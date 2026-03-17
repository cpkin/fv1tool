/**
 * FV-1 Interpreter
 * 
 * Sample-by-sample execution loop for FV-1 DSP programs.
 * Executes up to 128 instructions per audio sample at 32 kHz.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/arch.html
 */

import { INSTRUCTIONS_PER_SAMPLE, POT_UPDATE_BLOCK_SIZE, MAX_DELAY_RAM } from './constants';
import { createState, resetState } from './state';
import { getHandler } from './instructions';
import { normalizeOutput, normalizeInput, mapInputToADC } from './io';
import { quantizeToReg } from './fixedPoint';
import { updateLfoState } from './lfo';
import type { FV1State, CompiledProgram, PotValues } from './types';

// LFO state updates are delegated to fv1/lfo.ts for SpinCAD fidelity

/**
 * Options for program execution
 */
export interface ExecutionOptions {
  /**
   * Initial POT values (default: all 0.5)
   */
  initialPots?: Partial<PotValues>;
  
  /**
   * Callback invoked every 32 samples for POT updates
   * Return new POT values or undefined to keep current values
   */
  onPotUpdate?: (sampleIndex: number, state: FV1State) => Partial<PotValues> | void;
  
  /**
   * Whether to reset state before execution (default: true)
   */
  resetBeforeRun?: boolean;
  
  /**
   * Whether to normalize input (default: false)
   * Applies -6 dB gain reduction to prevent clipping
   */
  normalizeInput?: boolean;
  
  /**
   * Whether to normalize output (default: true)
   * Applies -1 dB gain reduction to match FV-1 output levels
   */
  normalizeOutput?: boolean;
}

/**
 * Result of program execution
 */
export interface ExecutionResult {
  /**
   * Output buffer for left channel
   */
  outputL: Float32Array;
  
  /**
   * Output buffer for right channel
   */
  outputR: Float32Array;
  
  /**
   * Final interpreter state after execution
   */
  finalState: FV1State;
}

/**
 * Executes a single sample through the FV-1 program
 * 
 * Steps through up to 128 instructions, updating state.
 * PACC is set to previous ACC value at the start of each sample.
 * 
 * @param state - Current interpreter state
 * @param program - Compiled program to execute
 * @param inputL - Left channel input sample
 * @param inputR - Right channel input sample
 */
function executeSample(
  state: FV1State,
  program: CompiledProgram,
  inputL: number,
  inputR: number
): void {
  // Update PACC with previous sample's ACC
  state.pacc = state.acc;
  state.acc = 0;

  // Clear DAC write flags for this sample
  state.dacLWritten = false;
  state.dacRWritten = false;

  // Map input samples to ADC registers based on IO mode
  const adc = mapInputToADC(inputL, inputR, state.ioMode, state.lr);
  state.adcL = quantizeToReg(adc.adcl);
  state.adcR = quantizeToReg(adc.adcr);
  
  // Execute up to 128 instructions
  const instructionCount = Math.min(program.instructions.length, INSTRUCTIONS_PER_SAMPLE);
  
  // Reset nextPc before instruction loop
  state.nextPc = null;
  
  for (let pc = 0; pc < instructionCount; ) {
    const instruction = program.instructions[pc];
    const handler = getHandler(instruction.opcode);

    // For SKP/RAW instruction, inject current PC as final operand
    const needsPc = instruction.opcode === 'skp'
      || instruction.opcode === 'raw'
      || instruction.opcode.startsWith('skp_');
    const operands = needsPc
      ? [...instruction.operands, pc]
      : instruction.operands;
    
    // Execute instruction (modifies state in place)
    handler(state, operands);
    
    // Check if instruction set nextPc (SKP/JMP control flow)
    if (state.nextPc !== null) {
      pc = state.nextPc;
      state.nextPc = null; // Clear for next instruction
    } else {
      pc++; // Normal sequential execution
    }
  }
  
  // After all instructions, output is in ACC
  // DAC outputs are set by WRAX/WRA instructions or default to ACC
  // For stereo processing, LR flag determines which DAC gets the output
  if (state.ioMode === 'mono_mono') {
    if (!state.dacLWritten) {
      state.dacL = state.acc;
    }
    if (!state.dacRWritten) {
      state.dacR = state.acc;
    }
  } else if (state.ioMode === 'mono_stereo') {
    if (state.lr === 0 && !state.dacLWritten) {
      state.dacL = state.acc;
    }
    if (state.lr === 1 && !state.dacRWritten) {
      state.dacR = state.acc;
    }
  } else {
    // stereo_stereo
    if (state.lr === 0 && !state.dacLWritten) {
      state.dacL = state.acc;
    }
    if (state.lr === 1 && !state.dacRWritten) {
      state.dacR = state.acc;
    }
  }
}

/**
 * Executes a complete FV-1 program over input audio buffers
 * 
 * Processes audio sample-by-sample, executing 128 instructions per sample.
 * Updates POT values every 32 samples via optional callback.
 * 
 * @param program - Compiled FV-1 program
 * @param inputL - Left channel input buffer
 * @param inputR - Right channel input buffer (for stereo programs)
 * @param options - Execution options
 * @returns Execution result with output buffers and final state
 */
export function executeProgram(
  program: CompiledProgram,
  inputL: Float32Array,
  inputR: Float32Array,
  options: ExecutionOptions = {}
): ExecutionResult {
  const {
    initialPots = {},
    onPotUpdate,
    resetBeforeRun = true,
    normalizeInput: shouldNormalizeInput = false,
    normalizeOutput: shouldNormalizeOutput = true,
  } = options;
  
  // Create or reset state
  const state = createState(program.ioMode, initialPots);
  
  if (!resetBeforeRun) {
    // If not resetting, caller is responsible for state management
    // This allows for stateful processing across multiple calls
  } else {
    resetState(state);
  }
  
  // Allocate output buffers
  const frameCount = inputL.length;
  const outputL = new Float32Array(frameCount);
  const outputR = new Float32Array(frameCount);
  
  // Process samples
  for (let sample = 0; sample < frameCount; sample++) {
    // Update POT values every 32 samples (block timing per FV-1 spec)
    if (sample % POT_UPDATE_BLOCK_SIZE === 0 && onPotUpdate) {
      const newPots = onPotUpdate(sample, state);
      if (newPots) {
        // Apply POT updates (clamped to [0, 1])
        if (newPots.pot0 !== undefined) {
          state.pots.pot0 = Math.max(0.0, Math.min(1.0, newPots.pot0));
        }
        if (newPots.pot1 !== undefined) {
          state.pots.pot1 = Math.max(0.0, Math.min(1.0, newPots.pot1));
        }
        if (newPots.pot2 !== undefined) {
          state.pots.pot2 = Math.max(0.0, Math.min(1.0, newPots.pot2));
        }
      }
    }
    
    // Normalize input if requested
    const inL = normalizeInput(inputL[sample], shouldNormalizeInput);
    const inR = normalizeInput(inputR[sample], shouldNormalizeInput);

    // Advance LFOs once per sample
    updateLfoState(state);
    
    // Toggle LR flag for stereo processing
    // In stereo modes, program runs twice per sample (once for L, once for R)
    if (program.ioMode !== 'mono_mono') {
      // Process left channel
      state.lr = 0;
      executeSample(state, program, inL, inR);
      outputL[sample] = shouldNormalizeOutput ? normalizeOutput(state.dacL) : state.dacL;
      
      // Process right channel
      state.lr = 1;
      executeSample(state, program, inL, inR);
      outputR[sample] = shouldNormalizeOutput ? normalizeOutput(state.dacR) : state.dacR;
    } else {
      // Mono mode: process once
      state.lr = 0;
      executeSample(state, program, inL, inR);
      outputL[sample] = shouldNormalizeOutput ? normalizeOutput(state.dacL) : state.dacL;
      outputR[sample] = shouldNormalizeOutput ? normalizeOutput(state.dacR) : state.dacR;
    }
    
    state.sampleCounter++;
    state.delayWritePtr = (state.delayWritePtr - 1 + MAX_DELAY_RAM) % MAX_DELAY_RAM;
  }
  
  return {
    outputL,
    outputR,
    finalState: state,
  };
}

/**
 * Alias for executeProgram with more descriptive name
 * 
 * @param program - Compiled FV-1 program
 * @param inputL - Left channel input buffer
 * @param inputR - Right channel input buffer
 * @param options - Execution options
 * @returns Execution result
 */
export function runProgram(
  program: CompiledProgram,
  inputL: Float32Array,
  inputR: Float32Array,
  options: ExecutionOptions = {}
): ExecutionResult {
  return executeProgram(program, inputL, inputR, options);
}

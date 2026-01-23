/**
 * FV-1 Interpreter Types
 * 
 * Type definitions for FV-1 DSP state and compiled instructions.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/arch.html
 */

/**
 * FV-1 IO mode configuration
 * 
 * Determines how input/output channels are routed:
 * - mono_mono: Single input, single output
 * - mono_stereo: Single input, stereo output (L/R)
 * - stereo_stereo: Stereo input, stereo output
 */
export type IOMode = 'mono_mono' | 'mono_stereo' | 'stereo_stereo';

/**
 * POT (potentiometer) values
 * 
 * Three POT inputs available to FV-1 programs, each in range [0.0, 1.0]
 */
export interface PotValues {
  pot0: number;
  pot1: number;
  pot2: number;
}

/**
 * FV-1 interpreter state
 * 
 * Maintains all architectural state for the FV-1 DSP:
 * - ACC: Accumulator (primary working register)
 * - PACC: Previous accumulator (ACC value from previous sample)
 * - LR: Left/Right flag for stereo processing
 * - Registers: 32 general-purpose registers (REG0-REG31)
 * - Delay RAM: 32768-sample delay memory (floating-point)
 * - POT values: Current potentiometer settings
 * - DAC outputs: Current left/right output values
 */
export interface FV1State {
  /**
   * Accumulator - primary working register
   * Range: [-1.0, +0.999999881] (S1.23 format)
   */
  acc: number;
  
  /**
   * Previous accumulator - holds ACC value from previous sample
   * Many instructions use PACC as an operand
   */
  pacc: number;
  
  /**
   * Left/Right flag
   * 0 = left channel processing
   * 1 = right channel processing
   */
  lr: number;
  
  /**
   * General-purpose registers (REG0-REG31)
   * Each register holds a value in S1.23 format
   */
  registers: Float32Array;
  
  /**
   * Delay RAM memory
   * 32768 samples of floating-point delay storage
   * 
   * Note: FV-1 delay RAM is floating-point with limited resolution.
   * For precision filters, use registers instead of delay memory.
   * Reference: http://spinsemi.com/knowledge_base/pgm_quick.html
   */
  delayRam: Float32Array;
  
  /**
   * Current delay RAM write pointer
   * Used by WRAP instruction to manage circular buffer
   */
  delayWritePtr: number;
  
  /**
   * POT (potentiometer) values
   * Updated every 32 samples
   */
  pots: PotValues;
  
  /**
   * DAC output for left channel
   */
  dacL: number;
  
  /**
   * DAC output for right channel
   */
  dacR: number;
  
  /**
   * IO mode configuration
   */
  ioMode: IOMode;
  
  /**
   * Current sample counter (for POT update timing)
   */
  sampleCounter: number;
  
  /**
   * LFO (Low-Frequency Oscillator) state
   * Used by CHO instruction family
   */
  lfo: {
    sin0: number;
    sin1: number;
    cos0: number;
    cos1: number;
    rmp0: number;
    rmp1: number;
  };
}

/**
 * Compiled FV-1 instruction
 * 
 * Represents a single instruction ready for execution by the interpreter.
 * This is the output of the compiler/assembler phase.
 */
export interface CompiledInstruction {
  /**
   * Opcode identifier (e.g., 'rdax', 'sof', 'wra')
   */
  opcode: string;
  
  /**
   * Operand values (parsed and resolved)
   * Format varies by instruction
   */
  operands: number[];
  
  /**
   * Source line number (for debugging)
   */
  line: number;
}

/**
 * FV-1 compiled program
 * 
 * A complete program ready for execution, consisting of up to 128 instructions
 */
export interface CompiledProgram {
  /**
   * Array of compiled instructions (up to 128)
   */
  instructions: CompiledInstruction[];
  
  /**
   * IO mode for this program
   */
  ioMode: IOMode;
  
  /**
   * Program metadata (optional)
   */
  metadata?: {
    name?: string;
    description?: string;
  };
}

/**
 * Instruction handler function type
 * 
 * Each opcode has a handler that executes the instruction's behavior
 */
export type InstructionHandler = (
  state: FV1State,
  operands: number[]
) => void;

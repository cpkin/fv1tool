/**
 * FV-1 State Management
 * 
 * Helpers for creating and resetting FV-1 interpreter state.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/arch.html
 */

import { NUM_REGISTERS, MAX_DELAY_RAM } from './constants';
import type { FV1State, IOMode, PotValues } from './types';

/**
 * Default POT values (all at midpoint)
 */
const DEFAULT_POTS: PotValues = {
  pot0: 0.5,
  pot1: 0.5,
  pot2: 0.5,
};

/**
 * Creates a new FV-1 interpreter state with deterministic defaults
 * 
 * All registers, ACC, PACC are initialized to zero.
 * Delay RAM is zeroed (silence).
 * POT values default to 0.5 (midpoint).
 * 
 * @param ioMode - IO mode configuration (default: 'stereo_stereo')
 * @param pots - Initial POT values (default: all 0.5)
 * @returns Initialized FV-1 state
 */
export function createState(
  ioMode: IOMode = 'stereo_stereo',
  pots: Partial<PotValues> = {},
  options: { choDepth?: number } = {}
): FV1State {
  return {
    acc: 0.0,
    pacc: 0.0,
    lr: 0,
    adcL: 0.0,
    adcR: 0.0,
    registers: new Float32Array(NUM_REGISTERS),
    delayRam: new Int32Array(MAX_DELAY_RAM),
    delayWritePtr: 0,
    delayLR: 0,
    pots: {
      ...DEFAULT_POTS,
      ...pots,
    },
    dacL: 0.0,
    dacR: 0.0,
    dacLWritten: false,
    dacRWritten: false,
    ioMode,
    choDepth: options.choDepth ?? 1,
    sampleCounter: 0,
    lfo: {
      sin0: 0.0,
      sin1: 0.0,
      rmp0: 0.0,
      rmp1: 0.0,
      sin0Out: 0,
      sin1Out: 0,
      rmp0Val: 0,
      rmp1Val: 0,
      rmp0Rptr2: 0,
      rmp1Rptr2: 0,
      rmp0Max: 0,
      rmp1Max: 0,
      sin0Int: 0,
      sin1Int: 0,
      sin0Cos: -0x7fff00,
      sin1Cos: -0x7fff00,
      rmp0Pos: 0,
      rmp1Pos: 0,
      rmp0Xfade: 0,
      rmp1Xfade: 0,
      rmp0XfadeVal: 0,
      rmp1XfadeVal: 0,
      sin0Phase: 0.0,
      sin1Phase: 0.0,
      rmp0Phase: 0.0,
      rmp1Phase: 0.0,
      sin0Rate: 0.0,
      sin1Rate: 0.0,
      rmp0Rate: 0.0,
      rmp1Rate: 0.0,
      sin0Amp: 0.0,
      sin1Amp: 0.0,
      rmp0Amp: 0.0,
      rmp1Amp: 0.0,
    },
    nextPc: null,
  };
}

/**
 * Resets an existing FV-1 state to initial values
 * 
 * Preserves IO mode and POT configuration, but resets:
 * - All registers to zero
 * - ACC and PACC to zero
 * - Delay RAM to zero (silence)
 * - LFO state to zero
 * - Sample counter to zero
 * - DAC outputs to zero
 * 
 * This ensures deterministic output across multiple runs with the same input.
 * 
 * @param state - State to reset
 */
export function resetState(state: FV1State): void {
  state.acc = 0.0;
  state.pacc = 0.0;
  state.lr = 0;
  state.adcL = 0.0;
  state.adcR = 0.0;
  
  // Clear registers
  state.registers.fill(0.0);
  
  // Clear delay RAM
  state.delayRam.fill(0);
  state.delayWritePtr = 0;
  state.delayLR = 0;
  
  // Reset DAC outputs
  state.dacL = 0.0;
  state.dacR = 0.0;
  state.dacLWritten = false;
  state.dacRWritten = false;
  
  // Reset sample counter
  state.sampleCounter = 0;
  
  // Reset LFO state
  state.lfo.sin0 = 0.0;
  state.lfo.sin1 = 0.0;
  state.lfo.rmp0 = 0.0;
  state.lfo.rmp1 = 0.0;
  state.lfo.sin0Out = 0;
  state.lfo.sin1Out = 0;
  state.lfo.rmp0Val = 0;
  state.lfo.rmp1Val = 0;
  state.lfo.rmp0Rptr2 = 0;
  state.lfo.rmp1Rptr2 = 0;
  state.lfo.rmp0Max = 0;
  state.lfo.rmp1Max = 0;
  state.lfo.sin0Int = 0;
  state.lfo.sin1Int = 0;
  state.lfo.sin0Cos = -0x7fff00;
  state.lfo.sin1Cos = -0x7fff00;
  state.lfo.rmp0Pos = 0;
  state.lfo.rmp1Pos = 0;
  state.lfo.rmp0Xfade = 0;
  state.lfo.rmp1Xfade = 0;
  state.lfo.rmp0XfadeVal = 0;
  state.lfo.rmp1XfadeVal = 0;
  state.lfo.sin0Phase = 0.0;
  state.lfo.sin1Phase = 0.0;
  state.lfo.rmp0Phase = 0.0;
  state.lfo.rmp1Phase = 0.0;
  state.lfo.sin0Rate = 0.0;
  state.lfo.sin1Rate = 0.0;
  state.lfo.rmp0Rate = 0.0;
  state.lfo.rmp1Rate = 0.0;
  state.lfo.sin0Amp = 0.0;
  state.lfo.sin1Amp = 0.0;
  state.lfo.rmp0Amp = 0.0;
  state.lfo.rmp1Amp = 0.0;
  
  // Reset control flow
  state.nextPc = null;
  
  // POT values are preserved (user control)
  // IO mode is preserved (program configuration)
}

/**
 * Updates POT values in the state
 * 
 * POT values should be in the range [0.0, 1.0].
 * Values outside this range will be clamped.
 * 
 * @param state - State to update
 * @param pots - New POT values
 */
export function updatePots(state: FV1State, pots: Partial<PotValues>): void {
  if (pots.pot0 !== undefined) {
    state.pots.pot0 = Math.max(0.0, Math.min(1.0, pots.pot0));
  }
  if (pots.pot1 !== undefined) {
    state.pots.pot1 = Math.max(0.0, Math.min(1.0, pots.pot1));
  }
  if (pots.pot2 !== undefined) {
    state.pots.pot2 = Math.max(0.0, Math.min(1.0, pots.pot2));
  }
}

/**
 * Validates that POT values are in valid range [0.0, 1.0]
 * 
 * @param pots - POT values to validate
 * @returns True if all POT values are valid
 */
export function validatePots(pots: PotValues): boolean {
  return (
    pots.pot0 >= 0.0 && pots.pot0 <= 1.0 &&
    pots.pot1 >= 0.0 && pots.pot1 <= 1.0 &&
    pots.pot2 >= 0.0 && pots.pot2 <= 1.0
  );
}

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
  pots: Partial<PotValues> = {}
): FV1State {
  return {
    acc: 0.0,
    pacc: 0.0,
    lr: 0,
    registers: new Float32Array(NUM_REGISTERS),
    delayRam: new Float32Array(MAX_DELAY_RAM),
    delayWritePtr: 0,
    pots: {
      ...DEFAULT_POTS,
      ...pots,
    },
    dacL: 0.0,
    dacR: 0.0,
    ioMode,
    sampleCounter: 0,
    lfo: {
      sin0: 0.0,
      sin1: 0.0,
      cos0: 0.0,
      cos1: 0.0,
      rmp0: 0.0,
      rmp1: 0.0,
    },
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
  
  // Clear registers
  state.registers.fill(0.0);
  
  // Clear delay RAM
  state.delayRam.fill(0.0);
  state.delayWritePtr = 0;
  
  // Reset DAC outputs
  state.dacL = 0.0;
  state.dacR = 0.0;
  
  // Reset sample counter
  state.sampleCounter = 0;
  
  // Reset LFO state
  state.lfo.sin0 = 0.0;
  state.lfo.sin1 = 0.0;
  state.lfo.cos0 = 0.0;
  state.lfo.cos1 = 0.0;
  state.lfo.rmp0 = 0.0;
  state.lfo.rmp1 = 0.0;
  
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

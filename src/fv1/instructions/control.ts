/**
 * FV-1 Control Flow Instruction Handlers
 * 
 * Implements handlers for control flow opcodes:
 * - SKP: Skip instructions based on condition flags
 * - JMP: Jump to address (alias for SKP with unconditional flag)
 * - NOP: No operation
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html
 */

import type { InstructionHandler, FV1State } from '../types';

/**
 * SKP: Skip instructions conditionally
 * 
 * Skips N instructions based on condition flags:
 * - RUN: Always run (skip 0)
 * - ZRO: Skip if ACC == 0
 * - GEZ: Skip if ACC >= 0
 * - NEG: Skip if ACC < 0
 * - ZRC: Skip on zero-crossing
 * 
 * SKP affects program counter by setting state.nextPc.
 * The interpreter loop checks nextPc and jumps accordingly.
 * 
 * Operands:
 * - operands[0]: Condition flags (bitfield)
 * - operands[1]: Number of instructions to skip (0-63)
 * - operands[2]: Current PC (injected by interpreter)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#SKP
 */
export const skp: InstructionHandler = (state: FV1State, operands: number[]) => {
  const flags = operands[0];
  const skipCount = operands[1];
  const currentPc = operands[2] || 0;
  
  // Condition flag bits:
  // 0x01 = RUN (always execute, never skip)
  // 0x02 = ZRO (skip if ACC == 0)
  // 0x04 = GEZ (skip if ACC >= 0)
  // 0x08 = NEG (skip if ACC < 0)
  // 0x10 = ZRC (skip on zero-crossing)
  
  let shouldSkip = false;

  if (flags === 0) {
    shouldSkip = true;
  }
  
  // RUN flag - skip after first sample
  if (flags & 0x01) {
    shouldSkip = shouldSkip || state.sampleCounter > 0;
  }
  
  // ZRO flag - skip if ACC == 0
  if (flags & 0x02) {
    shouldSkip = shouldSkip || (state.acc === 0.0);
  }
  
  // GEZ flag - skip if ACC >= 0
  if (flags & 0x04) {
    shouldSkip = shouldSkip || (state.acc >= 0.0);
  }
  
  // NEG flag - skip if ACC < 0
  if (flags & 0x08) {
    shouldSkip = shouldSkip || (state.acc < 0.0);
  }
  
  // ZRC flag - skip on zero-crossing (ACC and PACC have different signs)
  if (flags & 0x10) {
    const crossedZero = (state.acc >= 0) !== (state.pacc >= 0);
    shouldSkip = shouldSkip || crossedZero;
  }
  
  // Set nextPc if condition is met
  if (shouldSkip) {
    // Skip forward by skipCount instructions
    state.nextPc = currentPc + skipCount + 1;
  }
};

/**
 * JMP: Jump to address (unconditional)
 * 
 * JMP is implemented as an unconditional jump to a target address.
 * The compiler resolves label to instruction address.
 * 
 * Operands:
 * - operands[0]: Target address (0-127)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#JMP
 */
export const jmp: InstructionHandler = (state: FV1State, operands: number[]) => {
  const targetAddress = operands[0];
  
  // Unconditional jump - set nextPc to target
  state.nextPc = targetAddress;
};

/**
 * NOP: No operation
 * 
 * Does nothing. Used for alignment and as a placeholder.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#NOP
 */
export const nop: InstructionHandler = (_state: FV1State, _operands: number[]) => {
  // No operation
};

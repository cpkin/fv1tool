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
 * Note: SKP affects program counter, which requires special handling
 * in the interpreter loop. For now, we store the skip count in a
 * special state field that the interpreter will check.
 * 
 * Operands:
 * - operands[0]: Condition flags (bitfield)
 * - operands[1]: Number of instructions to skip (0-63)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#SKP
 */
export const skp: InstructionHandler = (state: FV1State, operands: number[]) => {
  const flags = operands[0];
  // Skip count is operands[1], but handled by interpreter loop
  
  // Condition flag bits:
  // 0x01 = RUN (always execute)
  // 0x02 = ZRO (skip if ACC == 0)
  // 0x04 = GEZ (skip if ACC >= 0)
  // 0x08 = NEG (skip if ACC < 0)
  // 0x10 = ZRC (skip on zero-crossing)
  
  let shouldSkip = false;
  
  // RUN flag - always run (never skip)
  if (flags & 0x01) {
    shouldSkip = false;
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
  
  // Store skip count if condition is met
  // The interpreter loop will need to check this and advance PC accordingly
  if (shouldSkip) {
    // Note: This requires adding a skipCount field to FV1State
    // For now, we'll handle this differently - SKP must be handled
    // specially in the interpreter loop, not here
    // TODO: Refactor interpreter to handle SKP properly
  }
  
  // For now, SKP is a no-op at the handler level
  // The interpreter must check condition flags and skip instructions
};

/**
 * JMP: Jump to address (unconditional)
 * 
 * JMP is implemented as SKP with RUN flag and skip count.
 * 
 * Operands:
 * - operands[0]: Target address (0-127)
 * 
 * Note: Like SKP, JMP requires special handling in the interpreter loop.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#JMP
 */
export const jmp: InstructionHandler = (_state: FV1State, _operands: number[]) => {
  // JMP is handled specially by the interpreter
  // The compiler should convert JMP to SKP with appropriate flags
  // This handler is a no-op
  
  // Note: The interpreter must check for JMP and set PC directly
  // TODO: Refactor interpreter to handle JMP properly
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

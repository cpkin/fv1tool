/**
 * FV-1 Arithmetic Instruction Handlers
 * 
 * Implements handlers for arithmetic/logic opcodes:
 * - RDAX: Read register and multiply with ACC
 * - RDFX: Read register, subtract from ACC (for filters)
 * - LDAX: Load register directly (no ACC multiply)
 * - WRAX: Write ACC to register with optional clear
 * - WRHX: Write ACC to register, high-pass filter
 * - WRLX: Write ACC to register, low-pass filter
 * - MAXX: Maximum of ACC and register
 * - ABSA: Absolute value of ACC
 * - MULX: Multiply ACC by register
 * - SOF: Scale and offset ACC
 * - LOG: Logarithmic conversion (right-shifted by 4 bits)
 * - EXP: Exponential conversion
 * - AND/OR/XOR/NOT: Bitwise logic operations
 * - CLR: Clear ACC
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html
 */

import type { InstructionHandler, FV1State } from '../types';
import { saturatingAdd, saturatingMul, saturate, clampRDAXCoeff, applyLogShift } from '../fixedPoint';

/**
 * RDAX: Read register and multiply, add to ACC
 * 
 * ACC = ACC + (REGx * coefficient)
 * 
 * Operands:
 * - operands[0]: Register index (0-31)
 * - operands[1]: Coefficient [-2.0, +1.9999389]
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#RDAX
 */
export const rdax: InstructionHandler = (state: FV1State, operands: number[]) => {
  const regIndex = operands[0];
  const coeff = clampRDAXCoeff(operands[1]);
  
  const regValue = state.registers[regIndex];
  const product = saturatingMul(regValue, coeff);
  state.acc = saturatingAdd(state.acc, product);
};

/**
 * RDFX: Read register, multiply, and subtract from ACC (for filters)
 * 
 * ACC = (REGx * coefficient) - ACC
 * 
 * Commonly used for biquad filters where feedback coefficient needs inversion.
 * 
 * Operands:
 * - operands[0]: Register index (0-31)
 * - operands[1]: Coefficient [-2.0, +1.9999389]
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#RDFX
 */
export const rdfx: InstructionHandler = (state: FV1State, operands: number[]) => {
  const regIndex = operands[0];
  const coeff = clampRDAXCoeff(operands[1]);
  
  const regValue = state.registers[regIndex];
  const product = saturatingMul(regValue, coeff);
  state.acc = saturate(product - state.acc);
};

/**
 * LDAX: Load register directly into ACC (no multiply)
 * 
 * ACC = REGx
 * 
 * Operands:
 * - operands[0]: Register index (0-31)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#LDAX
 */
export const ldax: InstructionHandler = (state: FV1State, operands: number[]) => {
  const regIndex = operands[0];
  state.acc = state.registers[regIndex];
};

/**
 * WRAX: Write ACC to register, with optional multiply and add
 * 
 * REGx = ACC
 * ACC = ACC * coefficient
 * 
 * Operands:
 * - operands[0]: Register index (0-31)
 * - operands[1]: Coefficient [-2.0, +1.9999389] (default 0.0)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#WRAX
 */
export const wrax: InstructionHandler = (state: FV1State, operands: number[]) => {
  const regIndex = operands[0];
  const coeff = operands.length > 1 ? clampRDAXCoeff(operands[1]) : 0.0;
  
  state.registers[regIndex] = state.acc;
  state.acc = saturatingMul(state.acc, coeff);
};

/**
 * WRHX: Write ACC to register, high-pass filter
 * 
 * REGx = ACC - REGx
 * ACC = REGx
 * 
 * Implements a simple high-pass filter by subtracting previous value.
 * 
 * Operands:
 * - operands[0]: Register index (0-31)
 * - operands[1]: Coefficient [-2.0, +1.9999389]
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#WRHX
 */
export const wrhx: InstructionHandler = (state: FV1State, operands: number[]) => {
  const regIndex = operands[0];
  const coeff = clampRDAXCoeff(operands[1]);
  
  const diff = saturate(state.acc - state.registers[regIndex]);
  state.registers[regIndex] = diff;
  state.acc = saturatingMul(diff, coeff);
};

/**
 * WRLX: Write ACC to register, low-pass filter
 * 
 * REGx = ACC
 * ACC = ACC - REGx (before update)
 * 
 * Implements a simple low-pass filter by computing difference.
 * 
 * Operands:
 * - operands[0]: Register index (0-31)
 * - operands[1]: Coefficient [-2.0, +1.9999389]
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#WRLX
 */
export const wrlx: InstructionHandler = (state: FV1State, operands: number[]) => {
  const regIndex = operands[0];
  const coeff = clampRDAXCoeff(operands[1]);
  
  const oldReg = state.registers[regIndex];
  state.registers[regIndex] = state.acc;
  const diff = saturate(state.acc - oldReg);
  state.acc = saturatingMul(diff, coeff);
};

/**
 * MAXX: Maximum of ACC and register
 * 
 * ACC = max(ACC, REGx * coefficient)
 * 
 * Operands:
 * - operands[0]: Register index (0-31)
 * - operands[1]: Coefficient [-2.0, +1.9999389]
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#MAXX
 */
export const maxx: InstructionHandler = (state: FV1State, operands: number[]) => {
  const regIndex = operands[0];
  const coeff = clampRDAXCoeff(operands[1]);
  
  const regValue = saturatingMul(state.registers[regIndex], coeff);
  state.acc = Math.max(state.acc, regValue);
};

/**
 * ABSA: Absolute value of ACC
 * 
 * ACC = |ACC|
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#ABSA
 */
export const absa: InstructionHandler = (state: FV1State, _operands: number[]) => {
  state.acc = Math.abs(state.acc);
};

/**
 * MULX: Multiply ACC by register
 * 
 * ACC = ACC * REGx
 * 
 * Operands:
 * - operands[0]: Register index (0-31)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#MULX
 */
export const mulx: InstructionHandler = (state: FV1State, operands: number[]) => {
  const regIndex = operands[0];
  state.acc = saturatingMul(state.acc, state.registers[regIndex]);
};

/**
 * SOF: Scale and offset
 * 
 * ACC = (ACC * coefficient) + offset
 * 
 * Operands:
 * - operands[0]: Coefficient [-2.0, +1.9999389]
 * - operands[1]: Offset [-1.0, +0.999999881]
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#SOF
 */
export const sof: InstructionHandler = (state: FV1State, operands: number[]) => {
  const coeff = clampRDAXCoeff(operands[0]);
  const offset = operands[1];
  
  const scaled = saturatingMul(state.acc, coeff);
  state.acc = saturatingAdd(scaled, offset);
};

/**
 * LOG: Logarithmic conversion
 * 
 * ACC = log2(|ACC|) << -4
 * 
 * Output is right-shifted by 4 bits (divided by 16) per FV-1 specification.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#LOG
 */
export const log: InstructionHandler = (state: FV1State, operands: number[]) => {
  const coeff = clampRDAXCoeff(operands[0]);
  const offset = operands[1];
  
  const absValue = Math.abs(state.acc);
  
  // Avoid log(0) - clamp to small value
  const safeValue = Math.max(absValue, 1e-10);
  
  // Compute log2 and apply LOG shift (right-shift by 4 bits)
  const logValue = Math.log2(safeValue);
  const shifted = applyLogShift(logValue);
  
  // Scale and offset
  const scaled = saturatingMul(shifted, coeff);
  state.acc = saturatingAdd(scaled, offset);
};

/**
 * EXP: Exponential conversion
 * 
 * ACC = 2^(ACC << 4)
 * 
 * Input is expected to be right-shifted by 4 bits (paired with LOG).
 * 
 * Operands:
 * - operands[0]: Coefficient [-2.0, +1.9999389]
 * - operands[1]: Offset [-1.0, +0.999999881]
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#EXP
 */
export const exp: InstructionHandler = (state: FV1State, operands: number[]) => {
  const coeff = clampRDAXCoeff(operands[0]);
  const offset = operands[1];
  
  // Scale and offset input
  const scaled = saturatingMul(state.acc, coeff);
  const adjusted = saturatingAdd(scaled, offset);
  
  // Apply EXP shift (left-shift by 4 bits) and compute 2^x
  const expValue = Math.pow(2, adjusted * 16); // *16 = left-shift by 4 bits
  state.acc = saturate(expValue);
};

/**
 * AND: Bitwise AND
 * 
 * ACC = ACC & mask
 * 
 * Operands:
 * - operands[0]: Mask value (24-bit)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#AND
 */
export const and: InstructionHandler = (state: FV1State, operands: number[]) => {
  const mask = operands[0];
  
  // Convert to fixed-point, apply bitwise AND, convert back
  const accInt = Math.trunc(state.acc * (1 << 23));
  const maskInt = Math.trunc(mask * (1 << 23));
  const result = (accInt & maskInt) / (1 << 23);
  
  state.acc = saturate(result);
};

/**
 * OR: Bitwise OR
 * 
 * ACC = ACC | mask
 * 
 * Operands:
 * - operands[0]: Mask value (24-bit)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#OR
 */
export const or: InstructionHandler = (state: FV1State, operands: number[]) => {
  const mask = operands[0];
  
  // Convert to fixed-point, apply bitwise OR, convert back
  const accInt = Math.trunc(state.acc * (1 << 23));
  const maskInt = Math.trunc(mask * (1 << 23));
  const result = (accInt | maskInt) / (1 << 23);
  
  state.acc = saturate(result);
};

/**
 * XOR: Bitwise XOR
 * 
 * ACC = ACC ^ mask
 * 
 * Operands:
 * - operands[0]: Mask value (24-bit)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#XOR
 */
export const xor: InstructionHandler = (state: FV1State, operands: number[]) => {
  const mask = operands[0];
  
  // Convert to fixed-point, apply bitwise XOR, convert back
  const accInt = Math.trunc(state.acc * (1 << 23));
  const maskInt = Math.trunc(mask * (1 << 23));
  const result = (accInt ^ maskInt) / (1 << 23);
  
  state.acc = saturate(result);
};

/**
 * NOT: Bitwise NOT
 * 
 * ACC = ~ACC
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#NOT
 */
export const not: InstructionHandler = (state: FV1State, _operands: number[]) => {
  // Convert to fixed-point, apply bitwise NOT, convert back
  const accInt = Math.trunc(state.acc * (1 << 23));
  const result = (~accInt & 0xFFFFFF) / (1 << 23); // Mask to 24 bits
  
  state.acc = saturate(result);
};

/**
 * CLR: Clear ACC
 * 
 * ACC = 0
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#CLR
 */
export const clr: InstructionHandler = (state: FV1State, _operands: number[]) => {
  state.acc = 0.0;
};

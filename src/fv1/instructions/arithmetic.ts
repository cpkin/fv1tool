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
import {
  saturatingAdd,
  saturatingMul,
  saturate,
  clampRDAXCoeff,
  applyLogShift,
  floatToFixed,
  fixedToFloat,
  signExtend24,
  quantizeToReg,
} from '../fixedPoint';

/**
 * Special register indices for ADC/DAC/LFO/POT access
 * These virtual registers allow instructions like LDAX to read input samples and pot values
 */
const SPECIAL_REGISTERS = {
  ADCL: 32,  // Current left input sample (mapped from inputL based on IO mode)
  ADCR: 33,  // Current right input sample (mapped from inputR based on IO mode)
  DACL: 34,  // Current left output
  DACR: 35,  // Current right output
  SIN0: 36,  // LFO sine wave 0
  SIN1: 37,  // LFO sine wave 1
  RMP0: 38,  // LFO ramp wave 0
  RMP1: 39,  // LFO ramp wave 1
  POT0: 40,  // POT0 knob value (0.0-1.0)
  POT1: 41,  // POT1 knob value (0.0-1.0)
  POT2: 42,  // POT2 knob value (0.0-1.0)
};

function resolveMask(mask: number): number {
  if (Number.isInteger(mask) && Math.abs(mask) > 2) {
    return Math.trunc(mask);
  }
  if (Math.abs(mask) > 2) {
    return Math.trunc(mask);
  }
  return floatToFixed(mask);
}

/**
 * Gets register value, handling both general-purpose and special registers
 * 
 * Special registers provide access to ADC inputs, DAC outputs, and LFO values.
 * ADC values are updated per-sample before the instruction loop.
 */
function getRegisterValue(state: FV1State, regIndex: number): number {
  if (regIndex >= 0 && regIndex < state.registers.length) {
    return state.registers[regIndex];
  }

  switch (regIndex) {
    case SPECIAL_REGISTERS.ADCL:
      return state.adcL;  // Current left input sample
    case SPECIAL_REGISTERS.ADCR:
      return state.adcR;  // Current right input sample
    case SPECIAL_REGISTERS.DACL:
      return state.dacL;
    case SPECIAL_REGISTERS.DACR:
      return state.dacR;
    case SPECIAL_REGISTERS.SIN0:
      return fixedToFloat(state.lfo.sin0Out);
    case SPECIAL_REGISTERS.SIN1:
      return fixedToFloat(state.lfo.sin1Out);
    case SPECIAL_REGISTERS.RMP0:
      return fixedToFloat(state.lfo.rmp0Val);
    case SPECIAL_REGISTERS.RMP1:
      return fixedToFloat(state.lfo.rmp1Val);
    case SPECIAL_REGISTERS.POT0:
      return state.pots.pot0;  // POT values are 0.0-1.0
    case SPECIAL_REGISTERS.POT1:
      return state.pots.pot1;
    case SPECIAL_REGISTERS.POT2:
      return state.pots.pot2;
    default:
      return 0.0;
  }
}

function setRegisterValue(state: FV1State, regIndex: number, value: number): void {
  if (regIndex >= 0 && regIndex < state.registers.length) {
    state.registers[regIndex] = quantizeToReg(value);
    return;
  }

  switch (regIndex) {
    case SPECIAL_REGISTERS.DACL:
      state.dacL = quantizeToReg(value);
      state.dacLWritten = true;
      break;
    case SPECIAL_REGISTERS.DACR:
      state.dacR = quantizeToReg(value);
      state.dacRWritten = true;
      break;
    default:
      break;
  }
}

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
  
  const regValue = getRegisterValue(state, regIndex);
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
  
  const regValue = getRegisterValue(state, regIndex);
  const product = saturatingMul(regValue, coeff);
  state.acc = saturate(product - state.acc);
};

/**
 * LDAX: Load register directly into ACC (no multiply)
 * 
 * ACC = REGx
 * 
 * Supports both general-purpose registers (0-31) and special registers:
 * - ADCL (32): Current left input sample
 * - ADCR (33): Current right input sample
 * - DACL (34): Current left output
 * - DACR (35): Current right output
 * - SIN0/SIN1/RMP0/RMP1 (36-39): LFO values
 * 
 * Operands:
 * - operands[0]: Register index (0-39)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#LDAX
 */
export const ldax: InstructionHandler = (state: FV1State, operands: number[]) => {
  const regIndex = operands[0];
  state.acc = getRegisterValue(state, regIndex);
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
  
  setRegisterValue(state, regIndex, state.acc);
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
  
  const regValue = getRegisterValue(state, regIndex);
  const diff = saturate(state.acc - regValue);
  setRegisterValue(state, regIndex, diff);
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
  
  const oldReg = getRegisterValue(state, regIndex);
  setRegisterValue(state, regIndex, state.acc);
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
  
  const regValue = saturatingMul(getRegisterValue(state, regIndex), coeff);
  state.acc = quantizeToReg(Math.max(state.acc, regValue));
};

/**
 * ABSA: Absolute value of ACC
 * 
 * ACC = |ACC|
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#ABSA
 */
export const absa: InstructionHandler = (state: FV1State, _operands: number[]) => {
  state.acc = quantizeToReg(Math.abs(state.acc));
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
  state.acc = saturatingMul(state.acc, getRegisterValue(state, regIndex));
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
  const logValue = absValue === 0 ? 1.0 : applyLogShift(Math.log2(absValue));
  state.acc = quantizeToReg((logValue * coeff) + offset);
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
  const acc = state.acc;
  if (acc >= 0) {
    state.acc = quantizeToReg((0.9999998807907104 * coeff) + offset);
    return;
  }
  const expValue = Math.pow(2, acc * 16);
  state.acc = quantizeToReg((expValue * coeff) + offset);
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
  const accInt = floatToFixed(state.acc);
  const maskInt = resolveMask(mask);
  const result = signExtend24(accInt & maskInt);
  state.acc = fixedToFloat(result);
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
  const accInt = floatToFixed(state.acc);
  const maskInt = resolveMask(mask);
  const result = signExtend24(accInt | maskInt);
  state.acc = fixedToFloat(result);
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
  const accInt = floatToFixed(state.acc);
  const maskInt = resolveMask(mask);
  const result = signExtend24(accInt ^ maskInt);
  state.acc = fixedToFloat(result);
};

/**
 * NOT: Bitwise NOT
 * 
 * ACC = ~ACC
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#NOT
 */
export const not: InstructionHandler = (state: FV1State, _operands: number[]) => {
  const accInt = floatToFixed(state.acc);
  const result = signExtend24(~accInt);
  state.acc = fixedToFloat(result);
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

/**
 * FV-1 Delay Memory Instruction Handlers
 * 
 * Implements handlers for delay memory read/write opcodes:
 * - RDA: Read delay RAM and multiply, add to ACC
 * - RMPA: Read delay RAM with LFO modulation
 * - WRA: Write ACC to delay RAM
 * - WRAP: Write ACC to delay RAM and increment write pointer
 * 
 * Note: FV-1 delay RAM is floating-point with limited resolution.
 * For precision filters, use register-based instructions instead.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html
 */

import type { InstructionHandler, FV1State } from '../types';
import {
  saturatingAdd,
  saturatingMul,
  clampRDACoeff,
  floatToFixed,
  fixedToFloat,
} from '../fixedPoint';
import { MAX_DELAY_RAM } from '../constants';

function resolveDelayAddress(state: FV1State, address: number): number {
  const pointerRelative = address >= MAX_DELAY_RAM;
  const base = pointerRelative ? address - MAX_DELAY_RAM : address;
  const resolved = pointerRelative ? base + state.delayWritePtr : base;
  return ((resolved % MAX_DELAY_RAM) + MAX_DELAY_RAM) % MAX_DELAY_RAM;
}

const POWER_LOOKUP = Array.from({ length: 16 }, (_, index) => Math.pow(2, index - 8));

function compressDelaySample(value: number): number {
  const fixed = floatToFixed(value);
  let magnitude = fixed & 0x7fffff;
  if (magnitude === 0) return 0;
  if (fixed < 0) {
    magnitude = (~magnitude + 1) & 0x7fffff;
  }
  let exponent = -8;
  let mask = 512;
  while (mask < 0x800000) {
    if (mask > magnitude) break;
    exponent += 1;
    mask <<= 1;
  }
  const mantissa = magnitude >> (exponent + 8);
  let packed = ((exponent & 0x0f) << 9) | (mantissa & 0x1ff);
  if (fixed < 0) {
    packed |= 0x2000;
  }
  return packed;
}

function decompressDelaySample(packed: number): number {
  let exponent = (packed >> 9) & 0x0f;
  if ((exponent & 0x08) !== 0) {
    exponent = (exponent & 0x07) - 8;
  }
  const value = Math.trunc(POWER_LOOKUP[exponent + 8] * 256 * (packed & 0x1ff));
  const signed = (packed & 0x2000) !== 0 ? (~value + 1) : value;
  return fixedToFloat(signed);
}


/**
 * RDA: Read from delay RAM, multiply, and add to ACC
 * 
 * ACC = ACC + (DELAY[address] * coefficient)
 * 
 * Operands:
 * - operands[0]: Delay RAM address (0-32767)
 * - operands[1]: Coefficient [-2.0, +1.998]
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#RDA
 */
export const rda: InstructionHandler = (state: FV1State, operands: number[]) => {
  const address = Math.trunc(operands[0]);
  const coeff = clampRDACoeff(operands[1]);
  const resolved = resolveDelayAddress(state, address);
  const delayValue = decompressDelaySample(Math.trunc(state.delayRam[resolved]));
  state.delayLR = delayValue;
  const product = saturatingMul(delayValue, coeff);
  state.acc = saturatingAdd(state.acc, product);
};

/**
 * RMPA: Read from delay RAM with LFO-modulated address
 * 
 * ACC = ACC + (DELAY[address + LFO_offset] * coefficient)
 * 
 * Used for chorus and modulated delay effects.
 * 
 * Operands:
 * - operands[0]: Coefficient [-2.0, +1.998]
 * 
 * Note: LFO offset comes from CHO instruction state.
 * For now, we'll implement without LFO modulation (base implementation).
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#RMPA
 */
export const rmpa: InstructionHandler = (state: FV1State, operands: number[]) => {
  const coeff = clampRDACoeff(operands[0]);

  const addrPtr = state.registers[24] ?? 0;
  const addrPtrInt = floatToFixed(addrPtr as number);
  const address = (addrPtrInt >> 8) + MAX_DELAY_RAM;
  const resolved = resolveDelayAddress(state, address);
  const delayValue = decompressDelaySample(Math.trunc(state.delayRam[resolved]));
  state.delayLR = delayValue;
  const product = saturatingMul(delayValue, coeff);
  state.acc = saturatingAdd(state.acc, product);
};

/**
 * WRA: Write ACC to delay RAM at specified address
 * 
 * DELAY[address] = ACC
 * ACC = ACC * coefficient
 * 
 * Operands:
 * - operands[0]: Delay RAM address (0-32767)
 * - operands[1]: Coefficient [-2.0, +1.9999389] (default 0.0)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#WRA
 */
export const wra: InstructionHandler = (state: FV1State, operands: number[]) => {
  const address = Math.trunc(operands[0]);
  const coeff = operands.length > 1 ? operands[1] : 0.0;
  const resolved = resolveDelayAddress(state, address);
  state.delayRam[resolved] = compressDelaySample(state.acc);
  state.acc = saturatingMul(state.acc, coeff);
};

/**
 * WRAP: Write ACC to delay RAM and advance write pointer
 * 
 * DELAY[writePtr] = (ACC * coefficient) + DELAY[address]
 * writePtr = (writePtr + 1) % MAX_DELAY_RAM
 * 
 * Used for all-pass filters and circular delay buffers.
 * 
 * Operands:
 * - operands[0]: Delay RAM address (0-32767)
 * - operands[1]: Coefficient [-2.0, +1.998]
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#WRAP
 */
export const wrap: InstructionHandler = (state: FV1State, operands: number[]) => {
  const coeff = clampRDACoeff(operands[1]);
  
  // Write ACC to delay and use LR for allpass feedback
  const product = saturatingMul(state.acc, coeff);
  const sum = saturatingAdd(product, state.delayLR);
  state.delayRam[state.delayWritePtr] = compressDelaySample(state.acc);
  
  // ACC is set to the written value
  state.acc = sum;
};

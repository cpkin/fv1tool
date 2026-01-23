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
import { saturatingAdd, saturatingMul, clampRDACoeff } from '../fixedPoint';
import { MAX_DELAY_RAM } from '../constants';

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
  const address = Math.trunc(operands[0]) % MAX_DELAY_RAM;
  const coeff = clampRDACoeff(operands[1]);
  
  const delayValue = state.delayRam[address];
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
  
  // TODO: Implement LFO modulation when CHO instruction is complete
  // For now, read from current write pointer position (unmodulated)
  const address = state.delayWritePtr % MAX_DELAY_RAM;
  const delayValue = state.delayRam[address];
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
  const address = Math.trunc(operands[0]) % MAX_DELAY_RAM;
  const coeff = operands.length > 1 ? operands[1] : 0.0;
  
  state.delayRam[address] = state.acc;
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
  const address = Math.trunc(operands[0]) % MAX_DELAY_RAM;
  const coeff = clampRDACoeff(operands[1]);
  
  // Read from specified address
  const delayValue = state.delayRam[address];
  
  // Write (ACC * coeff + delayValue) to current write pointer
  const product = saturatingMul(state.acc, coeff);
  const sum = saturatingAdd(product, delayValue);
  state.delayRam[state.delayWritePtr] = sum;
  
  // Advance write pointer (circular buffer)
  state.delayWritePtr = (state.delayWritePtr + 1) % MAX_DELAY_RAM;
  
  // ACC is set to the written value
  state.acc = sum;
};

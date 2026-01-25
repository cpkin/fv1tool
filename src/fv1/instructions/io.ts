/**
 * FV-1 IO and LFO Instruction Handlers
 * 
 * Implements handlers for IO and LFO opcodes:
 * - WLDS: Write LFO sine frequency
 * - WLDR: Write LFO ramp frequency
 * - JAM: Reset LFO ramp
 * - CHO: Chorus/LFO operations
 * - RAW: Raw instruction pass-through
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html
 */

import type { InstructionHandler, FV1State, RawDecodedInstruction } from '../types';
import { saturatingAdd, saturatingMul, clampRDAXCoeff, fixedToFloat } from '../fixedPoint';
import { warnUnsupportedRaw } from '../warnings';
import { instructionHandlers } from './index';
import {
  LFO_PHASE_INCREMENT_SCALE,
  LFO_SIN_GAIN_SCALE,
  LFO_RMP_GAIN_SCALE,
  LFO_SIN_DELAY_SCALE,
  LFO_RMP_DELAY_SCALE,
  MAX_DELAY_RAM,
} from '../constants';

const CHO_MODE_RDA = 0;
const CHO_MODE_SOF = 1;
const CHO_MODE_RDAL = 2;
const CHO_FLAG_COMPC = 2;

const RAW_OPCODE_MASK = 0x1f;
const RAW_FLAG_MASK = 0x1f;

const RAW_TO_INTERNAL_SKP_FLAGS = [
  { raw: 0x10, internal: 0x01 },
  { raw: 0x08, internal: 0x10 },
  { raw: 0x04, internal: 0x02 },
  { raw: 0x02, internal: 0x04 },
  { raw: 0x01, internal: 0x08 },
];

function signExtend(value: number, bits: number): number {
  const signBit = 1 << (bits - 1);
  const mask = (1 << bits) - 1;
  const masked = value & mask;
  return masked & signBit ? masked - (1 << bits) : masked;
}

function decodeFixed(value: number, bits: number, fracBits: number): number {
  return signExtend(value, bits) / (1 << fracBits);
}

function decodeS23(value: number): number {
  return fixedToFloat(value & 0xffffff);
}

function decodeRawInstruction(word: number): RawDecodedInstruction | null {
  const opcodeBits = word & RAW_OPCODE_MASK;

  switch (opcodeBits) {
    case 0b00000: {
      const address = (word >>> 5) & 0x7fff;
      const coeff = decodeFixed((word >>> 21) & 0x7ff, 11, 9);
      return { opcode: 'rda', operands: [address, coeff] };
    }
    case 0b00001: {
      const coeff = decodeFixed((word >>> 21) & 0x7ff, 11, 9);
      return { opcode: 'rmpa', operands: [coeff] };
    }
    case 0b00010: {
      const address = (word >>> 5) & 0x7fff;
      const coeff = decodeFixed((word >>> 21) & 0x7ff, 11, 9);
      return { opcode: 'wra', operands: [address, coeff] };
    }
    case 0b00011: {
      const address = (word >>> 5) & 0x7fff;
      const coeff = decodeFixed((word >>> 21) & 0x7ff, 11, 9);
      return { opcode: 'wrap', operands: [address, coeff] };
    }
    case 0b00100: {
      const reg = (word >>> 5) & 0x3f;
      const coeff = decodeFixed((word >>> 16) & 0xffff, 16, 14);
      return { opcode: 'rdax', operands: [reg, coeff] };
    }
    case 0b00101: {
      const reg = (word >>> 5) & 0x3f;
      const coeffValue = (word >>> 16) & 0xffff;
      const coeff = decodeFixed(coeffValue, 16, 14);
      if (coeffValue === 0) {
        return { opcode: 'ldax', operands: [reg] };
      }
      return { opcode: 'rdfx', operands: [reg, coeff] };
    }
    case 0b00110: {
      const reg = (word >>> 5) & 0x3f;
      const coeff = decodeFixed((word >>> 16) & 0xffff, 16, 14);
      return { opcode: 'wrax', operands: [reg, coeff] };
    }
    case 0b00111: {
      const reg = (word >>> 5) & 0x3f;
      const coeff = decodeFixed((word >>> 16) & 0xffff, 16, 14);
      return { opcode: 'wrhx', operands: [reg, coeff] };
    }
    case 0b01000: {
      const reg = (word >>> 5) & 0x3f;
      const coeff = decodeFixed((word >>> 16) & 0xffff, 16, 14);
      return { opcode: 'wrlx', operands: [reg, coeff] };
    }
    case 0b01001: {
      const reg = (word >>> 5) & 0x3f;
      const coeffValue = (word >>> 16) & 0xffff;
      const coeff = decodeFixed(coeffValue, 16, 14);
      if (reg === 0 && coeffValue === 0) {
        return { opcode: 'absa', operands: [] };
      }
      return { opcode: 'maxx', operands: [reg, coeff] };
    }
    case 0b01010: {
      const reg = (word >>> 5) & 0x3f;
      return { opcode: 'mulx', operands: [reg] };
    }
    case 0b01011: {
      const coeff = decodeFixed((word >>> 16) & 0xffff, 16, 14);
      const offset = decodeFixed((word >>> 5) & 0x7ff, 11, 10);
      return { opcode: 'log', operands: [coeff, offset] };
    }
    case 0b01100: {
      const coeff = decodeFixed((word >>> 16) & 0xffff, 16, 14);
      const offset = decodeFixed((word >>> 5) & 0x7ff, 11, 10);
      return { opcode: 'exp', operands: [coeff, offset] };
    }
    case 0b01101: {
      const coeff = decodeFixed((word >>> 16) & 0xffff, 16, 14);
      const offset = decodeFixed((word >>> 5) & 0x7ff, 11, 10);
      return { opcode: 'sof', operands: [coeff, offset] };
    }
    case 0b01110: {
      const value = decodeS23(word >>> 8);
      if ((word >>> 8) === 0) {
        return { opcode: 'clr', operands: [] };
      }
      return { opcode: 'and', operands: [value] };
    }
    case 0b01111: {
      const value = decodeS23(word >>> 8);
      return { opcode: 'or', operands: [value] };
    }
    case 0b10000: {
      const valueBits = word >>> 8;
      const value = decodeS23(valueBits);
      if ((valueBits & 0xffffff) === 0xffffff) {
        return { opcode: 'not', operands: [] };
      }
      return { opcode: 'xor', operands: [value] };
    }
    case 0b10001: {
      const rawFlags = (word >>> 27) & RAW_FLAG_MASK;
      let flags = 0;
      for (const mapping of RAW_TO_INTERNAL_SKP_FLAGS) {
        if (rawFlags & mapping.raw) {
          flags |= mapping.internal;
        }
      }
      const offset = (word >>> 21) & 0x3f;
      return { opcode: 'skp', operands: [flags, offset] };
    }
    case 0b10010: {
      const lfoBits = (word >>> 29) & 0x3;
      if (lfoBits < 2) {
        const frequency = (word >>> 20) & 0x1ff;
        const amplitude = (word >>> 5) & 0x7fff;
        return { opcode: 'wlds', operands: [lfoBits, frequency, amplitude] };
      }
      const frequency = signExtend((word >>> 13) & 0xffff, 16);
      const amplitudeCode = (word >>> 5) & 0x3;
      const amplitude = amplitudeCode === 0
        ? 4096
        : amplitudeCode === 1
          ? 2048
          : amplitudeCode === 2
            ? 1024
            : 512;
      return { opcode: 'wldr', operands: [lfoBits & 0x1, frequency, amplitude] };
    }
    case 0b10011: {
      const lfoBits = (word >>> 6) & 0x3;
      return { opcode: 'jam', operands: [lfoBits & 0x1] };
    }
    case 0b10100: {
      const modeBits = (word >>> 30) & 0x3;
      const lfo = (word >>> 21) & 0x3;
      const rawFlags = (word >>> 24) & 0x3f;
      let flags = 0;
      if (rawFlags & 0x02) {
        flags |= 0x01;
      }
      if (rawFlags & 0x04) {
        flags |= 0x02;
      }
      const argument = (word >>> 5) & 0xffff;

      if (modeBits === 0) {
        return { opcode: 'cho', operands: [0, lfo, flags, argument] };
      }
      if (modeBits === 2) {
        const offset = decodeFixed(argument, 16, 15);
        return { opcode: 'cho', operands: [1, lfo, flags, offset] };
      }
      if (modeBits === 3) {
        return { opcode: 'cho', operands: [2, lfo, flags] };
      }
      return null;
    }
    default:
      return null;
  }
}

function getLfoParams(state: FV1State, lfoSelect: number): {
  normalized: number;
  amplitude: number;
  gainScale: number;
  delayScale: number;
  blend: number;
} {
  const isRamp = lfoSelect >= 2;
  const index = lfoSelect % 2;

  const normalized = isRamp
    ? (index === 0 ? state.lfo.rmp0 : state.lfo.rmp1)
    : (index === 0 ? state.lfo.sin0 : state.lfo.sin1);
  const amplitude = isRamp
    ? (index === 0 ? state.lfo.rmp0Amp : state.lfo.rmp1Amp)
    : (index === 0 ? state.lfo.sin0Amp : state.lfo.sin1Amp);

  const gainScale = isRamp ? LFO_RMP_GAIN_SCALE : LFO_SIN_GAIN_SCALE;
  const delayScale = isRamp ? LFO_RMP_DELAY_SCALE : LFO_SIN_DELAY_SCALE;
  const blend = isRamp ? normalized : (normalized + 1) * 0.5;

  return {
    normalized,
    amplitude,
    gainScale,
    delayScale,
    blend,
  };
}

function readDelayInterpolated(state: FV1State, address: number): number {
  const wrapped = ((address % MAX_DELAY_RAM) + MAX_DELAY_RAM) % MAX_DELAY_RAM;
  const index = Math.floor(wrapped);
  const next = (index + 1) % MAX_DELAY_RAM;
  const fraction = wrapped - index;
  const current = state.delayRam[index];
  const nextValue = state.delayRam[next];
  return current + (nextValue - current) * fraction;
}

/**
 * WLDS: Write LFO sine frequency
 * 
 * Sets the frequency for SIN LFO (LFO 0 or LFO 1).
 * 
 * Operands:
 * - operands[0]: LFO selector (0 or 1)
 * - operands[1]: Frequency (0-511)
 * - operands[2]: Amplitude (0-4095)
 * 
 * Note: LFO implementation requires tracking phase and computing sin/cos.
 * For now, this is a placeholder until full LFO support is implemented.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#WLDS
 */
export const wlds: InstructionHandler = (_state: FV1State, _operands: number[]) => {
  const state = _state;
  const lfoSelect = _operands[0] ?? 0;
  const frequency = _operands[1] ?? 0;
  const amplitude = _operands[2] ?? 0;
  const rate = Math.max(0, frequency) * LFO_PHASE_INCREMENT_SCALE;

  if (lfoSelect === 0) {
    state.lfo.sin0Rate = rate;
    state.lfo.sin0Amp = Math.max(0, amplitude);
  } else {
    state.lfo.sin1Rate = rate;
    state.lfo.sin1Amp = Math.max(0, amplitude);
  }
};

/**
 * WLDR: Write LFO ramp frequency
 * 
 * Sets the frequency for RMP LFO (LFO 0 or LFO 1).
 * 
 * Operands:
 * - operands[0]: LFO selector (0 or 1)
 * - operands[1]: Frequency (0-511)
 * - operands[2]: Amplitude (0-32767)
 * 
 * Note: LFO implementation requires tracking phase and computing ramp.
 * For now, this is a placeholder until full LFO support is implemented.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#WLDR
 */
export const wldr: InstructionHandler = (_state: FV1State, _operands: number[]) => {
  const state = _state;
  const lfoSelect = _operands[0] ?? 0;
  const frequency = _operands[1] ?? 0;
  const amplitude = _operands[2] ?? 0;
  const rate = Math.max(0, frequency) * LFO_PHASE_INCREMENT_SCALE;

  if (lfoSelect === 0) {
    state.lfo.rmp0Rate = rate;
    state.lfo.rmp0Amp = Math.max(0, amplitude);
  } else {
    state.lfo.rmp1Rate = rate;
    state.lfo.rmp1Amp = Math.max(0, amplitude);
  }
};

/**
 * JAM: Reset LFO ramp
 * 
 * Resets the RMP LFO to zero phase.
 * 
 * Operands:
 * - operands[0]: LFO selector (0 or 1)
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#JAM
 */
export const jam: InstructionHandler = (state: FV1State, operands: number[]) => {
  const lfoSelect = operands[0];

  // Reset ramp LFO phase to zero
  if (lfoSelect === 0) {
    state.lfo.rmp0Phase = 0.0;
    state.lfo.rmp0 = 0.0;
  } else {
    state.lfo.rmp1Phase = 0.0;
    state.lfo.rmp1 = 0.0;
  }
};

/**
 * CHO: Chorus/LFO operations
 * 
 * Complex instruction for reading delay RAM with LFO modulation.
 * 
 * CHO variants:
 * - CHO RDA: Read delay with LFO, multiply and add
 * - CHO SOF: Scale and offset using LFO value
 * - CHO RDAL: Read delay with LFO crossfade
 * 
 * Operands vary by CHO type (RDA/SOF/RDAL).
 * 
 * Note: CHO is the most complex FV-1 instruction and requires
 * full LFO implementation. For now, this is a placeholder.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#CHO
 */
export const cho: InstructionHandler = (_state: FV1State, _operands: number[]) => {
  const state = _state;
  const mode = _operands[0] ?? CHO_MODE_RDA;
  const lfoSelect = _operands[1] ?? 0;
  const flags = _operands[2] ?? 0;

  const lfoParams = getLfoParams(state, lfoSelect);
  const lfoValue = lfoParams.normalized * lfoParams.amplitude * lfoParams.gainScale;

  if (mode === CHO_MODE_SOF) {
    const coeff = _operands.length > 3 ? clampRDAXCoeff(_operands[3]) : 1.0;
    const offset = _operands.length > 4 ? _operands[4] : 0.0;
    const scaled = saturatingMul(state.acc, coeff * lfoValue);
    state.acc = saturatingAdd(scaled, offset);
    return;
  }

  const baseAddress = _operands.length > 3 ? _operands[3] : 0;
  const delayOffset = lfoParams.normalized * lfoParams.amplitude * lfoParams.delayScale;
  const delayValue = readDelayInterpolated(state, baseAddress + delayOffset);
  const coeff = (flags & CHO_FLAG_COMPC) === 0 ? lfoParams.blend : 1 - lfoParams.blend;
  const scaled = saturatingMul(delayValue, coeff);

  if (mode === CHO_MODE_RDAL) {
    state.acc = scaled;
  } else {
    state.acc = saturatingAdd(state.acc, scaled);
  }
};

/**
 * RAW: Raw instruction pass-through
 * 
 * Allows direct encoding of FV-1 machine code.
 * Used for undocumented instructions or fine-tuned control.
 * 
 * Operands:
 * - operands[0]: Raw 32-bit instruction word
 * 
 * Note: RAW is rarely used and requires deep understanding of FV-1 ISA.
 * For now, this is a no-op placeholder.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html#RAW
 */
export const raw: InstructionHandler = (_state: FV1State, _operands: number[]) => {
  const state = _state;
  const word = (_operands[0] ?? 0) >>> 0;
  const currentPc = _operands[1] ?? 0;

  const decoded = decodeRawInstruction(word);
  if (!decoded) {
    warnUnsupportedRaw(word, 'could not decode opcode');
    return;
  }

  const handler = instructionHandlers[decoded.opcode];
  if (!handler) {
    warnUnsupportedRaw(word, `opcode ${decoded.opcode} is unsupported`);
    return;
  }

  const operands = decoded.opcode === 'skp'
    ? [...decoded.operands, currentPc]
    : decoded.operands;

  handler(state, operands);
};

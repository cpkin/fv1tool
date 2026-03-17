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
import {
  saturatingAdd,
  saturatingMul,
  fixedToFloat,
} from '../fixedPoint';
import { warnUnsupportedRaw } from '../warnings';
import { instructionHandlers } from './index';
import {
  MAX_DELAY_RAM,
} from '../constants';
import { getRampValues, getRampXfadeValue, getSinValue, jamRampLfo, jamSinLfo } from '../lfo';

const CHO_MODE_RDA = 0;
const CHO_MODE_SOF = 1;
const CHO_MODE_RDAL = 2;
const CHO_FLAG_COS = 0x01;
const CHO_FLAG_COMPC = 0x04;
const CHO_FLAG_COMPA = 0x08;
const CHO_FLAG_RPTR2 = 0x10;
const CHO_FLAG_NA = 0x20;

const POWER_LOOKUP = Array.from({ length: 16 }, (_, index) => Math.pow(2, index - 8));

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

function resolveDelayAddress(state: FV1State, address: number): number {
  const pointerRelative = address >= MAX_DELAY_RAM;
  const base = pointerRelative ? address - MAX_DELAY_RAM : address;
  const resolved = pointerRelative ? base + state.delayWritePtr : base;
  return ((resolved % MAX_DELAY_RAM) + MAX_DELAY_RAM) % MAX_DELAY_RAM;
}

function readDelayInterpolated(state: FV1State, address: number): number {
  const wrapped = resolveDelayAddress(state, address);
  const index = Math.floor(wrapped);
  const fraction = wrapped - index;
  const next = (index + 1) % MAX_DELAY_RAM;
  const current = decompressDelaySample(Math.trunc(state.delayRam[index]));
  const nextValue = decompressDelaySample(Math.trunc(state.delayRam[next]));
  const value = current + (nextValue - current) * fraction;
  state.delayLR = value;
  return value;
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
  const rate = (Math.max(0, frequency) & 0x1ff) << 14;

  if (lfoSelect === 0) {
    state.lfo.sin0Rate = rate;
    state.lfo.sin0Amp = Math.max(0, amplitude) << 8;
    jamSinLfo(state, 0);
  } else {
    state.lfo.sin1Rate = rate;
    state.lfo.sin1Amp = Math.max(0, amplitude) << 8;
    jamSinLfo(state, 1);
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
  let regFreq = (frequency & 0x7fff) << 8;
  if (frequency < 0) {
    regFreq |= 0xff80_0000;
  }
  const ampCode = amplitude === 1024
    ? 0x02
    : amplitude === 2048
      ? 0x01
      : amplitude === 4096
        ? 0x00
        : 0x03;

  if (lfoSelect === 0) {
    state.lfo.rmp0Rate = regFreq;
    state.lfo.rmp0Amp = ampCode;
    jamRampLfo(state, 0);
  } else {
    state.lfo.rmp1Rate = regFreq;
    state.lfo.rmp1Amp = ampCode;
    jamRampLfo(state, 1);
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
    jamRampLfo(state, 0);
  } else {
    jamRampLfo(state, 1);
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

  const isRamp = lfoSelect >= 2;
  const compc = (flags & CHO_FLAG_COMPC) !== 0;
  const compa = (flags & CHO_FLAG_COMPA) !== 0;
  const useCos = (flags & CHO_FLAG_COS) !== 0;
  const rptr2 = (flags & CHO_FLAG_RPTR2) !== 0;
  const na = (flags & CHO_FLAG_NA) !== 0;

  if (mode === CHO_MODE_SOF) {
    const offset = _operands.length > 3 ? _operands[3] : 0.0;
    if (na && isRamp) {
      const rampIndex = (lfoSelect - 2) as 0 | 1;
      let fadeVal = getRampXfadeValue(state, rampIndex);
      if (compc) fadeVal = 16384 - fadeVal;
      const coeff = fadeVal / 16384;
      state.acc = saturatingAdd(saturatingMul(state.acc, coeff), offset);
      return;
    }

    const lfoValue = isRamp
      ? fixedToFloat(getRampValues(state, (lfoSelect - 2) as 0 | 1, rptr2).value)
      : fixedToFloat(getSinValue(state, lfoSelect as 0 | 1, useCos));
    state.acc = saturatingAdd(saturatingMul(state.acc, lfoValue), offset);
    return;
  }

  const baseAddress = _operands.length > 3 ? _operands[3] : 0;

  if (na && isRamp) {
    const rampIndex = (lfoSelect - 2) as 0 | 1;
    let fadeVal = getRampXfadeValue(state, rampIndex);
    if (compc) fadeVal = 16384 - fadeVal;
    const coeff = fadeVal / 16384;
    const delayValue = readDelayInterpolated(state, baseAddress);
    const scaled = saturatingMul(delayValue, coeff);
    state.acc = mode === CHO_MODE_RDAL ? scaled : saturatingAdd(state.acc, scaled);
    return;
  }

  let lfoPos = 0;
  let coeff = 0;

  if (isRamp) {
    const ramp = getRampValues(state, (lfoSelect - 2) as 0 | 1, rptr2);
    lfoPos = ramp.value >> 10;
    if (compa) {
      lfoPos = ramp.maxPos - lfoPos;
    }
    const inter = ramp.value & 0x3fff;
    coeff = compc ? (16383 - inter) / 16384 : inter / 16384;
  } else {
    const sinVal = getSinValue(state, lfoSelect as 0 | 1, useCos);
    lfoPos = sinVal >> 9;
    if (compa) {
      lfoPos = -lfoPos;
    }
    const inter = sinVal & 0xff;
    coeff = compc ? (255 - inter) / 256 : inter / 256;
  }

  const delayValue = readDelayInterpolated(state, baseAddress + lfoPos);
  const scaled = saturatingMul(delayValue, coeff);
  state.acc = mode === CHO_MODE_RDAL ? scaled : saturatingAdd(state.acc, scaled);
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

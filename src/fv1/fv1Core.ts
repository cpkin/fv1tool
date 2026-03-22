/**
 * FV-1 Simulator Core
 *
 * Ported from audiofab/fv1-vscode (MIT License):
 * https://github.com/audiofab/fv1-vscode
 *
 * Key improvements over the previous FV1Tool interpreter:
 * - Float-based quadrature sine LFO (no integer-approximation artifacts)
 * - Correct CHO dual-tap linear interpolation (was single-tap, causing robotic chorus)
 * - COMPA and RPTR2 flags fully implemented
 * - Ramp crossfade window (NA flag) — prevents clicks in pitch-shifting programs
 * - Float32Array delay RAM (no packed-14-bit compression artifacts)
 * - Correct pointer-relative delay addressing throughout
 */

import { MAX_DELAY_RAM } from './constants';
import type { CompiledInstruction, IOMode } from './types';

const MAX_ACC = 1.0 - 1.0 / 8388608.0; // S1.23 max: 1 - 2^-23
const MIN_ACC = -1.0;
const DELAY_MASK = MAX_DELAY_RAM - 1; // 0x7FFF

// ---------------------------------------------------------------------------
// Register mapping: FV1Tool compiled register indices → internal 64-slot layout
//
// Internal layout (matches audiofab FV1Simulator):
//   [0]  SIN0_RATE_RAW   [1]  SIN0_RANGE_RAW
//   [2]  SIN1_RATE_RAW   [3]  SIN1_RANGE_RAW
//   [4]  RMP0_RATE_RAW   [5]  RMP0_RANGE_RAW
//   [6]  RMP1_RATE_RAW   [7]  RMP1_RANGE_RAW
//   [8]  SIN0  [9] COS0  [10] SIN1  [11] COS1
//   [12] RMP0  [13] RMP1
//   [16] POT0  [17] POT1  [18] POT2
//   [20] ADCL  [21] ADCR  [22] DACL  [23] DACR
//   [24] ADDR_PTR
//   [32..63] REG0..REG31
// ---------------------------------------------------------------------------
const REG_MAP = new Uint8Array(64);
// Default: identity (for indices 32-63 and anything not remapped below)
for (let i = 0; i < 64; i++) REG_MAP[i] = i;
// REG0-31 → slots 32-63
for (let i = 0; i < 32; i++) REG_MAP[i] = i + 32;
// ADDR_PTR (FV1Tool index 24) → stays at internal 24
REG_MAP[24] = 24;
// Special registers
REG_MAP[32] = 20; // ADCL
REG_MAP[33] = 21; // ADCR
REG_MAP[34] = 22; // DACL
REG_MAP[35] = 23; // DACR
REG_MAP[36] = 8;  // SIN0
REG_MAP[37] = 10; // SIN1
REG_MAP[38] = 12; // RMP0
REG_MAP[39] = 13; // RMP1
REG_MAP[40] = 16; // POT0
REG_MAP[41] = 17; // POT1
REG_MAP[42] = 18; // POT2
// SpinCAD LFO parameter registers
REG_MAP[43] = 0;  // SIN0_RATE
REG_MAP[44] = 1;  // SIN0_RANGE
REG_MAP[45] = 2;  // SIN1_RATE
REG_MAP[46] = 3;  // SIN1_RANGE
REG_MAP[47] = 4;  // RMP0_RATE
REG_MAP[48] = 5;  // RMP0_RANGE
REG_MAP[49] = 6;  // RMP1_RATE
REG_MAP[50] = 7;  // RMP1_RANGE

// Inverse register map: audiofab internal index → FV1Tool compiler index.
// Used by decodeRawWord so that re-dispatched instructions go through REG_MAP correctly.
const INV_REG_MAP = new Uint8Array(64);
for (let i = 0; i < 64; i++) INV_REG_MAP[i] = i; // default identity
// Internal 32-63 → FV1Tool 0-31 (REG0-REG31)
for (let i = 0; i < 32; i++) INV_REG_MAP[i + 32] = i;
INV_REG_MAP[24] = 24; // ADDR_PTR stays
INV_REG_MAP[20] = 32; // ADCL
INV_REG_MAP[21] = 33; // ADCR
INV_REG_MAP[22] = 34; // DACL
INV_REG_MAP[23] = 35; // DACR
INV_REG_MAP[8]  = 36; // SIN0
INV_REG_MAP[10] = 37; // SIN1
INV_REG_MAP[12] = 38; // RMP0
INV_REG_MAP[13] = 39; // RMP1
INV_REG_MAP[16] = 40; // POT0
INV_REG_MAP[17] = 41; // POT1
INV_REG_MAP[18] = 42; // POT2
// LFO parameter registers: wire indices 0-7 map to FV1Tool 43-50
// Note: these overlap with REG0-REG7 (indices 32-39 via INV_REG_MAP[32..63]).
// RAW words use wire format where 0-7 are LFO params, 32-63 are REGs.
INV_REG_MAP[0] = 43;  // SIN0_RATE
INV_REG_MAP[1] = 44;  // SIN0_RANGE
INV_REG_MAP[2] = 45;  // SIN1_RATE
INV_REG_MAP[3] = 46;  // SIN1_RANGE
INV_REG_MAP[4] = 47;  // RMP0_RATE
INV_REG_MAP[5] = 48;  // RMP0_RANGE
INV_REG_MAP[6] = 49;  // RMP1_RATE
INV_REG_MAP[7] = 50;  // RMP1_RANGE

/**
 * Convert a FV1Tool compiled delay address to a delayPtr-relative offset.
 *
 * FV1Tool stores delay addresses in two forms:
 *   address < MAX_DELAY_RAM  → treat as pointer-relative offset (hardware behavior)
 *   address >= MAX_DELAY_RAM → pointer-relative, offset = address - MAX_DELAY_RAM
 */
function toDelayOffset(address: number): number {
  return address >= MAX_DELAY_RAM ? address - MAX_DELAY_RAM : address;
}

export class FV1Core {
  // Delay RAM — Float32Array, no packed-format compression
  private readonly delayRam = new Float32Array(MAX_DELAY_RAM);

  // Flat 64-register file (audiofab internal layout)
  private readonly regs = new Float32Array(64);

  // Accumulators
  private acc = 0.0;
  private pacc = 0.0;

  // LR register: last value read from delay RAM (used by WRAP allpass)
  private lrReg = 0.0;

  // CHO latch: latched LFO value for multi-tap CHO sequences (REG flag)
  private lfoLatch = 0.0;

  // Delay write pointer (circular, counts down)
  private delayPtr = 0;

  // Tracks whether this is the very first sample (for SKP RUN behavior)
  private firstRun = true;

  // Float-based quadrature LFO state (Expert Sleepers C port, via audiofab)
  private sin0 = 0.0;  private cos0 = -1.0;
  private sin1 = 0.0;  private cos1 = -1.0;
  private rmp0 = 0.0;
  private rmp1 = 0.0;

  // Cached LFO parameters (read from regs[0-7] by updateLFOs each sample)
  private sin0Rate = 0.0; private sin0Range = 0.0;
  private sin1Rate = 0.0; private sin1Range = 0.0;
  private rmp0Rate = 0.0; private rmp0Range = 0.0;
  private rmp1Rate = 0.0; private rmp1Range = 0.0;

  // Program and IO configuration
  private program: CompiledInstruction[] = [];
  private ioMode: IOMode = 'stereo_stereo';

  // Per-pass DAC write tracking (cleared at start of each runPass)
  private dacLWritten = false;
  private dacRWritten = false;

  constructor(program?: CompiledInstruction[], ioMode?: IOMode) {
    if (program) this.loadProgram(program, ioMode ?? 'stereo_stereo');
  }

  loadProgram(program: CompiledInstruction[], ioMode: IOMode = 'stereo_stereo'): void {
    this.program = program;
    this.ioMode = ioMode;
  }

  reset(): void {
    this.delayRam.fill(0);
    this.regs.fill(0);
    this.acc = 0; this.pacc = 0; this.lrReg = 0; this.lfoLatch = 0;
    this.delayPtr = 0; this.firstRun = true;
    this.sin0 = 0.0; this.cos0 = -1.0;
    this.sin1 = 0.0; this.cos1 = -1.0;
    this.rmp0 = 0.0; this.rmp1 = 0.0;
    this.sin0Rate = 0; this.sin0Range = 0;
    this.sin1Rate = 0; this.sin1Range = 0;
    this.rmp0Rate = 0; this.rmp0Range = 0;
    this.rmp1Rate = 0; this.rmp1Range = 0;
    // Default POTs to 0.5 midpoint
    this.regs[16] = 0.5; this.regs[17] = 0.5; this.regs[18] = 0.5;
  }

  /** Update POT registers (quantized to 10-bit, matching FV-1 hardware) */
  setPots(pot0: number, pot1: number, pot2: number): void {
    const q = (v: number) =>
      Math.floor(Math.max(0, Math.min(0.9999999, v)) * 1024) / 1024;
    this.regs[16] = q(pot0);
    this.regs[17] = q(pot1);
    this.regs[18] = q(pot2);
  }

  /**
   * Process one audio sample.
   *
   * For stereo modes the program runs twice (L pass then R pass).
   * LFO updates happen once per sample, at the end.
   */
  step(
    inL: number,
    inR: number,
    pot0: number,
    pot1: number,
    pot2: number,
  ): [number, number] {
    this.setPots(pot0, pot1, pot2);
    // Expose current LFO state to instructions before this sample executes
    this.updateStateRegisters();

    const sat = (v: number) => Math.max(MIN_ACC, Math.min(MAX_ACC, v));
    const sL = sat(inL);
    const sR = sat(inR);

    let outL: number;
    let outR: number;

    if (this.ioMode === 'mono_mono') {
      this.runPass(sL, sL, 0);
      outL = this.dacLWritten ? this.regs[22] : this.acc;
      outR = outL;
    } else {
      // L pass (lr = 0): ADCL=ADCR=left input
      this.runPass(sL, sR, 0);
      outL = this.dacLWritten ? this.regs[22] : this.acc;

      // R pass (lr = 1): ADCL=ADCR=right input
      this.runPass(sL, sR, 1);
      outR = this.dacRWritten ? this.regs[23] : this.acc;
    }

    // Post-sample: advance LFOs and delay pointer
    this.firstRun = false;
    this.updateLFOs();
    this.updateStateRegisters();
    this.delayPtr = (this.delayPtr - 1 + MAX_DELAY_RAM) & DELAY_MASK;

    return [outL, outR];
  }

  // ---------------------------------------------------------------------------
  // Internal: run all 128 instructions for one channel pass
  // ---------------------------------------------------------------------------

  private runPass(inL: number, inR: number, lr: number): void {
    // PACC = previous sample's final ACC (FV1Tool convention)
    const prevAcc = this.acc;
    this.acc = 0;
    this.pacc = prevAcc;
    this.dacLWritten = false;
    this.dacRWritten = false;

    // Stereo ADC routing per FV-1 hardware:
    //   mono modes: ADCL=ADCR=input
    //   stereo_stereo lr=0: ADCL=ADCR=left
    //   stereo_stereo lr=1: ADCL=ADCR=right
    if (this.ioMode === 'stereo_stereo' && lr === 1) {
      this.regs[20] = inR; // ADCL = right on R pass
      this.regs[21] = inR; // ADCR = right on R pass
    } else {
      this.regs[20] = inL; // ADCL
      this.regs[21] = inL; // ADCR (same channel for current pass)
    }

    const prog = this.program;
    const len = prog.length;
    let pc = 0;

    while (pc < len) {
      const newPc = this.exec(prog[pc], pc);
      if (newPc !== null) {
        pc = newPc;
      } else {
        pc++;
      }
    }
  }

  /**
   * Execute one instruction.
   * Returns null for normal (pc + 1) advance, or a new absolute PC for jumps.
   */
  private exec(inst: CompiledInstruction, pc: number): number | null {
    const o = inst.operands;

    switch (inst.opcode) {
      // ------------------------------------------------------------------
      // Delay memory
      // ------------------------------------------------------------------

      case 'rda': {
        const offset = toDelayOffset(o[0] | 0);
        const addr = (this.delayPtr + offset + MAX_DELAY_RAM) & DELAY_MASK;
        this.lrReg = this.delayRam[addr];
        this.acc = this.sat(this.acc + this.lrReg * o[1]);
        return null;
      }

      case 'rmpa': {
        // ADDR_PTR holds a fractional [0,1] delay pointer set by CHO
        const ptr = Math.floor(this.regs[24] * MAX_DELAY_RAM);
        const addr = (this.delayPtr + ptr + MAX_DELAY_RAM) & DELAY_MASK;
        this.lrReg = this.delayRam[addr];
        this.acc = this.sat(this.acc + this.lrReg * o[0]);
        return null;
      }

      case 'wra': {
        const offset = toDelayOffset(o[0] | 0);
        const addr = (this.delayPtr + offset + MAX_DELAY_RAM) & DELAY_MASK;
        this.delayRam[addr] = this.acc;
        this.acc = this.sat(this.acc * (o[1] ?? 0));
        return null;
      }

      case 'wrap': {
        const offset = toDelayOffset(o[0] | 0);
        const addr = (this.delayPtr + offset + MAX_DELAY_RAM) & DELAY_MASK;
        this.delayRam[addr] = this.acc;
        this.acc = this.sat(this.acc * o[1] + this.lrReg);
        return null;
      }

      // ------------------------------------------------------------------
      // Register arithmetic
      // ------------------------------------------------------------------

      case 'rdax': {
        this.acc = this.sat(this.acc + this.regs[REG_MAP[o[0]]] * o[1]);
        return null;
      }

      case 'rdfx': {
        const rx = this.regs[REG_MAP[o[0]]];
        this.acc = this.sat((this.acc - rx) * o[1] + rx);
        return null;
      }

      case 'wrax': {
        const ri = REG_MAP[o[0]];
        this.regs[ri] = this.acc;
        if (ri === 22) this.dacLWritten = true;
        if (ri === 23) this.dacRWritten = true;
        this.acc = this.sat(this.acc * o[1]);
        return null;
      }

      case 'wrhx': {
        const ri = REG_MAP[o[0]];
        this.regs[ri] = this.acc;
        if (ri === 22) this.dacLWritten = true;
        if (ri === 23) this.dacRWritten = true;
        this.acc = this.sat(this.pacc + this.acc * o[1]);
        return null;
      }

      case 'wrlx': {
        const ri = REG_MAP[o[0]];
        this.regs[ri] = this.acc;
        if (ri === 22) this.dacLWritten = true;
        if (ri === 23) this.dacRWritten = true;
        this.acc = this.sat((this.pacc - this.acc) * o[1] + this.pacc);
        return null;
      }

      case 'maxx': {
        this.acc = this.sat(
          Math.max(Math.abs(this.acc), Math.abs(this.regs[REG_MAP[o[0]]] * o[1])),
        );
        return null;
      }

      case 'mulx': {
        this.acc = this.sat(this.acc * this.regs[REG_MAP[o[0]]]);
        return null;
      }

      case 'ldax': {
        this.acc = this.regs[REG_MAP[o[0]]];
        return null;
      }

      // ------------------------------------------------------------------
      // ALU
      // ------------------------------------------------------------------

      case 'sof':
        this.acc = this.sat(this.acc * o[0] + o[1]);
        return null;

      case 'log': {
        const val = Math.abs(this.acc);
        const logVal = val > 1.52587890625e-5 ? Math.log2(val) : -16.0;
        this.acc = this.sat((logVal * o[0] + o[1]) / 16.0);
        return null;
      }

      case 'exp':
        this.acc = this.sat(Math.pow(2.0, this.acc * 16.0) * o[0] + o[1]);
        return null;

      case 'and': {
        const mask = o[0] | 0;
        let iAcc = Math.floor(this.acc * 8388608.0);
        iAcc &= mask;
        this.acc = iAcc / 8388608.0;
        return null;
      }

      case 'or': {
        const mask = o[0] | 0;
        let iAcc = Math.floor(this.acc * 8388608.0);
        iAcc |= mask;
        this.acc = iAcc / 8388608.0;
        return null;
      }

      case 'xor': {
        const mask = o[0] | 0;
        let iAcc = Math.floor(this.acc * 8388608.0);
        iAcc ^= mask;
        this.acc = iAcc / 8388608.0;
        return null;
      }

      case 'absa':
        this.acc = Math.abs(this.acc);
        return null;

      case 'clr':
        this.acc = 0;
        return null;

      case 'not': {
        let iAcc = Math.floor(this.acc * 8388608.0);
        iAcc ^= 0xffffff;
        this.acc = iAcc / 8388608.0;
        return null;
      }

      // ------------------------------------------------------------------
      // Control flow
      // ------------------------------------------------------------------

      case 'skp':
      case 'skp_run':
      case 'skp_zro':
      case 'skp_gez':
      case 'skp_neg':
      case 'skp_zrc': {
        // FV1Tool flags: RUN=0x01, ZRO=0x02, GEZ=0x04, NEG=0x08, ZRC=0x10
        const flags = o[0];
        const n = o[1];
        if (this.skpCondMet(flags)) return pc + 1 + n;
        return null;
      }

      case 'jmp':
        // Unconditional jump to absolute instruction address
        return o[0];

      // ------------------------------------------------------------------
      // LFO programming
      // ------------------------------------------------------------------

      case 'wlds': {
        // operands: [lfoSelect(0|1), rawFreq(0-511), rawAmp(0-32767)]
        const base = o[0] === 0 ? 0 : 2;
        this.regs[base]     = (o[1] & 0x1ff) / 511.0;
        this.regs[base + 1] = (o[2] & 0x7fff) / 32767.0;
        return null;
      }

      case 'wldr': {
        // operands: [lfoSelect(0|1), rawFreq(signed int), rawAmp(512|1024|2048|4096)]
        const base = o[0] === 0 ? 4 : 6;
        this.regs[base]     = o[1] / 16384.0;
        this.regs[base + 1] = o[2] / 8192.0;
        return null;
      }

      case 'jam':
        if (o[0] === 0) this.rmp0 = 0;
        else            this.rmp1 = 0;
        return null;

      // ------------------------------------------------------------------
      // CHO — chorus / LFO-modulated delay
      // ------------------------------------------------------------------

      case 'cho':
      case 'cho_rda':
      case 'cho_sof':
      case 'cho_rdal': {
        // operands: [mode(0=RDA,1=SOF,2=RDAL), lfoSel, flags, argument]
        const mode   = o[0] ?? 0;
        const lfoSel = o[1] ?? 0;
        const flags  = o[2] ?? 0;
        const arg    = o[3] ?? 0;
        if (mode === 0)      this.choRda(lfoSel, flags, toDelayOffset(arg | 0));
        else if (mode === 1) this.choSof(lfoSel, flags, arg);
        else if (mode === 2) this.choRdal(lfoSel, flags);
        return null;
      }

      // ------------------------------------------------------------------
      // RAW pass-through — decode the 32-bit word and re-dispatch
      // (operands[0] is the raw word; operands[1] is the injected pc)
      // ------------------------------------------------------------------
      case 'raw': {
        const word = (o[0] ?? 0) >>> 0;
        const decoded = decodeRawWord(word);
        if (decoded !== null) {
          return this.exec(decoded, pc);
        }
        return null;
      }

      // ------------------------------------------------------------------
      // No-ops
      // ------------------------------------------------------------------
      case 'nop':
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // CHO implementations (ported from audiofab FV1Simulator.ts)
  // ---------------------------------------------------------------------------

  private choRda(lfoSel: number, flags: number, baseOffset: number): void {
    const lfoIn = this.getLfoVal(flags, lfoSel);
    let range = this.getLfoRange(lfoSel) * 8192.0;

    if (flags & 2) this.lfoLatch = lfoIn; // REG: latch LFO value
    let v = this.lfoLatch;

    if (flags & 16) { v += 0.5; if (v >= 1.0) v -= 1.0; } // RPTR2: offset by half
    if (flags & 8)  { v = -v; }                             // COMPA: negate

    let index: number;
    let c: number;

    if (flags & 32) {
      // NA: crossfade window (used for pitch shifting without clicks)
      index = baseOffset;
      c = Math.min(v, 1.0 - v);
      c = Math.max(0.0, Math.min(1.0, 4.0 * c - 0.5));
    } else {
      const addr = v * range + baseOffset;
      index = Math.floor(addr);
      c = addr - index; // linear interpolation coefficient
    }

    // + MAX_DELAY_RAM before masking handles negative index values
    const readAddr = (this.delayPtr + index + MAX_DELAY_RAM) & DELAY_MASK;
    this.lrReg = this.delayRam[readAddr];

    if (flags & 4) c = 1.0 - c; // COMPC: complement interpolation

    this.acc = this.sat(this.acc + this.lrReg * c);
  }

  private choSof(lfoSel: number, flags: number, coeff: number): void {
    const lfoIn = this.getLfoVal(flags, lfoSel);
    const range = this.getLfoRange(lfoSel);

    if (flags & 2) this.lfoLatch = lfoIn;
    let v = this.lfoLatch;

    if (flags & 32) {
      // NA: crossfade window
      v = Math.min(v, 1.0 - v);
      v = Math.max(0.0, Math.min(1.0, 4.0 * v - 0.5));
    } else {
      v *= range;
    }

    if (flags & 4) v = 1.0 - v; // COMPC

    this.acc = this.sat(v * this.acc + coeff);
  }

  private choRdal(lfoSel: number, flags: number): void {
    this.acc = this.sat(this.getLfoVal(flags, lfoSel));
  }

  private getLfoVal(flags: number, lfoSel: number): number {
    if (lfoSel === 0) return (flags & 1) ? this.cos0 : this.sin0;
    if (lfoSel === 1) return (flags & 1) ? this.cos1 : this.sin1;
    if (lfoSel === 2) return this.rmp0;
    return this.rmp1;
  }

  private getLfoRange(lfoSel: number): number {
    if (lfoSel === 0) return this.sin0Range;
    if (lfoSel === 1) return this.sin1Range;
    if (lfoSel === 2) return this.rmp0Range;
    return this.rmp1Range;
  }

  // ---------------------------------------------------------------------------
  // LFO update (runs once per sample, after all passes)
  // ---------------------------------------------------------------------------

  private updateLFOs(): void {
    // Read parameters from registers (written by WLDS/WLDR instructions)
    this.sin0Rate  = this.regs[0]; this.sin0Range = this.regs[1];
    this.sin1Rate  = this.regs[2]; this.sin1Range = this.regs[3];
    this.rmp0Rate  = this.regs[4]; this.rmp0Range = this.regs[5];
    this.rmp1Rate  = this.regs[6]; this.rmp1Range = this.regs[7];

    // Ramp LFOs: sawtooth waveform
    this.rmp0 -= this.rmp0Rate * (1.0 / 4096.0);
    while (this.rmp0 >= 1.0) this.rmp0 -= 1.0;
    while (this.rmp0 <  0.0) this.rmp0 += 1.0;

    this.rmp1 -= this.rmp1Rate * (1.0 / 4096.0);
    while (this.rmp1 >= 1.0) this.rmp1 -= 1.0;
    while (this.rmp1 <  0.0) this.rmp1 += 1.0;

    // Sine LFOs: quadrature oscillator (Expert Sleepers C port)
    // d/dt [sin, cos] = rate * [-cos, sin] rotates the phasor
    const x0 = this.sin0Rate * (1.0 / 256.0);
    const s0 = this.sin0; const c0 = this.cos0;
    this.cos0 = c0 + x0 * s0;
    this.sin0 = s0 - x0 * c0;

    const x1 = this.sin1Rate * (1.0 / 256.0);
    const s1 = this.sin1; const c1 = this.cos1;
    this.cos1 = c1 + x1 * s1;
    this.sin1 = s1 - x1 * c1;
  }

  /** Write current LFO output values into state registers for RDAX/LDAX reads */
  private updateStateRegisters(): void {
    this.regs[8]  = this.sin0;
    this.regs[9]  = this.cos0;
    this.regs[10] = this.sin1;
    this.regs[11] = this.cos1;
    this.regs[12] = this.rmp0;
    this.regs[13] = this.rmp1;
  }

  // ---------------------------------------------------------------------------
  // SKP condition evaluation
  // ---------------------------------------------------------------------------

  private skpCondMet(flags: number): boolean {
    // FV1Tool flag encoding: RUN=0x01, ZRO=0x02, GEZ=0x04, NEG=0x08, ZRC=0x10
    if ((flags & 0x08) && this.acc < 0)               return true; // NEG
    if ((flags & 0x04) && this.acc >= 0)              return true; // GEZ
    if ((flags & 0x02) && this.acc === 0)             return true; // ZRO
    if ((flags & 0x10) && this.acc * this.pacc < 0)   return true; // ZRC
    if ((flags & 0x01) && !this.firstRun)             return true; // RUN
    return false;
  }

  private sat(v: number): number {
    return v > MAX_ACC ? MAX_ACC : v < MIN_ACC ? MIN_ACC : v;
  }

  // ---------------------------------------------------------------------------
  // Debug / visualization accessors
  // ---------------------------------------------------------------------------

  getDelayRam(): Float32Array    { return this.delayRam; }
  getRegisters(): Float32Array   { return this.regs; }
  getDelayPtr(): number          { return this.delayPtr; }
  getAcc(): number               { return this.acc; }
  getPacc(): number              { return this.pacc; }
  getLfoState() {
    return {
      sin0: this.sin0, cos0: this.cos0,
      sin1: this.sin1, cos1: this.cos1,
      rmp0: this.rmp0, rmp1: this.rmp1,
    };
  }
}

// ---------------------------------------------------------------------------
// Minimal RAW word decoder (for programs that use RAW instructions)
// Decodes 32-bit FV-1 machine word back into a CompiledInstruction.
// ---------------------------------------------------------------------------

function decodeRawWord(word: number): CompiledInstruction | null {
  const op = word & 0x1f;

  const s19 = (raw: number) => {
    const v = raw & 0x7ff;
    return (v & 0x400) ? (v - 0x800) / 512.0 : v / 512.0;
  };
  const s114 = (raw: number) => {
    const v = raw & 0xffff;
    return (v & 0x8000) ? (v - 0x10000) / 16384.0 : v / 16384.0;
  };
  const s10 = (raw: number) => {
    const v = raw & 0x7ff;
    return (v & 0x400) ? (v - 0x800) / 1024.0 : v / 1024.0;
  };
  // Wire-format register → FV1Tool compiler index (so REG_MAP in exec() maps back correctly)
  const reg = (wireIdx: number) => INV_REG_MAP[wireIdx & 0x3f];

  switch (op) {
    case 0x00: return { opcode: 'rda',  operands: [(word >>> 5) & 0x7fff, s19(word >>> 21)],       line: -1 };
    case 0x01: return { opcode: 'rmpa', operands: [s19(word >>> 21)],                               line: -1 };
    case 0x02: return { opcode: 'wra',  operands: [(word >>> 5) & 0x7fff, s19(word >>> 21)],       line: -1 };
    case 0x03: return { opcode: 'wrap', operands: [(word >>> 5) & 0x7fff, s19(word >>> 21)],       line: -1 };
    case 0x04: return { opcode: 'rdax', operands: [reg((word >>> 5)),      s114(word >>> 16)],      line: -1 };
    case 0x05: {
      const r = reg((word >>> 5));
      const coeffRaw = (word >>> 16) & 0xffff;
      return coeffRaw === 0
        ? { opcode: 'ldax', operands: [r],                    line: -1 }
        : { opcode: 'rdfx', operands: [r, s114(coeffRaw)],    line: -1 };
    }
    case 0x06: return { opcode: 'wrax', operands: [reg((word >>> 5)), s114(word >>> 16)],           line: -1 };
    case 0x07: return { opcode: 'wrhx', operands: [reg((word >>> 5)), s114(word >>> 16)],           line: -1 };
    case 0x08: return { opcode: 'wrlx', operands: [reg((word >>> 5)), s114(word >>> 16)],           line: -1 };
    case 0x09: {
      const r = reg((word >>> 5));
      const cv  = (word >>> 16) & 0xffff;
      return (r === 0 && cv === 0)
        ? { opcode: 'absa', operands: [],                     line: -1 }
        : { opcode: 'maxx', operands: [r, s114(cv)],          line: -1 };
    }
    case 0x0a: return { opcode: 'mulx', operands: [reg((word >>> 5))],                              line: -1 };
    case 0x0b: return { opcode: 'log',  operands: [s114(word >>> 16), s10(word >>> 5)],             line: -1 };
    case 0x0c: return { opcode: 'exp',  operands: [s114(word >>> 16), s10(word >>> 5)],             line: -1 };
    case 0x0d: return { opcode: 'sof',  operands: [s114(word >>> 16), s10(word >>> 5)],             line: -1 };
    case 0x0e: {
      const mask = (word >>> 8) & 0xffffff;
      return mask === 0
        ? { opcode: 'clr', operands: [],       line: -1 }
        : { opcode: 'and', operands: [mask],   line: -1 };
    }
    case 0x0f: return { opcode: 'or',  operands: [(word >>> 8) & 0xffffff],                        line: -1 };
    case 0x10: {
      const mask = (word >>> 8) & 0xffffff;
      return (mask & 0xffffff) === 0xffffff
        ? { opcode: 'not', operands: [],       line: -1 }
        : { opcode: 'xor', operands: [mask],   line: -1 };
    }
    case 0x11: {
      // SKP / JMP — decode raw hardware flag bits → FV1Tool internal flag encoding
      const rawFlags = (word >>> 27) & 0x1f;
      // Hardware bits: [31]=RUN [30]=ZRC [29]=ZRO [28]=GEZ [27]=NEG
      // FV1Tool bits:  RUN=0x01  ZRO=0x02  GEZ=0x04  NEG=0x08  ZRC=0x10
      let flags = 0;
      if (rawFlags & 0x10) flags |= 0x01; // bit 4 (31) = RUN
      if (rawFlags & 0x04) flags |= 0x02; // bit 2 (29) = ZRO
      if (rawFlags & 0x02) flags |= 0x04; // bit 1 (28) = GEZ
      if (rawFlags & 0x01) flags |= 0x08; // bit 0 (27) = NEG
      if (rawFlags & 0x08) flags |= 0x10; // bit 3 (30) = ZRC
      const n = (word >>> 21) & 0x3f;
      return { opcode: 'skp', operands: [flags, n], line: -1 };
    }
    case 0x12: {
      const lfoBits = (word >>> 29) & 0x3;
      if (lfoBits < 2) {
        return { opcode: 'wlds', operands: [lfoBits, (word >>> 20) & 0x1ff, (word >>> 5) & 0x7fff], line: -1 };
      }
      let freq = (word >>> 13) & 0xffff;
      if (freq & 0x8000) freq -= 65536;
      const ampCode = (word >>> 5) & 0x3;
      const amp = 4096 >> ampCode;
      return { opcode: 'wldr', operands: [lfoBits & 0x1, freq, amp], line: -1 };
    }
    case 0x13: return { opcode: 'jam', operands: [(word >>> 6) & 0x1], line: -1 };
    case 0x14: {
      const modeBits = (word >>> 30) & 0x3;
      const lfoSel   = (word >>> 21) & 0x3;
      const rawFlags = (word >>> 24) & 0x3f;
      const arg      = (word >>> 5)  & 0xffff;
      // CHO mode mapping: wire 0=RDA, 2=SOF, 3=RDAL → FV1Tool 0,1,2
      const mode = modeBits === 0 ? 0 : modeBits === 2 ? 1 : modeBits === 3 ? 2 : -1;
      if (mode < 0) return null;
      return { opcode: 'cho', operands: [mode, lfoSel, rawFlags, arg], line: -1 };
    }
    default:
      return null;
  }
}

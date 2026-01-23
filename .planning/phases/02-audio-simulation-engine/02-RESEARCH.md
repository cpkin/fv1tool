# Phase 02: Audio Simulation Engine - Research

**Researched:** 2026-01-23
**Domain:** FV-1 DSP simulation + Web Audio offline rendering
**Confidence:** MEDIUM

## Summary

This research focused on the FV-1 DSP execution model (instruction set, numeric format, delay memory behavior) and the Web Audio API features required for offline decoding, resampling, and rendering. The FV-1 documentation establishes a 24-bit two's-complement fractional signal format, 128 instructions per audio sample, and a specific instruction set with coefficients constrained to approximately -2.0 to +1.999. Web Audio offline rendering uses `OfflineAudioContext` plus `decodeAudioData`, which automatically resamples to the context's sample rate, making it a suitable pipeline for 32 kHz rendering.

The standard approach is: decode input to `AudioBuffer`, resample by rendering in an `OfflineAudioContext` set to the target sample rate (32 kHz/32.768 kHz), run a pure TypeScript FV-1 interpreter that emulates ACC/PACC/LR semantics and fixed-point saturation, then emit the results into an output `AudioBuffer` for playback. The FV-1 manuals also call out that delay RAM is floating-point with limited resolution, so precision-sensitive filters should use registers instead of delay memory, and LOG/EXP use a 4-bit shift convention.

**Primary recommendation:** Use Web Audio decoding + OfflineAudioContext resampling, then implement a fixed-point FV-1 interpreter that mirrors ACC/PACC behavior, coefficient ranges, and delay-memory quirks documented by Spin Semiconductor.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API (`OfflineAudioContext`, `AudioBuffer`, `decodeAudioData`) | Browser API | Offline rendering, decoding, resampling | Official browser API; `decodeAudioData` resamples to context sample rate and `OfflineAudioContext` renders to `AudioBuffer` (MDN). |
| Spin Semiconductor FV-1 instruction set + knowledge base docs | 2017-08-29+ | Opcode semantics and numeric ranges | Official vendor documentation for instruction behavior and numeric formats. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Web Audio API `AudioBufferSourceNode` | Browser API | Play back offline-rendered buffers | Use to audition the rendered output. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Audio resampling | Custom WASM resampler (e.g., soxr) | Potentially higher quality but requires extra dependencies and careful integration; no official FV-1 guidance. (LOW confidence) |

**Installation:**
```bash
# No third-party packages required for Web Audio usage.
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── audio/              # Web Audio decoding/resampling/rendering
├── fv1/                # Instruction interpreter + fixed-point math
├── fv1/instructions/   # Opcode handlers
├── fv1/state/          # ACC/PACC/LR/register/delay RAM state
└── demos/              # Built-in demo audio assets + metadata
```

### Pattern 1: Offline decode + resample pipeline
**What:** Decode file bytes to `AudioBuffer`, then resample by rendering inside `OfflineAudioContext` set to the target sample rate. `decodeAudioData` resamples to the context sample rate.
**When to use:** Any input format (WAV/MP3/M4A) that must be converted to FV-1's 32 kHz domain.
**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData
const audioCtx = new AudioContext();
const buffer = await audioCtx.decodeAudioData(await file.arrayBuffer());

// Source: https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext
const offline = new OfflineAudioContext(2, buffer.length, 32000);
const src = new AudioBufferSourceNode(offline, { buffer });
src.connect(offline.destination);
src.start();
const resampledBuffer = await offline.startRendering();
```

### Pattern 2: FV-1 interpreter state machine
**What:** A sample-by-sample interpreter that tracks ACC, PACC, LR, delay RAM, register bank, and LFO state, executing up to 128 instructions per sample (program counter 0–127) in the order defined by SpinASM.
**When to use:** Every render pass (32 kHz audio domain), for all opcode sequences emitted by the Phase 1 parser.
**Example:**
```typescript
// Source: http://www.spinsemi.com/knowledge_base/arch.html
// ACC, PACC, LR, registers are 24-bit 2's complement fractional values.
for (let sample = 0; sample < frameCount; sample++) {
  state.pacc = state.acc;
  for (let pc = 0; pc < 128; pc++) {
    executeInstruction(program[pc], state);
  }
  outputL[sample] = state.dacL;
  outputR[sample] = state.dacR;
}
```

### Pattern 3: Delay memory + all-pass filter idiom
**What:** Use RDA/WRAP instruction pair for all-pass filters, as described in the official instruction syntax.
**When to use:** Implementing standard FV-1 reverb blocks (demo programs, validation cases).
**Example:**
```asm
; Source: http://www.spinsemi.com/knowledge_base/inst_syntax.html#WRAP
rda  ap1#,kap
wrap ap1,-kap
```

### Anti-Patterns to Avoid
- **Using delay RAM for precision filters:** Delay RAM is floating-point with limited resolution; use register-based filters for precision (Spin doc). 
- **Ignoring ACC/PACC semantics:** Many instructions load PACC with the previous ACC; missing this changes filter behavior.
- **Assuming coefficient range includes +2.0:** Coefficients are limited to about -2.0 to +1.999 (2's complement constraint).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio decoding (WAV/MP3/M4A) | Custom decoders | `decodeAudioData` | Web Audio handles browser-supported formats and returns PCM `AudioBuffer` (MDN). |
| Resampling to 32 kHz | Manual SRC | `OfflineAudioContext` with target sample rate | `decodeAudioData` resamples to the context sample rate and offline rendering is optimized for this. |

**Key insight:** Web Audio provides the decoding and resampling pipeline needed for offline rendering; custom codecs/SRC add complexity without FV-1-specific benefit.

## Common Pitfalls

### Pitfall 1: Wrong numeric format
**What goes wrong:** Using float math without emulating 24-bit 2's complement fractional range leads to gain and saturation mismatches.
**Why it happens:** FV-1 data path is 24-bit fractional (S.bbbbb...), not IEEE float.
**How to avoid:** Implement fixed-point helpers that clamp to [-1, 1) and emulate 24-bit shifts.
**Warning signs:** Outputs clip or drift vs. Spin demo programs.

### Pitfall 2: Misusing delay RAM
**What goes wrong:** Filters implemented in delay RAM introduce distortion.
**Why it happens:** Delay RAM is floating-point with limited resolution (Spin docs).
**How to avoid:** Use register-based opcodes (RDFX/WRLX/WRHX) for filters; use delay RAM for delays/all-pass.
**Warning signs:** Extra noise/distortion in low-frequency filters.

### Pitfall 3: Ignoring LOG/EXP scaling
**What goes wrong:** LOG/EXP math is off by 16x.
**Why it happens:** LOG output is right-shifted 4 bits; EXP expects inputs right-shifted 4 bits (Spin docs).
**How to avoid:** Implement LOG/EXP with the documented shift and saturation behavior.
**Warning signs:** RMS/limiter examples fail to match reference behavior.

### Pitfall 4: Sample-rate mismatch
**What goes wrong:** Audio rendered at input sample rate instead of FV-1 target rate.
**Why it happens:** FV-1 docs reference 32.768 kHz timing for memory delays; interpreting at a different rate skews timing.
**How to avoid:** Always render at 32 kHz/32.768 kHz and document the resample step.
**Warning signs:** Reverb times and LFO rates do not match reference programs.

## Code Examples

Verified patterns from official sources:

### Offline rendering to `AudioBuffer`
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext
const offline = new OfflineAudioContext(2, 44100 * 40, 44100);
const rendered = await offline.startRendering();
```

### Instruction coefficient ranges (RDA/RDAX)
```text
// Source: http://www.spinsemi.com/knowledge_base/inst_syntax.html
RDA coefficient width: 11 bits, range -2.0 to +1.998
RDAX coefficient width: 16 bits, range -2.0 to +1.9999389
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual audio decoding/resampling | Web Audio `decodeAudioData` + `OfflineAudioContext` | Standardized across modern browsers (MDN: 2021 baseline) | Simplifies offline render pipeline and ensures resampling handled by browser. |

**Deprecated/outdated:**
- ScriptProcessorNode: deprecated in Web Audio; avoid for offline rendering (MEDIUM confidence, MDN deprecation note not fetched).

## Open Questions

1. **32-sample block timing requirements**
   - What we know: The phase requirements mandate 32-sample block processing for POT timing; FV-1 docs do not explicitly state the block cadence.
   - What's unclear: Whether pot updates are quantized per 32 samples in hardware or just in common implementations.
   - Recommendation: Validate against Spin demo programs and, if possible, confirm in FV-1 manual or hardware tests.

2. **Exact 32 kHz vs 32.768 kHz target**
   - What we know: Datasheet references 32.768 kHz for memory delay timing.
   - What's unclear: Whether the simulator should use 32,000 Hz (UI requirement) or 32,768 Hz (hardware timing) and how to communicate the difference.
   - Recommendation: Decide on a single internal rate (likely 32 kHz per product requirement) and document the variance in the fidelity modal.

## Sources

### Primary (HIGH confidence)
- http://www.spinsemi.com/knowledge_base/arch.html - numeric format, instruction count per sample, LOG/EXP scaling, delay RAM behavior
- http://www.spinsemi.com/knowledge_base/inst_syntax.html - opcode list and coefficient ranges
- http://spinsemi.com/knowledge_base/pgm_quick.html - pot quantization, delay memory floating point, coefficient ranges
- https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext - offline rendering and `startRendering`
- https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData - decoding and resampling behavior
- https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer - PCM float format and channel layout

### Secondary (MEDIUM confidence)
- https://archive.org/stream/SPN1001-DS-170829/FV-1_djvu.txt - datasheet OCR (32.768 kHz timing reference, internal memory delay)

### Tertiary (LOW confidence)
- https://duckduckgo.com/html/?q=SpinASM+manual+FV-1+pdf - search results only (no direct citations used)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Web Audio + official Spin docs
- Architecture: HIGH - Spin Semiconductor knowledge base
- Pitfalls: MEDIUM - derived from docs + implementation experience gaps

**Research date:** 2026-01-23
**Valid until:** 2026-02-22

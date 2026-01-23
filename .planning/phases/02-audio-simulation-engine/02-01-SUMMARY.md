---
phase: 02-audio-simulation-engine
plan: 01
subsystem: audio-simulation
tags: [fv1, dsp, fixed-point, interpreter, typescript]

# Dependency graph
requires:
  - phase: 01-validation-ux
    provides: Parser types and AST structures for compiled instructions
provides:
  - S1.23 fixed-point math helpers with saturation
  - FV1State type and management (ACC, PACC, registers, delay RAM)
  - Interpreter execution loop (128 instructions per sample)
  - Instruction handler registry with opcode dispatch
affects: [02-02-arithmetic-opcodes, 02-03-delay-memory, 02-04-control-flow, 02-05-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "S1.23 fixed-point format with 24-bit two's-complement"
    - "Sample-by-sample interpreter with PACC propagation"
    - "32-sample block POT updates"
    - "Instruction handler registry pattern"

key-files:
  created:
    - src/fv1/constants.ts
    - src/fv1/fixedPoint.ts
    - src/fv1/types.ts
    - src/fv1/state.ts
    - src/fv1/interpreter.ts
    - src/fv1/instructions/index.ts
  modified: []

key-decisions:
  - "Use 32 kHz sample rate (per product requirements) instead of 32.768 kHz hardware rate"
  - "Store delay RAM as Float32Array for performance (convert to/from fixed-point at boundaries)"
  - "Default all instruction handlers to NOP until implemented in later plans"
  - "Support POT updates via callback every 32 samples"
  - "Implement IO mode handling (mono_mono, mono_stereo, stereo_stereo)"

patterns-established:
  - "Fixed-point helpers: floatToFixed/fixedToFloat for boundary conversions"
  - "Saturating arithmetic: saturatingAdd/Sub/Mul with range clamping"
  - "Coefficient clamping: clampRDACoeff/clampRDAXCoeff for instruction ranges"
  - "State management: createState/resetState for deterministic execution"
  - "Handler registry: getHandler/registerHandler for opcode dispatch"

# Metrics
duration: 4min
completed: 2026-01-23
---

# Phase 02 Plan 01: FV-1 Fixed-Point Core and Interpreter Skeleton Summary

**S1.23 fixed-point math foundation with saturating arithmetic, FV1State model with 32 registers and 32768-sample delay RAM, and sample-by-sample interpreter loop executing 128 instructions per sample**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-23T18:35:19Z
- **Completed:** 2026-01-23T18:39:07Z
- **Tasks:** 3
- **Files created:** 6

## Accomplishments
- Established FV-1 fixed-point math foundation with S1.23 format constants and saturating arithmetic
- Created complete FV1State model with ACC, PACC, 32 registers, 32768-sample delay RAM, and POT values
- Implemented interpreter execution loop with 128-instruction sample processing and 32-sample POT updates
- Built instruction handler registry with all FV-1 opcodes defaulting to NOP for incremental implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add FV-1 fixed-point helpers** - `a661bd2` (feat)
2. **Task 2: Model FV-1 interpreter state** - `5b5db54` (feat)
3. **Task 3: Build interpreter loop skeleton** - `7ab5b25` (feat)

## Files Created/Modified

- `src/fv1/constants.ts` - FV-1 architecture constants (S1.23 format, coefficient ranges, sample rate, memory limits)
- `src/fv1/fixedPoint.ts` - Fixed-point conversion and saturating arithmetic helpers
- `src/fv1/types.ts` - FV1State, CompiledInstruction, CompiledProgram, and handler type definitions
- `src/fv1/state.ts` - State creation, reset, and POT management helpers
- `src/fv1/interpreter.ts` - Sample-by-sample execution loop with executeProgram/runProgram API
- `src/fv1/instructions/index.ts` - Instruction handler registry with opcode dispatch

## Decisions Made

**1. Use 32 kHz sample rate instead of 32.768 kHz**
- **Rationale:** Product requirement specifies 32 kHz for user-facing consistency. Hardware variance documented in fidelity modal (future phase).
- **Impact:** Slight timing difference in reverb/delay calculations vs hardware (acceptable for audition-quality simulation).

**2. Store delay RAM as Float32Array**
- **Rationale:** JavaScript float math is faster than simulating fixed-point at every read/write. Convert at boundaries only.
- **Impact:** Matches FV-1 datasheet note that delay RAM is floating-point with limited resolution.

**3. Default instruction handlers to NOP**
- **Rationale:** Enables incremental opcode implementation in subsequent plans without breaking type-checks.
- **Impact:** Programs won't produce correct output until opcodes are implemented (Plan 02-02, 02-03, 02-04).

**4. POT updates via callback every 32 samples**
- **Rationale:** Matches FV-1 hardware behavior and research guidance (32-sample block quantization).
- **Impact:** Caller can implement dynamic POT automation or keep static values.

**5. IO mode handling for mono/stereo routing**
- **Rationale:** FV-1 supports three IO modes with different L/R processing semantics.
- **Impact:** Interpreter executes program once (mono_mono) or twice per sample (stereo modes) based on configuration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without blockers.

## Next Phase Readiness

**Ready for:** Plan 02-02 (Arithmetic Opcodes)
- Fixed-point helpers tested and ready for opcode math
- State model complete with all required registers and memory
- Handler registry ready to receive opcode implementations

**Blockers:** None

**Concerns:** None - foundation stable and type-checks pass

---
*Phase: 02-audio-simulation-engine*
*Completed: 2026-01-23*

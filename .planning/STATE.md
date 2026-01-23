# Project State: SpinGPT

**Last Updated:** 2026-01-23
**Status:** Phase 2 In Progress (2/6 plans complete)

---

## Project Reference

### Core Value
Paste .spn code → hear simulated audio in under 2 seconds. Catch bugs before burning EEPROMs.

### Current Focus
Building Phase 2 audio simulation engine: FV-1 fixed-point core complete, implementing opcode handlers next.

---

## Current Position

Phase: 2 of 5 (Audio Simulation Engine)
Plan: 2 of 6 in current phase
Status: In progress
Last activity: 2026-01-23 - Completed 02-03-PLAN.md

### Progress
```
Phase 0: [████████████████████] 3/3 plans (100%)
Phase 1: [████████████████████] 4/4 plans (100%)
Phase 2: [███████░░░░░░░░░░░░░] 2/6 plans (33%)
Overall: [██████████████░░░░░░] 9/13 plans (69%)
```

---

## Performance Metrics

### Velocity
- **Plans completed:** 9
- **Requirements completed:** 26/50 (52%)
- **Phases completed:** 1.17/5 (23%)

### Quality
- **Blockers:** 0 active
- **Technical debt items:** 0 tracked
- **Test coverage:** Not yet applicable

### Efficiency
- **Avg time per plan:** 5 min (2 + 6 + 0 + 0 + 11 + 8 + 9 + 4 + 6 = 46 min / 9 plans)
- **Replanning rate:** 0%

---

## Accumulated Context

### Key Decisions

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2026-01-22 | Roadmap: 5 phases at "quick" depth | Requirements naturally cluster into foundation → validation → simulation → interaction → diagrams | Clear delivery boundaries, each phase unblocks next |
| 2026-01-22 | Phase 0 before coding | Lock SpinASM spec, metadata schema, test corpus before implementation | Prevents parser rework, enables TDD approach |
| 2026-01-22 | Separate Phase 2 (simulation) from Phase 3 (interaction) | Audio engine is highest-risk; isolate for focused testing | Front-loads critical risk (fixed-point math) |
| 2026-01-22 | Phase 4 (diagrams) as optional enhancement | Diagrams require metadata; tool works without them | Graceful degradation, metadata adoption can grow organically |
| 2026-01-22 | Version field optional with v1 default | Supports backward compatibility with legacy .spn files | Missing metadata doesn't block validator/simulator |
| 2026-01-22 | Strict validation (additionalProperties: false) | Catches typos and schema drift early | Invalid fields produce warnings but don't break tool |
| 2026-01-22 | Memory limit 32768 samples | Enforces FV-1 hardware constraint at 32kHz | Schema validation prevents overallocation errors |
| 2026-01-22 | Signal graph allows cycles | Feedback paths common in audio effects | Diagrams can visualize feedback without validation errors |
| 2026-01-22 | Used asfv1 assembler for corpus validation | Official assembler (SpinASM) is Windows-only; asfv1 is cross-platform Python tool | Enables CI/CD testing on any platform |
| 2026-01-22 | Created 27-program test corpus (11 official + 16 community) | Diverse coverage of FV-1 features and formatting styles | Parser and simulator can be validated against realistic programs |
| 2026-01-22 | Documented 5 major community pain points | Real-world validation of SpinGPT value proposition | Design priorities confirmed: simulation quality, cross-platform, code-first workflow |
| 2026-01-23 | Checked in generated Lezer parser artifacts | CodeMirror language support needs parser output in repo | Editor can import parser without build-time plugin |
| 2026-01-23 | Use 32 kHz sample rate instead of 32.768 kHz | Product requirement specifies 32 kHz for user-facing consistency | Slight timing difference in reverb/delay calculations vs hardware (acceptable for audition-quality simulation) |
| 2026-01-23 | Store delay RAM as Float32Array | JavaScript float math faster than simulating fixed-point at every read/write | Matches FV-1 datasheet note that delay RAM is floating-point with limited resolution |
| 2026-01-23 | Default instruction handlers to NOP | Enables incremental opcode implementation without breaking type-checks | Programs won't produce correct output until opcodes are implemented (Plan 02-02, 02-03, 02-04) |
| 2026-01-23 | Normalize rendered output to -1 dB via peak scaling | Keeps playback headroom consistent across rendered buffers | Render pipeline output aligns with FV-1 level expectations |

### Active Todos
None

### Blockers
None

---

## Session Continuity

Last session: 2026-01-23T20:57:14Z
Stopped at: Completed 02-03-PLAN.md
Resume file: None

### What Just Happened
- Completed Plan 02-03: Audio decode/resample pipeline and render API
- Added Web Audio decoding helper for File/ArrayBuffer inputs
- Implemented 32 kHz resampling via OfflineAudioContext
- Built offline render pipeline with limits, progress, and normalization

### What's Next
1. Execute Plan 02-02: Arithmetic Opcodes (RDAX, SOF, MULX, etc.)
2. Execute Plan 02-04: Simulation panel UI and render wiring
3. Execute Plan 02-05: Demo assets and layout styling

### Context for Next Session
- **Project:** Browser-based FV-1 SpinASM validator and audio simulator
- **User background:** FV-1 pedal builder frustrated by SpinCAD bugs and Windows-only tooling
- **Tech stack:** React + TypeScript + Web Audio API (offline rendering)
- **Critical risks:** Fixed-point math emulation, sample rate conversion, parser robustness
- **Success metric:** Paste code → hear audio in <2 seconds

---

*State initialized: 2026-01-22*
*Ready for planning*

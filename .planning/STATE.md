# Project State: SpinGPT

**Last Updated:** 2026-01-22
**Status:** Phase 0 In Progress

---

## Project Reference

### Core Value
Paste .spn code → hear simulated audio in under 2 seconds. Catch bugs before burning EEPROMs.

### Current Focus
Establishing foundational specifications and test infrastructure for FV-1 SpinASM validator and simulator.

---

## Current Position

### Active Phase
**Phase 0: Foundation & Test Infrastructure**

Goal: Specifications and test corpus locked; development can proceed with confidence

### Active Plan
Plan 03 of 6 in current phase

### Status
In progress

### Progress
```
Phase 0: [██░░░░░░░░░░░░░░░░░░] 2/6 plans (33%)
Overall: [██░░░░░░░░░░░░░░░░░░] 2/50 plans (4%)
```

**Last Activity:** 2026-01-22 - Completed 00-03-PLAN.md

---

## Performance Metrics

### Velocity
- **Plans completed:** 2
- **Requirements completed:** 2/50 (4%)
- **Phases completed:** 0/5 (0%)

### Quality
- **Blockers:** 0 active
- **Technical debt items:** 0 tracked
- **Test coverage:** Not yet applicable

### Efficiency
- **Avg time per plan:** 4 min (2 min + 6 min / 2)
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

### Active Todos
None

### Blockers
None

---

## Session Continuity

### What Just Happened
- Completed 00-03-PLAN.md: SpinASM Test Corpus & Community Research
- Created 27-program test corpus (11 official + 16 community) with diverse FV-1 features
- Generated corpus.json manifest with instruction counts, RAM usage, and registers
- Validated all programs with asfv1 assembler (100% assembly success)
- Documented 5 major pain points from diystompboxes.com and PedalPCB forums
- Confirmed SpinGPT value proposition through community research

### What's Next
1. Continue Phase 0 with remaining plans (01, 04, 05, 06)
2. Next plans: SpinASM dialect spec, simulator strategy, fidelity targets
3. After Phase 0 completion, Phase 1 can begin with locked specifications and test fixtures

### Context for Next Session
- **Project:** Browser-based FV-1 SpinASM validator and audio simulator
- **User background:** FV-1 pedal builder frustrated by SpinCAD bugs and Windows-only tooling
- **Tech stack:** React + TypeScript + Web Audio API (offline rendering)
- **Critical risks:** Fixed-point math emulation, sample rate conversion, parser robustness
- **Success metric:** Paste code → hear audio in <2 seconds

---

*State initialized: 2026-01-22*
*Ready for planning*

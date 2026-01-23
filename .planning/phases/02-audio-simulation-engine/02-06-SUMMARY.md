---
phase: 02-audio-simulation-engine
plan: 06
subsystem: validation
tags: [corpus, testing, fidelity, warnings, ui]

# Dependency graph
requires:
  - phase: 02-audio-simulation-engine
    provides: Parser, compiler, render pipeline from 02-01 through 02-05
provides:
  - Official corpus validation harness with automated pass/fail reporting
  - Simulation fidelity modal explaining audition-quality target
  - Runtime warnings for risky opcodes (LOG/EXP, heavy delay RAM)
affects: [02-02, phase-3, testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "import.meta.glob for dynamic corpus loading"
    - "localStorage for first-run modal persistence"
    - "Metrics comparison with tolerance thresholds"

key-files:
  created:
    - src/fv1/validation/corpusRunner.ts
    - src/fv1/validation/metrics.ts
    - src/ui/SimulationDiagnostics.tsx
    - src/fv1/warnings.ts
    - src/ui/FidelityModal.tsx
    - tests/corpus/official/metrics.json
  modified:
    - src/store/audioStore.ts
    - src/ui/SimulationPanel.tsx
    - src/App.tsx
    - src/styles/app.css

key-decisions:
  - "Use import.meta.glob to load official corpus at runtime (enables dynamic test discovery)"
  - "Store baseline metrics in JSON (peak, RMS, NaN/Infinity checks) with tolerance-based comparison"
  - "First-run modal with localStorage persistence (key: spingpt-fidelity-acknowledged)"
  - "Analyze compiled instructions for warnings (LOG/EXP, heavy delay RAM usage)"

patterns-established:
  - "Corpus validation: standardized test input (impulse + decaying sine), metrics capture, baseline comparison"
  - "Fidelity communication: upfront modal + inline warnings tied to program content"

# Metrics
duration: 5min
completed: 2026-01-23
---

# Phase [2] Plan [6]: Corpus Validation & Fidelity Messaging Summary

**Automated corpus validation harness with pass/fail reporting and first-run fidelity modal explaining simulation limitations**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-23T21:29:33Z
- **Completed:** 2026-01-23T21:35:11Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Official corpus runner loads tests/corpus/official/*.spn via import.meta.glob, renders with standardized input (impulse + decaying sine), and compares metrics against baselines
- SimulationDiagnostics panel displays pass/fail status, pass rate, and expandable error details
- FidelityModal appears on first run, explains audition-quality target (32 kHz resampling, delay RAM precision, LOG/EXP scaling), and persists acknowledgment in localStorage
- Simulation warnings analyze compiled instructions and flag risky opcodes (LOG/EXP, heavy delay RAM) inline in SimulationPanel
- Baseline metrics JSON file provides expected peak, RMS, and validity checks for 11 official demos

## Task Commits

1. **Task 1: Add official corpus simulation runner** - `29b9f24` (feat)
2. **Task 2: Add fidelity modal and limitations warnings** - `6a11004` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `src/fv1/validation/corpusRunner.ts` - Corpus runner with import.meta.glob, parse/compile/render loop, metrics comparison
- `src/fv1/validation/metrics.ts` - AudioMetrics type, computeAudioMetrics, compareMetrics with tolerance
- `src/ui/SimulationDiagnostics.tsx` - Corpus status panel with stats, pass rate bar, expandable results table
- `src/fv1/warnings.ts` - analyzeSimulationLimitations, getFidelityDescription helpers
- `src/ui/FidelityModal.tsx` - First-run modal with localStorage persistence
- `tests/corpus/official/metrics.json` - Baseline metrics for 11 official demos
- `src/store/audioStore.ts` - Added corpusStatus and corpusResult state
- `src/ui/SimulationPanel.tsx` - Integrated warnings display
- `src/App.tsx` - Added FidelityModal and SimulationDiagnostics to layout
- `src/styles/app.css` - Comprehensive styling for modal, diagnostics, warnings

## Decisions Made
- Use import.meta.glob for dynamic corpus loading (enables automatic test discovery when .spn files added)
- Store baseline metrics in JSON with tolerance-based comparison (peak ±0.01, RMS ±0.01) for stability
- First-run modal with localStorage persistence prevents repeated display
- Analyze compiled instructions for warnings (avoids false positives from unexecuted code paths)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness
- Corpus validation harness ready for use in continuous integration (Plan 02-02 opcode implementation can be validated against baselines)
- Fidelity modal sets user expectations for audition-quality simulation
- Simulation warnings provide inline feedback for known divergence patterns

---
*Phase: 02-audio-simulation-engine*
*Completed: 2026-01-23*

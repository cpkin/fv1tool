---
phase: 02-audio-simulation-engine
plan: 04
subsystem: ui
tags: [react, zustand, audio-upload, file-validation, web-audio]

# Dependency graph
requires:
  - phase: 02-audio-simulation-engine
    plan: 03
    provides: renderSimulation API, decodeAudio helper, resample pipeline
  - phase: 01-code-validation
    plan: 02
    provides: parseSpinAsm parser
provides:
  - Audio upload UI with WAV/MP3/M4A validation
  - Simulation panel with IO mode controls and render trigger
  - Editor source integration into render pipeline
  - Parse/compile error surfacing before render
affects: [02-05, 02-06, 03-audio-interaction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand store for audio simulation state"
    - "File validation by extension and MIME type before decode"
    - "Progress tracking via callback-based renderSimulation API"

key-files:
  created:
    - src/store/audioStore.ts
    - src/ui/SimulationPanel.tsx
    - src/ui/ProgressBar.tsx
  modified:
    - src/styles/app.css
    - src/App.tsx

key-decisions:
  - "Validate audio files by extension (.wav, .mp3, .m4a) and MIME type before decode"
  - "Surface friendly error messages for unsupported files or decode failures"
  - "Block render when parse/compile errors exist, showing clear error message"

patterns-established:
  - "Audio state management via Zustand store (input, render status, POT values)"
  - "Upload UI with drag-drop and file input fallback"
  - "Progress reporting via onProgress callback during render"

# Metrics
duration: 2 min
completed: 2026-01-23
---

# Phase 02 Plan 04: Simulation Panel UI and Editor Wiring Summary

**Audio upload UI with WAV/MP3/M4A validation, IO mode controls, and editor-to-render pipeline integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-23T21:19:27Z
- **Completed:** 2026-01-23T21:22:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Audio store tracks input selection, IO mode, render state, and POT values
- Simulation panel UI with upload/drag-drop, IO mode selector, render button, and progress bar
- File validation by extension and MIME type before decode (WAV, MP3, M4A)
- Friendly error messages for unsupported files or decode failures
- Editor source parsed and compiled before rendering
- Clear error surfacing when parse/compile fails (blocks render)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build simulation panel UI and input validation** - `d6728dd` (feat)
   - Created audio store for simulation state
   - Built SimulationPanel with upload, IO mode controls, render button
   - Added ProgressBar component
   - Validated WAV/MP3/M4A by extension and MIME type
   - Surfaced friendly error messages for unsupported/corrupted files

2. **Task 3: Wire editor source into simulation render flow** - `feae22e` (feat)
   - Integrated SimulationPanel into App layout
   - Render reads current editor source from validationStore
   - Parses source with parseSpinAsm before rendering
   - Compiles instructions via compileProgram
   - Blocks render with clear error if parse/compile fails
   - Passes compiled instructions, IO mode, and POT values to renderSimulation

## Files Created/Modified
- `src/store/audioStore.ts` - Zustand store for audio input, render state, POT values, and errors
- `src/ui/SimulationPanel.tsx` - Upload UI, IO mode controls, render trigger, progress/error display
- `src/ui/ProgressBar.tsx` - Render progress visualization component
- `src/styles/app.css` - Styling for simulation panel, upload area, progress bar, and render status
- `src/App.tsx` - Integrated SimulationPanel into main layout

## Decisions Made

**File validation approach:**
- Validate by both extension (.wav, .mp3, .m4a) and MIME type before attempting decode
- Rationale: Catches unsupported formats early with friendly error, before Web Audio decode
- Impact: Users see "Unsupported file type" instead of cryptic decode errors

**Render blocking on errors:**
- Block render and show clear message when parse/compile errors exist
- Rationale: Prevents confusing runtime errors from invalid programs
- Impact: Users fix code errors before attempting render

**Progress reporting:**
- Use callback-based onProgress from renderSimulation API
- Rationale: Non-blocking updates during long renders (>10 seconds)
- Impact: UI stays responsive during render

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness
- Ready for Plan 02-05: Demo assets and layout styling
- Simulation panel is functional but needs demo audio files and UI polish
- Audio playback controls will be added in Phase 3 (audio interaction)

---
*Phase: 02-audio-simulation-engine*
*Completed: 2026-01-23*

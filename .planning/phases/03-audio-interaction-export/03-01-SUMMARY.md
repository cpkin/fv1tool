---
phase: 03-audio-interaction-export
plan: 01
subsystem: audio-visualization
tags: [waveform, playback, web-audio, canvas, visualization]

# Dependency graph
requires:
  - Phase 2 audio simulation engine (renderSimulation, outputBuffer)
  - Zustand state management (audioStore)
provides:
  - Canvas-based waveform visualization with stereo overlay
  - Web Audio playback controls with play/pause
  - Animated playhead cursor synced with audio playback
  - PlaybackManager singleton for AudioBufferSourceNode lifecycle
affects:
  - 03-02 (loop region and scrubbing will build on waveform display)
  - 03-03 (knob controls will trigger re-render via playbackManager)
  - 03-04 (export will use outputBuffer for WAV encoding)

# Tech tracking
tech-stack:
  added:
    - Canvas API (native) - waveform rendering
    - Web Audio API (native) - playback state machine
  patterns:
    - Singleton PlaybackManager for AudioContext lifecycle
    - RequestAnimationFrame loop for playhead cursor animation
    - Device pixel ratio scaling for crisp canvas rendering
    - Zustand playback store for isPlaying/playheadTime state

key-files:
  created:
    - src/ui/WaveformDisplay.tsx
    - src/audio/playbackManager.ts
    - src/store/playbackStore.ts
    - src/ui/PlaybackControls.tsx
  modified:
    - src/ui/SimulationPanel.tsx
    - src/styles/app.css

key-decisions:
  - "Use native Canvas API instead of WaveSurfer.js for full control over sample-level rendering"
  - "PlaybackManager creates new AudioBufferSourceNode on each play() (Web Audio requirement)"
  - "Stereo waveforms overlaid with distinct colors (blue/orange at 70% opacity) for phase visualization"
  - "Playhead cursor updates via requestAnimationFrame, waveform redraws only when buffer/ioMode changes"

patterns-established:
  - "Singleton pattern for AudioContext to avoid multiple context creation overhead"
  - "Device pixel ratio scaling on canvas to prevent blurriness on high-DPI displays"
  - "Separate playback state store from audio state store for clear separation of concerns"

# Metrics
duration: 4 min
completed: 2026-01-25
---

# Phase 3 Plan 01: Waveform Visualization and Playback Controls Summary

**Canvas-based waveform display with stereo overlay, play/pause controls, and animated playhead cursor for rendered FV-1 audio**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-25T21:33:17Z
- **Completed:** 2026-01-25T21:37:22Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Implemented canvas-based waveform visualization with sample-level detail (not just peaks)
- Stereo waveforms display as overlaid channels with blue (left) and orange (right) at 70% opacity
- Built PlaybackManager singleton handling AudioBufferSourceNode lifecycle (play/pause/seek)
- Created PlaybackControls with large circular button (64px) and requestAnimationFrame playhead updates
- Integrated waveform and controls into SimulationPanel below render result
- Playhead cursor animates in sync with audio playback (red vertical line)
- Automatic playback stop when reaching end of audio

## Task Commits

Each task was committed atomically:

1. **Task 1: Create waveform display component** - `32eedd1` (feat)
   - Canvas-based waveform with device pixel ratio scaling
   - Stereo overlay rendering with distinct colors
   - Red playhead cursor at playback position
   - Auto-resize handling for window changes

2. **Task 2: Build playback manager and controls** - `fba08bc` (feat)
   - PlaybackManager singleton with Web Audio state machine
   - Zustand playbackStore for isPlaying/playheadTime/duration
   - PlaybackControls component with play/pause toggle
   - RequestAnimationFrame loop for smooth cursor updates

3. **Task 3: Wire waveform and playback into app** - `94d9508` (feat)
   - Integrated WaveformDisplay and PlaybackControls into SimulationPanel
   - Set outputBuffer when render completes
   - Reset playback state on new render
   - Removed old AudioContext-based playback handlers

**Plan metadata:** Pending

## Files Created/Modified
- `src/ui/WaveformDisplay.tsx` - Canvas waveform with stereo overlay and playhead cursor (157 lines)
- `src/audio/playbackManager.ts` - Singleton Web Audio playback state machine (121 lines)
- `src/store/playbackStore.ts` - Zustand playback state (isPlaying, playheadTime, duration) (22 lines)
- `src/ui/PlaybackControls.tsx` - Play/pause button with animation frame loop (76 lines)
- `src/ui/SimulationPanel.tsx` - Integrated waveform and controls (modified)
- `src/styles/app.css` - Waveform and playback control styles (modified)

## Decisions Made

**1. Canvas API vs WaveSurfer.js**
- Chose native Canvas API for full control over sample-level rendering
- WaveSurfer.js adds 200KB+ bundle size and removes control needed for stereo overlay
- Canvas allows precise devicePixelRatio scaling for crisp rendering on high-DPI displays

**2. Singleton PlaybackManager pattern**
- AudioContext creation is expensive (causes audio glitches if created repeatedly)
- Singleton ensures single context for all playback operations
- Each play() creates new AudioBufferSourceNode (Web Audio API requirement)

**3. Stereo overlay visualization**
- Overlaid channels (not stacked) show phase relationships at a glance
- Blue (left) and orange (right) at 70% opacity for clear distinction
- Single waveform for mono modes (mono_mono, mono_stereo)

**4. RequestAnimationFrame for playhead**
- Waveform canvas redraws only when buffer/ioMode changes (expensive)
- Playhead cursor updates via requestAnimationFrame (smooth 60fps animation)
- Prevents redundant full waveform redraws during playback

## Deviations from Plan

None - plan executed exactly as written. All success criteria met:
- ✓ WaveformDisplay renders AudioBuffer samples to canvas with full sample detail
- ✓ Stereo waveforms display as overlaid channels with blue/orange at 70% opacity
- ✓ PlaybackManager creates new AudioBufferSourceNode on each play() without errors
- ✓ Play button starts audio, pause button stops cleanly
- ✓ Red playhead cursor animates across waveform during playback, synced with audio
- ✓ Re-rendering audio while playing automatically pauses and resets cursor
- ✓ Waveform and controls only appear when render complete and outputBuffer exists

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Waveform display foundation complete for 03-02 (loop region and scrubbing)
- PlaybackManager ready for seek() integration in 03-02
- OutputBuffer state management ready for 03-04 (WAV export)
- No blockers identified

---
*Phase: 03-audio-interaction-export*
*Completed: 2026-01-25*

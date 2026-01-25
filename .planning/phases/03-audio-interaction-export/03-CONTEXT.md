# Phase 3: Audio Interaction & Export - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the audio interaction workflow. Users can visualize rendered audio with waveforms, manipulate POT knobs (POT0, POT1, POT2) to adjust parameters in real-time, control playback with loops and scrubbing, and export/share their validated code and rendered audio. This phase builds on Phase 2's simulation engine to deliver the complete "paste code → hear audio → tweak → export" workflow.

</domain>

<decisions>
## Implementation Decisions

### Waveform Visualization
- Full waveform with samples (not just peaks) - shows actual sample data for detail
- Stereo channels overlaid with different colors - compact display, shows phase relationships
- No zoom controls - always fit to window, matches quick-audition workflow
- During playback: both playhead cursor (for precision) and highlight/shade played portion (for progress)

### Knob Control Interaction
- Support BOTH vertical drag (up/down) and circular rotation drag - users can choose preferred method
- Pure analog knob aesthetic - no dual-affordance hints, users discover both interactions work
- Display numeric value (0-11) on or near the knob always
- Click knob to enable inline editing - value becomes editable text field for direct numeric entry
- Invalid entries (outside 0-11) are clamped to range - forgiving behavior, snap to nearest bound
- Show progress indicator AND disable knobs during re-render (if >2s) - prevents render queue buildup
- Claude's Discretion: Whether to trigger re-render immediately, debounced, or on mouse release

### Playback Controls
- Play/Pause only - minimal transport, matches quick audition use case
- Loop region selection via draggable handles on waveform - direct manipulation, visual feedback
- Loop mode toggle button (on/off) - explicit user control of loop behavior
- Waveform scrubbing: click anywhere to jump immediately - fast, direct seeking

### Export & Sharing
- Export both rendered audio (WAV) and validated .spn source code as separate downloads
- Shareable URL loads code and knob settings, but waits for user to click Render (no auto-render)
- Claude's Discretion: URL encoding strategy (hash vs query params)
- Claude's Discretion: Whether to include demo audio selection in URL state

</decisions>

<specifics>
## Specific Ideas

- Knob interaction should feel like FV-1 hardware - analog aesthetic with both digital precision (numeric entry) and tactile control (drag/rotate)
- Waveform should make it easy to see phase issues (stereo overlay) and spot where effects kick in (sample-level detail)
- Export workflow focused on "share this sound" and "take to hardware" - both the program and the proof-of-concept audio

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-audio-interaction-export*
*Context gathered: 2026-01-25*

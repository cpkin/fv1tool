# Project State: SpinGPT

**Last Updated:** 2026-01-25
**Status:** Phase 4 In Progress (1/1 plans complete)

---

## Project Reference

### Core Value
Paste .spn code → hear simulated audio in under 2 seconds. Catch bugs before burning EEPROMs.

### Current Focus
Phase 4 complete: Signal path diagrams with Cytoscape.js. All core features implemented.

---

## Current Position

Phase: 4 of 5 (Signal Path Diagrams)
Plan: 1 of 1 in current phase
Status: Phase complete
Last activity: 2026-01-25 - Completed 04-01-PLAN.md

### Progress
```
Phase 0: [████████████████████] 3/3 plans (100%)
Phase 1: [████████████████████] 4/4 plans (100%)
Phase 2: [████████████████████] 11/11 plans (100%)
Phase 3: [████████████████████] 4/4 plans (100%)
Phase 4: [████████████████████] 1/1 plans (100%)
Overall: [████████████████████] 23/23 plans (100%)
```

---

## Performance Metrics

### Velocity
- **Plans completed:** 23
- **Requirements completed:** 50/50 (100%)
- **Phases completed:** 4.0/5 (80%)

### Quality
- **Blockers:** 0 active
- **Technical debt items:** 0 tracked
- **Test coverage:** Not yet applicable

### Efficiency
- **Avg time per plan:** 4 min (93 min / 23 plans)
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
| 2026-01-23 | Generated synthetic demo audio files | Ensures licensing clarity, predictable waveforms for testing, small file sizes | Demo library ready for immediate simulation testing without sourcing external audio |
| 2026-01-23 | Use import.meta.glob for dynamic corpus loading | Enables automatic test discovery when .spn files added | Corpus validation harness can scale without code changes |
| 2026-01-23 | Store baseline metrics in JSON with tolerance-based comparison | Peak ±0.01, RMS ±0.01 tolerance for stability | Corpus validation robust to minor floating-point differences |
| 2026-01-23 | First-run modal with localStorage persistence | Prevents repeated fidelity disclaimer after initial acknowledgment | User sees fidelity notice once, not on every session |
| 2026-01-23 | Analyze compiled instructions for runtime warnings | Flags LOG/EXP, heavy delay RAM usage after compilation | Avoids false positives from unexecuted code paths |
| 2026-01-25 | Scale LFO amplitude via gain constants and delay scales | Keep LFO register values in fixed-point bounds while supporting modulation depth | LFO opcodes produce consistent modulation |
| 2026-01-25 | Advance LFO phases once per sample | Prevent stereo passes from double-advancing modulation | LFOs stay in sync across channels |
| 2026-01-25 | Use nextPc field for SKP/JMP control flow | Cleaner than skip counter; supports both relative and absolute jumps | SKP/JMP handlers set nextPc, interpreter honors it |
| 2026-01-25 | Inject current PC to SKP handler as operand | SKP needs current PC for relative skip calculation | Avoids threading PC through entire handler chain |
| 2026-01-25 | Use native Canvas API instead of WaveSurfer.js | Full control over sample-level rendering, stereo overlay | Avoids 200KB+ bundle size, enables precise devicePixelRatio scaling for crisp waveforms |
| 2026-01-25 | Singleton PlaybackManager for AudioContext | AudioContext creation expensive, causes glitches if repeated | Single context for all playback, creates new AudioBufferSourceNode on each play() |
| 2026-01-25 | Stereo waveforms overlaid (not stacked) | Shows phase relationships at a glance | Blue (left) and orange (right) at 70% opacity for clear distinction |
| 2026-01-25 | RequestAnimationFrame for playhead updates | Waveform redraw expensive, playhead needs 60fps smoothness | Waveform redraws only on buffer/ioMode change, cursor updates every frame |
| 2026-01-25 | Use 16-bit PCM WAV format for export | Maximum compatibility with audio players and DAWs | Predictable file sizes, industry standard lossless format |
| 2026-01-25 | Encode URL state as base64(encodeURIComponent(JSON)) | Cleaner URLs than query params, stays client-side | Supports all Unicode in code, no server logging of shared programs |
| 2026-01-25 | Convert POT values from 0.0-1.0 to 0-11 for URL | Users understand 0-11 range (FV-1 convention) | URL state human-readable, matches user mental model |
| 2026-01-25 | Load URL state without auto-render | Auto-rendering could be confusing and waste CPU | User sees loaded message, must click Render to hear audio |
| 2026-01-25 | Click-to-seek on waveform canvas with pointer cursor | Direct navigation via waveform interaction | Fast playback positioning without separate seek controls |
| 2026-01-25 | Loop region overlay with draggable handles | Allows independent interaction without canvas redraw on drag | Clean separation: canvas for visualization, overlay for interaction |
| 2026-01-25 | Enforce 0.1s minimum gap between loop points | Prevents invalid loopStart >= loopEnd regions | 0.1s is minimum audible loop duration (3.2 samples at 32kHz) |
| 2026-01-25 | Reset loop region to [0, duration] on new render | Prevents old loop region applied to new audio | User must explicitly enable looping for each render |
| 2026-01-25 | Use Cytoscape.js with Dagre layout for signal path diagrams | Mature graph visualization library with strong TypeScript support and proven hierarchical layout | Auto-arranged block diagrams with left-to-right signal flow |
| 2026-01-25 | Detect feedback cycles via topological ranking heuristic | BFS-based ranking assigns depth from inputs; backward edges are feedback | Works well for typical audio signal paths, may not catch all cycles in complex graphs |
| 2026-01-25 | Hide diagram section entirely when no metadata present | Per graceful degradation principle - no nag messages or empty states | Clean UI that doesn't clutter interface when feature not used |
| 2026-01-25 | Auto-expand diagram when valid metadata detected | If user added metadata, they likely want to see the diagram immediately | User can collapse if not needed, default shows their work |

### Active Todos
- 7 pending todos (UX improvements from user testing)

### Blockers
None

---

## Session Continuity

Last session: 2026-01-25T23:20:43Z
Stopped at: Completed 04-01-PLAN.md
Resume file: None

### What Just Happened
- Completed Phase 4 Plan 1: Signal path diagram visualization
- Installed Cytoscape.js, cytoscape-dagre, dagre dependencies
- Created metadata parser extracting ;@fx headers from SpinASM source
- Built graph builder with feedback cycle detection via topological ranking
- Implemented SignalPathDiagram component with analog aesthetic and Dagre auto-layout
- Integrated collapsible diagram section into SimulationPanel
- All 23 planned plans across Phases 0-4 now complete (100%)

### What's Next
1. Consider project complete for production deployment (all core features implemented)
2. Optional: User testing with metadata-annotated .spn programs
3. Optional: Phase 5 (production deployment) or additional enhancements

### Context for Next Session
- **Project:** Browser-based FV-1 SpinASM validator and audio simulator
- **User background:** FV-1 pedal builder frustrated by SpinCAD bugs and Windows-only tooling
- **Tech stack:** React + TypeScript + Web Audio API (offline rendering)
- **Critical risks:** Fixed-point math emulation, sample rate conversion, parser robustness
- **Success metric:** Paste code → hear audio in <2 seconds

---

*State initialized: 2026-01-22*
*Ready for planning*

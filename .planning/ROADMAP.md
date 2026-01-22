# Roadmap: SpinGPT

**Created:** 2026-01-22
**Core Value:** Paste .spn code → hear simulated audio in under 2 seconds. Catch bugs before burning EEPROMs.
**Depth:** Quick (5 phases)

## Overview

SpinGPT delivers a browser-based FV-1 SpinASM validator and audio simulator through five natural delivery phases. Phase 0 establishes foundational specifications and test infrastructure. Phase 1 delivers complete code validation (syntax, resources, linting). Phase 2 implements the critical audio simulation engine. Phase 3 completes the audio interaction workflow (visualization, knobs, export). Phase 4 adds metadata-driven signal path diagrams as an enhancement. Each phase delivers a coherent, verifiable capability that unblocks the next.

---

## Phase 0: Foundation & Test Infrastructure

**Goal:** Specifications and test corpus locked; development can proceed with confidence

**Dependencies:** None (kickoff phase)

**Requirements:**
- FOUND-01: Lock SpinASM dialect specification for parser target
- FOUND-02: Lock metadata schema v1 (versioned ;@fx v1/v2 format)
- FOUND-03: Define simulator strategy (reference implementations, fidelity target)
- FOUND-04: Create validation test corpus from official Spin demo programs
- FOUND-05: Document simulation fidelity target ("gross correctness" definition)
- FOUND-06: Identify tooling gaps from community (diystompboxes.com, PedalPCB)

**Success Criteria:**
1. SpinASM dialect spec documented with syntax examples, instruction set reference, and edge cases
2. Metadata schema v1 published with versioning strategy (backward compatibility plan)
3. Test corpus contains 10+ official Spin demo programs with expected outputs
4. Simulation fidelity target documented: "gross correctness" for bug catching, not cycle-accurate emulation
5. Community feedback collected from at least 2 forums identifying top 3 pain points in existing tools

---

## Phase 1: Code Validation & Analysis

**Goal:** Users can paste .spn code and see syntax errors, resource usage, and lint warnings instantly

**Dependencies:** Phase 0 (requires SpinASM spec and test corpus)

**Requirements:**
- EDIT-01: Integrate CodeMirror 6 with SpinASM syntax highlighting
- EDIT-02: Display enhanced error messages with context (±2 lines around error)
- EDIT-03: Provide suggested fixes where possible ("Did you mean 'wra' instead of 'war'?")
- EDIT-04: Categorize messages as ERROR | WARNING | INFO
- EDIT-05: ONE-CLICK "Copy errors & warnings" button for AI iteration
- RSRC-01: Display instruction count meter (<=128 limit)
- RSRC-02: Display delay RAM usage (samples + ms @ 32 kHz)
- RSRC-03: Track register usage (best-effort via equ and usage analysis)
- LINT-01: Warn on unused pots (pot0/1/2 never referenced)
- LINT-02: Warn on memory allocated but never written (no wra/wrax to mem)
- LINT-03: Warn on memory written but never read (no rda/rdax/rmpa from mem)
- LINT-04: Warn on register read before write (undefined state)
- LINT-05: Warn on output never written (no wrax dacl/dacr)
- LINT-06: Warn on potential clipping (gain sum >1.0 without saturation)
- LINT-07: Warn on delay address out of bounds

**Success Criteria:**
1. User can paste .spn code into CodeMirror editor with SpinASM syntax highlighting active
2. Parser validates code and displays errors with ±2 line context and categorization (ERROR/WARNING/INFO)
3. Resource meters show instruction count, delay RAM usage (samples + ms), and register usage in real-time
4. All 7 priority-1 lint warnings detect issues and display actionable messages
5. One-click button copies all errors and warnings to clipboard for AI iteration workflow
6. Parser passes all test corpus files from Phase 0 without false positives

---

## Phase 2: Audio Simulation Engine

**Goal:** Users can render audio through FV-1 simulation and hear how their code affects sound

**Dependencies:** Phase 1 (requires parser output, AST, validated code)

**Requirements:**
- SIM-01: Implement FV-1 instruction interpreter (40+ instructions)
- SIM-02: Implement fixed-point math helpers (1.23 format emulation)
- SIM-03: Implement 32-sample block processing for correct POT timing
- SIM-04: Render audio offline using Web Audio API OfflineAudioContext
- SIM-05: Support input formats: WAV, MP3, M4A
- SIM-06: Include 3-4 built-in demo audio files (guitar, synth, drums, voice)
- SIM-07: Automatically resample input audio to 32 kHz (FV-1 native)
- SIM-08: Handle IO modes: mono_mono, stereo_stereo, mono_stereo
- SIM-09: Enforce max render length: 30s default, 2min max with warning
- SIM-10: Show progress bar for renders >10 seconds
- SIM-11: Test interpreter against official Spin demo programs
- SIM-12: Document simulation limitations clearly in UI

**Success Criteria:**
1. User can upload audio file (WAV/MP3/M4A) or select built-in demo (guitar/synth/drums/voice)
2. Simulator renders audio through validated .spn code in <2 seconds for 30-second input
3. All 40+ FV-1 instructions execute correctly with fixed-point math (1.23 format)
4. Audio processing respects 32-sample block boundaries for correct POT timing
5. All three IO modes (mono_mono, stereo_stereo, mono_stereo) produce correct output
6. Simulator passes validation against all official Spin demo programs from test corpus
7. UI displays simulation limitations and known deviations from hardware behavior

---

## Phase 3: Audio Interaction & Export

**Goal:** Users can visualize waveforms, manipulate knobs, and export results

**Dependencies:** Phase 2 (requires audio rendering capability)

**Requirements:**
- VIZ-01: Display waveform (WaveSurfer.js or custom canvas)
- VIZ-02: Enable waveform scrubbing (click to seek)
- VIZ-03: Add loop playback toggle
- VIZ-04: Add loop region selector (drag start/end points)
- VIZ-05: Display stereo waveforms separately for stereo_stereo mode
- KNOB-01: Render on-screen knobs (POT0, POT1, POT2) with analog aesthetic
- KNOB-02: Knob UI range: 0–11 (FV-1 standard)
- KNOB-03: Knob changes trigger audio re-render
- KNOB-04: Fast re-render on knob change (<2 second target)
- EXP-01: Export validated .spn source file
- EXP-02: Encode .spn source + knob settings in shareable URL (hash or query param)
- EXP-03: Support "share this sound" workflow via URL

**Success Criteria:**
1. Waveform displays rendered audio with peaks visualization and playback position indicator
2. User can click waveform to seek, drag loop region markers, and toggle loop playback
3. Three analog-style knobs (POT0, POT1, POT2) display with 0-11 range and respond to drag
4. Knob changes trigger re-render in <2 seconds by reusing cached AST (not re-parsing)
5. User can export validated .spn source file and rendered audio as WAV
6. User can share code + knob settings via URL hash, which loads complete state when visited
7. Stereo waveforms display as dual channels for stereo_stereo mode

---

## Phase 4: Signal Path Diagrams

**Goal:** Users can visualize signal flow from metadata annotations

**Dependencies:** Phase 1 (requires parser with metadata extraction)

**Requirements:**
- DIAG-01: Parse metadata header from .spn files (;@fx v1/v2)
- DIAG-02: Render block-diagram visualization from metadata (Cytoscape.js or D3.js)
- DIAG-03: Auto-layout signal flow using Dagre or similar algorithm
- DIAG-04: Support feedback cycles (mark feedback edges differently)
- DIAG-05: Graceful degradation: show warning if metadata missing, rest of tool works

**Success Criteria:**
1. Parser extracts metadata from ;@fx headers (v1 and v2 formats) including signal graph
2. Block diagram renders signal flow with auto-layout (Dagre algorithm via Cytoscape.js)
3. Feedback cycles display with distinct visual treatment (dashed edges, different color)
4. Diagram updates when code changes and metadata is re-parsed
5. If metadata is missing or invalid, tool displays warning but remains fully functional (validation, simulation, export all work)

---

## Progress Tracking

| Phase | Status | Progress | Completed |
|-------|--------|----------|-----------|
| 0 - Foundation & Test Infrastructure | Not Started | 0/6 requirements | — |
| 1 - Code Validation & Analysis | Not Started | 0/15 requirements | — |
| 2 - Audio Simulation Engine | Not Started | 0/12 requirements | — |
| 3 - Audio Interaction & Export | Not Started | 0/12 requirements | — |
| 4 - Signal Path Diagrams | Not Started | 0/5 requirements | — |

**Overall:** 0/50 requirements complete (0%)

---

## Coverage Summary

**Total v1 requirements:** 50
**Requirements mapped to phases:** 50
**Unmapped requirements:** 0 ✓

**Phase distribution:**
- Phase 0: 6 requirements (foundation)
- Phase 1: 15 requirements (validation)
- Phase 2: 12 requirements (simulation)
- Phase 3: 12 requirements (interaction)
- Phase 4: 5 requirements (diagrams)

**Deferred to v2:** Audio export enhancements (AUD-01, AUD-02), advanced lint rules (LINT-08–10), developer experience features (DX-01–03), simulation quality improvements (SIM-13–14), assembler integration (ASM-01–04), stretch goals (AUTO-01–02, DIAG-06, INT-01)

---

*Roadmap created: 2026-01-22*
*Last updated: 2026-01-22*

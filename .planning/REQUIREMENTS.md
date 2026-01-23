# Requirements: SpinGPT

**Defined:** 2026-01-22
**Core Value:** Paste .spn code → hear simulated audio in under 2 seconds. Catch bugs before burning EEPROMs.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Phase 0: Foundation

- [ ] **FOUND-01**: Lock SpinASM dialect specification for parser target
- [ ] **FOUND-02**: Lock metadata schema v1 (versioned ;@fx v1/v2 format)
- [ ] **FOUND-03**: Define simulator strategy (reference implementations, fidelity target)
- [ ] **FOUND-04**: Create validation test corpus from official Spin demo programs
- [ ] **FOUND-05**: Document simulation fidelity target ("gross correctness" definition)
- [ ] **FOUND-06**: Identify tooling gaps from community (diystompboxes.com, PedalPCB)

### Phase 1: Code Validation & Analysis

- [ ] **EDIT-01**: Integrate CodeMirror 6 with SpinASM syntax highlighting
- [ ] **EDIT-02**: Display enhanced error messages with context (±2 lines around error)
- [ ] **EDIT-03**: Provide suggested fixes where possible ("Did you mean 'wra' instead of 'war'?")
- [ ] **EDIT-04**: Categorize messages as ERROR | WARNING | INFO
- [ ] **EDIT-05**: ONE-CLICK "Copy errors & warnings" button for AI iteration

- [ ] **RSRC-01**: Display instruction count meter (<=128 limit)
- [ ] **RSRC-02**: Display delay RAM usage (samples + ms @ 32 kHz)
- [ ] **RSRC-03**: Track register usage (best-effort via equ and usage analysis)

- [ ] **LINT-01**: Warn on unused pots (pot0/1/2 never referenced)
- [ ] **LINT-02**: Warn on memory allocated but never written (no wra/wrax to mem)
- [ ] **LINT-03**: Warn on memory written but never read (no rda/rdax/rmpa from mem)
- [ ] **LINT-04**: Warn on register read before write (undefined state)
- [ ] **LINT-05**: Warn on output never written (no wrax dacl/dacr)
- [ ] **LINT-06**: Warn on potential clipping (gain sum >1.0 without saturation)
- [ ] **LINT-07**: Warn on delay address out of bounds

### Phase 2: Audio Simulation (MVP CRITICAL)

- [ ] **SIM-01**: Implement FV-1 instruction interpreter (40+ instructions)
- [ ] **SIM-02**: Implement fixed-point math helpers (1.23 format emulation)
- [ ] **SIM-03**: Implement 32-sample block processing for correct POT timing
- [ ] **SIM-04**: Render audio offline using Web Audio API OfflineAudioContext
- [ ] **SIM-05**: Support input formats: WAV, MP3, M4A
- [ ] **SIM-06**: Include 3-4 built-in demo audio files (guitar, synth, drums, voice)
- [ ] **SIM-07**: Automatically resample input audio to 32 kHz (FV-1 native)
- [ ] **SIM-08**: Handle IO modes: mono_mono, stereo_stereo, mono_stereo
- [ ] **SIM-09**: Enforce max render length: 30s default, 2min max with warning
- [ ] **SIM-10**: Show progress bar for renders >10 seconds
- [ ] **SIM-11**: Test interpreter against official Spin demo programs
- [ ] **SIM-12**: Document simulation limitations clearly in UI

### Phase 3: Audio Visualization & Interaction

- [ ] **VIZ-01**: Display waveform (WaveSurfer.js or custom canvas)
- [ ] **VIZ-02**: Enable waveform scrubbing (click to seek)
- [ ] **VIZ-03**: Add loop playback toggle
- [ ] **VIZ-04**: Add loop region selector (drag start/end points)
- [ ] **VIZ-05**: Display stereo waveforms separately for stereo_stereo mode

- [ ] **KNOB-01**: Render on-screen knobs (POT0, POT1, POT2) with analog aesthetic
- [ ] **KNOB-02**: Knob UI range: 0–11 (FV-1 standard)
- [ ] **KNOB-03**: Knob changes trigger audio re-render
- [ ] **KNOB-04**: Fast re-render on knob change (<2 second target)

### Phase 4: Signal Path Diagram & Export

- [ ] **DIAG-01**: Parse metadata header from .spn files (;@fx v1/v2)
- [ ] **DIAG-02**: Render block-diagram visualization from metadata (Cytoscape.js or D3.js)
- [ ] **DIAG-03**: Auto-layout signal flow using Dagre or similar algorithm
- [ ] **DIAG-04**: Support feedback cycles (mark feedback edges differently)
- [ ] **DIAG-05**: Graceful degradation: show warning if metadata missing, rest of tool works

- [ ] **EXP-01**: Export validated .spn source file
- [ ] **EXP-02**: Encode .spn source + knob settings in shareable URL (hash or query param)
- [ ] **EXP-03**: Support "share this sound" workflow via URL

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Audio Export

- **AUD-01**: Export rendered audio as WAV (lossless)
- **AUD-02**: Export rendered audio as MP3 (compressed)

### Advanced Validation

- **LINT-08**: Feedback loop stability analysis
- **LINT-09**: Dead code detection
- **LINT-10**: LFO rate vs delay time sanity checks

### Developer Experience

- **DX-01**: Preset/recipe templates (5-10 canonical effects with full metadata)
- **DX-02**: Side-by-side diff tool for AI revisions
- **DX-03**: Pre-hardware validation checklist (all pots used, no warnings, tested with multiple inputs, etc)

### Simulation Quality

- **SIM-13**: Improved simulation fidelity based on hardware testing feedback
- **SIM-14**: Document known deviations from hardware behavior

### Assembler Integration (Phase 3)

- **ASM-01**: In-browser SpinASM assembler (WASM-based)
- **ASM-02**: Validate assembled output matches SpinASM reference (binary equivalence)
- **ASM-03**: Export compiled .hex output
- **ASM-04**: 8-program bank export

### Stretch Goals (Phase 4)

- **AUTO-01**: Pot automation during render (linear ramps, LFOs)
- **AUTO-02**: Export automation as .json sidecar
- **DIAG-06**: Optional "Verify" button: check metadata graph vs actual register flow
- **INT-01**: Integration hooks with hardware programmer tools

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time audio processing | Offline rendering sufficient for validation workflow; real-time adds complexity without clear benefit |
| Drag-and-drop DSP editor | SpinCAD already provides visual editing; SpinGPT is code-first validation tool |
| Server-side processing | Browser-only architecture keeps tool simple, fast, free to host; aligns with offline capability goal |
| AI API integration | Users bring their own AI agent (BYO model); tool provides validation, not generation |
| Monetization features | Open source, free, community-driven project |
| Cycle-accurate FV-1 emulation | "Gross correctness" sufficient for bug catching; document known deviations clearly |
| Competing with SpinCAD | Positioned as complementary code-first validation layer, not replacement |
| Email verification | No accounts, no server, browser-only tool |
| Mobile app | Web-first; mobile browser support best-effort |
| Video posts | Not applicable to DSP code validation tool |
| OAuth login | No authentication needed for browser-only static tool |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 0 | Complete |
| FOUND-02 | Phase 0 | Complete |
| FOUND-03 | Phase 0 | Complete |
| FOUND-04 | Phase 0 | Complete |
| FOUND-05 | Phase 0 | Complete |
| FOUND-06 | Phase 0 | Complete |
| EDIT-01 | Phase 1 | Complete |
| EDIT-02 | Phase 1 | Complete |
| EDIT-03 | Phase 1 | Complete |
| EDIT-04 | Phase 1 | Complete |
| EDIT-05 | Phase 1 | Complete |
| RSRC-01 | Phase 1 | Complete |
| RSRC-02 | Phase 1 | Complete |
| RSRC-03 | Phase 1 | Complete |
| LINT-01 | Phase 1 | Complete |
| LINT-02 | Phase 1 | Complete |
| LINT-03 | Phase 1 | Complete |
| LINT-04 | Phase 1 | Complete |
| LINT-05 | Phase 1 | Complete |
| LINT-06 | Phase 1 | Complete |
| LINT-07 | Phase 1 | Complete |
| SIM-01 | Phase 2 | Pending |
| SIM-02 | Phase 2 | Pending |
| SIM-03 | Phase 2 | Pending |
| SIM-04 | Phase 2 | Pending |
| SIM-05 | Phase 2 | Pending |
| SIM-06 | Phase 2 | Pending |
| SIM-07 | Phase 2 | Pending |
| SIM-08 | Phase 2 | Pending |
| SIM-09 | Phase 2 | Pending |
| SIM-10 | Phase 2 | Pending |
| SIM-11 | Phase 2 | Pending |
| SIM-12 | Phase 2 | Pending |
| VIZ-01 | Phase 3 | Pending |
| VIZ-02 | Phase 3 | Pending |
| VIZ-03 | Phase 3 | Pending |
| VIZ-04 | Phase 3 | Pending |
| VIZ-05 | Phase 3 | Pending |
| KNOB-01 | Phase 3 | Pending |
| KNOB-02 | Phase 3 | Pending |
| KNOB-03 | Phase 3 | Pending |
| KNOB-04 | Phase 3 | Pending |
| EXP-01 | Phase 3 | Pending |
| EXP-02 | Phase 3 | Pending |
| EXP-03 | Phase 3 | Pending |
| DIAG-01 | Phase 4 | Pending |
| DIAG-02 | Phase 4 | Pending |
| DIAG-03 | Phase 4 | Pending |
| DIAG-04 | Phase 4 | Pending |
| DIAG-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 50 total
- Mapped to phases: 50
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-22*
*Last updated: 2026-01-23 after Phase 1 completion*

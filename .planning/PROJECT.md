# SpinGPT: Web-Based FV-1 Authoring, Validation & Simulation Tool

## What This Is

A browser-based FV-1 SpinASM code validator and audio simulator that helps pedal builders iterate faster by providing instant feedback on syntax errors, resource usage, and audio behavior. Users paste .spn code (often AI-generated or exported from SpinCAD), validate it, simulate audio processing with adjustable knobs, and catch bugs before burning EEPROMs. Fills the gap between SpinCAD's visual editor and hardware testing.

## Core Value

Paste .spn code → hear simulated audio in under 2 seconds. Catch bugs before burning EEPROMs.

## Requirements

### Validated

(None yet — ship to validate)

### Active

#### Phase 0: Community Validation & Foundation (Pre-MVP)

- [ ] Post on diystompboxes.com + PedalPCB forums: "Would you use a web FV-1 simulator/validator?"
- [ ] Contact Digital Larry (SpinCAD author) for potential collaboration/blessing
- [ ] Contact Spin Semiconductor for validation/endorsement
- [ ] Identify most painful gaps in current tooling via community feedback
- [ ] Lock metadata schema v1 (versioned, documented)
- [ ] Lock SpinASM dialect for parsing/simulation
- [ ] Choose and document license (GPL acceptable if leveraging SpinCAD simulator code)
- [ ] Define simulator strategy: Study SpinCAD/ElmGen simulators, implement interpreter for FV-1 instructions
- [ ] Create validation test corpus from official Spin demo programs
- [ ] Document simulation fidelity target: "gross correctness" for bug catching, not cycle-accurate emulation

#### Phase 1: MVP Core Loop (Simulator + Validator)

**A) Code Editor & Validation**
- [ ] Integrate CodeMirror 6 with SpinASM syntax highlighting
- [ ] Build SpinASM source parser (validation without compilation)
- [ ] Enhanced error/warning display with context (±2 lines around error)
- [ ] Suggested fixes where possible ("Did you mean 'wra' instead of 'war'?")
- [ ] Categorized messages: ERROR | WARNING | INFO
- [ ] ONE-CLICK "Copy errors & warnings" button for AI iteration

**B) Resource Analysis**
- [ ] Instruction count meter (<=128) parsed from source
- [ ] Delay RAM usage display (samples + ms @ 32 kHz) from mem declarations
- [ ] Register usage tracking (best-effort via equ and usage analysis)
- [ ] Priority 1 lint warnings:
  - [ ] Unused pots (pot0/1/2 never referenced)
  - [ ] Memory allocated but never written (no wra/wrax to mem)
  - [ ] Memory written but never read (no rda/rdax/rmpa from mem)
  - [ ] Register read before write (undefined state)
  - [ ] Output never written (no wrax dacl/dacr)
  - [ ] Potential clipping (gain sum >1.0 without saturation)
  - [ ] Delay address out of bounds

**C) Audio Simulation (MVP CRITICAL)**
- [ ] Implement FV-1 instruction interpreter in JavaScript/TypeScript
- [ ] OFFLINE audio rendering using Web Audio API OfflineAudioContext
- [ ] Input format support: WAV, MP3, M4A
- [ ] Include 3-4 built-in demo audio files (guitar, synth, drums, voice)
- [ ] Automatic audio preprocessing:
  - [ ] Resample to 32 kHz (FV-1 native sample rate)
  - [ ] Downmix or preserve stereo based on program IO mode
  - [ ] Truncate audio beyond max render length
- [ ] Max render length: 30 seconds default, 2 minutes max (with warning)
- [ ] Progress bar for renders >10 seconds
- [ ] Rendered audio player with playback controls
- [ ] Fast re-render when knobs change (<2 seconds target)
- [ ] IO mode handling: mono_mono, stereo_stereo, mono_stereo
- [ ] Test against official Spin demo programs for correctness validation
- [ ] Document simulation limitations clearly in UI

**D) Audio Visualization & Interaction**
- [ ] Waveform display (Peaks.js or custom canvas)
- [ ] Waveform scrubbing
- [ ] Loop playback toggle
- [ ] Simple loop region selector (drag start/end)
- [ ] On-screen knobs (POT0, POT1, POT2) with analog aesthetic
- [ ] Knob UI range: 0–11 (FV-1 standard)
- [ ] Knob changes trigger re-render
- [ ] Stereo waveforms shown separately for stereo_stereo mode

**E) Signal Path Diagram**
- [ ] Parse metadata header from .spn files
- [ ] Block-diagram visualization driven ONLY by metadata
- [ ] Auto-layout using Dagre or Cytoscape.js
- [ ] Support feedback cycles (mark feedback edges differently)
- [ ] Warning displayed: "Diagram is from metadata, not code analysis"
- [ ] Graceful degradation: If metadata missing, show warning, rest of tool works

**F) Shareable Links (No Server)**
- [ ] Encode .spn source + knob settings in URL hash
- [ ] Format: #<base64> or ?code=<compressed>
- [ ] Enable "share this sound" workflow

**G) Export Options**
- [ ] Export validated .spn source file
- [ ] Audio export: WAV (lossless)
- [ ] Audio export: MP3 (optional compressed format)

**H) UI Design**
- [ ] Hybrid analog/modern aesthetic:
  - [ ] Analog-style knobs for POT0/1/2
  - [ ] VU meter style for resource usage (instruction count, RAM)
  - [ ] Clean, modern layout for editor and error messages
  - [ ] Retro touches (beveled panels, rack-mount hints) without sacrificing usability
- [ ] Chrome-first, responsive layout
- [ ] Fast, lightweight (static hosting on GitHub Pages or Netlify)

#### Phase 2: Quality & Developer Experience

- [ ] Expanded lint rules (Priority 2):
  - [ ] Feedback loop stability analysis
  - [ ] Dead code detection
  - [ ] LFO rate vs delay time sanity checks
- [ ] Diagram layout polish (better auto-layout, visual feedback)
- [ ] Preset/recipe templates (5-10 canonical effects with full metadata)
- [ ] Side-by-side diff tool for AI revisions
- [ ] Pre-hardware validation checklist:
  - [ ] All pots used
  - [ ] No warnings
  - [ ] Tested with multiple input types
  - [ ] Gain staging safe
  - [ ] <128 instructions
  - [ ] <32K RAM
- [ ] Improved error messages + suggestions based on community feedback
- [ ] Simulation fidelity improvements based on hardware testing comparisons

#### Phase 3: Assembler Integration

- [ ] Research assembler source options:
  - [ ] Option A: Port official SpinASM (C/C++ → WASM) with Spin Semi permission
  - [ ] Option B: Clean-room implementation from instruction set spec
  - [ ] Option C: Fork/adapt existing open source assembler
- [ ] Implement in-browser SpinASM assembler (WASM-based)
- [ ] Validate assembled output matches SpinASM reference (binary equivalence)
- [ ] Export compiled .hex output
- [ ] 8-program bank export

#### Phase 4: Stretch Goals

- [ ] Pot automation during render (linear ramps, LFOs)
- [ ] Export automation as .json sidecar
- [ ] Improved loop detection in signal path
- [ ] More faithful FV-1 hardware quirks (based on community needs)
- [ ] Optional "Verify" button: check metadata graph vs actual register flow
- [ ] Integration hooks with hardware programmer tools

### Out of Scope

- **Real-time audio processing** — Offline rendering only (complexity, latency issues)
- **Drag-and-drop DSP editor** — Code-first tool; SpinCAD already does visual editing
- **Server-side processing** — Browser-only, no backend
- **AI API integration** — Users bring their own AI agent (BYO agent model)
- **Monetization** — Open source, free, community-driven
- **Cycle-accurate FV-1 emulation** — Audition quality sufficient; document known deviations
- **Competing with SpinCAD** — Positioned as complementary code-first validation layer

## Context

### Market Validation

- **ZERO web-based FV-1 tools exist** (confirmed via community research on diystompboxes.com, PedalPCB forums)
- Current tools:
  - SpinCAD Designer (Java desktop app, visual block editor, buggy simulator)
  - SpinASM (Windows-only assembler, no simulator)
- Active DIY pedal community desperate for modern, cross-platform tooling
- Expected to become community standard within 6 months if well-executed

### Target Users

1. **Hobbyist FV-1 pedal builders** (primary: you and SpinCAD users)
2. **DSP tinkerers** exploring audio algorithms
3. **Audio product engineers** prototyping FV-1 designs
4. **AI experimenters** generating DSP code with Claude/ChatGPT
5. **Linux/Mac users** avoiding Windows VMs for SpinASM

### Your Background

- FV-1 pedal builder using SpinCAD's visual editor
- Frustrated by SpinCAD simulator unreliability and Windows-only tooling
- Workflow: Export from SpinCAD → need code-level validation → burn EEPROM
- Scratching your own itch; lived the pain this tool solves

### Technical Environment

- **FV-1 Chip**: Spin Semiconductor's fixed-point DSP for audio effects
  - 128 instruction limit
  - 32K delay RAM
  - 32 kHz sample rate
  - 3 analog pot inputs (0–11 range)
- **SpinASM**: Assembly language for FV-1
- **Metadata Contract**: Versioned header in .spn files enabling visualization and AI determinism
  - Schema: `;@fx v2` (strict) or `;@fx v1` (original)
  - Defines: effect name, IO mode, pot labels, memory allocations, signal graph
  - Optional: Tool works without metadata (diagram unavailable, rest functions)

### AI Workflow (BYO Agent)

- No AI integration in tool itself
- Tool provides:
  - **Agent Pack**: Single GitHub-hosted prompt file (`docs/AGENT_PROMPT.md`)
    - Links to modular reference docs (`/reference/instruction-set.md`, `/metadata-schema.md`)
    - Links to example programs (`/examples/*.spn`)
  - Fast paste → validate → simulate loop
  - One-click copy of errors/warnings for AI iteration
- User pastes GitHub URL into Claude/ChatGPT
- AI acts as junior DSP engineer; tool is source of truth

### Competitive Positioning

**vs. SpinCAD Designer:**
- Complementary, not competitive
- SpinCAD: Graphical block editor, patch generation
- SpinGPT: Code-first validation, simulation, AI workflow
- Integration opportunity: SpinCAD export → SpinGPT validate/audition

**vs. SpinASM:**
- Fills simulation gap (SpinASM has no simulator)
- Cross-platform (vs Windows-only)
- Modern web UX (vs desktop CLI)
- AI-friendly feedback loop (vs manual iteration)

**Unique Value:**
- ONLY web-based FV-1 simulator
- ONLY tool designed for AI code generation workflow
- ONLY tool with metadata-driven visualization
- ONLY tool with shareable URL encoding

### Success Metrics (MVP)

**5 minutes:**
- Paste .spn → Simulate → Hear audio → See resource meters

**1 hour:**
- Iterate using AI + validation feedback
- Tune knobs and hear changes
- Export validated program for external compilation

**6 months:**
- Become go-to validation/audition tool in FV-1 community
- Organic sharing on forums (diystompboxes, PedalPCB, r/diypedals)
- Positive reception from Digital Larry and/or Spin Semiconductor

## Constraints

- **Tech Stack**: Browser-only (no server), static hosting
- **License**: GPL acceptable if leveraging SpinCAD simulator code
- **Platform**: Chrome-first (other browsers best-effort)
- **Audio Format**: Offline rendering only (no real-time processing)
- **Simulation Fidelity**: "Gross correctness" bar — catches bugs (wrong delay lengths, unstable feedback, silent outputs), not sonic perfection
- **Offline Capability**: Nice to have, not MVP requirement (defer to Phase 2)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Defer assembler to Phase 3 | Prove demand with simulator/validator first; avoid scope creep | — Pending |
| GPL license acceptable | Can reuse/study SpinCAD simulator code for better fidelity | — Pending |
| Metadata optional, not required | Tool must work with legacy .spn files; metadata enhances but doesn't gate | — Pending |
| "Gross correctness" simulation bar | Users need bug detection, not hardware perfection; document limitations clearly | — Pending |
| Browser-only, no server | Keeps tool simple, fast, free to host; aligns with static/offline goals | — Pending |
| Position as SpinCAD complement | Build relationships, not competition; integration opportunities (export → validate) | — Pending |
| Phase 0 community validation | De-risk adoption by building relationships with Digital Larry, Spin Semi, forums before coding | — Pending |
| GitHub-hosted agent prompt | Minimal copy-paste for users; AI can follow links to reference docs; versioned and maintainable | — Pending |
| Hybrid analog/modern UI | Analog knobs/meters for familiarity; clean editor/errors for readability | — Pending |

---
*Last updated: 2025-01-22 after initialization*

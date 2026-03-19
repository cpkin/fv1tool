# SpinIDE

**Browser-based IDE for the Spin Semiconductor FV-1 DSP chip.** Write SpinASM code, simulate the effect, and hear the result.

**Live:** [spinide.vercel.app](https://spinide.vercel.app)

---

## What It Does

SpinIDE compiles and simulates FV-1 SpinASM programs in the browser. Load audio, write or paste your effect code, click Render, and listen to the output. Adjust POT0–POT2 and hear changes in real time.

- **SpinASM compiler** with real-time diagnostics and resource meters
- **FV-1 simulator** — 32,768 Hz fixed-point execution with delay RAM, LFOs, and CHO
- **Oscilloscope** — waveform viewer with playhead, zoom, channel select, and dry/wet overlay
- **FFT spectrum** — frequency analysis of rendered output
- **Delay memory map** — visual representation of MEM allocations and read/write regions
- **Signal path diagram** — auto-generated from `;@fx` metadata headers
- **18 example programs** from the [mstratman/fv1-programs](https://github.com/mstratman/fv1-programs) collection
- **Live/Manual knob modes** — Live auto-renders a 3s preview on pot change; Manual lets you tweak freely then re-render
- **Export** — download rendered audio as WAV or save your source as `.spn`
- **Drag-and-drop** `.spn` files into the editor
- **LLM workflow** — copy a ready-made prompt that gives Claude/ChatGPT the full FV-1 instruction set reference

## Quick Start

1. Pick a demo clip from the **Demo** dropdown or click **Upload .wav**
2. Select an example from the **Examples** dropdown, or write your own SpinASM code
3. Click **Render**
4. Hit **Play** to listen

## Using an LLM to Write Effects

SpinIDE includes a built-in FV-1 development guide that you can feed to any LLM:

1. Expand the **FV-1 LLM Usage Guide** in the app
2. Click **Copy Guide Prompt**
3. Paste into Claude, ChatGPT, or any LLM
4. Describe the effect you want — the LLM will generate valid SpinASM code
5. Paste the output into SpinIDE and render

The guide covers the full FV-1 architecture, instruction set, delay RAM, LFOs, fixed-point math, and common patterns like reverb tanks, allpass filters, pitch shifting, and shelving EQ.

## Development

```bash
npm install
npm run dev        # Vite dev server on localhost:5173
npm run build      # Production build
npm run typecheck  # TypeScript check
```

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Zustand (state management)
- CodeMirror 6 (editor with custom SpinASM grammar)
- Canvas2D (oscilloscope, FFT, delay memory map)
- Cytoscape.js + Dagre (signal path diagrams)
- Web Audio API (playback and resampling)
- Pure JS FFT (no dependencies)

## FV-1 Development Guide

The full reference is at [`docs/fv1-development-guide.md`](docs/fv1-development-guide.md) — covering the instruction set, memory model, fixed-point math, LFO/CHO behavior, and production-tested patterns from 100+ real-world FV-1 programs.

## Acknowledgments

- **[Spin Semiconductor](http://www.spinsemi.com/)** — FV-1 chip and SpinASM reference
- **[audiofab/fv1-vscode](https://github.com/audiofab/fv1-vscode)** — FV-1 simulator core (MIT License), shelving filter documentation, and reference implementations
- **[mstratman/fv1-programs](https://github.com/mstratman/fv1-programs)** — Community FV-1 program collection with 85+ effects by Spin Semi, Digital Larry, Don Stavely, David Rolo, Alex Lawrow, and many others
- **[SpinCAD Designer](https://github.com/HolyCityAudio/SpinCAD-Designer)** — Visual FV-1 block editor (inspiration)
- **[asfv1](https://github.com/ndf-zz/asfv1)** — Cross-platform Python SpinASM assembler (behavior reference)

## License

MIT

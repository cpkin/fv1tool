---
created: 2026-01-25T19:31
title: Auto-detect mono vs stereo input, only show output mode selector
area: ui
files:
  - src/ui/SimulationPanel.tsx
  - src/audio/renderSimulation.ts
---

## Problem

Current UI requires users to manually select both input and output audio modes (mono_mono, stereo_stereo, mono_stereo). This creates confusion and potential mismatches:
- Users upload stereo file but select mono input → audio gets incorrectly downmixed
- Users upload mono file but select stereo input → wasted processing
- Three-way choice is overwhelming when input mode should be automatic

The input mode should be automatically detected from the uploaded audio file's channel count. Users should only choose the desired OUTPUT mode:
- "Mono output" — process as mono (downmix stereo input if needed)
- "Stereo output" — process as stereo (duplicate mono input to both channels if needed)

This simplifies the UI from 3 modes to 2 choices, and makes the behavior more predictable.

## Solution

1. Detect input channel count when audio file is decoded in renderSimulation.ts
2. Remove input mode from UI selector, only show output mode choice
3. Derive IO mode automatically:
   - Input=mono, Output=mono → mono_mono
   - Input=mono, Output=stereo → mono_stereo  
   - Input=stereo, Output=mono → stereo_mono (downmix)
   - Input=stereo, Output=stereo → stereo_stereo
4. Display detected input mode as info text: "Input: Mono/Stereo (detected)"

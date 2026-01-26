---
created: 2026-01-25T19:27
title: POT knobs do not trigger audio re-render when changed
area: ui
files:
  - src/ui/KnobPanel.tsx
  - src/components/AnalogKnob.tsx
  - src/ui/SimulationPanel.tsx
---

## Problem

User adjusts POT0, POT1, or POT2 knobs but the audio effect does not change. The knobs update visually but the audio simulation is not re-rendered with the new POT values. This breaks the core interaction loop where users should be able to hear how POT changes affect the audio effect in real-time.

Expected behavior: Adjusting a POT knob → debounced re-render (500ms) → hear updated audio with new POT settings (as designed in Phase 3, Plan 03-03).

Actual behavior: Knobs move but audio stays the same as initial render.

## Solution

Investigate KnobPanel.tsx re-render trigger logic:
1. Check if POT value changes are being passed to renderSimulation()
2. Verify cached instructions include POT parameter handling
3. Confirm debounce timer is firing and calling re-render
4. Check if audioStore POT values are being read by the interpreter during re-render

Likely issue: POT values not being passed through the render pipeline, or interpreter not reading updated POT values from store.

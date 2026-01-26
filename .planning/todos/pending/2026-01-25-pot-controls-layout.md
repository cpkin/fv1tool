---
created: 2026-01-25T19:27
title: Move POT controls above diagnostics panel
area: ui
files:
  - src/ui/SimulationPanel.tsx
  - src/styles/app.css
---

## Problem

POT controls (POT0, POT1, POT2 analog knobs) are currently positioned below the diagnostics panel in the UI. This places the interactive controls far from where users are actively working (the editor at the top). Users need to scroll down to adjust knobs, making the workflow less efficient.

The POT controls should be positioned at the top of the screen near the editor, with diagnostics (resource meters, lint warnings) below. This keeps the primary interaction controls (code editing + POT tweaking) in the same visual area.

## Solution

Reorder SimulationPanel component structure:
1. Move KnobPanel component to render before/above the diagnostics section
2. Adjust CSS layout to ensure POT controls are visually prominent at top
3. Maintain current spacing and styling, just change vertical order
4. Test responsive layout to ensure controls don't overlap on smaller screens

Simple DOM reordering in SimulationPanel.tsx render method.

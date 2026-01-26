---
created: 2026-01-25T19:31
title: Make resource meters more compact (instructions, delay RAM, registers)
area: ui
files:
  - src/ui/ResourceMeters.tsx
  - src/styles/app.css
---

## Problem

The resource meters section (instruction count, delay RAM usage, register usage) takes up significant vertical space in the UI. Each meter has a large visual footprint with labels, bars, and values spread across multiple lines.

With limited screen real estate, the resource meters push other important controls (POT knobs, playback, export) further down the page. Users have to scroll to access frequently-used controls.

Resource meters should be more compact — displaying the same information in less vertical space. Consider horizontal layout, smaller fonts, or condensed progress bar styling.

## Solution

Redesign ResourceMeters component for density:
1. Use horizontal layout instead of stacked vertical meters
2. Reduce padding and margins between meter elements
3. Use smaller font sizes for labels while maintaining readability
4. Consider inline display: "Instructions: 45/128 ██████░░░░ 35%"
5. Show meters in a single row if screen width allows (responsive)

Goal: Reduce resource meter height by 40-50% without losing information clarity.

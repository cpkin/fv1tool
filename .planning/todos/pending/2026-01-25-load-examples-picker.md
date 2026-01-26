---
created: 2026-01-25T19:31
title: Add example picker to load official and community examples
area: ui
files:
  - src/ui/SimulationPanel.tsx
  - src/ui/ExamplePicker.tsx
  - corpus/official/
  - corpus/community/
---

## Problem

Users currently have no easy way to load example .spn programs into the editor to explore the tool's capabilities. They must manually find examples, copy code, and paste it in.

The project already has a test corpus with 27 programs (11 official Spin examples + 16 community examples from Phase 0). These examples should be easily accessible through a "Load Example" UI that lets users browse and select programs.

Benefits:
- New users can immediately try the tool without finding example code
- Examples demonstrate FV-1 features and metadata usage
- Official examples provide known-good baseline programs
- Community examples show real-world usage patterns

## Solution

Create ExamplePicker component:
1. List examples from corpus/official/ and corpus/community/ directories
2. Group by category (official vs community)
3. Show program name and brief description (extract from comments or metadata)
4. Click to load → populate editor with selected .spn code
5. Integration: Add "Load Example" button in SimulationPanel or App toolbar
6. Use import.meta.glob to dynamically load example file list (already used in corpus validation)

UI placement: Near top of screen, next to editor or as dropdown/modal.

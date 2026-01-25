# Phase 4: Signal Path Diagrams - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Visualize signal flow from metadata annotations in .spn files. Parse metadata headers (;@fx v1/v2 formats) and render block-diagram visualization with auto-layout. Tool remains fully functional without metadata (graceful degradation). This phase does NOT add metadata validation against code — diagrams are documentation-driven.

</domain>

<decisions>
## Implementation Decisions

### Diagram visual style
- **Aesthetic:** Analog/vintage (pedal vibe) — rounded blocks with shadows/gradients, warm colors, matches analog knob aesthetic from Phase 3
- **Feedback cycle treatment:** Dashed/dotted edges to distinguish feedback loops from forward signal flow
- **Block information:** Name + parameter hints (e.g., "LPF (cutoff: POT0)")
- **POT indication:** Show POT usage in parameter hints only — no special visual indicators or separate POT nodes
- **Block color scheme:** Research and replicate SpinCAD's color scheme for block types (delay, filter, modulation, etc.)
- **Typography:** Match editor font (monospace like CodeMirror) for consistency

### Layout & space usage
- **UI placement:** Collapsible section within simulation panel (not separate panel/tab)
- **Default state:** Expanded if valid metadata exists, hidden entirely if no metadata
- **Diagram size:** Auto-height (fit content) — container grows to show entire diagram without scrolling
- **Auto-layout orientation:** Left-to-right (horizontal) signal flow — input on left, output on right (traditional signal flow diagram style)

### Missing/invalid metadata handling
- **No metadata:** Hide diagram section entirely — don't show placeholder or nag messages
- **Malformed metadata:** Show partial diagram for valid parts, display warning about malformed sections
- **Metadata explanation:** Documentation only — no in-app tooltips or modals explaining metadata (assume users who want diagrams will read docs)

### Claude's Discretion
- Input/output node treatment (explicit nodes vs implied from flow)
- Edge styling (bezier curves vs straight arrows) — choose based on diagram library
- Exact implementation of "analog/vintage" aesthetic (shadow depth, gradient style, etc.)
- How to handle very large/complex diagrams (pan/zoom if needed)

</decisions>

<specifics>
## Specific Ideas

- **SpinCAD color scheme reference:** Researcher should investigate SpinCAD Designer's block color scheme and replicate it (delay blocks, filter blocks, modulation blocks, etc. have specific colors)
- **Consistency with Phase 3:** Diagram aesthetic should echo the analog knob design (rounded corners, shadows, warm palette)
- **Monospace font:** Use same font family as CodeMirror editor for block labels

</specifics>

<deferred>
## Deferred Ideas

- **Metadata validation against code:** Optional "Verify" button to check if metadata matches actual register/block usage in code — belongs in future enhancement phase
- **Interactive diagram features:** Clicking blocks for details, highlighting signal path, exporting diagram as image — consider for future phase if user demand exists

</deferred>

---

*Phase: 04-signal-path-diagrams*
*Context gathered: 2026-01-25*

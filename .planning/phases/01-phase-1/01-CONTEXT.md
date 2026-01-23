# Phase 1: Code Validation & Analysis - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver code validation UX for pasted .spn files: syntax errors, resource meters, and lint warnings with clear feedback loops.

</domain>

<decisions>
## Implementation Decisions

### Error Message UX
- Inline gutter markers plus bottom panel for full list
- Errors listed chronologically
- Inline underline + tooltip on hover
- "Copy errors & warnings" copies full code plus errors (AI-friendly paste)

### Lint Warnings Policy
- Lint warnings appear in the same chronological list as errors
- Warnings phrased as actionable guidance
- Suggested fixes appear in tooltips
- Priority 1 lint rules are all WARNING severity (non-blocking)

### Resource Meters
- Compact bar trio near top (instruction/RAM/register)
- Show current + max values (e.g., 84/128)
- Highlight meters when related warnings fire
- Live updates as the user types

### Editor Behavior
- Full editable editor (paste + edit inline)
- Empty editor with helpful hint on load
- Validation target: parse + lint after a line completes; fallback to manual Validate button if needed
- Line numbers with gutter enabled

### OpenCode's Discretion
- Exact debounce timing for "line complete" validation
- Final formatting of the copied code+errors payload

</decisions>

<specifics>
## Specific Ideas

- Copy button should include full source + error list for easy Claude/ChatGPT paste
- Prefer auto-validate on line completion rather than constant re-run

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-phase-1*
*Context gathered: 2026-01-23*

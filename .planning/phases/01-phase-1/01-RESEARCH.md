# Phase 01: Code Validation & Analysis - Research

**Researched:** 2026-01-23
**Domain:** CodeMirror 6 editor integration, SpinASM parsing/linting, client-side static analysis
**Confidence:** MEDIUM

## Summary

This phase depends on CodeMirror 6's modular editor architecture, with a custom SpinASM language definition built on a Lezer parser and linting via `@codemirror/lint`. The standard approach is to implement a lint source that produces `Diagnostic` objects (ERROR/WARNING/INFO) and feeds a lint gutter plus diagnostics panel, using `actions` for fix suggestions and `syntaxTree` for parse-aware linting. Resource meters and semantic checks should run in the same validation pipeline that yields diagnostics, driven by editor updates and debounced on line completion.

Key implementation guidance: rely on CodeMirror's state model (`EditorState`/`Text`) to compute line context and positions, never mutate state directly, and avoid hand-rolling rendering for lint markers or panels. The CodeMirror docs explicitly state that lint sources are user-defined, so the SpinASM lint/analysis stack must be implemented in-house but plugged into the standard lint extension.

**Primary recommendation:** Use a Lezer-based `LRLanguage` for SpinASM plus a CodeMirror `linter` source that emits diagnostics with `actions` for suggested fixes and leverages `state.doc.line(...)` for context snippets.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|-------------|
| `codemirror` | 6.0.2 | Baseline editor setup (`basicSetup`) | Official bundle of common extensions for CM6 editors. | 
| `@codemirror/state` | 6.5.4 | Immutable editor state, transactions, document model | Required for EditorState/Text APIs used in analysis. | 
| `@codemirror/view` | 6.39.11 | EditorView rendering and interaction | Required UI surface for CodeMirror 6. | 
| `@codemirror/language` | 6.12.1 | Language infrastructure + `syntaxTree` | Needed for parser integration and tree-based linting. | 
| `@codemirror/lint` | 6.9.2 | Diagnostics, lint gutter, lint panel | Standard CM6 mechanism for errors/warnings/actions. | 

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@lezer/lr` | 1.4.7 | Lezer LR parser runtime | Use for SpinASM parser integration. |
| `@lezer/common` | 1.5.0 | Shared parser utilities (syntax tree, nodes) | Needed for parser/tree operations. |
| `@lezer/highlight` | 1.2.3 | Highlight tags for syntax styling | Use for SpinASM syntax highlight mapping. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CodeMirror 6 lint/panel/gutter | Hand-rolled UI | CM6 already provides standard diagnostics rendering; custom UI adds maintenance and misses built-in tooling. |
| Lezer LR parser | CodeMirror 5 modes | CM5 modes are legacy and lack CM6 tree-based linting integration. |

**Installation:**
```bash
npm install codemirror @codemirror/state @codemirror/view @codemirror/language @codemirror/lint @lezer/lr @lezer/common @lezer/highlight
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── editor/           # CodeMirror setup, extensions, themes
├── language/         # SpinASM Lezer parser + language support
├── analysis/         # Resource usage + lint rule engine
├── diagnostics/      # Diagnostic mapping + formatting + copy payload
└── ui/               # Gutter/panel/meter UI glue
```

### Pattern 1: Lint Source as Single Validation Pipeline
**What:** Build one lint source that runs parsing, analysis, and lint rules, returning `Diagnostic[]` for ERROR/WARNING/INFO.
**When to use:** Always—CodeMirror expects lint diagnostics to come from a lint source function.
**Example:**
```typescript
import {syntaxTree} from "@codemirror/language"
import {linter, Diagnostic} from "@codemirror/lint"

const spinasmLinter = linter(view => {
  const diagnostics: Diagnostic[] = []
  // Walk tree, compute diagnostics
  syntaxTree(view.state).cursor().iterate(node => {
    // custom checks here
  })
  return diagnostics
})
```
Source: https://codemirror.net/examples/lint/

### Pattern 2: Lezer-Backed Language Definition
**What:** Define SpinASM as an `LRLanguage` using the Lezer LR parser and attach language data.
**When to use:** For syntax highlighting and parse-aware linting.
**Example:**
```typescript
import {LRLanguage} from "@codemirror/language"
import {parser} from "./spinasm.grammar"

export const spinasmLanguage = LRLanguage.define({
  name: "SpinASM",
  parser
})
```
Source: https://codemirror.net/docs/ref/#language.LRLanguage

### Pattern 3: Line-Context Extraction via `Text`
**What:** Use `state.doc.line(...)` and `lineAt(...)` to fetch lines around an error (±2 lines).
**When to use:** For error tooltips and copy payloads that include context.
**Example:**
```typescript
const line = state.doc.line(lineNumber)
const prev = lineNumber > 1 ? state.doc.line(lineNumber - 1) : null
const next = lineNumber < state.doc.lines ? state.doc.line(lineNumber + 1) : null
```
Source: https://codemirror.net/docs/ref/#state.Text

### Anti-Patterns to Avoid
- **Mutating editor state:** CM6 state is immutable; use transactions only (per system guide).
- **Custom lint marker rendering:** CM6 lint extension already provides gutter/tooltip/panel hooks.
- **Polling for changes:** Use the lint source invocation and editor update cycle instead of manual polling.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diagnostic gutter + panel | Custom DOM markers | `@codemirror/lint` (`lintGutter`, lint panel) | CM6 already renders diagnostics, tooltips, and panel lists. |
| Parse tree walking | Manual tokenization | Lezer parser + `syntaxTree` | Tree data already maintained by CodeMirror. |
| Line context parsing | Manual string splits | `EditorState.doc.line(...)` | Handles line indexing and offsets correctly. |

**Key insight:** CodeMirror 6 is designed to keep parsing, diagnostics, and UI rendering in extensions; fighting that architecture increases complexity and breaks standard behavior.

## Common Pitfalls

### Pitfall 1: Expecting CM6 to provide lint sources
**What goes wrong:** No diagnostics appear because no lint source is supplied.
**Why it happens:** The lint extension explicitly states it does not ship lint sources.
**How to avoid:** Implement a SpinASM lint source and pass it to `linter(...)`.
**Warning signs:** Lint gutter/panel enabled but always empty.

### Pitfall 2: Missing lint gutter/panel extensions
**What goes wrong:** Diagnostics exist but no gutter markers or panel list appear.
**Why it happens:** `lintGutter()` (and optional lint panel) must be added as extensions.
**How to avoid:** Include `lintGutter()` alongside the linter extension in editor setup.
**Warning signs:** Diagnostics only appear in tooltips (or not at all).

### Pitfall 3: State mutation
**What goes wrong:** Decorations or analysis drift from editor state; errors are inconsistent.
**Why it happens:** CM6 state is immutable and must be updated via transactions.
**How to avoid:** Use transactions/state fields for derived analysis data.
**Warning signs:** Diagnostics refer to incorrect ranges after edits.

### Pitfall 4: No bundler for CM6
**What goes wrong:** Editor fails to load in browser.
**Why it happens:** CM6 ships as ES modules requiring bundling.
**How to avoid:** Ensure build system bundles ESM (Vite/Rollup/etc.).
**Warning signs:** Browser errors about `import` or unresolved modules.

## Code Examples

Verified patterns from official sources:

### Lint Diagnostics With Fix Actions
```typescript
import {syntaxTree} from "@codemirror/language"
import {linter, Diagnostic} from "@codemirror/lint"

const regexpLinter = linter(view => {
  let diagnostics: Diagnostic[] = []
  syntaxTree(view.state).cursor().iterate(node => {
    if (node.name == "RegExp") diagnostics.push({
      from: node.from,
      to: node.to,
      severity: "warning",
      message: "Regular expressions are FORBIDDEN",
      actions: [{
        name: "Remove",
        apply(view, from, to) { view.dispatch({changes: {from, to}}) }
      }]
    })
  })
  return diagnostics
})
```
Source: https://codemirror.net/examples/lint/

### Minimal Editor Setup (CM6)
```typescript
import {EditorView, basicSetup} from "codemirror"

const view = new EditorView({
  doc: "",
  extensions: [basicSetup],
  parent: document.body
})
```
Source: https://codemirror.net/docs/guide/

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CodeMirror 5 monolith + modes | CodeMirror 6 modular extensions + Lezer parsing | CM6 release (post-v5) | Enables tree-based linting, composable extensions, and modern diagnostics pipeline. |

**Deprecated/outdated:**
- CodeMirror 5 modes for new integrations: CM6 is the supported modular system per current docs.

## Open Questions

1. **Suggested fix strategy for opcode typos**
   - What we know: Diagnostics support `actions` for quick fixes in CM6.
   - What's unclear: Which string-distance or suggestion library to use for opcode spell-correct.
   - Recommendation: Default to a small, well-known Levenshtein helper (or custom minimal logic) and validate performance on the 27-program corpus.

## Sources

### Primary (HIGH confidence)
- https://codemirror.net/docs/guide/ - CM6 modular architecture, basic setup, bundler requirement
- https://codemirror.net/examples/lint/ - lint source, diagnostics, actions, lint gutter
- https://codemirror.net/docs/ref/#language.LRLanguage - language definition with Lezer parsers
- https://codemirror.net/docs/ref/#state.Text - line access for context

### Secondary (MEDIUM confidence)
- `npm view` package versions for CodeMirror and Lezer (2026-01-23)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - stack verified by official docs; versions from npm registry.
- Architecture: HIGH - patterns directly supported by CM6 docs and lint examples.
- Pitfalls: HIGH - documented limitations (lint sources, immutability, bundling).

**Research date:** 2026-01-23
**Valid until:** 2026-02-22

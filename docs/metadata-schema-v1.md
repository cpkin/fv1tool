# Metadata Schema v1 Documentation

## Overview

SpinGPT metadata headers are structured comments embedded in SpinASM `.spn` files that provide effect documentation, pot labeling, memory allocation details, and signal flow visualization. Metadata is **optional** — the validator and simulator work without it, but diagrams and enhanced UI features require valid metadata.

This document describes **Metadata Schema v1** — the format, rules, and usage for authoring versioned metadata headers.

## Versioning Strategy

Metadata headers support explicit versioning to enable forward-compatible changes:

- **`v1`** (default): Original metadata format with required fields defined below. If no version is specified, v1 is assumed with a warning.
- **`v2`** (future): Extended format with additional optional fields for advanced features. v2 headers remain backward-compatible with v1 validation rules.

**Versioning behavior:**
- Missing `version` field → defaults to `v1` with a warning
- Invalid `version` value → validation fails with error
- Unknown version (e.g., `v3`) → warning, attempts v2 validation rules

## Schema Reference

Full JSON Schema: [`schemas/metadata-v1.schema.json`](../schemas/metadata-v1.schema.json)

The schema follows [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-core.html) and defines strict validation rules for all metadata fields.

## Field Definitions

### `version` (optional)
- **Type:** String enum
- **Values:** `"v1"` | `"v2"`
- **Default:** `"v1"`
- **Description:** Metadata schema version. Omitting this field triggers a warning but defaults to v1.

### `effectName` (required)
- **Type:** String
- **Length:** 1-64 characters
- **Description:** Human-readable name of the effect, displayed in UI and documentation.
- **Example:** `"Stereo Delay with Feedback"`

### `io` (required)
- **Type:** String enum
- **Values:**
  - `"mono_mono"` — Single input, single output
  - `"mono_stereo"` — Single input, stereo output (e.g., stereo widening, ping-pong delay)
  - `"stereo_stereo"` — Stereo input, stereo output (true stereo processing)
- **Description:** Audio input/output mode. Determines channel configuration for simulation and validation.

### `pots` (required)
- **Type:** Array of exactly 3 objects
- **Description:** Potentiometer (knob) configuration for POT0, POT1, and POT2 on the FV-1 chip.
- **Object structure:**
  - `id` (required): String enum — `"pot0"` | `"pot1"` | `"pot2"`
  - `label` (required): String (1-32 chars) — Human-readable knob label (e.g., `"Mix"`, `"Time"`, `"Feedback"`)

### `memory` (required)
- **Type:** Array of objects
- **Description:** Delay memory allocations. Each allocation defines a named buffer and its size in samples.
- **Object structure:**
  - `name` (required): String — Memory identifier matching SpinASM code (e.g., `"delay1"`, `"delayL"`)
  - `samples` (required): Integer (1-32768) — Buffer size in samples. Total across all allocations must not exceed 32768.

**Note:** The FV-1 runs at 32kHz sample rate. 32768 samples = ~1.02 seconds of delay.

### `graph` (required)
- **Type:** Object with `nodes` and `edges`
- **Description:** Signal flow graph for block diagram visualization. Describes processing stages and their connections.
- **Structure:**
  - `nodes` (required): Array of strings — Node identifiers (e.g., `["input", "delay", "filter", "mix", "output"]`)
  - `edges` (required): Array of edge objects — Directed connections between nodes
    - `from` (required): String — Source node ID (must exist in `nodes`)
    - `to` (required): String — Destination node ID (must exist in `nodes`)

**Feedback loops:** Edges can create cycles (e.g., delay output → feedback → delay input). SpinGPT marks feedback edges visually in diagrams.

## Complete Examples

### Example 1: Mono Delay (v1)

```asm
;@fx v1
;@fx {
;@fx   "version": "v1",
;@fx   "effectName": "Simple Mono Delay",
;@fx   "io": "mono_mono",
;@fx   "pots": [
;@fx     {"id": "pot0", "label": "Time"},
;@fx     {"id": "pot1", "label": "Feedback"},
;@fx     {"id": "pot2", "label": "Mix"}
;@fx   ],
;@fx   "memory": [
;@fx     {"name": "delay1", "samples": 24576}
;@fx   ],
;@fx   "graph": {
;@fx     "nodes": ["input", "delay", "feedback", "mix", "output"],
;@fx     "edges": [
;@fx       {"from": "input", "to": "delay"},
;@fx       {"from": "delay", "to": "feedback"},
;@fx       {"from": "feedback", "to": "delay"},
;@fx       {"from": "delay", "to": "mix"},
;@fx       {"from": "input", "to": "mix"},
;@fx       {"from": "mix", "to": "output"}
;@fx     ]
;@fx   }
;@fx }

; SpinASM code starts here
mem delay1 24576
equ time reg0
equ feedback reg1
equ mix reg2

; ... effect code ...
```

### Example 2: Stereo Reverb (v2)

```asm
;@fx v2
;@fx {
;@fx   "version": "v2",
;@fx   "effectName": "Stereo Plate Reverb",
;@fx   "io": "stereo_stereo",
;@fx   "pots": [
;@fx     {"id": "pot0", "label": "Decay"},
;@fx     {"id": "pot1", "label": "Pre-Delay"},
;@fx     {"id": "pot2", "label": "Mix"}
;@fx   ],
;@fx   "memory": [
;@fx     {"name": "delayL", "samples": 16384},
;@fx     {"name": "delayR", "samples": 16384}
;@fx   ],
;@fx   "graph": {
;@fx     "nodes": ["inputL", "inputR", "diffuseL", "diffuseR", "tankL", "tankR", "mixL", "mixR", "outputL", "outputR"],
;@fx     "edges": [
;@fx       {"from": "inputL", "to": "diffuseL"},
;@fx       {"from": "inputR", "to": "diffuseR"},
;@fx       {"from": "diffuseL", "to": "tankL"},
;@fx       {"from": "diffuseR", "to": "tankR"},
;@fx       {"from": "tankL", "to": "tankR"},
;@fx       {"from": "tankR", "to": "tankL"},
;@fx       {"from": "tankL", "to": "mixL"},
;@fx       {"from": "tankR", "to": "mixR"},
;@fx       {"from": "inputL", "to": "mixL"},
;@fx       {"from": "inputR", "to": "mixR"},
;@fx       {"from": "mixL", "to": "outputL"},
;@fx       {"from": "mixR", "to": "outputR"}
;@fx     ]
;@fx   }
;@fx }

; SpinASM code starts here
mem delayL 16384
mem delayR 16384
; ... reverb algorithm ...
```

## Validation Behavior

SpinGPT validates metadata headers using the JSON Schema. Validation outcomes:

### Valid Metadata
- All required fields present and correctly formatted
- No additional unknown fields (strict validation)
- Signal graph nodes/edges are consistent
- **Result:** Full features enabled, diagram rendered

### Missing Version
- No `version` field specified
- **Result:** Warning displayed, defaults to v1, continues validation

### Invalid Fields
- Required fields missing (e.g., no `effectName`)
- Enum value incorrect (e.g., `io: "stereo_mono"` — not a valid option)
- Type mismatch (e.g., `samples` as string instead of integer)
- **Result:** Warning displayed, metadata marked invalid, diagram unavailable, rest of tool works

### Missing Metadata
- No `;@fx` header in file
- **Result:** Badge shows "No metadata", diagram unavailable, validator and simulator work normally

## Authoring Guidelines

### Best Practices
- **Always include version:** Explicitly set `"version": "v1"` or `"v2"` to avoid warnings
- **Match memory allocations:** Ensure `memory` array matches `mem` directives in SpinASM code
- **Meaningful pot labels:** Use short, descriptive labels (e.g., "Mix" not "pot2 control")
- **Keep graphs simple:** Diagram complexity increases with node count; aim for 5-10 nodes
- **Test validation:** Paste metadata into SpinGPT validator before finalizing

### Common Mistakes
- **Pot array length:** Must be exactly 3 objects (pot0, pot1, pot2)
- **Memory overflow:** Total `samples` across all allocations must not exceed 32768
- **Unconnected nodes:** Every node in `nodes` should appear in at least one edge
- **Duplicate pot IDs:** Each pot ID (pot0/pot1/pot2) must appear exactly once

## Forward Compatibility

When v2 is released, v1 metadata will continue to validate correctly. New v2-only fields will be optional, ensuring backward compatibility. Programs authored with v1 headers do not require updates unless new features are desired.

**Migration path v1 → v2:**
1. Add `"version": "v2"` to header
2. Validation continues with v1 rules as baseline
3. Optionally add v2-specific fields for enhanced features

## Schema Updates

The JSON Schema is the source of truth for validation rules. When authoring metadata:
- Refer to [`schemas/metadata-v1.schema.json`](../schemas/metadata-v1.schema.json) for exact field requirements
- Use JSON Schema validators (e.g., [jsonschemavalidator.net](https://www.jsonschemavalidator.net/)) to test headers before embedding in `.spn` files

---

**Next Steps:**
- Use these examples as templates for your own effects
- Validate metadata in SpinGPT before committing to code
- Report issues or suggest enhancements via GitHub

*Schema version: v1*  
*Last updated: 2026-01-22*

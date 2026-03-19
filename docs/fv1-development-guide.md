# FV-1 Development Guide

This is the canonical reference for developing FV-1 SpinASM programs, intended for use by human developers and AI agents alike. It covers the instruction set, memory model, fixed-point math, LFO/CHO behavior, file format requirements, metadata schema, and common patterns.

---

## 1. The FV-1 Chip — Overview

The **Spin Semiconductor FV-1** is an 8-program DSP chip for audio effects (reverb, delay, chorus, etc.). It is widely used in guitar pedal DIY builds.

Key hardware facts:
- **Sample rate:** 32 kHz (fixed, not configurable)
- **Program memory:** 128 instruction slots per program, 8 programs total per EEPROM
- **Delay RAM:** 32,768 samples shared across the program (~1.02 seconds total)
- **Potentiometers:** 3 external pots (POT0, POT1, POT2), read once per 32-sample block
- **Registers:** 32 general-purpose registers (REG0–REG31) plus named special registers
- **Accumulators:** ACC (current accumulator), PACC (previous accumulator), LR (left-right crossfade register)
- **Audio I/O:** ADCL (left input), ADCR (right input), DACL (left output), DACR (right output)

---

## 2. Critical File Format Requirement — CRLF Line Endings

**SpinASM (the official Windows assembler) requires CRLF line endings (`\r\n`) in all `.spn` source files.**

SpinASM only runs on Windows and uses Windows-style line endings. Files with Unix LF-only (`\n`) line endings will either fail to parse or produce incorrect output.

### What CRLF means

- **CRLF** = Carriage Return + Line Feed = two bytes: `\r\n` (hex `0D 0A`) — Windows standard
- **LF** = Line Feed only = one byte: `\n` (hex `0A`) — Unix/Linux/macOS standard

### Why this matters for generated files

When generating `.spn` files on Linux or macOS (including from AI tools, scripts, or CI pipelines), the output will naturally use LF-only line endings. These files **will not assemble correctly** in SpinASM.

### How to convert

Every `.spn` file destined for SpinASM must have its line endings converted before use:

```bash
# Convert LF → CRLF using sed (safe, in-place)
sed -i 's/$/\r/' yourfile.spn

# Or using unix2dos (if available)
unix2dos yourfile.spn

# Verify line endings are CRLF
file yourfile.spn
# Expected: "ASCII text, with CRLF line terminators"

# Or inspect with xxd
xxd yourfile.spn | grep "0d 0a"
```

### Rule for agents and code generators

> **Any tool, script, or AI agent that writes `.spn` files must either produce CRLF line endings natively, or include a conversion step before the file is used with SpinASM.**

If writing a shell script that generates `.spn` files on Linux:

```bash
# Write with CRLF from the start using printf
printf "rdax ADCL,1.0\r\nwrax DACL,0.0\r\n" > effect.spn

# Or pipe through sed after writing
python generate_effect.py > effect.spn && sed -i 's/$/\r/' effect.spn
```

Note: The SpinGPT simulator accepts both LF and CRLF. CRLF is only required when using the official SpinASM assembler on Windows.

---

## 3. SpinASM Dialect

### 3.1 Lexical Rules

- **Case-insensitive:** `RDAX`, `rdax`, and `Rdax` are all valid
- **Comments:** semicolon (`;`) starts a comment and runs to end of line
- **Whitespace:** spaces and tabs are interchangeable; multiple whitespace collapses to a single separator
- **Line endings:** both LF and CRLF accepted by SpinGPT; CRLF **required** by SpinASM (see Section 2)
- **Operand separators:** commas separate operands
- **Jump target labels:** identified by a trailing colon (e.g., `start:`)

### 3.2 Directives

#### `EQU label value`

Assigns a constant name to a value. Commonly used to give readable names to registers, addresses, and constants.

```asm
EQU input  ADCL
EQU output DACL
EQU gain   REG0
EQU mix    0.5
```

- Label format: `[A-Za-z][A-Za-z0-9_]*`
- Expression may reference previously defined labels
- Re-definition is allowed (emits a warning)

#### `MEM label size`

Allocates delay memory and defines three address labels:
- `label` — start address
- `label^` — midpoint address (size/2)
- `label#` — end address (size-1)

```asm
MEM delay1  24576   ; ~0.77 seconds at 32kHz
MEM delayL  16384
MEM delayR  16384   ; total = 32768 (maximum)
```

- Size is in samples (integer)
- Memory is allocated sequentially; total must not exceed 32,768 samples
- 32,768 samples = ~1.02 seconds of delay at 32 kHz

#### `ORG address`

Sets the instruction counter origin for subsequent instructions. Rarely needed; useful for placing code at specific slot positions.

```asm
ORG 0
```

### 3.3 Label Rules

- **Constant labels** (`EQU`, `MEM`): must be defined before use
- **Jump target labels** (e.g., `start:`): may be forward-referenced by `skp`/`jmp`
- A label cannot be both a constant and a jump target
- Backward jumps are **disallowed** (SKP/JMP can only jump forward)

---

## 4. Instruction Set Reference

### 4.1 Special Registers

| Register | Description |
|---|---|
| `ADCL` | Left ADC input (read-only) |
| `ADCR` | Right ADC input (read-only) |
| `DACL` | Left DAC output (write) |
| `DACR` | Right DAC output (write) |
| `POT0` | Potentiometer 0 value (read-only, updated per 32-sample block) |
| `POT1` | Potentiometer 1 value |
| `POT2` | Potentiometer 2 value |
| `ADDR_PTR` | Address pointer for `rmpa` |
| `REG0`–`REG31` | General-purpose registers |

### 4.2 SKP Condition Flags

| Flag | Meaning |
|---|---|
| `RUN` | Skip if not first sample after reset |
| `ZRC` | Zero crossing (ACC changed sign) |
| `ZRO` | ACC is zero |
| `GEZ` | ACC >= 0 |
| `NEG` | ACC < 0 |

Flags can be combined with `|` (bitwise OR). Example: `skp GEZ|ZRC,label`

### 4.3 Full Instruction Listing

#### Delay Memory

| Mnemonic | Operands | Description |
|---|---|---|
| `rda` | `ADDRESS, MULTIPLIER` | Read delay at ADDRESS, multiply by MULTIPLIER, add to ACC |
| `rmpa` | `MULTIPLIER` | Read delay at ADDR_PTR, multiply by MULTIPLIER, add to ACC |
| `wra` | `ADDRESS, MULTIPLIER` | Write ACC to delay at ADDRESS; ACC = ACC * MULTIPLIER |
| `wrap` | `ADDRESS, MULTIPLIER` | Write ACC to delay at ADDRESS; ACC = (ACC * MULTIPLIER) + LR |

#### Register I/O

| Mnemonic | Operands | Description |
|---|---|---|
| `rdax` | `REGISTER, MULTIPLIER` | ACC += REGISTER * MULTIPLIER |
| `rdfx` | `REGISTER, MULTIPLIER` | ACC = (ACC - REGISTER) * MULTIPLIER + REGISTER |
| `ldax` | `REGISTER` | ACC = REGISTER (load, replaces ACC) |
| `wrax` | `REGISTER, MULTIPLIER` | REGISTER = ACC; ACC = ACC * MULTIPLIER |
| `wrhx` | `REGISTER, MULTIPLIER` | REGISTER = ACC; ACC = ACC * MULTIPLIER + PACC * (1 - |MULTIPLIER|) (high shelf) |
| `wrlx` | `REGISTER, MULTIPLIER` | REGISTER = ACC; ACC = PACC + MULTIPLIER * (ACC - PACC) (low shelf) |

#### Arithmetic

| Mnemonic | Operands | Description |
|---|---|---|
| `sof` | `MULTIPLIER, OFFSET` | ACC = ACC * MULTIPLIER + OFFSET |
| `maxx` | `REGISTER, MULTIPLIER` | ACC = max(|ACC|, |REGISTER * MULTIPLIER|) |
| `absa` | *(none)* | ACC = |ACC| |
| `mulx` | `REGISTER` | ACC = ACC * REGISTER |
| `log` | `MULTIPLIER, OFFSET` | ACC = log2(|ACC|) * MULTIPLIER + OFFSET |
| `exp` | `MULTIPLIER, OFFSET` | ACC = 2^ACC * MULTIPLIER + OFFSET |

#### Bitwise

| Mnemonic | Operands | Description |
|---|---|---|
| `and` | `VALUE` | ACC = ACC & VALUE |
| `or` | `VALUE` | ACC = ACC \| VALUE |
| `xor` | `VALUE` | ACC = ACC ^ VALUE |
| `not` | *(none)* | ACC = ~ACC |
| `clr` | *(none)* | ACC = 0 (equivalent to `and 0`) |

#### Control Flow

| Mnemonic | Operands | Description |
|---|---|---|
| `skp` | `CONDITIONS, OFFSET` | Skip OFFSET instructions forward if CONDITIONS are met |
| `jmp` | `OFFSET` | Unconditional skip OFFSET instructions forward |
| `nop` | *(none)* | No operation; used for padding to 128 instructions |

#### LFO Control

| Mnemonic | Operands | Description |
|---|---|---|
| `wlds` | `SIN0\|SIN1, FREQUENCY, AMPLITUDE` | Configure sine LFO (SIN0 or SIN1) |
| `wldr` | `RMP0\|RMP1, FREQUENCY, AMPLITUDE` | Configure ramp LFO (RMP0 or RMP1) |
| `jam` | `RMP0\|RMP1` | Reset ramp LFO phase to zero |
| `cho` | `TYPE, LFO, FLAGS, ADDRESS` | LFO-modulated delay access (chorus/vibrato) |

#### Miscellaneous

| Mnemonic | Operands | Description |
|---|---|---|
| `raw` | `U32` | Insert a raw 32-bit instruction word directly |

### 4.4 Operand Constraints

- **Multipliers:** S1.9 fixed-point, range -2.0 to +1.99 (approximately)
- **Offsets (sof/log/exp):** S1.9 fixed-point, range -1.0 to +1.0
- **Delay addresses:** 15-bit unsigned integer, range 0–32767
- **SKP/JMP offsets:** 0–63 (forward only); a target label resolves automatically
- **AND/OR/XOR values:** 24-bit mask
- **LFO frequency:** integer, range dependent on LFO type (see manual)
- **LFO amplitude:** integer, range dependent on LFO type (see manual)

---

## 5. Fixed-Point Math Model

The FV-1 uses **S1.23 fixed-point arithmetic** for all audio operations.

- **Format:** 1 sign bit + 1 integer bit + 23 fractional bits = 25 bits total
- **Range:** -1.0 to approximately +0.9999999 (just under 1.0)
- **Audio signals are expected to live in the range -1.0 to +1.0**

### Saturation and Overflow

- Most arithmetic operations **saturate** at the ±1.0 limit (no wraparound)
- Some bit operations treat the value as a raw integer (AND, OR, XOR, NOT)
- When in doubt, protect against overflow with `sof 1.0, 0` to clamp or attenuate input

### Practical Tips

- Audio inputs from ADC are already normalized to ±1.0
- When multiplying two signals, the result may need scaling (multiplying two 0.5-amplitude signals gives 0.25)
- Use `sof` to apply a gain factor: `sof 0.5, 0.0` halves the signal
- Use `log`/`exp` for compression/expansion effects (log domain processing)

---

## 6. Delay Memory Model

### Addressing

- Total delay RAM: **32,768 samples** (shared across all `MEM` allocations)
- Address 0 is the current write pointer position (newest sample)
- Addresses increase toward the past (address N = N samples ago)
- MEM declarations allocate regions sequentially; the assembler assigns base addresses

### MEM Label Suffixes

Given `MEM echo 8192`:
- `echo` = start of buffer (base address)
- `echo^` = midpoint (base address + 4096)
- `echo#` = end of buffer (base address + 8191)

### Reading and Writing Delay

```asm
MEM echo 8192   ; allocate ~0.256s delay

; Write current ACC to start of buffer, zero ACC
wra echo, 0.0

; Read from end of buffer (oldest sample), multiply by 0.5, add to ACC
rda echo#, 0.5

; Read from midpoint
rda echo^, 0.7
```

### Circular Buffer Behavior

The FV-1 hardware maintains a single delay write pointer that advances by one sample per clock. All delay addresses are relative to this pointer. This means `wra` and `rda` addresses are **relative offsets into the past**, not absolute memory positions. This is handled automatically by the hardware and assembler.

---

## 7. LFO and CHO Reference

### 7.1 LFO Types

The FV-1 has four hardware LFOs:
- **SIN0, SIN1** — sine wave oscillators
- **RMP0, RMP1** — ramp (sawtooth) oscillators

### 7.2 Configuring LFOs

```asm
; Configure SIN0: frequency=57 (~1.7 Hz at 32kHz), amplitude=32768
wlds SIN0, 57, 32768

; Configure RMP0: frequency=128, amplitude=32767
wldr RMP0, 128, 32767

; Reset RMP0 phase to zero (useful for syncing LFOs)
jam RMP0
```

### 7.3 CHO Instruction

`cho` is the primary instruction for LFO-modulated delay access (chorus, vibrato, flanger):

```asm
cho RDA,  SIN0, REG|COMPC, delayaddr   ; LFO-modulated delay read + accumulate
cho RDAL, SIN0, REG|COMPC, delayaddr   ; Same but loads ACC (replaces)
cho SOF,  SIN0, 0, 0                   ; Scale ACC by LFO value
cho RAMP, RMP0, RAMP|RANGE|NA, 0       ; Ramp LFO address interpolation
```

**CHO flags (can be combined with `|`):**

| Flag | Description |
|---|---|
| `REG` | Use LFO value from register (normal operation) |
| `COMPC` | Use complement of coefficient for crossfade |
| `COMPA` | Use complement of address offset |
| `RAMP` | Ramp interpolation mode (use with RMP LFOs) |
| `RANGE` | Scale address by LFO amplitude range |
| `NA` | No accumulate (replaces ACC instead of adding) |
| `COS` | Use cosine phase instead of sine |

### 7.4 Chorus Pattern Example

```asm
MEM chorus 2048

; Init
wlds SIN0, 57, 2048

; Per-sample
ldax ADCL
wra chorus, 0.0

cho RDA, SIN0, REG|COMPC, chorus
cho RDA, SIN0, REG, chorus+1    ; dual-tap for smooth interpolation
wrax DACL, 0.0
```

---

## 8. I/O Modes

FV-1 programs can operate in three I/O configurations:

| Mode | Input | Output | Typical Use |
|---|---|---|---|
| `mono_mono` | ADCL only | DACL only | Simple mono effects (fuzz, compression) |
| `mono_stereo` | ADCL only | DACL + DACR | Mono-in stereo-out (ping-pong delay, stereo reverb) |
| `stereo_stereo` | ADCL + ADCR | DACL + DACR | True stereo processing |

ADCR is only meaningful in `stereo_stereo` mode. Writing both DACL and DACR is needed for `mono_stereo` and `stereo_stereo` modes; in `mono_mono` mode, only write DACL.

---

## 9. Resource Limits

These limits are enforced in hardware and must be respected:

| Resource | Limit |
|---|---|
| Instructions per program | 128 (pad unused slots with `nop`) |
| Total delay RAM | 32,768 samples across all `MEM` declarations |
| General-purpose registers | 32 (REG0–REG31) |
| Pots | 3 (POT0–POT2) |
| LFOs | 4 (SIN0, SIN1, RMP0, RMP1) |

If your instruction count is less than 128, SpinASM pads the remainder with `nop` automatically. You do not need to manually add `nop` instructions to reach 128 unless you are using `ORG` to place code at specific positions.

---

## 10. Common Patterns

### 10.1 Unity Gain Passthrough (Mono)

```asm
; Read left input, write to left output unchanged
ldax ADCL
wrax DACL, 0.0
```

### 10.2 Wet/Dry Mix with POT

```asm
; POT2 controls mix: 0 = dry, 1 = wet
; wet is in REG0, dry is ADCL

; Mix: ACC = dry * (1 - mix) + wet * mix
ldax POT2           ; ACC = mix value
mulx REG0           ; ACC = wet * mix
wrax REG1, 0.0      ; store wet*mix

sof 1.0, 0.0        ; restore
ldax POT2
sof -1.0, 1.0       ; ACC = 1 - mix
mulx ADCL           ; ACC = dry * (1 - mix)
rdax REG1, 1.0      ; ACC += wet * mix
wrax DACL, 0.0
```

### 10.3 First-Sample Initialization Guard

The `RUN` flag in `skp` is 0 on the very first sample after chip reset and 1 thereafter. Use it to initialize registers once:

```asm
; Skip init block on all samples after the first
skp RUN, main

; Initialization (runs once)
ldax ADCL
wrax REG0, 0.0
clr
wra delay, 0.0

main:
; Normal per-sample processing
```

### 10.4 Feedback Delay

```asm
MEM dly  24576     ; ~0.77s

EQU time    POT0
EQU fb      POT1
EQU mix     POT2
EQU dly_out REG0

skp RUN, main
clr
wra dly, 0.0

main:
rdax ADCL, 1.0     ; ACC = dry input
rdax dly_out, 1.0  ; ACC += delayed signal (feedback)
wra dly, 0.0       ; write to delay, clear ACC
rda dly#, 1.0      ; ACC = oldest delay sample
wrax dly_out, 0.0  ; store for next cycle

; Output mix
ldax ADCL
mulx mix            ; ACC = dry * mix
rdax dly_out, 1.0   ; add delayed
wrax DACL, 0.0
```

---

## 11. Error Handling Policy (SpinASM Behavior)

SpinASM and SpinGPT follow these error handling conventions:

| Condition | Behavior |
|---|---|
| Unknown opcode or directive | Warn and continue |
| Invalid operand range or type | Error, continue parsing |
| Duplicate `EQU` label | Warn, accept latest definition |
| Undefined label reference | Error, continue parsing |
| Instruction count > 128 | Error (assembler halts) |
| Delay RAM total > 32768 | Error (assembler halts) |

When iterating with an AI tool, use the "Copy errors" feature in SpinGPT to paste all errors and warnings into the AI prompt in one click.

---

## 12. SpinGPT Metadata Schema (`;@fx` Headers)

SpinGPT supports optional structured metadata in `.spn` files for signal path diagram generation, pot labeling, and enhanced UI features. Metadata is **not required** for the assembler or simulator — it is SpinGPT-specific.

### 12.1 Format

Metadata is embedded as structured comments at the top of the file:

```asm
;@fx v1
;@fx {
;@fx   "version": "v1",
;@fx   "effectName": "My Effect",
;@fx   "io": "mono_stereo",
;@fx   "pots": [
;@fx     {"id": "pot0", "label": "Time"},
;@fx     {"id": "pot1", "label": "Feedback"},
;@fx     {"id": "pot2", "label": "Mix"}
;@fx   ],
;@fx   "memory": [
;@fx     {"name": "delay1", "samples": 24576}
;@fx   ],
;@fx   "graph": {
;@fx     "nodes": ["input", "delay", "output"],
;@fx     "edges": [
;@fx       {"from": "input", "to": "delay"},
;@fx       {"from": "delay", "to": "output"}
;@fx     ]
;@fx   }
;@fx }
```

### 12.2 Field Reference

| Field | Required | Type | Description |
|---|---|---|---|
| `version` | No | `"v1"` \| `"v2"` | Schema version; defaults to v1 with warning if omitted |
| `effectName` | Yes | String (1–64 chars) | Human-readable effect name |
| `io` | Yes | `"mono_mono"` \| `"mono_stereo"` \| `"stereo_stereo"` | I/O mode |
| `pots` | Yes | Array[3] | Exactly 3 pot objects with `id` and `label` |
| `memory` | Yes | Array | One entry per `MEM` directive with `name` and `samples` |
| `graph` | Yes | Object | `nodes` (string array) and `edges` (from/to pairs) |

### 12.3 Common Mistakes

- `pots` array must have **exactly 3 entries** (pot0, pot1, pot2)
- `memory` `samples` values must match the `MEM` sizes in the code
- Total `memory.samples` across all entries must not exceed 32,768
- All node IDs referenced in `edges` must exist in `nodes`
- Feedback cycles in `edges` are supported and visually highlighted by SpinGPT

---

## 13. Simulation Fidelity Notes

The SpinGPT simulator targets **gross correctness** — it is designed to catch functional bugs before hardware testing, not to produce bit-accurate hardware output.

**What the simulator matches:**
- Instruction semantics (ACC/PACC/LR behavior per opcode)
- Fixed-point math (S1.23 scaling, saturation rules)
- Delay memory (32,768-sample circular buffer with correct wrapping)
- Resource limits (instruction count, delay RAM, register allocation)
- Block timing (32-sample blocks, pot updates at block boundaries)

**Acceptable deviations:**
- Minor floating-point precision differences (no perceptible effect on audio)
- LFO phase alignment may differ slightly from hardware
- CHO interpolation may differ from exact hardware behavior
- Input resampling from non-32kHz sources introduces minor artifacts

**If the simulator output sounds wrong:**
- Check for silent output (zero output is usually a missing `wrax DACL` instruction)
- Check for clipping/overflow (reduce input gain or add `sof 0.7, 0.0` attenuation)
- Check delay RAM total (exceeding 32,768 samples corrupts audio)
- Verify I/O mode matches your audio source (stereo file + mono_mono mode only uses left channel)

---

## 14. Quick Reference Card

```
; --- Boilerplate skeleton for a mono effect ---

;@fx v1
;@fx { "version": "v1", "effectName": "My Effect", "io": "mono_mono",
;@fx   "pots": [{"id":"pot0","label":"Param1"},{"id":"pot1","label":"Param2"},{"id":"pot2","label":"Mix"}],
;@fx   "memory": [{"name":"buf","samples":8192}],
;@fx   "graph": {"nodes":["in","proc","out"],"edges":[{"from":"in","to":"proc"},{"from":"proc","to":"out"}]} }

MEM buf 8192
EQU param1  POT0
EQU param2  POT1
EQU mix     POT2
EQU dry     ADCL
EQU out     DACL
EQU wet_reg REG0

; Skip init on all samples after first
skp RUN, main

; One-time init
clr
wra buf, 0.0

main:
; --- your algorithm here ---

; Write dry to delay, get wet signal
ldax dry
wra buf, 0.0
rda buf#, 1.0
wrax wet_reg, 0.0

; Mix output
ldax mix
mulx wet_reg
wrax REG1, 0.0
sof -1.0, 1.0       ; 1 - mix
mulx dry
rdax REG1, 1.0
wrax out, 0.0
```

---

## 15. Reference Sources

- **SPINAsm User Manual** (canonical): `http://www.spinsemi.com/Products/datasheets/spn1001-dev/SPINAsmUserManual.pdf`
- **asfv1 assembler** (cross-platform Python assembler, compatible behavior): `https://github.com/ndf-zz/asfv1`
- **SpinCAD Designer** (visual block editor, good for learning): Community tool
- **SpinGPT** (this project): Web-based validator, simulator, and diagram tool

# FV-1 Development Guide

This is the canonical reference for developing FV-1 SpinASM programs, intended for use by AI agents generating code on behalf of users. It covers the instruction set, memory model, fixed-point math, LFO/CHO behavior, metadata schema, and production-tested DSP patterns drawn from analysis of 100+ real-world FV-1 programs.

---

## 1. Rules for Code Generation

When generating SpinASM code, you MUST follow these rules:

### 1.1 Output Format

- Always produce a **single, complete, runnable `.spn` program** — never code fragments or partial files
- Always include the **`;@fx` metadata block** at the top (see Section 13) so the program works with SpinIDE's signal path diagram, pot labels, and UI features
- Always follow the **program structure order** from Section 2 (metadata, header, MEM, EQU, init, pots, input, processing, output)
- Use the **skeleton template in Section 15** as your starting point for every program

### 1.2 Commenting Policy (Critical)

Assume the user has **zero SpinASM background**. They are likely a guitar pedal builder or musician, not a DSP engineer. Every program you generate must be understandable by someone who has never seen assembly language before.

**Required comments:**

1. **Section headers** — mark every logical section with a clear banner comment:
   ```asm
   ; ===== DELAY MEMORY =====
   ; ===== KNOB READING =====
   ; ===== INPUT STAGE =====
   ; ===== CORE EFFECT (chorus processing) =====
   ; ===== WET/DRY MIX & OUTPUT =====
   ```

2. **Every tweakable value** — any constant the user might want to change must have a comment explaining what it controls, what range is safe, and what changing it does sonically:
   ```asm
   EQU krt    0.55       ; TWEAK: reverb decay time (0.3=short, 0.7=long, 0.95=near-infinite — keep below 1.0!)
   EQU kap    0.6        ; TWEAK: diffusion amount (0.4=sparse, 0.7=dense — higher = lusher but risks ringing)
   EQU krf    0.4        ; TWEAK: damping tone (0.1=very dark, 0.5=bright — controls high-freq decay)
   ```

3. **Every non-obvious instruction** — explain what the instruction does in plain English, not just what the mnemonic stands for:
   ```asm
   rdfx lp1, krf         ; lowpass filter: smooths out high frequencies (like turning down a tone knob)
   wrlx lp1, krs         ; apply the damping shelf — highs decay faster than lows, like a real room
   ```

4. **Why, not just what** — explain the musical/sonic purpose, not just the math:
   ```asm
   sof  0.8, 0.1         ; scale pot range to 0.1–0.9 (avoids fully-off and prevents runaway feedback)
   rdax ADCL, 0.5        ; read left input at half volume (leaves headroom so mixing won't clip)
   ```

5. **Pot descriptions** — in the header, clearly describe what each knob does in user terms:
   ```asm
   ; POT0 (Knob 1) = Decay Time — turn right for longer reverb tail
   ; POT1 (Knob 2) = Tone — turn right for brighter sound
   ; POT2 (Knob 3) = Mix — full left = dry only, full right = wet only
   ```

### 1.3 Validation Before Presenting Code

Before presenting your program to the user, mentally verify:
- Total instruction count is **<= 128** (count every instruction line, excluding comments, directives, and labels)
- Total delay RAM across all `MEM` declarations is **<= 32,768 samples**
- Every program has a `skp RUN, label` initialization guard
- Every program writes to at least `DACL` (and `DACR` for stereo output)
- Feedback coefficients are **< 1.0** (to prevent runaway oscillation)
- The `;@fx` metadata `memory` entries match the actual `MEM` declarations

If the user's request would exceed 128 instructions, simplify the design and explain what tradeoffs you made. Do not silently exceed the limit.

### 1.4 Common LLM Mistakes to Avoid

These are errors that AI models frequently make when generating SpinASM code:

- **Forgetting the `skp RUN` init guard** — without it, LFOs and registers re-initialize every sample, causing silence or noise
- **Feedback coefficient >= 1.0** — causes instant clipping/oscillation. Always cap feedback below 1.0 (e.g., `sof 0.9, 0.0`)
- **Forgetting to write to DACL/DACR** — the program runs but produces silence
- **Exceeding 128 instructions** — the assembler rejects the program. Count carefully for complex effects
- **Exceeding 32,768 delay samples** — corrupts all delay memory. Add up all `MEM` sizes
- **Using backward jumps** — SKP and JMP can only jump **forward**. Labels must come after the skip instruction
- **Using `rdax` when `ldax` is needed** — `rdax` *adds* to ACC, `ldax` *replaces* ACC. Mixing these up corrupts signal levels
- **Forgetting to clear ACC** — use `wrax REG, 0` (the 0 clears ACC) or `clr` before starting a new calculation chain
- **Not attenuating when summing inputs** — `rdax ADCL, 1.0` + `rdax ADCR, 1.0` can clip. Use 0.5 coefficients for mono summing

---

## 2. Recommended Program Structure

Every well-written FV-1 program follows this order (based on conventions observed across the Spin Semi GA_DEMO series, mstratman collection, and audiofab examples):

```asm
; 1. HEADER — effect name, pot descriptions, author
; My Awesome Reverb
; POT0 = Reverb Time    POT1 = Damping    POT2 = Mix

; 2. MEMORY DECLARATIONS
MEM ap1   334         ; allpass diffuser 1
MEM ap2   556         ; allpass diffuser 2
MEM del1  8192        ; main delay line

; 3. REGISTER ALIASES (EQU)
EQU mono   REG0       ; mono input sum
EQU lp1    REG1       ; lowpass filter state
EQU temp   REG2       ; scratch register
EQU krt    0.55       ; reverb time coefficient
EQU kap    0.6        ; allpass coefficient

; 4. INITIALIZATION (skp RUN guard)
skp RUN, main
wrax lp1, 0           ; clear filter states
wlds SIN0, 12, 100    ; init sine LFO
main:

; 5. POT READING & PROCESSING
rdax POT0, 1.0
sof  0.8, 0.1         ; scale to 0.1–0.9 range
wrax krt, 0

; 6. INPUT READING
rdax ADCL, 0.5
rdax ADCR, 0.5        ; sum to mono
wrax mono, 0

; 7. SIGNAL PROCESSING (core DSP algorithm)
; ... allpass filters, delay reads/writes, shelving EQ ...

; 8. OUTPUT WRITING
wrax DACL, 1.0        ; write left output, keep in ACC
wrax DACR, 0.0        ; write right output, clear ACC
```

---

## 3. File Format Note — CRLF Line Endings

**SpinASM (the official Windows assembler) requires CRLF line endings (`\r\n`).** The SpinIDE simulator accepts both LF and CRLF, so this only matters when exporting to the hardware assembler. If the user needs to compile for hardware, they should convert with `unix2dos yourfile.spn`.

---

## 4. SpinASM Dialect

### 4.1 Lexical Rules

- **Case-insensitive:** `RDAX`, `rdax`, and `Rdax` are all valid
- **Comments:** semicolon (`;`) starts a comment and runs to end of line
- **Whitespace:** spaces and tabs are interchangeable; multiple whitespace collapses to a single separator
- **Operand separators:** commas separate operands
- **Jump target labels:** identified by a trailing colon (e.g., `start:`)
- **Binary literals:** `%` prefix (e.g., `%01100000_00000000_00000000`), underscores optional for readability
- **Hex literals:** `$` or `0x` prefix (e.g., `$7FFF00` or `0x7FFF00`)

### 4.2 Directives

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
MEM delay1  24576   ; ~0.75 seconds at 32768 Hz
MEM delayL  16384
MEM delayR  16384   ; total = 32768 (maximum)
```

- Size is in samples (integer)
- Memory is allocated sequentially; total must not exceed 32,768 samples
- 32,768 samples = ~1.0 seconds of delay at 32,768 Hz

#### `ORG address`

Sets the instruction counter origin for subsequent instructions. Rarely needed.

### 4.3 Label Rules

- **Constant labels** (`EQU`, `MEM`): must be defined before use
- **Jump target labels** (e.g., `start:`): may be forward-referenced by `skp`/`jmp`
- A label cannot be both a constant and a jump target
- Backward jumps are **disallowed** (SKP/JMP can only jump forward)

---

## 5. Instruction Set Reference

### 5.1 Special Registers

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

### 5.2 SKP Condition Flags

| Flag | Meaning |
|---|---|
| `RUN` | Skip if not first sample after reset |
| `ZRC` | Zero crossing (ACC changed sign) |
| `ZRO` | ACC is zero |
| `GEZ` | ACC >= 0 |
| `NEG` | ACC < 0 |

Flags can be combined with `|` (bitwise OR). Example: `skp GEZ|ZRC,label`

### 5.3 Full Instruction Listing

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
| `rdfx` | `REGISTER, MULTIPLIER` | ACC = (ACC - REGISTER) * MULTIPLIER + REGISTER (one-pole lowpass) |
| `ldax` | `REGISTER` | ACC = REGISTER (load, replaces ACC) |
| `wrax` | `REGISTER, MULTIPLIER` | REGISTER = ACC; ACC = ACC * MULTIPLIER |
| `wrhx` | `REGISTER, MULTIPLIER` | REGISTER = ACC; ACC = ACC * MULTIPLIER + PACC * (1 - \|MULTIPLIER\|) (high shelf) |
| `wrlx` | `REGISTER, MULTIPLIER` | REGISTER = ACC; ACC = PACC + MULTIPLIER * (ACC - PACC) (low shelf) |

#### Arithmetic

| Mnemonic | Operands | Description |
|---|---|---|
| `sof` | `MULTIPLIER, OFFSET` | ACC = ACC * MULTIPLIER + OFFSET |
| `maxx` | `REGISTER, MULTIPLIER` | ACC = max(\|ACC\|, \|REGISTER * MULTIPLIER\|) |
| `absa` | *(none)* | ACC = \|ACC\| |
| `mulx` | `REGISTER` | ACC = ACC * REGISTER |
| `log` | `MULTIPLIER, OFFSET` | ACC = log2(\|ACC\|) * MULTIPLIER + OFFSET |
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

### 5.4 Operand Constraints

- **Multipliers:** S1.9 fixed-point, range -2.0 to +1.99 (approximately)
- **Offsets (sof/log/exp):** S1.9 fixed-point, range -1.0 to +1.0
- **Delay addresses:** 15-bit unsigned integer, range 0–32767
- **SKP/JMP offsets:** 0–63 (forward only); a target label resolves automatically
- **AND/OR/XOR values:** 24-bit mask
- **LFO frequency:** integer, range dependent on LFO type (see manual)
- **LFO amplitude:** integer, range dependent on LFO type (see manual)

---

## 6. Fixed-Point Math Model

The FV-1 uses **S1.23 fixed-point arithmetic** for all audio operations.

- **Format:** 1 sign bit + 1 integer bit + 23 fractional bits = 25 bits total
- **Range:** -1.0 to approximately +0.9999999 (just under 1.0)
- **Audio signals are expected to live in the range -1.0 to +1.0**

### Saturation and Overflow

- Most arithmetic operations **saturate** at the +/-1.0 limit (no wraparound)
- Some bit operations treat the value as a raw integer (AND, OR, XOR, NOT)
- When in doubt, protect against overflow with `sof 1.0, 0` to clamp or attenuate input

### Gain Staging (Critical)

Gain staging is the single most important practical concern in FV-1 programming. Because the accumulator saturates at +/-1.0, you must carefully manage signal levels throughout the processing chain:

- **Attenuate early, amplify late.** Sum inputs at reduced levels (e.g., `rdax ADCL, 0.5`) to leave headroom for processing.
- **Feedback loops must attenuate.** Any feedback path multiplied by 1.0 or higher will clip within a few samples. Use coefficients like 0.5–0.9.
- **Multiply = reduce level.** Multiplying two signals both at 0.5 gives 0.25. You may need `sof 2.0, 0` to recover level after multiplication.
- **Monitor for silent output.** If output is silent, check that you wrote to DACL/DACR and that your signal chain doesn't attenuate to zero.
- **Monitor for clipped output.** If output sounds distorted, add attenuation: `sof 0.7, 0.0` before the output stage.

### Practical Tips

- Audio inputs from ADC are already normalized to +/-1.0
- Use `sof` to apply a gain factor: `sof 0.5, 0.0` halves the signal
- Use `log`/`exp` for compression/expansion effects (log domain processing)
- Invert a signal: `sof -1.0, 0.0`
- Compute `1 - x`: load x, then `sof -1.0, 1.0` (result = 1 - ACC)

---

## 7. Delay Memory Model

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
MEM echo 8192   ; allocate ~0.25s delay

; Write current ACC to start of buffer, zero ACC
wra echo, 0.0

; Read from end of buffer (oldest sample), multiply by 0.5, add to ACC
rda echo#, 0.5

; Read from midpoint
rda echo^, 0.7
```

### Circular Buffer Behavior

The FV-1 hardware maintains a single delay write pointer that advances by one sample per clock. All delay addresses are relative to this pointer. This means `wra` and `rda` addresses are **relative offsets into the past**, not absolute memory positions. This is handled automatically by the hardware and assembler.

### Memory Allocation Tips

- **Allpass filters** use small buffers: 100–2000 samples
- **Main delay lines** range from 1000 (30ms) to 32767 (1 second max)
- **Reverb programs** typically use 18,000–32,000 total samples across all lines
- **Use prime-number lengths** for reverb delay lines to avoid frequency coloring and metallic ringing
- **Add headroom for LFO modulation.** If a delay line will be CHO-modulated, allocate extra samples (e.g., `MEM del 4096+200`) so the LFO sweep doesn't read past the buffer boundary

---

## 8. LFO and CHO Reference

### 8.1 LFO Types

The FV-1 has four hardware LFOs:
- **SIN0, SIN1** — sine wave oscillators (for chorus, flanger, reverb modulation)
- **RMP0, RMP1** — ramp (sawtooth) oscillators (for pitch shifting)

### 8.2 Configuring LFOs

```asm
; Configure SIN0: frequency=12 (~0.5 Hz), amplitude=100 (~100-sample sweep)
wlds SIN0, 12, 100

; Configure RMP0 for octave-up pitch shift
wldr RMP0, 16384, 4096

; Common ramp rates for pitch shifting:
;   16384  = octave up
;  -16384  = octave down (negative = reverse direction)
;  -8192   = octave down (alternative)
;   2006   = whole tone up
;   974    = semitone up

; Reset RMP0 phase to zero (useful for syncing)
jam RMP0
```

### 8.3 CHO Instruction

`cho` is the primary instruction for LFO-modulated delay access (chorus, vibrato, flanger, pitch shift):

```asm
cho RDA,  SIN0, REG|COMPC, delayaddr   ; LFO-modulated delay read + accumulate
cho RDAL, SIN0, 0, 0                   ; Load LFO value into ACC (useful for reading LFO state)
cho SOF,  SIN0, 0, 0                   ; Scale ACC by LFO value
```

**CHO flags (can be combined with `|`):**

| Flag | Description |
|---|---|
| `SIN` | Sine LFO mode (default for SIN0/SIN1) |
| `COS` | Use cosine phase instead of sine |
| `REG` | Use LFO value from register (normal operation) |
| `COMPC` | Use complement of coefficient for crossfade |
| `COMPA` | Use complement of address offset |
| `RPTR2` | Second read pointer (half-ramp offset, for ramp crossfade) |
| `NA` | No accumulate (replaces ACC instead of adding) |

### 8.4 Chorus Pattern (Sine LFO)

The standard chorus uses two adjacent CHO reads for interpolation:

```asm
MEM chorus 2048

; Init
skp RUN, main
wlds SIN0, 12, 100    ; slow sine, moderate depth
main:

; Write input to delay
ldax ADCL
wra chorus, 0.0

; Interpolated LFO-modulated read (two taps)
cho RDA, SIN0, SIN|REG|COMPC, chorus+100
cho RDA, SIN0, SIN,            chorus+101
wrax DACL, 0.0
```

### 8.5 Pitch Shifting Pattern (Ramp LFO)

Pitch shifting uses a ramp LFO with crossfade between two read pointers to avoid clicks at the ramp reset point:

```asm
MEM pdel 4096

; Init
skp RUN, main
wldr RMP0, 16384, 4096    ; octave up
main:

; Write input to delay
ldax ADCL
wra pdel, 0

; First read pointer (interpolated)
cho RDA, RMP0, REG|COMPC, pdel
cho RDA, RMP0, 0,         pdel+1
wra  temp_mem, 0                     ; save first tap

; Second read pointer (half-ramp offset)
cho RDA, RMP0, RPTR2|COMPC, pdel
cho RDA, RMP0, RPTR2,       pdel+1

; Crossfade between the two taps
cho SOF, RMP0, NA|COMPC, 0           ; multiply by (1 - crossfade)
cho RDA, RMP0, NA, temp_mem          ; add first tap * crossfade

wrax DACL, 0.0
```

### 8.6 LFO Smearing for Reverb

To reduce metallic ringing in reverb allpass filters, modulate them with a slow sine LFO. Use sin, cos, inverted sin, and inverted cos for decorrelated modulation across multiple allpasses:

```asm
; Modulate allpass tap with SIN0 (flags 0x06 = SIN|REG|COMPC)
cho RDA, SIN0, SIN|REG|COMPC, ap1+50
cho RDA, SIN0, SIN,            ap1+51
wra ap1+100, 0

; Use COS for a second allpass (decorrelated)
cho RDA, SIN0, COS|REG|COMPC, ap2+50
cho RDA, SIN0, COS,            ap2+51
wra ap2+100, 0
```

---

## 9. I/O Modes

FV-1 programs can operate in three I/O configurations:

| Mode | Input | Output | Typical Use |
|---|---|---|---|
| `mono_mono` | ADCL only | DACL only | Simple mono effects (fuzz, compression) |
| `mono_stereo` | ADCL only | DACL + DACR | Mono-in stereo-out (ping-pong delay, stereo reverb) |
| `stereo_stereo` | ADCL + ADCR | DACL + DACR | True stereo processing |

### Input Summing to Mono

Nearly every mono-processing program sums stereo input to mono first:

```asm
rdax ADCL, 0.5
rdax ADCR, 0.5        ; ACC = (left + right) / 2
wrax mono, 0          ; store mono sum
```

The 0.5 coefficients prevent clipping when both channels are at full scale.

---

## 10. Resource Limits

These limits are enforced in hardware and must be respected:

| Resource | Limit |
|---|---|
| Instructions per program | 128 (pad unused slots with `nop`) |
| Total delay RAM | 32,768 samples across all `MEM` declarations |
| General-purpose registers | 32 (REG0–REG31) |
| Pots | 3 (POT0–POT2) |
| LFOs | 4 (SIN0, SIN1, RMP0, RMP1) |

If your instruction count is less than 128, SpinASM pads the remainder with `nop` automatically. You do not need to manually add `nop` instructions to reach 128 unless you are using `ORG` to place code at specific positions.

The 128-instruction limit is the primary constraint when writing complex effects. Techniques to save instructions:
- Use `wrax REG, 1.0` (store and keep) instead of `wrax REG, 0` followed by `ldax REG` (saves 1 instruction)
- Combine operations: `rdax REG, 1.0` adds to ACC without a separate load
- Pre-compute constants with `EQU` rather than computing them at runtime

---

## 11. Common Patterns

### 11.1 Unity Gain Passthrough (Mono)

```asm
; Read left input, write to left output unchanged
ldax ADCL
wrax DACL, 0.0
```

### 11.2 First-Sample Initialization Guard

The `RUN` flag in `skp` is 0 on the very first sample after chip reset and 1 thereafter. Use it to initialize registers and LFOs once:

```asm
skp RUN, main

; Initialization (runs once)
wrax lp1, 0           ; clear filter states
wrax lp2, 0
wlds SIN0, 12, 100    ; init sine LFO
wldr RMP0, 0, 4096    ; init ramp LFO (rate=0, will be set by pot)

main:
; Normal per-sample processing
```

### 11.3 Pot Reading and Control Curves

#### Basic pot reading with range scaling

```asm
; POT0 raw range is 0.0 to ~1.0
; Scale to 0.1–0.9 for reverb time
rdax POT0, 1.0
sof  0.8, 0.1         ; ACC = POT0 * 0.8 + 0.1
wrax rt, 0            ; store as control variable
```

#### Squared pot curve (slower onset, finer low-end control)

```asm
; Square the pot value for logarithmic-feel response
rdax POT1, 1.0
mulx POT1             ; ACC = POT1^2 (range still 0–1, but curved)
sof  0.4, 0.01        ; scale to desired range
wrax rate, 0
```

#### Pot smoothing (one-pole filter to remove zipper noise)

```asm
; Smooth pot changes to avoid audible stepping
rdax POT0, 1.0
rdfx potfil, 0.02     ; very slow lowpass (~1.5 Hz cutoff)
wrax potfil, 0        ; store filtered pot value
; Use potfil instead of POT0 in subsequent processing
```

### 11.4 Allpass Filter

The allpass filter is the fundamental building block of reverb. It passes all frequencies at equal amplitude but shifts their phase, creating diffusion:

```asm
MEM ap1 500            ; allpass delay buffer

; Canonical allpass: rda from end, wrap to start
; Coefficient magnitude must match (one negative, one positive)
rda  ap1#, kap         ; read end of delay, scale by +kap
wrap ap1,  -kap        ; write to start, scale ACC by -kap, add LR
```

Where `kap` is typically 0.5 to 0.7. Higher values = more diffusion but risks instability.

**Cascaded allpass bank** (used for reverb input diffusion):

```asm
MEM ap1  334           ; mutually prime sizes
MEM ap2  556           ; reduce frequency coloring
MEM ap3  871

EQU kap  0.6

; Input diffusion: 3 allpasses in series
rda  ap1#, kap
wrap ap1,  -kap
rda  ap2#, kap
wrap ap2,  -kap
rda  ap3#, kap
wrap ap3,  -kap
; ACC now contains diffused signal
```

### 11.5 Shelving Filters (wrhx / wrlx)

The `wrhx` and `wrlx` instructions implement single-instruction shelving filters — extremely useful inside reverb loops for frequency-dependent damping.

#### Low-pass shelving (high-frequency damping)

```asm
; Damp high frequencies in a reverb loop
; krf = filter frequency (0.01=dark, 0.5=bright)
; krs = shelf depth (use -1.0 for full cut, -0.6 for moderate)
rdfx lp1, krf         ; one-pole lowpass
wrlx lp1, krs         ; shelving: ACC = PACC + krs*(ACC-PACC)
```

This attenuates frequencies above the cutoff set by `krf`. Inside a reverb feedback loop, it simulates air absorption (high frequencies decay faster).

#### High-pass shelving (low-frequency damping)

```asm
; Damp low frequencies (prevent rumble buildup)
rdfx hp1, krf
wrhx hp1, krs         ; high shelf: ACC = ACC*krs + PACC*(1-|krs|)
```

#### DC blocking high-pass (essential utility)

```asm
; Remove DC offset — use at the end of any feedback chain
rdfx dc_block, 0.02   ; very low cutoff (~1 Hz)
wrhx dc_block, -1.0   ; full high-pass: removes everything below cutoff
```

### 11.6 Reverb Tank Architecture

The standard FV-1 reverb uses a **4-stage ring topology** with allpass diffusion and shelving EQ. This pattern appears in the Spin Semi ROM programs, Dattorro implementations, and most community reverbs:

```asm
; MEMORY: 4 delay lines + 4 embedded allpasses
MEM del1 3559          ; prime-number lengths for natural sound
MEM ap1a  241
MEM del2 4007
MEM ap2a  307
MEM del3 3371
MEM ap3a  269
MEM del4 4519
MEM ap4a  353

EQU krt  0.55          ; reverb time (feedback coefficient)
EQU kap  0.6           ; allpass diffusion
EQU krf  0.4           ; LP filter frequency (damping)
EQU krs -0.6           ; LP shelf depth

; --- Ring stage 1 ---
rda  del4#, krt        ; read end of previous delay, scale by RT
rda  ap1a#, kap        ; input diffusion allpass
wrap ap1a,  -kap
rdfx lp1, krf          ; shelving lowpass (damping)
wrlx lp1, krs
rdax input, 1.0        ; inject input signal
wra  del1, 0           ; write to delay 1

; --- Ring stage 2 ---
rda  del1#, krt
rda  ap2a#, kap
wrap ap2a,  -kap
rdfx lp2, krf
wrlx lp2, krs
wra  del2, 0

; --- Ring stage 3 ---
rda  del2#, krt
rda  ap3a#, kap
wrap ap3a,  -kap
rdfx lp3, krf
wrlx lp3, krs
wra  del3, 0

; --- Ring stage 4 ---
rda  del3#, krt
rda  ap4a#, kap
wrap ap4a,  -kap
rdfx lp4, krf
wrlx lp4, krs
wra  del4, 0

; --- Output: multi-tap for stereo image ---
rda  del1+2630, 1.0    ; different tap offsets
rda  del2+1943, 1.0    ; create stereo width
wrax DACL, 0.0         ; left output

rda  del3+3200, 1.0
rda  del4+4016, 1.0
wrax DACR, 0.0         ; right output
```

**Key principles:**
- Use **prime-number delay lengths** to avoid frequency coloring
- **krt** (reverb time) must be < 1.0 to prevent infinite buildup (typical: 0.3–0.95)
- **Shelving LPF** inside the loop simulates air absorption (highs decay faster)
- **Output taps** from different points in the ring create natural stereo image
- Left and right outputs use **different tap positions** for decorrelation

### 11.7 Feedback Delay

```asm
MEM dly  24576         ; ~0.75s

EQU dly_out REG0
EQU fb      REG1

skp RUN, main
clr
wra dly, 0.0

main:
; Read pot for feedback amount
rdax POT1, 1.0
sof  0.9, 0.0         ; cap at 0.9 to prevent runaway
wrax fb, 0

; Input + feedback
rdax ADCL, 1.0
rdax dly_out, 1.0     ; add delayed signal (feedback)
mulx fb               ; scale feedback
wra dly, 0.0          ; write to delay, clear ACC
rda dly#, 1.0         ; read oldest sample
wrax dly_out, 0.0     ; store for next cycle feedback
```

### 11.8 Variable Delay with ADDR_PTR

For pot-controlled delay time (variable read position):

```asm
MEM vdel 32765         ; maximum delay

; Calculate read address from pot
clr
or   $7FFF00           ; load max address (top bits)
mulx POT0              ; scale by pot (0 = no delay, 1 = max)
wrax ADDR_PTR, 0.0     ; set address pointer

; Write input
ldax ADCL
wra  vdel, 0

; Read from variable position
rmpa 1.0               ; read delay at ADDR_PTR
wrax DACL, 0.0
```

### 11.9 Wet/Dry Mix

#### Simple crossfade mix (POT controls blend)

```asm
; wet signal in REG0, dry is ADCL, POT2 = mix
; Result: output = dry*(1-mix) + wet*mix

rdax POT2, 1.0        ; ACC = mix
mulx REG0             ; ACC = wet * mix
wrax REG1, 0.0        ; store wet component

ldax POT2
sof  -1.0, 1.0        ; ACC = 1 - mix
mulx ADCL             ; ACC = dry * (1 - mix)
rdax REG1, 1.0        ; add wet component
wrax DACL, 0.0
```

#### Difference method (more efficient, 1 fewer instruction — prefer this)

```asm
; Equivalent to above but uses subtraction trick
; wet in REG0, dry = ADCL
rdax ADCL, -1.0       ; ACC = -dry
rdax REG0, 1.0        ; ACC = wet - dry
mulx POT2             ; ACC = mix * (wet - dry)
rdax ADCL, 1.0        ; ACC = dry + mix*(wet - dry)
wrax DACL, 0.0
```

### 11.10 Envelope Detection

Useful for auto-wah, compressor, noise gate:

```asm
EQU env    REG5        ; envelope follower state
EQU avg    REG6        ; smoothed envelope

; Rectify and smooth the input
ldax ADCL
absa                   ; full-wave rectify: ACC = |input|
rdfx avg, 0.01        ; one-pole smooth (attack/release ~10ms)
wrax avg, 0           ; store smoothed envelope
; avg now holds the signal envelope (0 to ~1.0)
```

### 11.11 Soft Clipping Overdrive

Implements `Vout = Vin / (|Vin| + threshold)` using log/exp domain:

```asm
EQU mono   REG0
EQU gain   REG1

; Read and store input
rdax ADCL, 0.5
rdax ADCR, 0.5
wrax mono, 1.0

; Apply drive (pot-controlled gain)
rdax POT0, 1.0
sof  0.9, 0.1         ; gain range 0.1 to 1.0
wrax gain, 0

; Soft clip: V/(|V|+threshold)
ldax mono
absa                   ; |Vin|
rdax gain, 1.0         ; |Vin| + threshold
log  -1.0, -0.3        ; compute 1/(|Vin|+threshold) via log
exp  1.0, 0            ; back to linear domain
mulx mono              ; Vin * 1/(|Vin|+threshold)
wrax DACL, 0.0
```

### 11.12 Triangle Wave from Ramp LFO

Convert a ramp LFO to triangle wave (useful for tremolo, flanger):

```asm
cho  RDAL, RMP0        ; read ramp value into ACC (0 to 1 sawtooth)
sof  1.0, -0.25        ; offset to center
absa                   ; fold negative half -> triangle wave
wrax tri, 0            ; store triangle (0 to 0.5 range)
```

---

## 12. Error Handling Policy (SpinASM Behavior)

SpinASM and SpinIDE follow these error handling conventions:

| Condition | Behavior |
|---|---|
| Unknown opcode or directive | Warn and continue |
| Invalid operand range or type | Error, continue parsing |
| Duplicate `EQU` label | Warn, accept latest definition |
| Undefined label reference | Error, continue parsing |
| Instruction count > 128 | Error (assembler halts) |
| Delay RAM total > 32768 | Error (assembler halts) |

When iterating with an AI tool, use the "Copy errors" feature in SpinIDE to paste all errors and warnings into the AI prompt in one click.

---

## 13. SpinIDE Metadata Schema (`;@fx` Headers)

SpinIDE supports optional structured metadata in `.spn` files for signal path diagram generation, pot labeling, and enhanced UI features. Metadata is **not required** for the assembler or simulator — it is SpinIDE-specific.

### 13.1 Format

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

### 13.2 Field Reference

| Field | Required | Type | Description |
|---|---|---|---|
| `version` | No | `"v1"` \| `"v2"` | Schema version; defaults to v1 with warning if omitted |
| `effectName` | Yes | String (1–64 chars) | Human-readable effect name |
| `io` | Yes | `"mono_mono"` \| `"mono_stereo"` \| `"stereo_stereo"` | I/O mode |
| `pots` | Yes | Array[3] | Exactly 3 pot objects with `id` and `label` |
| `memory` | Yes | Array | One entry per `MEM` directive with `name` and `samples` |
| `graph` | Yes | Object | `nodes` (string array) and `edges` (from/to pairs) |

### 13.3 Common Mistakes

- `pots` array must have **exactly 3 entries** (pot0, pot1, pot2)
- `memory` `samples` values must match the `MEM` sizes in the code
- Total `memory.samples` across all entries must not exceed 32,768
- All node IDs referenced in `edges` must exist in `nodes`
- Feedback cycles in `edges` are supported and visually highlighted by SpinIDE

---

## 14. Quick Reference Card

Always use this skeleton as the starting point for new programs:

```asm
; --- Boilerplate skeleton for a mono-in stereo-out effect ---

;@fx v1
;@fx { "version": "v1", "effectName": "My Effect", "io": "mono_stereo",
;@fx   "pots": [{"id":"pot0","label":"Param1"},{"id":"pot1","label":"Param2"},{"id":"pot2","label":"Mix"}],
;@fx   "memory": [{"name":"buf","samples":8192}],
;@fx   "graph": {"nodes":["in","proc","out"],"edges":[{"from":"in","to":"proc"},{"from":"proc","to":"out"}]} }

; My Effect
; POT0 (Knob 1) = Param1 — describe what this knob does
; POT1 (Knob 2) = Param2 — describe what this knob does
; POT2 (Knob 3) = Mix — full left = dry only, full right = wet only

; ===== DELAY MEMORY =====
MEM buf 8192           ; main effect buffer (~0.25 seconds)

; ===== REGISTERS & CONSTANTS =====
EQU param1  POT0
EQU param2  POT1
EQU mix     POT2
EQU mono    REG0       ; mono input sum
EQU wet     REG1       ; processed (wet) signal
EQU temp    REG2       ; scratch register

; ===== INITIALIZATION (runs once at power-on) =====
skp RUN, main
clr
wra buf, 0.0

main:
; ===== READ KNOBS =====
; (read and scale pot values here)

; ===== READ INPUT (sum to mono) =====
rdax ADCL, 0.5        ; read left input at half volume (leaves headroom)
rdax ADCR, 0.5        ; add right input at half volume
wrax mono, 0          ; store mono sum, clear ACC

; ===== CORE EFFECT PROCESSING =====
ldax mono
wra buf, 0.0          ; write input to delay buffer
rda buf#, 1.0         ; read oldest sample from buffer
wrax wet, 0.0         ; store wet signal

; ===== WET/DRY MIX & OUTPUT =====
rdax mono, -1.0       ; ACC = -dry (start of difference mix)
rdax wet, 1.0         ; ACC = wet - dry
mulx mix              ; ACC = mix * (wet - dry)
rdax mono, 1.0        ; ACC = dry + mix*(wet-dry)
wrax DACL, 1.0        ; left output (keep in ACC)
wrax DACR, 0.0        ; right output (clear ACC)
```

---

## 15. Effect Recipe Index

Quick reference for common effects and the patterns they combine:

| Effect | Key Patterns (see Section 11) | Typical Instructions |
|---|---|---|
| **Simple Delay** | 11.7 Feedback Delay + 11.9 Wet/Dry Mix | 15–25 |
| **Ping-Pong Delay** | 2x 11.7 with cross-feed L/R | 25–40 |
| **Chorus** | 8.4 Chorus Pattern + 11.9 Mix | 15–25 |
| **Flanger** | Short delay + 8.4 Chorus + feedback + 11.9 Mix | 20–35 |
| **Plate Reverb** | 11.4 Allpass Bank + 11.6 Reverb Tank + 11.5 Shelving | 80–120 |
| **Spring Reverb** | Cascaded chirp allpasses (6–37 stages) | 90–128 |
| **Shimmer** | 11.6 Reverb Tank + 8.5 Pitch Shift (octave up) in feedback | 100–128 |
| **Tremolo** | 8.2 LFO + multiply signal amplitude | 10–20 |
| **Phaser** | Cascaded allpasses with LFO-swept coefficients | 40–70 |
| **Pitch Shift** | 8.5 Pitch Shifting Pattern | 20–35 |
| **Overdrive** | 11.11 Soft Clipping + tone filter | 25–40 |
| **Auto-Wah** | 11.10 Envelope Detection + state-variable filter | 30–50 |
| **Compressor** | 11.10 Envelope Detection + log/exp gain control | 30–50 |

# SpinASM Dialect Specification (SpinGPT)

This document locks the SpinASM dialect that SpinGPT will parse and simulate.
It is anchored to the official SPINAsm User Manual and verified against
community assembler behavior where the manual is ambiguous.

## References

- SPINAsm User Manual (canonical): http://www.spinsemi.com/Products/datasheets/spn1001-dev/SPINAsmUserManual.pdf (SPINAsmUserManual)
- asfv1 assembler behavior: https://raw.githubusercontent.com/ndf-zz/asfv1/master/README.md

## Scope

- Target **official SpinASM** only (no SpinCAD extensions in Phase 0).
- Supported directives: `equ`, `mem`, `org` only.
- Comments: semicolon (`;`) only.
- Parser behavior: unknown opcodes/directives **warn and continue** (non-fatal).

## Lexical Rules

- **Case-insensitive** for mnemonics, labels, and directives.
- **Comments:** semicolon starts a comment and runs to end of line.
- **Whitespace:** spaces, tabs, and newlines are interchangeable; multiple
  whitespace characters collapse into a single separator.
- **Line endings:** both LF and CRLF accepted.
- **Tokens:** commas separate operands, colons denote jump target labels.

## Directives

### `EQU label expression`

Assigns a constant value to `label`.

- `label` format: `[A-Za-z][A-Za-z0-9_]*`.
- `expression` may reference previously defined labels and constants.
- Re-definition is allowed but should emit a warning.

Example:

```asm
EQU input ADCL
EQU gain 0.5
```

### `MEM label expression`

Allocates delay memory and defines three labels: `label`, `label^`, `label#`.

- `expression` must resolve to an integer sample count.
- Memory segments are allocated sequentially; total must stay within 32768 samples.
- `label` rules are the same as `EQU`.

Example:

```asm
MEM delay int(0.5 * 32767)
```

### `ORG expression`

Sets the current instruction origin (program counter) for subsequent instructions.

- Expression should resolve to an integer in the 0-127 range.
- **Needs confirmation:** precise padding behavior when `ORG` skips forward
  (manual section reference required).

Example:

```asm
ORG 0
```

## Label Rules

- **Constant labels** (`EQU`, `MEM`) must be defined before use.
- **Jump target labels** (`label:`) may be forward-referenced by `skp`/`jmp`.
- A label cannot be both a constant and a jump target.
- Target labels are resolved after parsing; backward jumps are disallowed.

## Instruction Set Listing

Operand patterns follow the official manual; ranges are enforced during
validation (fixed-point formats, address bounds, and bit widths).

| Mnemonic | Operand Pattern | Notes |
| --- | --- | --- |
| `rda` | `ADDRESS, MULTIPLIER` | Read delay, multiply, accumulate |
| `rmpa` | `MULTIPLIER` | Read delay via `ADDR_PTR`, multiply, accumulate |
| `wra` | `ADDRESS, MULTIPLIER` | Write delay, multiply ACC |
| `wrap` | `ADDRESS, MULTIPLIER` | Write delay, multiply ACC, add LR |
| `rdax` | `REGISTER, MULTIPLIER` | Read register, multiply, accumulate |
| `rdfx` | `REGISTER, MULTIPLIER` | Crossfade register/ACC |
| `ldax` | `REGISTER` | Load register into ACC |
| `wrax` | `REGISTER, MULTIPLIER` | Write register, multiply ACC |
| `wrhx` | `REGISTER, MULTIPLIER` | Write register, high-shelf |
| `wrlx` | `REGISTER, MULTIPLIER` | Write register, low-shelf |
| `maxx` | `REGISTER, MULTIPLIER` | Max(|ACC|, |REG|*mult) |
| `absa` | *(none)* | Absolute value of ACC |
| `mulx` | `REGISTER` | Multiply ACC by register |
| `log` | `MULTIPLIER, OFFSET` | log2(|ACC|) * mult + offset |
| `exp` | `MULTIPLIER, OFFSET` | 2**ACC * mult + offset |
| `sof` | `MULTIPLIER, OFFSET` | ACC * mult + offset |
| `and` | `VALUE` | Bitwise AND |
| `clr` | *(none)* | Clear ACC |
| `or` | `VALUE` | Bitwise OR |
| `xor` | `VALUE` | Bitwise XOR |
| `not` | *(none)* | Bitwise NOT |
| `skp` | `CONDITIONS, OFFSET` | Conditional skip |
| `jmp` | `OFFSET` | Unconditional skip |
| `nop` | *(none)* | No-op / padding |
| `wlds` | `LFO, FREQUENCY, AMPLITUDE` | Set SIN LFO |
| `wldr` | `LFO, FREQUENCY, AMPLITUDE` | Set RMP LFO |
| `jam` | `LFO` | Reset RMP LFO |
| `cho` | `TYPE, LFO, FLAGS, ADDRESS` | Interpolated delay access |
| `raw` | `U32` | Insert raw instruction word |

## Operand Constraints (Summary)

- Addresses are 15-bit delay addresses (0-32767) or fixed-point equivalents.
- Multipliers and offsets must fit the documented fixed-point range for each opcode.
- `skp`/`jmp` offsets are 0-63 or forward target labels only.
- `raw` accepts a 32-bit unsigned integer literal.

## Error Handling Policy

- **Unknown opcode/directive:** warn and continue parsing.
- **Invalid operand range/type:** error but continue parsing subsequent lines.
- **Duplicate constant label:** warn, accept latest definition.
- **Undefined label:** error; continue parsing.

## Examples

### Example 1: Basic gain with named registers

```asm
; Simple gain
EQU input ADCL
EQU output DACL
EQU gain REG0

ldax input
wrax gain,0.0
ldax input
mulx gain
wrax output,0.0
```

### Example 2: Delay with labels and comments

```asm
; 0.5s delay line
MEM delay int(0.5 * 32767)

start: skp RUN,main
       ldax ADCL
       wra delay,0.0
main:  rda delay^,0.5 ; read midpoint
       wrax DACL,0.0
```

### Example 3: ORG + conditional skip

```asm
ORG 0
start: clr
       skp ZRC,next
       ldax ADCL
next:  wrax DACL,0.0
```

## Needs Confirmation

- `ORG` padding behavior and constraints (manual reference required).
- Exact operand range wording for `cho` modes beyond the summary table.

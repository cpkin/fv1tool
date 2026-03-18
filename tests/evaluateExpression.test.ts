import { describe, it, expect } from 'vitest'
import {
  evaluateExpression,
  parseAtomicValue,
  type ExprContext,
} from '../src/fv1/compileProgram'
import { parseSpinAsm } from '../src/parser/parseSpinAsm'
import { compileProgram } from '../src/fv1/compileProgram'

// Shorthand: evaluate with no symbol context
const eval_ = (expr: string, ctx: ExprContext = {}) =>
  evaluateExpression(expr, ctx)

// Equate context helper
const withEquates = (map: Record<string, string>): ExprContext => ({
  equates: Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k.toLowerCase(), { value: v }]),
  ),
})

const withMem = (map: Record<string, number>): ExprContext => ({
  memoryAddresses: Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]),
  ),
})

// ─── parseAtomicValue ───────────────────────────────────────────────────────

describe('parseAtomicValue', () => {
  it('parses decimal integers', () => {
    expect(parseAtomicValue('42', {})).toBe(42)
    expect(parseAtomicValue('0', {})).toBe(0)
  })

  it('parses decimal floats', () => {
    expect(parseAtomicValue('0.5', {})).toBe(0.5)
    expect(parseAtomicValue('-1.0', {})).toBe(-1.0)
    expect(parseAtomicValue('.25', {})).toBe(0.25)
  })

  it('parses hex with $ prefix', () => {
    expect(parseAtomicValue('$FF', {})).toBe(255)
    expect(parseAtomicValue('$007FFF00', {})).toBe(0x007fff00)
  })

  it('parses hex with 0x prefix', () => {
    expect(parseAtomicValue('0xFF', {})).toBe(255)
    expect(parseAtomicValue('0XAB', {})).toBe(0xab)
  })

  it('parses binary with % prefix', () => {
    expect(parseAtomicValue('%10101010', {})).toBe(0xaa)
  })

  it('strips underscores from binary literals', () => {
    expect(parseAtomicValue('%01111110_00000000_00000000', {})).toBe(0x7e0000)
    expect(parseAtomicValue('%1111_0000', {})).toBe(0xf0)
  })

  it('resolves equates', () => {
    const ctx = withEquates({ gain: '0.5', hex_val: '$FF' })
    expect(parseAtomicValue('gain', ctx)).toBe(0.5)
    expect(parseAtomicValue('hex_val', ctx)).toBe(255)
  })

  it('resolves equates case-insensitively', () => {
    const ctx = withEquates({ MyGain: '0.75' })
    expect(parseAtomicValue('mygain', ctx)).toBe(0.75)
    expect(parseAtomicValue('MYGAIN', ctx)).toBe(0.75)
  })

  it('resolves memory symbols', () => {
    const ctx = withMem({ delay0: 100, buffer: 2048 })
    expect(parseAtomicValue('delay0', ctx)).toBe(100)
    expect(parseAtomicValue('buffer', ctx)).toBe(2048)
  })

  it('returns 0 for empty string', () => {
    expect(parseAtomicValue('', {})).toBe(0)
    expect(parseAtomicValue('   ', {})).toBe(0)
  })

  it('returns 0 for POT references', () => {
    expect(parseAtomicValue('pot0', {})).toBe(0)
    expect(parseAtomicValue('POT2', {})).toBe(0)
  })

  it('throws on unresolvable identifier', () => {
    expect(() => parseAtomicValue('nonexistent', {})).toThrow('Invalid value')
  })

  it('recursively evaluates equate whose value is an expression', () => {
    const ctx = withEquates({ base: '100', total: 'base + 50' })
    expect(parseAtomicValue('total', ctx)).toBe(150)
  })
})

// ─── evaluateExpression: basic arithmetic ───────────────────────────────────

describe('evaluateExpression — basic arithmetic', () => {
  it('returns 0 for empty string', () => {
    expect(eval_('')).toBe(0)
    expect(eval_('   ')).toBe(0)
  })

  it('returns a bare number', () => {
    expect(eval_('42')).toBe(42)
    expect(eval_('0.5')).toBe(0.5)
  })

  it('adds two numbers', () => {
    expect(eval_('1+2')).toBe(3)
    expect(eval_('1 + 2')).toBe(3)
  })

  it('subtracts', () => {
    expect(eval_('10-3')).toBe(7)
    expect(eval_('10 - 3')).toBe(7)
  })

  it('multiplies', () => {
    expect(eval_('6*7')).toBe(42)
    expect(eval_('6 * 7')).toBe(42)
  })

  it('divides', () => {
    expect(eval_('1/256')).toBeCloseTo(1 / 256)
    expect(eval_('10 / 5')).toBe(2)
  })

  it('handles division by zero gracefully', () => {
    expect(eval_('1/0')).toBe(0)
  })

  it('chains multiple additions', () => {
    expect(eval_('1+2+3+4')).toBe(10)
  })

  it('chains mixed add and subtract', () => {
    expect(eval_('10 - 3 + 2 - 1')).toBe(8)
  })
})

// ─── operator precedence ────────────────────────────────────────────────────

describe('evaluateExpression — operator precedence', () => {
  it('multiplies before adding', () => {
    expect(eval_('2 + 3 * 4')).toBe(14)
  })

  it('divides before subtracting', () => {
    expect(eval_('10 - 6 / 3')).toBe(8)
  })

  it('chains high-precedence ops', () => {
    expect(eval_('2 * 3 * 4')).toBe(24)
  })

  it('mixed precedence: a + b * c - d / e', () => {
    expect(eval_('1 + 2 * 3 - 8 / 4')).toBe(5) // 1 + 6 - 2
  })
})

// ─── unary signs ────────────────────────────────────────────────────────────

describe('evaluateExpression — unary signs', () => {
  it('negative number', () => {
    expect(eval_('-1')).toBe(-1)
    expect(eval_('-0.5')).toBe(-0.5)
  })

  it('negative number with space: "- 1"', () => {
    expect(eval_('- 1')).toBe(-1)
  })

  it('negative number in division: "- 1/256"', () => {
    expect(eval_('- 1/256')).toBeCloseTo(-1 / 256)
  })

  it('unary minus on equate: "-kiap"', () => {
    const ctx = withEquates({ kiap: '0.5' })
    expect(eval_('-kiap', ctx)).toBe(-0.5)
  })

  it('unary minus on equate with space: "- kiap"', () => {
    const ctx = withEquates({ kiap: '0.5' })
    expect(eval_('- kiap', ctx)).toBe(-0.5)
  })

  it('unary plus on equate: "+del"', () => {
    const ctx = withEquates({ del: '100' })
    expect(eval_('+del', ctx)).toBe(100)
  })

  it('unary plus on equate with space: "+ del"', () => {
    const ctx = withEquates({ del: '100' })
    expect(eval_('+ del', ctx)).toBe(100)
  })

  it('unary plus on number: "+42"', () => {
    expect(eval_('+42')).toBe(42)
  })

  it('unary minus on hex: "-$FF"', () => {
    expect(eval_('-$FF')).toBe(-255)
  })

  it('unary minus on binary: "-%1010"', () => {
    expect(eval_('-%1010')).toBe(-10)
  })
})

// ─── parentheses ────────────────────────────────────────────────────────────

describe('evaluateExpression — parentheses', () => {
  it('simple parenthesized expression', () => {
    expect(eval_('(1 + 2)')).toBe(3)
  })

  it('parentheses override precedence', () => {
    expect(eval_('(2 + 3) * 4')).toBe(20)
  })

  it('nested parentheses', () => {
    expect(eval_('((2 + 3) * (4 - 1))')).toBe(15)
  })

  it('coefficient with parens: "(1.0 - 0.5)"', () => {
    expect(eval_('(1.0 - 0.5)')).toBe(0.5)
  })

  it('complex: "(mem_addr + 16384)/32768"', () => {
    const ctx = withMem({ mem_addr: 100 })
    expect(eval_('(mem_addr + 16384)/32768', ctx)).toBeCloseTo(
      (100 + 16384) / 32768,
    )
  })

  it('parens with equate: "(base + offset)"', () => {
    const ctx = withEquates({ base: '100', offset: '50' })
    expect(eval_('(base + offset)', ctx)).toBe(150)
  })
})

// ─── shift operators ────────────────────────────────────────────────────────

describe('evaluateExpression — shift operators', () => {
  it('left-shift with <<', () => {
    expect(eval_('1 << 8')).toBe(256)
  })

  it('left-shift with single <', () => {
    // SpinASM uses single < as left-shift shorthand
    expect(eval_('1 < 8')).toBe(256)
  })

  it('right-shift with >>', () => {
    expect(eval_('256 >> 8')).toBe(1)
  })

  it('right-shift with single >', () => {
    expect(eval_('256 > 8')).toBe(1)
  })

  it('shift with equate: "fladel < 8"', () => {
    const ctx = withEquates({ fladel: '138' })
    expect(eval_('fladel < 8', ctx)).toBe(138 << 8)
  })

  it('shift has same precedence as multiply', () => {
    // (1 << 8) + 1 = 257, not 1 << 9 = 512
    expect(eval_('1 << 8 + 1')).toBe(257)
  })
})

// ─── bitwise OR ─────────────────────────────────────────────────────────────

describe('evaluateExpression — bitwise OR', () => {
  it('basic OR', () => {
    expect(eval_('$F0 | $0F')).toBe(0xff)
  })

  it('OR has lower precedence than shift', () => {
    // 1 << 8 | 0xFF = 256 | 255 = 511
    expect(eval_('1 << 8 | $FF')).toBe(0x1ff)
  })
})

// ─── hex/binary in expressions ──────────────────────────────────────────────

describe('evaluateExpression — hex and binary in expressions', () => {
  it('hex addition', () => {
    expect(eval_('$100 + $FF')).toBe(0x1ff)
  })

  it('binary in arithmetic', () => {
    expect(eval_('%1111 + 1')).toBe(16)
  })

  it('mixed hex and decimal', () => {
    expect(eval_('$10 * 2')).toBe(32)
  })

  it('binary with underscores in expression', () => {
    expect(eval_('%1111_0000 + %0000_1111')).toBe(0xff)
  })
})

// ─── equate resolution in expressions ───────────────────────────────────────

describe('evaluateExpression — equate resolution', () => {
  it('equate + literal', () => {
    const ctx = withEquates({ excursion: '10' })
    expect(eval_('740 + excursion', ctx)).toBe(750)
  })

  it('equate - equate', () => {
    const ctx = withEquates({ ptrmax: '1000', ptrmin: '100' })
    expect(eval_('ptrmax - ptrmin', ctx)).toBe(900)
  })

  it('equate * literal', () => {
    const ctx = withEquates({ line1: '256' })
    expect(eval_('line1 * 256', ctx)).toBe(65536)
  })

  it('negative equate in subtraction: "-excursion - 1"', () => {
    const ctx = withEquates({ excursion: '10' })
    expect(eval_('-excursion - 1', ctx)).toBe(-11)
  })
})

// ─── memory symbol resolution ───────────────────────────────────────────────

describe('evaluateExpression — memory symbol resolution', () => {
  it('memory symbol as bare value', () => {
    const ctx = withMem({ delay0: 500 })
    expect(eval_('delay0', ctx)).toBe(500)
  })

  it('memory symbol + literal', () => {
    const ctx = withMem({ delay0: 500 })
    expect(eval_('delay0 + 100', ctx)).toBe(600)
  })
})

// ─── integration: full compile pipeline ─────────────────────────────────────

describe('integration — compileProgram with expression edge cases', () => {
  const compile = (source: string) => compileProgram(parseSpinAsm(source))

  it('handles MEM size with equate expression', () => {
    const prog = compile(`
equ excursion 10
mem buffer 740+excursion
rdax adcl, 0.5
wra buffer, 0
    `)
    // Should compile without error
    expect(prog.instructions[0].opcode).toBe('rdax')
  })

  it('handles binary literal with underscores in OR mask', () => {
    const prog = compile(`
or %01111110_00000000_00000000
    `)
    expect(prog.instructions[0].operands[0]).toBe(0x7e0000)
  })

  it('handles spaced unary minus in sof coefficient', () => {
    const prog = compile(`
sof 1, - 1/256
    `)
    expect(prog.instructions[0].operands[1]).toBeCloseTo(-1 / 256)
  })

  it('handles name-first equ syntax', () => {
    const prog = compile(`
gain equ 0.5
rdax adcl, gain
    `)
    expect(prog.instructions[0].operands[1]).toBe(0.5)
  })

  it('handles cho with empty flags field (double comma)', () => {
    const prog = compile(`
mem delay0 4096
cho rda, rmp0, , delay0
    `)
    // cho operands: [mode, lfoSel, flags, addr]
    expect(prog.instructions[0].opcode).toBe('cho')
    expect(prog.instructions[0].operands[2]).toBe(0) // flags = 0 (empty)
  })

  it('handles cho with sin flag', () => {
    const prog = compile(`
mem delay0 4096
cho rda, sin0, sin|reg|compc, delay0
    `)
    const flags = prog.instructions[0].operands[2]
    expect(flags & 0x02).toBe(0x02) // REG
    expect(flags & 0x04).toBe(0x04) // COMPC
    expect(flags & 0x01).toBe(0x00) // SIN = default (not COS)
  })

  it('handles parenthesized coefficient', () => {
    const prog = compile(`
rdax adcl, (1.0 - 0.5)
    `)
    expect(prog.instructions[0].operands[1]).toBe(0.5)
  })

  it('handles label#-equateExpr address', () => {
    const prog = compile(`
equ excursion 10
mem ap 100
rda ap#-excursion-1, 0.5
    `)
    // Should compile without throwing
    expect(prog.instructions[0].opcode).toBe('rda')
  })

  it('handles case-insensitive labels in SKP', () => {
    const prog = compile(`
skp zro, DONE
nop
DONE:
nop
    `)
    // skip count from instruction 0 to label DONE (instruction 2) = 2 - 0 - 1 = 1
    expect(prog.instructions[0].operands[1]).toBe(1)
  })
})

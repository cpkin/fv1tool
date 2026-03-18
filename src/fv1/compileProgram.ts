/**
 * FV-1 Program Compiler
 * 
 * Compiles parsed SpinASM instructions into a 128-slot instruction array
 * ready for execution by the FV-1 interpreter.
 * 
 * Key responsibilities:
 * - Resolve label references to instruction addresses
 * - Normalize operands (parse coefficients, register indices, addresses)
 * - Fill unused slots with NOPs (ensuring 128-instruction fixed size)
 * - Map opcode identifiers from parser to handler names
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/arch.html
 */

import type { ParseResult, ParsedInstruction } from '../parser/ast';
import type { CompiledProgram, CompiledInstruction, IOMode } from './types';
import { INSTRUCTIONS_PER_SAMPLE, MAX_DELAY_RAM } from './constants';

/**
 * Compilation error
 */
export class CompilationError extends Error {
  readonly line: number;
  readonly column: number;
  
  constructor(
    message: string,
    line: number,
    column: number,
  ) {
    super(`Line ${line}:${column} - ${message}`);
    this.name = 'CompilationError';
    this.line = line;
    this.column = column;
  }
}

/**
 * Parses a register operand (REG0-REG31, ADCL, ADCR, DACL, DACR)
 * 
 * @param operand - Register name or index
 * @param equates - Equate symbol table for resolving symbolic names
 * @returns Register index (0-31) or special register value
 */
// Hardware register index → SpinGPT compiler index for numeric indices > 31
// SpinCAD outputs raw hardware register addresses (32=ADCL, 33=ADCR, etc.)
const HARDWARE_REG_MAP: Record<number, number> = {
  20: 32,  // ADCL  (hw 20 → compiler 32)
  21: 33,  // ADCR
  22: 34,  // DACL
  23: 35,  // DACR
  24: 24,  // ADDR_PTR
  // Hardware indices 32-63 are REG0-REG31
};

function parseRegister(operand: string, equates: Record<string, { value: string }>): number {
  let trimmed = operand.trim().toLowerCase();

  // Resolve equates first (e.g., "input" -> "ADCL")
  if (trimmed in equates) {
    trimmed = equates[trimmed].value.toLowerCase();
  }

  // Special registers (ADC/DAC are mapped to virtual registers)
  if (trimmed === 'adcl') return 32;
  if (trimmed === 'adcr') return 33;
  if (trimmed === 'dacl') return 34;
  if (trimmed === 'dacr') return 35;
  if (trimmed === 'sin0') return 36;
  if (trimmed === 'sin1') return 37;
  if (trimmed === 'rmp0') return 38;
  if (trimmed === 'rmp1') return 39;
  if (trimmed === 'addr_ptr' || trimmed === 'addrptr') return 24;
  if (trimmed === 'cos0') return 36;
  if (trimmed === 'cos1') return 37;
  // SpinCAD LFO parameter register names
  if (trimmed === 'sin0_rate') return 43;
  if (trimmed === 'sin0_range') return 44;
  if (trimmed === 'sin1_rate') return 45;
  if (trimmed === 'sin1_range') return 46;
  if (trimmed === 'rmp0_rate') return 47;
  if (trimmed === 'rmp0_range') return 48;
  if (trimmed === 'rmp1_rate') return 49;
  if (trimmed === 'rmp1_range') return 50;

  // POT registers (runtime-resolved, use placeholder indices)
  if (trimmed === 'pot0') return 40;
  if (trimmed === 'pot1') return 41;
  if (trimmed === 'pot2') return 42;

  // Named registers: reg0-reg31
  const regMatch = trimmed.match(/^reg(\d+)$/);
  if (regMatch) {
    const index = parseInt(regMatch[1], 10);
    if (index >= 0 && index <= 31) {
      return index;
    }
  }

  // Direct numeric index — support full FV-1 hardware range (0-63)
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch) {
    const index = parseInt(numMatch[1], 10);
    if (index >= 0 && index <= 31) {
      return index; // REG0-REG31
    }
    // Hardware special register indices (20-24)
    if (index in HARDWARE_REG_MAP) {
      return HARDWARE_REG_MAP[index];
    }
    // Hardware indices 32-63 → REG0-REG31
    if (index >= 32 && index <= 63) {
      return index - 32;
    }
  }

  // Last resort: if the resolved value is numeric (e.g., equate to "-0.5"),
  // truncate to a 6-bit register index. This handles buggy programs like
  // shimmer-2.spn where "mulx kd" and "equ kd -0.5" is used.
  const numericValue = parseFloat(trimmed);
  if (!isNaN(numericValue)) {
    const index = Math.abs(Math.floor(numericValue)) & 0x3f;
    if (index >= 0 && index <= 31) return index;
    if (index in HARDWARE_REG_MAP) return HARDWARE_REG_MAP[index];
    if (index >= 32 && index <= 63) return index - 32;
    return 0;
  }

  throw new Error(`Invalid register: ${operand}`);
}

function parseLfoSelector(operand: string, type: 'sin' | 'rmp' | 'any'): number {
  const trimmed = operand.trim().toLowerCase();

  // Named selectors: sin0, sin1, rmp0, rmp1
  const supportedTypes = type === 'any' ? ['sin', 'rmp'] : [type];
  for (const prefix of supportedTypes) {
    if (trimmed.startsWith(prefix)) {
      const index = parseInt(trimmed.slice(prefix.length), 10);
      if (index === 0 || index === 1) {
        if (type === 'any' && prefix === 'rmp') {
          return index + 2; // rmp0=2, rmp1=3
        }
        return index;
      }
    }
  }

  // Numeric selectors — FV-1 hardware encoding: 0=SIN0, 1=SIN1, 2=RMP0, 3=RMP1
  const numeric = parseInt(trimmed, 10);
  if (!isNaN(numeric)) {
    if (type === 'any') {
      if (numeric >= 0 && numeric <= 3) return numeric;
    } else if (type === 'sin') {
      if (numeric === 0 || numeric === 1) return numeric;
      // SpinCAD encoding: 8 = SIN0 with COS flag, 9 = SIN1 with COS flag
      // These are only used with CHO RDAL which reads the raw LFO value.
      // 8 → lfoSelect=0 (handled separately via flags in CHO)
      // 9 → lfoSelect=1
      if (numeric === 8) return 0;
      if (numeric === 9) return 1;
    } else {
      // type === 'rmp'
      if (numeric === 0 || numeric === 2) return 0; // rmp0 — SpinCAD uses 2 for RMP0
      if (numeric === 1 || numeric === 3) return 1; // rmp1 — SpinCAD uses 3 for RMP1
    }
  }

  throw new Error(`Invalid LFO selector: ${operand}`);
}

function parseChoMode(operand: string): number {
  const trimmed = operand.trim().toLowerCase();

  if (trimmed === 'rda') return 0;
  if (trimmed === 'sof') return 1;
  if (trimmed === 'rdal') return 2;

  throw new Error(`Invalid CHO mode: ${operand}`);
}

function parseChoFlags(operand: string): number {
  const trimmed = operand.trim();
  if (!trimmed) return 0;

  const normalized = trimmed.toLowerCase();
  if (normalized === '0') return 0;

  return normalized.split('|').reduce((flags, flag) => {
    const cleaned = flag.trim();
    if (cleaned === 'sin') return flags | 0x00; // SIN is default (no bit set)
    if (cleaned === 'cos') return flags | 0x01;
    if (cleaned === 'reg') return flags | 0x02;
    if (cleaned === 'compc') return flags | 0x04;
    if (cleaned === 'compa') return flags | 0x08;
    if (cleaned === 'rptr2') return flags | 0x10;
    if (cleaned === 'na') return flags | 0x20;
    const numeric = parseInt(cleaned, 10);
    if (!Number.isNaN(numeric)) {
      return flags | numeric;
    }
    return flags;
  }, 0);
}

const SKP_ALIAS_FLAGS: Record<string, number> = {
  skp_run: 0x01,
  skp_zro: 0x02,
  skp_gez: 0x04,
  skp_neg: 0x08,
  skp_zrc: 0x10,
  skp_run_zro: 0x01 | 0x02,
  skp_run_gez: 0x01 | 0x04,
  skp_run_neg: 0x01 | 0x08,
  skp_run_zrc: 0x01 | 0x10,
};

const CHO_MODE_ALIASES: Record<string, number> = {
  cho_rda: 0,
  cho_sof: 1,
  cho_rdal: 2,
};

function parseSkipTarget(
  target: string,
  labelAddresses: Record<string, number>,
  currentInstructionIndex: number,
): number {
  const numMatch = target.match(/^(\d+)$/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  const targetLower = target.toLowerCase();
  if (!(targetLower in labelAddresses)) {
    throw new Error(`Unresolved label: ${target}`);
  }

  const targetAddr = labelAddresses[targetLower];
  const skipCount = targetAddr - currentInstructionIndex - 1;
  return Math.max(0, skipCount);
}

function parseRawWord(operand: string): number {
  const trimmed = operand.trim();
  if (!trimmed) {
    throw new Error('RAW requires a 32-bit unsigned literal');
  }

  let value: number;
  if (trimmed.startsWith('$')) {
    value = parseInt(trimmed.slice(1), 16);
  } else if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    value = parseInt(trimmed.slice(2), 16);
  } else if (trimmed.startsWith('%')) {
    value = parseInt(trimmed.slice(1).replace(/_/g, ''), 2);
  } else if (/^\d+$/.test(trimmed)) {
    value = parseInt(trimmed, 10);
  } else {
    throw new Error(`Invalid RAW operand: ${operand}`);
  }

  if (!Number.isFinite(value) || value < 0 || value > 0xFFFFFFFF) {
    throw new Error(`RAW operand out of range: ${operand}`);
  }

  return value >>> 0;
}

function parseChoOperands(
  instruction: ParsedInstruction,
  mode: number,
  operandOffset: number,
  memoryAddresses: Record<string, number>,
  equates?: Record<string, { value: string }>,
): number[] {
  const operands: number[] = [mode];

  // Parse LFO selector — may contain embedded flags for SpinCAD numeric selectors
  let embeddedFlags = 0;
  if (instruction.operands.length >= operandOffset + 1) {
    const lfoOperand = instruction.operands[operandOffset].trim();
    const lfoNumeric = parseInt(lfoOperand, 10);
    if (!isNaN(lfoNumeric) && lfoNumeric > 3) {
      // SpinCAD combined encoding: low 2 bits = lfoSel, upper bits = flags
      // e.g., 8 = lfoSel=0, flags=COS (CHO RDAL,8 reads COS0)
      operands.push(lfoNumeric & 0x03);
      embeddedFlags = lfoNumeric >> 2;
    } else {
      operands.push(parseLfoSelector(lfoOperand, 'any'));
    }
  }

  if (instruction.operands.length >= operandOffset + 2) {
    operands.push(parseChoFlags(instruction.operands[operandOffset + 1]) | embeddedFlags);
  } else if (embeddedFlags) {
    // No explicit flags operand but we have embedded flags from the selector
    operands.push(embeddedFlags);
  }

  if (instruction.operands.length >= operandOffset + 3) {
    if (mode === 1) {
      operands.push(parseCoefficient(instruction.operands[operandOffset + 2], equates, memoryAddresses));
    } else {
      operands.push(parseDelayWriteAddress(instruction.operands[operandOffset + 2], memoryAddresses, equates));
    }
  }

  if (mode === 1 && instruction.operands.length >= operandOffset + 4) {
    operands.push(parseCoefficient(instruction.operands[operandOffset + 3], equates, memoryAddresses));
  }

  return operands;
}

/**
 * Parses a coefficient operand
 * 
 * Supports:
 * - Decimal: 0.5, -1.0, 1.99
 * - Hexadecimal: $FF, 0x7FFF
 * - Binary: %10101010
 * - Symbolic: POT0, POT1, POT2
 * 
 * @param operand - Coefficient string
 * @returns Numeric coefficient value
 */
/** Context for expression evaluation: equate table + memory symbol table. */
export interface ExprContext {
  equates?: Record<string, { value: string }>;
  memoryAddresses?: Record<string, number>;
}

/**
 * Parse a single atomic value (no operators).
 * Handles: hex ($FF, 0xFF), binary (%101), decimal, POT refs, equate names, memory symbols.
 */
export function parseAtomicValue(token: string, ctx: ExprContext): number {
  const trimmed = token.trim();
  if (!trimmed) return 0;

  // Resolve equates (e.g., "crush" → "0xfc0000", "kiap" → "0.5")
  if (ctx.equates) {
    const lower = trimmed.toLowerCase();
    if (lower in ctx.equates) {
      // Recursively evaluate in case equate value is itself an expression
      return evaluateExpression(ctx.equates[lower].value.trim(), ctx);
    }
  }

  // Resolve memory symbols (e.g., "Line1" → 2338)
  if (ctx.memoryAddresses) {
    const lower = trimmed.toLowerCase();
    if (lower in ctx.memoryAddresses) {
      return ctx.memoryAddresses[lower];
    }
  }

  // POT references (runtime-resolved, placeholder 0)
  if (trimmed.toLowerCase().startsWith('pot')) return 0;

  // Hexadecimal: $FF, 0xFF (with optional leading minus: -$FF, -0xFF)
  if (trimmed.startsWith('$')) return parseInt(trimmed.slice(1), 16);
  if (trimmed.startsWith('-$')) return -parseInt(trimmed.slice(2), 16);
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) return parseInt(trimmed.slice(2), 16);
  if (trimmed.startsWith('-0x') || trimmed.startsWith('-0X')) return -parseInt(trimmed.slice(3), 16);

  // Binary: %10101010 (underscores allowed as visual separators, optional leading minus)
  if (trimmed.startsWith('%')) return parseInt(trimmed.slice(1).replace(/_/g, ''), 2);
  if (trimmed.startsWith('-%')) return -parseInt(trimmed.slice(2).replace(/_/g, ''), 2);

  // Decimal
  const value = parseFloat(trimmed);
  if (!isNaN(value)) return value;

  throw new Error(`Invalid value: ${token}`);
}

/**
 * Evaluate a simple arithmetic expression with equate resolution.
 *
 * Supports: +, -, *, /, |, <<, >> between atoms and parenthesized sub-expressions.
 * Respects operator precedence (* / << >> before + - |).
 *
 * Examples:
 *   "-kiap"            → negate equate value
 *   "Line1 * 256"      → equate * literal
 *   "ptrmax - ptrmin"  → equate - equate
 *   "1/256"            → literal division
 *   "-1/256"           → unary minus then division
 */
export function evaluateExpression(
  expr: string,
  ctx: ExprContext,
): number {
  const trimmed = expr.trim();
  if (!trimmed) return 0;

  type Token = { type: 'num'; value: number } | { type: 'op'; value: string };
  const tokens: Token[] = [];
  let pos = 0;
  const s = trimmed;

  while (pos < s.length) {
    // Skip whitespace
    while (pos < s.length && (s[pos] === ' ' || s[pos] === '\t')) pos++;
    if (pos >= s.length) break;

    const ch = s[pos];

    // Parenthesized sub-expression: (...)
    if (ch === '(') {
      let depth = 1;
      const inner_start = pos + 1;
      pos++;
      while (pos < s.length && depth > 0) {
        if (s[pos] === '(') depth++;
        else if (s[pos] === ')') depth--;
        pos++;
      }
      const inner = s.slice(inner_start, pos - 1);
      tokens.push({ type: 'num', value: evaluateExpression(inner, ctx) });
      continue;
    }

    // Operator (but not unary): +  -  *  /  |  < (left-shift)  > (right-shift)
    const lastIsNum = tokens.length > 0 && tokens[tokens.length - 1].type === 'num';
    if (lastIsNum) {
      if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '|') {
        tokens.push({ type: 'op', value: ch });
        pos++;
        continue;
      }
      // Left-shift: < or <<
      if (ch === '<') {
        pos++;
        if (s[pos] === '<') pos++;
        tokens.push({ type: 'op', value: '<<' });
        continue;
      }
      // Right-shift: > or >>
      if (ch === '>') {
        pos++;
        if (s[pos] === '>') pos++;
        tokens.push({ type: 'op', value: '>>' });
        continue;
      }
    }

    // Atom (number, identifier, hex/binary literal).
    // Track the sign char and value start separately so interior whitespace
    // (e.g., "+ 1", "- del") is stripped when rebuilding the atom string.
    let signChar = '';
    if (ch === '-' || ch === '+') {
      signChar = ch;
      pos++;
      // Skip whitespace between sign and value (e.g., "- 1/256", "+ del")
      while (pos < s.length && (s[pos] === ' ' || s[pos] === '\t')) pos++;
    }
    const valueStart = pos;
    // Read atom chars until operator or whitespace
    while (pos < s.length) {
      const c = s[pos];
      if (c === ' ' || c === '\t' || c === '(' || c === ')') break;
      if (c === '+' || c === '*' || c === '/' || c === '|' || c === '<' || c === '>') break;
      // '-' terminates if we already have value chars (binary minus)
      if (c === '-' && pos > valueStart) break;
      pos++;
    }

    const valueStr = s.slice(valueStart, pos);
    // Reconstruct atom without interior spaces: sign + value
    const atom = signChar + valueStr;
    if (!atom || atom === '+' || atom === '-') continue;

    // Unary + on identifier: strip the +, resolve normally
    if (atom.startsWith('+') && atom.length > 1) {
      tokens.push({ type: 'num', value: parseAtomicValue(atom.slice(1), ctx) });
    // Unary minus on identifier: "-kiap" → negate resolved value
    } else if (atom.startsWith('-') && atom.length > 1 && !/^-[\d$%]/.test(atom) && !atom.startsWith('-0x') && !atom.startsWith('-0X')) {
      tokens.push({ type: 'num', value: -parseAtomicValue(atom.slice(1), ctx) });
    } else {
      tokens.push({ type: 'num', value: parseAtomicValue(atom, ctx) });
    }
  }

  if (tokens.length === 0) return 0;
  if (tokens.length === 1 && tokens[0].type === 'num') return tokens[0].value;

  // Build alternating num/op lists
  const nums: number[] = [];
  const ops: string[] = [];
  for (const t of tokens) {
    if (t.type === 'num') nums.push(t.value);
    else ops.push(t.value);
  }

  // Pass 1: high-precedence operators: * / << >>
  const nums2: number[] = [nums[0]];
  const ops2: string[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const right = nums[i + 1];
    if (op === '*' || op === '/' || op === '<<' || op === '>>') {
      const left = nums2.pop()!;
      if (op === '*') nums2.push(left * right);
      else if (op === '/') nums2.push(right !== 0 ? left / right : 0);
      else if (op === '<<') nums2.push((left << right) >>> 0);
      else nums2.push(left >> right);
    } else {
      ops2.push(op);
      nums2.push(right);
    }
  }

  // Pass 2: low-precedence operators: + - |
  let result = nums2[0];
  for (let i = 0; i < ops2.length; i++) {
    const op = ops2[i];
    const right = nums2[i + 1];
    if (op === '+') result = result + right;
    else if (op === '-') result = result - right;
    else if (op === '|') result = (result | right) >>> 0;
    else result = result + right; // fallback
  }

  return result;
}

function parseCoefficient(
  operand: string,
  equates?: Record<string, { value: string }>,
  memoryAddresses?: Record<string, number>,
): number {
  const ctx: ExprContext = { equates, memoryAddresses };
  return evaluateExpression(operand.trim(), ctx);
}

/**
 * Parses a delay address operand
 * 
 * Can be:
 * - Direct numeric: 1000, 32767
 * - Label reference: delay_line1#
 * - Expression: delay_line1#+100
 * 
 * @param operand - Address string
 * @param symbols - Symbol table for label resolution
 * @returns Numeric address (0-32767)
 */
function parseAddress(
  operand: string,
  symbols: Record<string, number>,
  equates?: Record<string, { value: string }>,
): number {
  const trimmed = operand.trim();

  // Direct numeric
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  // Label reference with # or ^ suffix, optionally followed by an offset expression.
  // Examples: "delay#", "delay#-100", "ap23_24#-excursion-1" (where excursion is an equate)
  const labelHashMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)[#^](.*)$/);
  if (labelHashMatch) {
    const label = labelHashMatch[1].toLowerCase();
    const offsetExpr = labelHashMatch[2].trim();

    if (!(label in symbols)) {
      throw new Error(`Unresolved label: ${label}`);
    }

    const base = symbols[label];
    if (!offsetExpr) {
      return base + MAX_DELAY_RAM;
    }
    const ctx: ExprContext = { equates, memoryAddresses: symbols as Record<string, number> };
    return base + MAX_DELAY_RAM + evaluateExpression(offsetExpr, ctx);
  }

  // Expression without # separator: label followed by +/- and an offset expression.
  // Handles spaces and equate names: "delay+100", "del1+del", "mem0_delayd + 1"
  const labelOpMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([+\-].+)$/);
  if (labelOpMatch) {
    const label = labelOpMatch[1].toLowerCase();
    const offsetExpr = labelOpMatch[2].trim();
    if (label in symbols) {
      const ctx: ExprContext = { equates, memoryAddresses: symbols };
      return symbols[label] + evaluateExpression(offsetExpr, ctx);
    }
  }

  // Bare symbol name without suffix (e.g., "delay")
  // This is common in WRA/RDA instructions
  const bareSymbol = trimmed.toLowerCase();
  if (bareSymbol in symbols) {
    return symbols[bareSymbol];
  }

  throw new Error(`Invalid address: ${operand}`);
}

function parseDelayWriteAddress(
  operand: string,
  symbols: Record<string, number>,
  equates?: Record<string, { value: string }>,
): number {
  const trimmed = operand.trim();

  // Preserve explicit pointer-relative addressing (# or ^ suffix)
  if (trimmed.includes('#') || trimmed.includes('^')) {
    return parseAddress(trimmed, symbols, equates);
  }

  // Treat delay memory symbols as pointer-relative by default for writes.
  // Handles spaces and equate names in offset: "mem0_delayd + 1", "del1+del"
  const labelOpMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([+\-].+)$/);
  if (labelOpMatch) {
    const label = labelOpMatch[1].toLowerCase();
    const offsetExpr = labelOpMatch[2].trim();
    if (label in symbols) {
      const ctx: ExprContext = { equates, memoryAddresses: symbols };
      return symbols[label] + evaluateExpression(offsetExpr, ctx) + MAX_DELAY_RAM;
    }
  }

  const bareSymbol = trimmed.toLowerCase();
  if (bareSymbol in symbols) {
    return symbols[bareSymbol] + MAX_DELAY_RAM;
  }

  return parseAddress(trimmed, symbols, equates);
}

/**
 * Compiles a single parsed instruction into a compiled instruction
 * 
 * @param instruction - Parsed instruction from parser
 * @param labelAddresses - Map of label names to instruction addresses
 * @param memoryAddresses - Map of memory symbol names to delay RAM addresses
 * @param equates - Equate symbol table for resolving symbolic names
 * @returns Compiled instruction ready for execution
 */
function compileInstruction(
  instruction: ParsedInstruction,
  instructionIndex: number,
  labelAddresses: Record<string, number>,
  memoryAddresses: Record<string, number>,
  equates: Record<string, { value: string }>,
): CompiledInstruction {
  const opcode = instruction.opcode.toLowerCase();
  const operands: number[] = [];

  const skpAliasFlags = SKP_ALIAS_FLAGS[opcode];
  if (skpAliasFlags !== undefined) {
    operands.push(skpAliasFlags);
    if (instruction.operands.length >= 1) {
      operands.push(parseSkipTarget(instruction.operands[0], labelAddresses, instructionIndex));
    } else {
      operands.push(0);
    }

    return {
      opcode: 'skp',
      operands,
      line: instruction.line,
    };
  }

  const choAliasMode = CHO_MODE_ALIASES[opcode];
  if (choAliasMode !== undefined) {
    return {
      opcode: 'cho',
      operands: parseChoOperands(instruction, choAliasMode, 0, memoryAddresses, equates),
      line: instruction.line,
    };
  }
  
  try {
    // Handle different operand types based on opcode
    switch (opcode) {
      // Register operations: reg, coeff
      case 'rdax':
      case 'rdfx':
      case 'wrax':
      case 'wrhx':
      case 'wrlx':
      case 'maxx':
        if (instruction.operands.length >= 1) {
          operands.push(parseRegister(instruction.operands[0], equates));
        }
        if (instruction.operands.length >= 2) {
          operands.push(parseCoefficient(instruction.operands[1], equates, memoryAddresses));
        }
        break;
      
      // Register load: reg
      case 'ldax':
      case 'mulx':
        if (instruction.operands.length >= 1) {
          operands.push(parseRegister(instruction.operands[0], equates));
        }
        break;
      
      // Delay memory read: addr, coeff
      case 'rda':
        if (instruction.operands.length >= 1) {
          operands.push(parseAddress(instruction.operands[0], memoryAddresses, equates));
        }
        if (instruction.operands.length >= 2) {
          operands.push(parseCoefficient(instruction.operands[1], equates, memoryAddresses));
        }
        break;

      // Delay memory write: addr, coeff
      case 'wra':
      case 'wrap':
        if (instruction.operands.length >= 1) {
          operands.push(parseDelayWriteAddress(instruction.operands[0], memoryAddresses, equates));
        }
        if (instruction.operands.length >= 2) {
          operands.push(parseCoefficient(instruction.operands[1], equates, memoryAddresses));
        }
        break;
      
      // RMPA: coeff
      case 'rmpa':
        if (instruction.operands.length >= 1) {
          operands.push(parseCoefficient(instruction.operands[0], equates, memoryAddresses));
        }
        break;
      
      // Scale and offset: coeff, offset
      case 'sof':
      case 'log':
      case 'exp':
        if (instruction.operands.length >= 1) {
          operands.push(parseCoefficient(instruction.operands[0], equates, memoryAddresses));
        }
        if (instruction.operands.length >= 2) {
          operands.push(parseCoefficient(instruction.operands[1], equates, memoryAddresses));
        }
        break;
      
      // Bitwise operations: mask
      case 'and':
      case 'or':
      case 'xor':
        if (instruction.operands.length >= 1) {
          operands.push(parseCoefficient(instruction.operands[0], equates, memoryAddresses));
        }
        break;
      
      // Skip: flags, count or label
      case 'skp': {
        // Parse condition flags
        let flags = 0;
        if (instruction.operands.length >= 1) {
          const flagStr = instruction.operands[0].toLowerCase();
          if (flagStr.includes('run')) flags |= 0x01;
          if (flagStr.includes('zro')) flags |= 0x02;
          if (flagStr.includes('gez')) flags |= 0x04;
          if (flagStr.includes('neg')) flags |= 0x08;
          if (flagStr.includes('zrc')) flags |= 0x10;
        }
        operands.push(flags);
        
        // Parse skip count or resolve label
        if (instruction.operands.length >= 2) {
          operands.push(parseSkipTarget(instruction.operands[1], labelAddresses, instructionIndex));
        }
        break;
      }
      
      // Jump: label
      case 'jmp': {
        if (instruction.operands.length >= 1) {
          const target = instruction.operands[0].toLowerCase();
          if (!(target in labelAddresses)) {
            throw new Error(`Unresolved label: ${instruction.operands[0]}`);
          }
          operands.push(labelAddresses[target]);
        }
        break;
      }
      
      // LFO operations
      case 'wlds':
      case 'wldr':
        // Parse: lfo_select, frequency, amplitude
        if (instruction.operands.length >= 1) {
          const type = opcode === 'wlds' ? 'sin' : 'rmp';
          operands.push(parseLfoSelector(instruction.operands[0], type));
        }
        if (instruction.operands.length >= 2) {
          operands.push(parseCoefficient(instruction.operands[1], equates, memoryAddresses));
        }
        if (instruction.operands.length >= 3) {
          operands.push(parseCoefficient(instruction.operands[2], equates, memoryAddresses));
        }
        break;
      
      case 'jam':
        // Parse: lfo_select
        if (instruction.operands.length >= 1) {
          operands.push(parseLfoSelector(instruction.operands[0], 'rmp'));
        }
        break;
      
      // No operands
      case 'nop':
      case 'absa':
      case 'clr':
      case 'not':
        // No operands needed
        break;
      
      // Special/complex instructions
      case 'cho': {
        if (instruction.operands.length >= 1) {
          const mode = parseChoMode(instruction.operands[0]);
          operands.push(...parseChoOperands(instruction, mode, 1, memoryAddresses, equates));
        }
        break;
      }
      case 'raw':
        if (instruction.operands.length < 1) {
          throw new Error('RAW requires a 32-bit unsigned literal');
        }
        operands.push(parseRawWord(instruction.operands[0]));
        break;
      
      default:
        // Unknown opcode - pass operands as-is
        for (const op of instruction.operands) {
          try {
            operands.push(parseCoefficient(op, equates, memoryAddresses));
          } catch {
            // If parsing fails, use 0 as placeholder
            operands.push(0);
          }
        }
    }
  } catch (error) {
    throw new CompilationError(
      error instanceof Error ? error.message : 'Unknown compilation error',
      instruction.line,
      instruction.column,
    );
  }
  
  return {
    opcode,
    operands,
    line: instruction.line,
  };
}

/**
 * Compiles a parsed SpinASM program into executable format
 * 
 * @param parseResult - Parse result from SpinASM parser
 * @param ioMode - IO mode for the program (default: stereo_stereo)
 * @returns Compiled program ready for execution
 */
export function compileProgram(
  parseResult: ParseResult,
  ioMode: IOMode = 'stereo_stereo',
): CompiledProgram {
  // Build label address map: label name → instruction index
  // Labels store source line numbers from the parser, so we need to convert
  // them to instruction indices by counting how many instructions precede each label.
  const labelLineNumbers: Record<string, number> = {};
  for (const [name, symbol] of Object.entries(parseResult.symbols.labels)) {
    labelLineNumbers[name] = symbol.line;
  }

  // For labels, find the first instruction at or after the label's source line
  const labelAddresses: Record<string, number> = {};
  for (const [name, labelLine] of Object.entries(labelLineNumbers)) {
    // Find the first instruction whose source line >= label line
    let foundIdx = parseResult.instructions.length; // default: past end
    for (let i = 0; i < parseResult.instructions.length; i++) {
      if (parseResult.instructions[i].line >= labelLine) {
        foundIdx = i;
        break;
      }
    }
    labelAddresses[name] = foundIdx;
  }
  
  // Build memory address map (memory symbols point to delay RAM addresses)
  // Note: equates must be built first so MEM size expressions can reference them.
  const equates: Record<string, { value: string }> = {};
  for (const [name, symbol] of Object.entries(parseResult.symbols.equates)) {
    equates[name.toLowerCase()] = { value: symbol.value };
  }

  const memoryAddresses: Record<string, number> = {};
  let currentMemAddr = 0;
  for (const [name, symbol] of Object.entries(parseResult.symbols.memory)) {
    memoryAddresses[name.toLowerCase()] = currentMemAddr;
    // Evaluate size expression (may reference equates, e.g., "740+excursion")
    try {
      const size = evaluateExpression(symbol.size, { equates });
      if (isFinite(size) && size > 0) {
        currentMemAddr += Math.round(size);
      }
    } catch {
      const size = parseInt(symbol.size, 10);
      if (!isNaN(size)) currentMemAddr += size;
    }
  }
  
  // Compile each instruction
  const compiledInstructions: CompiledInstruction[] = [];
  for (let i = 0; i < parseResult.instructions.length; i++) {
    const instruction = parseResult.instructions[i];
    if (!instruction.recognized) {
      throw new CompilationError(
        `Unrecognized instruction: ${instruction.opcode}`,
        instruction.line,
        instruction.column,
      );
    }

    const compiled = compileInstruction(
      instruction,
      i,
      labelAddresses,
      memoryAddresses,
      equates,
    );
    compiledInstructions.push(compiled);
  }
  
  // Fill to 128 instructions with NOPs
  while (compiledInstructions.length < INSTRUCTIONS_PER_SAMPLE) {
    compiledInstructions.push({
      opcode: 'nop',
      operands: [],
      line: -1, // Synthetic NOP
    });
  }
  
  // Truncate if more than 128 instructions
  if (compiledInstructions.length > INSTRUCTIONS_PER_SAMPLE) {
    throw new CompilationError(
      `Program exceeds ${INSTRUCTIONS_PER_SAMPLE} instructions (has ${compiledInstructions.length})`,
      parseResult.instructions[INSTRUCTIONS_PER_SAMPLE].line,
      parseResult.instructions[INSTRUCTIONS_PER_SAMPLE].column,
    );
  }
  
  return {
    instructions: compiledInstructions,
    ioMode,
    metadata: {
      name: undefined,
      description: undefined,
    },
  };
}

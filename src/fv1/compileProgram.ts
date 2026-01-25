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
import { INSTRUCTIONS_PER_SAMPLE } from './constants';

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
function parseRegister(operand: string, equates: Record<string, { value: string }>): number {
  let trimmed = operand.trim().toLowerCase();
  
  // Resolve equates first (e.g., "input" -> "ADCL")
  if (trimmed in equates) {
    trimmed = equates[trimmed].value.toLowerCase();
  }
  
  // Special registers (ADC/DAC are mapped to virtual registers)
  if (trimmed === 'adcl') return 32; // Virtual register for ADC left
  if (trimmed === 'adcr') return 33; // Virtual register for ADC right
  if (trimmed === 'dacl') return 34; // Virtual register for DAC left
  if (trimmed === 'dacr') return 35; // Virtual register for DAC right
  if (trimmed === 'sin0') return 36; // LFO sine 0
  if (trimmed === 'sin1') return 37; // LFO sine 1
  if (trimmed === 'rmp0') return 38; // LFO ramp 0
  if (trimmed === 'rmp1') return 39; // LFO ramp 1
  
  // POT registers (runtime-resolved, use placeholder indices)
  if (trimmed === 'pot0') return 40; // POT0 placeholder
  if (trimmed === 'pot1') return 41; // POT1 placeholder
  if (trimmed === 'pot2') return 42; // POT2 placeholder
  
  // Named registers: reg0-reg31
  const regMatch = trimmed.match(/^reg(\d+)$/);
  if (regMatch) {
    const index = parseInt(regMatch[1], 10);
    if (index >= 0 && index <= 31) {
      return index;
    }
  }
  
  // Direct numeric index
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch) {
    const index = parseInt(numMatch[1], 10);
    if (index >= 0 && index <= 31) {
      return index;
    }
  }
  
  throw new Error(`Invalid register: ${operand}`);
}

function parseLfoSelector(operand: string, type: 'sin' | 'rmp' | 'any'): number {
  const trimmed = operand.trim().toLowerCase();

  const supportedTypes = type === 'any' ? ['sin', 'rmp'] : [type];
  for (const prefix of supportedTypes) {
    if (trimmed.startsWith(prefix)) {
      const index = parseInt(trimmed.slice(prefix.length), 10);
      if (index === 0 || index === 1) {
        if (type === 'any' && prefix === 'rmp') {
          return index + 2;
        }
        return index;
      }
    }
  }

  const numeric = parseInt(trimmed, 10);
  if (numeric === 0 || numeric === 1) {
    return numeric;
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
    if (cleaned === 'reg') return flags | 1;
    if (cleaned === 'compc') return flags | 2;
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
  instruction: ParsedInstruction,
): number {
  const numMatch = target.match(/^(\d+)$/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  if (!(target in labelAddresses)) {
    throw new Error(`Unresolved label: ${target}`);
  }

  const targetAddr = labelAddresses[target];
  const skipCount = targetAddr - instruction.line - 1;
  return Math.max(0, skipCount);
}

function parseChoOperands(
  instruction: ParsedInstruction,
  mode: number,
  operandOffset: number,
  memoryAddresses: Record<string, number>,
): number[] {
  const operands: number[] = [mode];

  if (instruction.operands.length >= operandOffset + 1) {
    const lfoSelect = parseLfoSelector(instruction.operands[operandOffset], 'any');
    operands.push(lfoSelect);
  }

  if (instruction.operands.length >= operandOffset + 2) {
    operands.push(parseChoFlags(instruction.operands[operandOffset + 1]));
  }

  if (instruction.operands.length >= operandOffset + 3) {
    if (mode === 1) {
      operands.push(parseCoefficient(instruction.operands[operandOffset + 2]));
    } else if (mode !== 2) {
      operands.push(parseAddress(instruction.operands[operandOffset + 2], memoryAddresses));
    }
  }

  if (mode === 1 && instruction.operands.length >= operandOffset + 4) {
    operands.push(parseCoefficient(instruction.operands[operandOffset + 3]));
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
function parseCoefficient(operand: string): number {
  const trimmed = operand.trim();
  
  // POT references (will be resolved at runtime)
  if (trimmed.toLowerCase().startsWith('pot')) {
    // POT values are placeholders - compiler can't resolve them
    // Return 0 as placeholder (runtime will use actual POT values)
    return 0;
  }
  
  // Hexadecimal: $FF or 0xFF
  if (trimmed.startsWith('$')) {
    return parseInt(trimmed.slice(1), 16);
  }
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    return parseInt(trimmed.slice(2), 16);
  }
  
  // Binary: %10101010
  if (trimmed.startsWith('%')) {
    return parseInt(trimmed.slice(1), 2);
  }
  
  // Decimal (default)
  const value = parseFloat(trimmed);
  if (isNaN(value)) {
    throw new Error(`Invalid coefficient: ${operand}`);
  }
  
  return value;
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
function parseAddress(operand: string, symbols: Record<string, number>): number {
  const trimmed = operand.trim();
  
  // Direct numeric
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }
  
  // Label reference with # suffix (e.g., "delay#")
  const labelMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)#$/);
  if (labelMatch) {
    const label = labelMatch[1].toLowerCase();
    if (!(label in symbols)) {
      throw new Error(`Unresolved label: ${label}`);
    }
    return symbols[label];
  }
  
  // Expression with # separator: label#+offset (e.g., "delay#+100")
  const exprHashMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)#([+\-])(\d+)$/);
  if (exprHashMatch) {
    const label = exprHashMatch[1].toLowerCase();
    const op = exprHashMatch[2];
    const offset = parseInt(exprHashMatch[3], 10);
    
    if (!(label in symbols)) {
      throw new Error(`Unresolved label: ${label}`);
    }
    
    const base = symbols[label];
    return op === '+' ? base + offset : base - offset;
  }
  
  // Expression without # separator: label+offset (e.g., "delay+100")
  const exprMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)([+\-])(\d+)$/);
  if (exprMatch) {
    const label = exprMatch[1].toLowerCase();
    const op = exprMatch[2];
    const offset = parseInt(exprMatch[3], 10);
    
    if (!(label in symbols)) {
      throw new Error(`Unresolved label: ${label}`);
    }
    
    const base = symbols[label];
    return op === '+' ? base + offset : base - offset;
  }
  
  // Bare symbol name without suffix (e.g., "delay")
  // This is common in WRA/RDA instructions
  const bareSymbol = trimmed.toLowerCase();
  if (bareSymbol in symbols) {
    return symbols[bareSymbol];
  }
  
  throw new Error(`Invalid address: ${operand}`);
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
      operands.push(parseSkipTarget(instruction.operands[0], labelAddresses, instruction));
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
      operands: parseChoOperands(instruction, choAliasMode, 0, memoryAddresses),
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
          operands.push(parseCoefficient(instruction.operands[1]));
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
          operands.push(parseAddress(instruction.operands[0], memoryAddresses));
        }
        if (instruction.operands.length >= 2) {
          operands.push(parseCoefficient(instruction.operands[1]));
        }
        break;
      
      // Delay memory write: addr, coeff
      case 'wra':
      case 'wrap':
        if (instruction.operands.length >= 1) {
          operands.push(parseAddress(instruction.operands[0], memoryAddresses));
        }
        if (instruction.operands.length >= 2) {
          operands.push(parseCoefficient(instruction.operands[1]));
        }
        break;
      
      // RMPA: coeff
      case 'rmpa':
        if (instruction.operands.length >= 1) {
          operands.push(parseCoefficient(instruction.operands[0]));
        }
        break;
      
      // Scale and offset: coeff, offset
      case 'sof':
      case 'log':
      case 'exp':
        if (instruction.operands.length >= 1) {
          operands.push(parseCoefficient(instruction.operands[0]));
        }
        if (instruction.operands.length >= 2) {
          operands.push(parseCoefficient(instruction.operands[1]));
        }
        break;
      
      // Bitwise operations: mask
      case 'and':
      case 'or':
      case 'xor':
        if (instruction.operands.length >= 1) {
          operands.push(parseCoefficient(instruction.operands[0]));
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
          operands.push(parseSkipTarget(instruction.operands[1], labelAddresses, instruction));
        }
        break;
      }
      
      // Jump: label
      case 'jmp': {
        if (instruction.operands.length >= 1) {
          const target = instruction.operands[0];
          if (!(target in labelAddresses)) {
            throw new Error(`Unresolved label: ${target}`);
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
          operands.push(parseCoefficient(instruction.operands[1]));
        }
        if (instruction.operands.length >= 3) {
          operands.push(parseCoefficient(instruction.operands[2]));
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
          operands.push(...parseChoOperands(instruction, mode, 1, memoryAddresses));
        }
        break;
      }
      case 'raw':
        // Pass operands as-is (will be parsed by handler)
        for (const op of instruction.operands) {
          operands.push(parseCoefficient(op));
        }
        break;
      
      default:
        // Unknown opcode - pass operands as-is
        for (const op of instruction.operands) {
          try {
            operands.push(parseCoefficient(op));
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
  // Build label address map (labels point to instruction addresses)
  const labelAddresses: Record<string, number> = {};
  for (const [name, symbol] of Object.entries(parseResult.symbols.labels)) {
    labelAddresses[name] = symbol.line;
  }
  
  // Build memory address map (memory symbols point to delay RAM addresses)
  const memoryAddresses: Record<string, number> = {};
  let currentMemAddr = 0;
  for (const [name, symbol] of Object.entries(parseResult.symbols.memory)) {
    memoryAddresses[name.toLowerCase()] = currentMemAddr;
    // Parse size and advance pointer
    const size = parseInt(symbol.size, 10);
    if (!isNaN(size)) {
      currentMemAddr += size;
    }
  }
  
  // Build equates map
  const equates: Record<string, { value: string }> = {};
  for (const [name, symbol] of Object.entries(parseResult.symbols.equates)) {
    equates[name.toLowerCase()] = { value: symbol.value };
  }
  
  // Compile each instruction
  const compiledInstructions: CompiledInstruction[] = [];
  for (const instruction of parseResult.instructions) {
    if (!instruction.recognized) {
      throw new CompilationError(
        `Unrecognized instruction: ${instruction.opcode}`,
        instruction.line,
        instruction.column,
      );
    }
    
    const compiled = compileInstruction(
      instruction,
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

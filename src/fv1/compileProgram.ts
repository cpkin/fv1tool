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
 * @returns Register index (0-31) or special register value
 */
function parseRegister(operand: string): number {
  const trimmed = operand.trim().toLowerCase();
  
  // Special registers (ADC/DAC are mapped to virtual registers)
  if (trimmed === 'adcl') return 32; // Virtual register for ADC left
  if (trimmed === 'adcr') return 33; // Virtual register for ADC right
  if (trimmed === 'dacl') return 34; // Virtual register for DAC left
  if (trimmed === 'dacr') return 35; // Virtual register for DAC right
  
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
  
  // Label reference with # suffix
  const labelMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)#$/);
  if (labelMatch) {
    const label = labelMatch[1];
    if (!(label in symbols)) {
      throw new Error(`Unresolved label: ${label}`);
    }
    return symbols[label];
  }
  
  // Expression: label#+offset
  const exprMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)#([+\-])(\d+)$/);
  if (exprMatch) {
    const label = exprMatch[1];
    const op = exprMatch[2];
    const offset = parseInt(exprMatch[3], 10);
    
    if (!(label in symbols)) {
      throw new Error(`Unresolved label: ${label}`);
    }
    
    const base = symbols[label];
    return op === '+' ? base + offset : base - offset;
  }
  
  throw new Error(`Invalid address: ${operand}`);
}

/**
 * Compiles a single parsed instruction into a compiled instruction
 * 
 * @param instruction - Parsed instruction from parser
 * @param labelAddresses - Map of label names to instruction addresses
 * @param memoryAddresses - Map of memory symbol names to delay RAM addresses
 * @returns Compiled instruction ready for execution
 */
function compileInstruction(
  instruction: ParsedInstruction,
  labelAddresses: Record<string, number>,
  memoryAddresses: Record<string, number>,
): CompiledInstruction {
  const opcode = instruction.opcode.toLowerCase();
  const operands: number[] = [];
  
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
          operands.push(parseRegister(instruction.operands[0]));
        }
        if (instruction.operands.length >= 2) {
          operands.push(parseCoefficient(instruction.operands[1]));
        }
        break;
      
      // Register load: reg
      case 'ldax':
      case 'mulx':
        if (instruction.operands.length >= 1) {
          operands.push(parseRegister(instruction.operands[0]));
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
          const target = instruction.operands[1];
          const numMatch = target.match(/^(\d+)$/);
          if (numMatch) {
            // Direct skip count
            operands.push(parseInt(numMatch[1], 10));
          } else {
            // Label reference - compute skip count
            if (!(target in labelAddresses)) {
              throw new Error(`Unresolved label: ${target}`);
            }
            const targetAddr = labelAddresses[target];
            const skipCount = targetAddr - instruction.line - 1;
            operands.push(Math.max(0, skipCount));
          }
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
        for (let i = 0; i < Math.min(3, instruction.operands.length); i++) {
          operands.push(parseCoefficient(instruction.operands[i]));
        }
        break;
      
      case 'jam':
        // Parse: lfo_select
        if (instruction.operands.length >= 1) {
          operands.push(parseCoefficient(instruction.operands[0]));
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
      case 'cho':
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
    memoryAddresses[name] = currentMemAddr;
    // Parse size and advance pointer
    const size = parseInt(symbol.size, 10);
    if (!isNaN(size)) {
      currentMemAddr += size;
    }
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

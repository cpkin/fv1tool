/**
 * FV-1 Instruction Handler Registry
 * 
 * Central registry for all FV-1 instruction handlers.
 * Each opcode maps to a handler function that executes the instruction's behavior.
 * 
 * Reference: http://www.spinsemi.com/knowledge_base/inst_syntax.html
 */

import type { InstructionHandler } from '../types';

// Import all instruction handlers
import * as arithmetic from './arithmetic';
import * as control from './control';
import * as delay from './delay';
import * as io from './io';

/**
 * Instruction handler registry
 * 
 * Maps opcode names to their handler functions.
 */
export const instructionHandlers: Record<string, InstructionHandler> = {
  // Delay memory read/write
  rda: delay.rda,
  rmpa: delay.rmpa,
  wra: delay.wra,
  wrap: delay.wrap,
  
  // Register operations
  rdax: arithmetic.rdax,
  rdfx: arithmetic.rdfx,
  ldax: arithmetic.ldax,
  wrax: arithmetic.wrax,
  wrhx: arithmetic.wrhx,
  wrlx: arithmetic.wrlx,
  
  // Arithmetic/logic
  maxx: arithmetic.maxx,
  absa: arithmetic.absa,
  mulx: arithmetic.mulx,
  log: arithmetic.log,
  exp: arithmetic.exp,
  sof: arithmetic.sof,
  
  // Bitwise
  and: arithmetic.and,
  clr: arithmetic.clr,
  or: arithmetic.or,
  xor: arithmetic.xor,
  not: arithmetic.not,
  
  // Control flow
  skp: control.skp,
  jmp: control.jmp,
  nop: control.nop,
  
  // LFO
  wlds: io.wlds,
  wldr: io.wldr,
  
  // Special
  jam: io.jam,
  cho: io.cho,
  raw: io.raw,
};

/**
 * Gets the handler for a given opcode
 * 
 * If the opcode is not recognized, returns the NOP handler.
 * This ensures the interpreter never crashes on unknown opcodes.
 * 
 * @param opcode - Opcode name (lowercase)
 * @returns Handler function for the opcode
 */
export function getHandler(opcode: string): InstructionHandler {
  return instructionHandlers[opcode.toLowerCase()] || control.nop;
}

/**
 * Registers a custom handler for an opcode
 * 
 * Used to add or override opcode implementations.
 * 
 * @param opcode - Opcode name (lowercase)
 * @param handler - Handler function
 */
export function registerHandler(opcode: string, handler: InstructionHandler): void {
  instructionHandlers[opcode.toLowerCase()] = handler;
}

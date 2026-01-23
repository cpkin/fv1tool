import type { ParsedInstruction, RegisterReference, SymbolTables } from '../parser/ast'

export interface RegisterUsageEntry {
  name: string
  reads: number
  writes: number
  readLines: number[]
  writeLines: number[]
}

export type RegisterUsageMap = Record<string, RegisterUsageEntry>

export const POT_REGISTERS = ['pot0', 'pot1', 'pot2']
export const OUTPUT_REGISTERS = ['dacl', 'dacr']
export const INPUT_REGISTERS = ['adcl', 'adcr']

export const GENERAL_REGISTER_PATTERN = /^reg(1[0-5]|\d)$/i
export const GENERAL_REGISTER_MAX = 16

const REGISTER_NAMES = new Set([
  ...POT_REGISTERS,
  ...OUTPUT_REGISTERS,
  ...INPUT_REGISTERS,
  'addr_ptr',
  'sin0',
  'sin1',
  'rmp0',
  'rmp1',
])

const REGISTER_READ_OPCODES = new Set([
  'rdax',
  'rdfx',
  'ldax',
  'mulx',
  'maxx',
])

const REGISTER_WRITE_OPCODES = new Set(['wrax', 'wrhx', 'wrlx'])

const ensureEntry = (usage: RegisterUsageMap, name: string): RegisterUsageEntry => {
  const key = name.toLowerCase()
  if (!usage[key]) {
    usage[key] = {
      name: key,
      reads: 0,
      writes: 0,
      readLines: [],
      writeLines: [],
    }
  }

  return usage[key]
}

export const resolveRegisterName = (
  operand: string,
  symbols: SymbolTables
): string | null => {
  const trimmed = operand.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.toLowerCase()
  if (GENERAL_REGISTER_PATTERN.test(normalized) || REGISTER_NAMES.has(normalized)) {
    return normalized
  }

  const equate = symbols.equates[normalized]
  if (!equate) {
    return null
  }

  const tokens = equate.value.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
  for (const token of tokens) {
    const tokenNormalized = token.toLowerCase()
    if (GENERAL_REGISTER_PATTERN.test(tokenNormalized) || REGISTER_NAMES.has(tokenNormalized)) {
      return tokenNormalized
    }
  }

  return null
}

const addAccess = (
  usage: RegisterUsageMap,
  name: string,
  access: 'read' | 'write',
  line: number
): void => {
  const entry = ensureEntry(usage, name)
  if (access === 'read') {
    entry.reads += 1
    entry.readLines.push(line)
  } else {
    entry.writes += 1
    entry.writeLines.push(line)
  }
}

export const analyzeRegisterUsage = (
  instructions: ParsedInstruction[],
  symbols: SymbolTables
): RegisterUsageMap => {
  const usage: RegisterUsageMap = {}

  instructions.forEach((instruction) => {
    const operand = instruction.operands[0]
    if (!operand) {
      return
    }

    if (REGISTER_READ_OPCODES.has(instruction.opcode)) {
      const registerName = resolveRegisterName(operand, symbols)
      if (registerName) {
        addAccess(usage, registerName, 'read', instruction.line)
      }
    }

    if (REGISTER_WRITE_OPCODES.has(instruction.opcode)) {
      const registerName = resolveRegisterName(operand, symbols)
      if (registerName) {
        addAccess(usage, registerName, 'write', instruction.line)
      }
    }
  })

  return usage
}

export const countGeneralRegisters = (usage: RegisterUsageMap): number =>
  Object.keys(usage).filter((name) => GENERAL_REGISTER_PATTERN.test(name)).length

export const findRegisterReference = (
  references: RegisterReference[],
  line: number,
  opcode: string,
  registerName: string
): RegisterReference | undefined =>
  references.find(
    (reference) =>
      reference.line === line &&
      reference.opcode === opcode &&
      reference.name.toLowerCase() === registerName.toLowerCase()
  )

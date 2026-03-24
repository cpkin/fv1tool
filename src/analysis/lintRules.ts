import type { ValidationDiagnostic } from '../diagnostics/types'
import type { ParseResult } from '../parser/ast'
import { getLineContext } from '../diagnostics/context'

import type { ResourceAnalysis } from './resourceAnalyzer'
import { evaluateExpression } from './resourceAnalyzer'
import {
  findRegisterReference,
  GENERAL_REGISTER_PATTERN,
  OUTPUT_REGISTERS,
  POT_REGISTERS,
  resolveRegisterName,
} from './registerUsage'

interface DiagnosticInput {
  message: string
  line?: number
  column?: number
  suggestedFix?: string
  source: string
  severity?: ValidationDiagnostic['severity']
}

const createDiagnostic = ({
  message,
  line,
  column,
  suggestedFix,
  source,
  severity = 'warning',
}: DiagnosticInput): ValidationDiagnostic => ({
  severity,
  message,
  suggestedFix,
  line,
  column,
  context: line ? getLineContext(source, line) : undefined,
})

const findEquateForRegister = (parseResult: ParseResult, registerName: string) => {
  const target = registerName.toLowerCase()

  return Object.values(parseResult.symbols.equates).find((equate) => {
    const tokens = equate.value.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
    return tokens.some((token) => token.toLowerCase() === target)
  })
}

const normalizeMemoryOperand = (operand: string): string => {
  const trimmed = operand.trim()
  const identifierMatch = trimmed.match(/[A-Za-z_][A-Za-z0-9_]*/)
  if (!identifierMatch) {
    return trimmed.toLowerCase().replace(/[\^#]$/, '')
  }

  return identifierMatch[0].toLowerCase()
}

const parseNumericOperand = (
  operand: string,
  parseResult: ParseResult
): number | null => {
  const trimmed = operand.trim()
  if (!trimmed) {
    return null
  }

  if (/[A-Za-z_]/.test(trimmed)) {
    const normalized = trimmed.toLowerCase().replace(/[\^#]$/, '')
    const equate = parseResult.symbols.equates[normalized]
    if (!equate) {
      return null
    }

    return evaluateExpression(equate.value)
  }

  return evaluateExpression(trimmed)
}

const collectMemoryUsage = (parseResult: ParseResult) => {
  const memoryNames = new Set(Object.keys(parseResult.symbols.memory))
  const writes = new Set<string>()
  const reads = new Set<string>()

  parseResult.instructions.forEach((instruction) => {
    const opcode = instruction.opcode
    if (opcode === 'wra' || opcode === 'wrap') {
      const operand = instruction.operands[0]
      if (!operand) {
        return
      }
      const normalized = normalizeMemoryOperand(operand)
      if (memoryNames.has(normalized)) {
        writes.add(normalized)
      }
    }

    if (opcode === 'rda') {
      const operand = instruction.operands[0]
      if (!operand) {
        return
      }
      const normalized = normalizeMemoryOperand(operand)
      if (memoryNames.has(normalized)) {
        reads.add(normalized)
      }
    }

    if (opcode === 'cho') {
      const operand = instruction.operands[3]
      if (!operand) {
        return
      }
      const normalized = normalizeMemoryOperand(operand)
      if (memoryNames.has(normalized)) {
        reads.add(normalized)
      }
    }

    // RMPA reads delay memory indirectly via ADDR_PTR — any MEM could be the target
    if (opcode === 'rmpa') {
      memoryNames.forEach((name) => reads.add(name))
    }
  })

  return { writes, reads }
}

const findRegisterReadBeforeWrite = (
  parseResult: ParseResult,
  source: string
): ValidationDiagnostic[] => {
  const diagnostics: ValidationDiagnostic[] = []
  const written = new Set<string>()
  const registerReadOpcodes = new Set(['rdax', 'rdfx', 'ldax', 'mulx', 'maxx'])
  const registerWriteOpcodes = new Set(['wrax', 'wrhx', 'wrlx'])

  parseResult.instructions.forEach((instruction) => {
    const operand = instruction.operands[0]
    if (operand && registerReadOpcodes.has(instruction.opcode)) {
      const registerName = resolveRegisterName(operand, parseResult.symbols)
      if (registerName && GENERAL_REGISTER_PATTERN.test(registerName)) {
        if (!written.has(registerName)) {
          const reference = findRegisterReference(
            parseResult.registerReferences,
            instruction.line,
            instruction.opcode,
            operand
          )

          diagnostics.push(
            createDiagnostic({
              severity: 'info',
              message: `NOTE: ${registerName.toUpperCase()} is read before it is written (likely a feedback loop for delay/chorus-style effects).`,
              line: instruction.line,
              column: reference?.column ?? instruction.column,
              source,
            })
          )
        }
      }
    }

    if (operand && registerWriteOpcodes.has(instruction.opcode)) {
      const registerName = resolveRegisterName(operand, parseResult.symbols)
      if (registerName && GENERAL_REGISTER_PATTERN.test(registerName)) {
        written.add(registerName)
      }
    }
  })

  return diagnostics
}

const findClippingRisk = (
  parseResult: ParseResult,
  source: string
): ValidationDiagnostic[] => {
  const diagnostics: ValidationDiagnostic[] = []
  let gainSum = 0
  let warned = false
  const resetOpcodes = new Set([
    'clr',
    'ldax',
    'rdfx',
    'log',
    'exp',
    'mulx',
    'maxx',
    'and',
    'or',
    'xor',
    'not',
    'absa',
  ])

  parseResult.instructions.forEach((instruction) => {
    const opcode = instruction.opcode
    const operands = instruction.operands

    if (resetOpcodes.has(opcode)) {
      gainSum = 0
    }

    if (opcode === 'sof') {
      const multiplier = evaluateExpression(operands[0] ?? '')
      gainSum = multiplier !== null ? Math.abs(multiplier) : gainSum
    }

    if (opcode === 'rda' || opcode === 'rdax') {
      const multiplier = evaluateExpression(operands[1] ?? '')
      gainSum += multiplier !== null ? Math.abs(multiplier) : 0
    }

    if (opcode === 'rmpa') {
      const multiplier = evaluateExpression(operands[0] ?? '')
      gainSum += multiplier !== null ? Math.abs(multiplier) : 0
    }

    if (warned) {
      return
    }

    if (opcode === 'wrax' || opcode === 'wrhx' || opcode === 'wrlx') {
      const target = resolveRegisterName(operands[0] ?? '', parseResult.symbols)
      if (target && OUTPUT_REGISTERS.includes(target)) {
        const outputMultiplier = evaluateExpression(operands[1] ?? '')
        const effectiveGain = gainSum * (outputMultiplier !== null ? Math.abs(outputMultiplier) : 1)

        if (effectiveGain > 1) {
          diagnostics.push(
            createDiagnostic({
              message: 'LINT-06: Potential clipping risk; accumulated gain exceeds 1.0 at output.',
              line: instruction.line,
              column: instruction.column,
              suggestedFix: 'Reduce multipliers or add a saturation step before output.',
              source,
            })
          )
          warned = true
        }
      }
    }
  })

  return diagnostics
}

const findDelayAddressOutOfBounds = (
  parseResult: ParseResult,
  resources: ResourceAnalysis,
  source: string
): ValidationDiagnostic[] => {
  const diagnostics: ValidationDiagnostic[] = []
  const totalDelaySamples = resources.delayRamAllocations.reduce(
    (total, allocation) => total + (allocation.size ?? 0),
    0
  )
  const limit = totalDelaySamples > 0 ? totalDelaySamples : resources.usage.delayRam.max

  const checkAddress = (operand: string | undefined, instructionLine: number, column: number) => {
    if (!operand) {
      return
    }

    const normalized = normalizeMemoryOperand(operand)
    if (parseResult.symbols.memory[normalized]) {
      return
    }

    const address = parseNumericOperand(operand, parseResult)
    if (address === null) {
      return
    }

    if (address < 0 || address >= limit) {
      diagnostics.push(
        createDiagnostic({
          message: `LINT-07: Delay address ${address} is outside available RAM (${limit} samples).`,
          line: instructionLine,
          column,
          suggestedFix: 'Clamp the address or increase the MEM allocation to cover it.',
          source,
        })
      )
    }
  }

  parseResult.instructions.forEach((instruction) => {
    const opcode = instruction.opcode
    if (opcode === 'rda' || opcode === 'wra' || opcode === 'wrap') {
      checkAddress(instruction.operands[0], instruction.line, instruction.column)
    }

    if (opcode === 'cho') {
      checkAddress(instruction.operands[3], instruction.line, instruction.column)
    }
  })

  return diagnostics
}

export const runLintRules = (
  parseResult: ParseResult,
  resources: ResourceAnalysis,
  source: string
): ValidationDiagnostic[] => {
  const diagnostics: ValidationDiagnostic[] = []

  POT_REGISTERS.forEach((pot) => {
    const usage = resources.registerUsage[pot]
    if (usage && usage.reads + usage.writes > 0) {
      return
    }

    const equate = findEquateForRegister(parseResult, pot)
    diagnostics.push(
      createDiagnostic({
        severity: 'info',
        message: `NOTE: ${pot.toUpperCase()} is not referenced (optional).`,
        line: equate?.line,
        column: equate?.column,
        source,
      })
    )
  })

  const { reads, writes } = collectMemoryUsage(parseResult)
  Object.entries(parseResult.symbols.memory).forEach(([key, symbol]) => {
    if (!writes.has(key)) {
      diagnostics.push(
        createDiagnostic({
          message: `LINT-02: ${symbol.name} is allocated but never written.`,
          line: symbol.line,
          column: symbol.column,
          suggestedFix: 'Write to this delay line with WRA or WRAP.',
          source,
        })
      )
    } else if (!reads.has(key)) {
      diagnostics.push(
        createDiagnostic({
          message: `LINT-03: ${symbol.name} is written but never read.`,
          line: symbol.line,
          column: symbol.column,
          suggestedFix: 'Read from this delay line using RDA, CHO, or RMPA, or remove it.',
          source,
        })
      )
    }
  })

  diagnostics.push(...findRegisterReadBeforeWrite(parseResult, source))

  const outputWritten = OUTPUT_REGISTERS.some((register) => {
    const usage = resources.registerUsage[register]
    return usage && usage.writes > 0
  })
  if (!outputWritten) {
    const equate = OUTPUT_REGISTERS.map((register) =>
      findEquateForRegister(parseResult, register)
    ).find(Boolean)

    diagnostics.push(
      createDiagnostic({
        message: 'LINT-05: No output register is written (DACL/DACR).',
        line: equate?.line,
        column: equate?.column,
        suggestedFix: 'Write to DACL or DACR using WRAX/WRHX/WRLX.',
        source,
      })
    )
  }

  diagnostics.push(...findClippingRisk(parseResult, source))
  diagnostics.push(...findDelayAddressOutOfBounds(parseResult, resources, source))

  return diagnostics
}

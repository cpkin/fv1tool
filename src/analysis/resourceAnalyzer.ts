import type { ResourceUsage } from '../diagnostics/types'
import type { MemoryAllocation, ParseResult } from '../parser/ast'

import type { RegisterUsageMap } from './registerUsage'
import {
  analyzeRegisterUsage,
  countGeneralRegisters,
  GENERAL_REGISTER_MAX,
} from './registerUsage'

export interface DelayRamAllocation {
  name: string
  size: number | null
  start: number | null
  end: number | null
  line: number
  column: number
}

export interface ResourceAnalysis {
  usage: ResourceUsage
  registerUsage: RegisterUsageMap
  delayRamAllocations: DelayRamAllocation[]
}

const sanitizeExpression = (expression: string): string | null => {
  const normalized = expression.trim()
  if (!normalized) {
    return null
  }

  const safeExpression = normalized.replace(/int\s*\(/gi, 'Math.floor(')
  const withoutMath = safeExpression.replace(/Math\.floor/g, '')

  if (/[^0-9+\-*/().\s]/.test(withoutMath)) {
    return null
  }

  return safeExpression
}

export const evaluateExpression = (expression: string): number | null => {
  const sanitized = sanitizeExpression(expression)
  if (!sanitized) {
    return null
  }

  try {
    const value = Function(`"use strict"; return (${sanitized});`)()
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      return null
    }

    return Math.max(0, Math.floor(value))
  } catch {
    return null
  }
}

const buildDelayRamAllocations = (memory: MemoryAllocation[]): DelayRamAllocation[] => {
  let offset = 0

  return memory.map((allocation) => {
    const size = evaluateExpression(allocation.size)
    const start = size !== null ? offset : null
    const end = size !== null ? offset + size - 1 : null

    if (size !== null) {
      offset += size
    }

    return {
      name: allocation.name,
      size,
      start,
      end,
      line: allocation.line,
      column: allocation.column,
    }
  })
}

const sumDelayRamSamples = (allocations: DelayRamAllocation[]): number =>
  allocations.reduce((total, allocation) => total + (allocation.size ?? 0), 0)

export const resourceAnalyzer = (parseResult: ParseResult): ResourceAnalysis => {
  const instructionCount = parseResult.instructions.length
  const registerUsage = analyzeRegisterUsage(parseResult.instructions, parseResult.symbols)
  const delayRamAllocations = buildDelayRamAllocations(parseResult.memoryAllocations)
  const delaySamples = sumDelayRamSamples(delayRamAllocations)
  const delayMs = Math.round((delaySamples / 32) * 100) / 100

  const usage: ResourceUsage = {
    instructions: {
      used: instructionCount,
      max: 128,
    },
    delayRam: {
      used: delaySamples,
      max: 32768,
      ms: delayMs,
    },
    registers: {
      used: countGeneralRegisters(registerUsage),
      max: GENERAL_REGISTER_MAX,
    },
  }

  return {
    usage,
    registerUsage,
    delayRamAllocations,
  }
}

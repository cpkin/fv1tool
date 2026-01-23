import type { ValidationDiagnostic } from '../diagnostics/types'
import { getLineContext } from '../diagnostics/context'
import { suggestOpcode } from '../diagnostics/suggestions'
import { parseSpinAsm } from '../parser/parseSpinAsm'

import { resourceAnalyzer } from './resourceAnalyzer'
import { runLintRules } from './lintRules'

export interface AnalysisResult {
  diagnostics: ValidationDiagnostic[]
  resources: ReturnType<typeof resourceAnalyzer>
}

const buildUnknownOpcodeDiagnostics = (
  source: string,
  instructions: ReturnType<typeof parseSpinAsm>['instructions']
): ValidationDiagnostic[] =>
  instructions
    .filter((instruction) => !instruction.recognized)
    .map((instruction) => {
      const suggestedFix = suggestOpcode(instruction.opcode)
      return {
        severity: 'warning',
        message: `Unknown opcode "${instruction.opcode.toUpperCase()}".`,
        suggestedFix: suggestedFix ?? undefined,
        line: instruction.line,
        column: instruction.column,
        context: getLineContext(source, instruction.line),
      }
    })

export const analysisPipeline = (source: string): AnalysisResult => {
  const parseResult = parseSpinAsm(source)
  const resources = resourceAnalyzer(parseResult)
  const hasContent = source.trim().length > 0
  const lintDiagnostics = hasContent ? runLintRules(parseResult, resources, source) : []
  const opcodeDiagnostics = hasContent
    ? buildUnknownOpcodeDiagnostics(source, parseResult.instructions)
    : []

  return {
    diagnostics: [...parseResult.diagnostics, ...opcodeDiagnostics, ...lintDiagnostics],
    resources,
  }
}

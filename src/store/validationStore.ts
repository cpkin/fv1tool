import { create } from 'zustand'

import type { ResourceUsage, ValidationDiagnostic } from '../diagnostics/types'

interface ValidationState {
  source: string
  diagnostics: ValidationDiagnostic[]
  resourceUsage: ResourceUsage
  setSource: (source: string) => void
  setDiagnostics: (diagnostics: ValidationDiagnostic[]) => void
  setResourceUsage: (resourceUsage: ResourceUsage) => void
}

const placeholderDiagnostics: ValidationDiagnostic[] = [
  {
    severity: 'warning',
    message: 'Delay line declared but never written to.',
    suggestedFix: 'Consider adding a WRA instruction for this memory label.',
    line: 42,
    column: 3,
  },
  {
    severity: 'info',
    message: 'POT2 is never referenced in this program.',
    suggestedFix: 'Use POT2 as a modulation source or remove it from comments.',
    line: 18,
    column: 1,
  },
]

const placeholderResourceUsage: ResourceUsage = {
  instructions: {
    used: 84,
    max: 128,
  },
  delayRam: {
    used: 20480,
    max: 32768,
    ms: 640,
  },
  registers: {
    used: 10,
    max: 16,
  },
}

const placeholderSource = ''

export const useValidationStore = create<ValidationState>((set) => ({
  source: placeholderSource,
  diagnostics: placeholderDiagnostics,
  resourceUsage: placeholderResourceUsage,
  setSource: (source) => set({ source }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),
  setResourceUsage: (resourceUsage) => set({ resourceUsage }),
}))

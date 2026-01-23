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

const initialResourceUsage: ResourceUsage = {
  instructions: {
    used: 0,
    max: 128,
  },
  delayRam: {
    used: 0,
    max: 32768,
    ms: 0,
  },
  registers: {
    used: 0,
    max: 16,
  },
}

export const useValidationStore = create<ValidationState>((set) => ({
  source: '',
  diagnostics: [] as ValidationDiagnostic[],
  resourceUsage: initialResourceUsage,
  setSource: (source) => set({ source }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),
  setResourceUsage: (resourceUsage) => set({ resourceUsage }),
}))

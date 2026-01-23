import { create } from 'zustand'

import type { IOMode, PotValues } from '../fv1/types'
import type { RenderSimulationResult, RenderProgress } from '../audio/renderTypes'

interface AudioState {
  // Input selection
  selectedDemo: string | null
  uploadedFile: File | null
  audioBuffer: AudioBuffer | null
  
  // Input validation error
  inputError: string | null
  
  // IO mode and normalization
  ioMode: IOMode
  normalizeInput: boolean
  
  // Render state
  renderStatus: 'idle' | 'rendering' | 'complete' | 'error'
  renderProgress: RenderProgress | null
  renderError: string | null
  
  // Render output
  outputBuffer: AudioBuffer | null
  renderResult: RenderSimulationResult | null
  
  // POT values (knobs)
  pots: PotValues
  
  // Actions
  setSelectedDemo: (demo: string | null) => void
  setUploadedFile: (file: File | null) => void
  setAudioBuffer: (buffer: AudioBuffer | null) => void
  setInputError: (error: string | null) => void
  setIoMode: (mode: IOMode) => void
  setNormalizeInput: (normalize: boolean) => void
  setRenderStatus: (status: AudioState['renderStatus']) => void
  setRenderProgress: (progress: RenderProgress | null) => void
  setRenderError: (error: string | null) => void
  setOutputBuffer: (buffer: AudioBuffer | null) => void
  setRenderResult: (result: RenderSimulationResult | null) => void
  setPots: (pots: Partial<PotValues>) => void
  resetRenderState: () => void
}

const DEFAULT_POTS: PotValues = {
  pot0: 0.5,
  pot1: 0.5,
  pot2: 0.5,
}

export const useAudioStore = create<AudioState>((set) => ({
  // Initial state
  selectedDemo: null,
  uploadedFile: null,
  audioBuffer: null,
  inputError: null,
  ioMode: 'stereo_stereo',
  normalizeInput: false,
  renderStatus: 'idle',
  renderProgress: null,
  renderError: null,
  outputBuffer: null,
  renderResult: null,
  pots: DEFAULT_POTS,
  
  // Actions
  setSelectedDemo: (demo) => set({ selectedDemo: demo, uploadedFile: null }),
  setUploadedFile: (file) => set({ uploadedFile: file, selectedDemo: null }),
  setAudioBuffer: (buffer) => set({ audioBuffer: buffer }),
  setInputError: (error) => set({ inputError: error }),
  setIoMode: (mode) => set({ ioMode: mode }),
  setNormalizeInput: (normalize) => set({ normalizeInput: normalize }),
  setRenderStatus: (status) => set({ renderStatus: status }),
  setRenderProgress: (progress) => set({ renderProgress: progress }),
  setRenderError: (error) => set({ renderError: error }),
  setOutputBuffer: (buffer) => set({ outputBuffer: buffer }),
  setRenderResult: (result) => set({ renderResult: result }),
  setPots: (pots) => set((state) => ({ pots: { ...state.pots, ...pots } })),
  resetRenderState: () => set({
    renderStatus: 'idle',
    renderProgress: null,
    renderError: null,
    outputBuffer: null,
    renderResult: null,
  }),
}))

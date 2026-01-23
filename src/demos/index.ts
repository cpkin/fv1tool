import type { IOMode } from '../fv1/types'

export interface DemoAudio {
  id: string
  name: string
  description: string
  path: string
  recommendedIoMode: IOMode
}

export const demoAudioFiles: DemoAudio[] = [
  {
    id: 'guitar',
    name: 'Guitar Pluck',
    description: 'Decaying guitar note with harmonics (A3, 220 Hz)',
    path: '/demos/guitar.wav',
    recommendedIoMode: 'mono_mono',
  },
  {
    id: 'synth',
    name: 'Synth Saw Wave',
    description: 'Steady sawtooth wave (A3, 220 Hz)',
    path: '/demos/synth.wav',
    recommendedIoMode: 'mono_stereo',
  },
  {
    id: 'drums',
    name: 'Kick Drum',
    description: 'Short percussive burst with noise',
    path: '/demos/drums.wav',
    recommendedIoMode: 'mono_mono',
  },
  {
    id: 'voice',
    name: 'Voice-like Tone',
    description: 'Modulated sine with vibrato (150 Hz fundamental)',
    path: '/demos/voice.wav',
    recommendedIoMode: 'mono_mono',
  },
]

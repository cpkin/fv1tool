/**
 * Example programs from mstratman/fv1-programs repository.
 * Source: https://github.com/mstratman/fv1-programs/tree/master/docs/files
 */

export interface ExampleProgram {
  name: string
  file: string
  url: string
}

const BASE_URL = 'https://raw.githubusercontent.com/mstratman/fv1-programs/master/docs/files'

export const mstratmanExamples: ExampleProgram[] = [
  { name: 'Dattorro Reverb', file: 'dattorro.spn', url: `${BASE_URL}/dattorro.spn` },
  { name: 'Freeverb', file: 'freeverb.spn', url: `${BASE_URL}/freeverb.spn` },
  { name: 'Spring Verb', file: 'spring_verb.spn', url: `${BASE_URL}/spring_verb.spn` },
  { name: 'Hall (Goldmine)', file: 'hall_goldmine.spn', url: `${BASE_URL}/hall_goldmine.spn` },
  { name: 'Chorus (Dual Rate)', file: 'chorus-dual-rate.spn', url: `${BASE_URL}/chorus-dual-rate.spn` },
  { name: 'Faux Phaser', file: 'faux-phaser.spn', url: `${BASE_URL}/faux-phaser.spn` },
  { name: 'Slocum Phaser', file: 'slocum-phaser.spn', url: `${BASE_URL}/slocum-phaser.spn` },
  { name: 'Ping Pong Delay', file: 'pingpong.spn', url: `${BASE_URL}/pingpong.spn` },
  { name: 'Reverse Delay', file: 'reverse_delay.spn', url: `${BASE_URL}/reverse_delay.spn` },
  { name: 'Modulated Echo', file: 'modulated-echo.spn', url: `${BASE_URL}/modulated-echo.spn` },
  { name: 'Shimmer', file: 'shimmer-1.spn', url: `${BASE_URL}/shimmer-1.spn` },
  { name: 'Pitch Transpose (Stereo)', file: 'pitch-transpose-stereo.spn', url: `${BASE_URL}/pitch-transpose-stereo.spn` },
  { name: 'Tremolo (Sawtooth)', file: 'sawtooth.spn', url: `${BASE_URL}/sawtooth.spn` },
  { name: 'Crusher', file: 'crusher.spn', url: `${BASE_URL}/crusher.spn` },
  { name: 'Soft Clipping Overdrive', file: 'softclipping_overdrive.spn', url: `${BASE_URL}/softclipping_overdrive.spn` },
  { name: 'Resonator', file: 'resonator.spn', url: `${BASE_URL}/resonator.spn` },
  { name: 'Parametric EQ (7-band)', file: 'parametric-eq-7.spn', url: `${BASE_URL}/parametric-eq-7.spn` },
  { name: 'RevRev', file: 'RevRev.spn', url: `${BASE_URL}/RevRev.spn` },
]

export const MSTRATMAN_REPO_URL = 'https://github.com/mstratman/fv1-programs/tree/master/docs/files'

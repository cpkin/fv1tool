import { fixedToFloat, signExtend24 } from './fixedPoint'
import type { FV1State } from './types'

function clamp24(value: number): number {
  if (value > 0x7fffff) return 0x7fffff
  if (value < -0x800000) return -0x800000
  return value
}

function updateSinLfo(state: FV1State, index: 0 | 1): void {
  const rate = index === 0 ? state.lfo.sin0Rate : state.lfo.sin1Rate
  const ampReg = index === 0 ? state.lfo.sin0Amp : state.lfo.sin1Amp
  const coeff = rate >> 14
  const amp = ampReg >> 8
  let sin = index === 0 ? state.lfo.sin0Int : state.lfo.sin1Int
  let cos = index === 0 ? state.lfo.sin0Cos : state.lfo.sin1Cos

  let acc = sin
  acc = (acc * coeff) >> 17
  acc = clamp24(acc + cos)
  cos = acc
  acc = -acc
  acc = (acc * coeff) >> 17
  acc = clamp24(acc + sin)
  sin = acc

  const out = signExtend24((sin * amp) >> 15)
  if (index === 0) {
    state.lfo.sin0Int = sin
    state.lfo.sin0Cos = cos
    state.lfo.sin0Out = out
    state.lfo.sin0 = fixedToFloat(out)
  } else {
    state.lfo.sin1Int = sin
    state.lfo.sin1Cos = cos
    state.lfo.sin1Out = out
    state.lfo.sin1 = fixedToFloat(out)
  }
}

function updateRampLfo(state: FV1State, index: 0 | 1): void {
  const rate = index === 0 ? state.lfo.rmp0Rate : state.lfo.rmp1Rate
  const ampCode = index === 0 ? state.lfo.rmp0Amp : state.lfo.rmp1Amp
  let pos = index === 0 ? state.lfo.rmp0Pos : state.lfo.rmp1Pos

  let amp = 0x3fffff
  let xFadeScale = 16
  if (ampCode === 0x03) {
    amp = 0x07ffff
    xFadeScale = 128
  } else if (ampCode === 0x02) {
    amp = 0x0fffff
    xFadeScale = 64
  } else if (ampCode === 0x01) {
    amp = 0x1fffff
    xFadeScale = 32
  }

  let freq = rate >> 8
  let sign = 1
  if ((freq & 0x80000) !== 0) {
    sign = -1
    freq = ~((-1 ^ 0x7ffff) | freq) + 1
  }
  const increment = freq * sign
  pos = (pos - increment) & amp

  const eighthAmp = amp >> 3
  let xfade = index === 0 ? state.lfo.rmp0Xfade : state.lfo.rmp1Xfade

  if (sign === 1) {
    if (pos > eighthAmp * 7) {
      xfade = 0
    } else if (pos > eighthAmp * 5) {
      xfade += increment
    } else if (pos > eighthAmp * 3) {
      xfade = xfade * 1
    } else if (pos > eighthAmp && xfade > 0) {
      xfade -= increment
    } else {
      xfade = 0
    }
  } else {
    if (pos > eighthAmp * 7) {
      xfade = 0
    } else if (pos > eighthAmp * 5) {
      xfade += increment
    } else if (pos > eighthAmp * 3) {
      xfade = xfade * 1
    } else if (pos > eighthAmp) {
      xfade -= increment
    } else {
      xfade = 0
    }
  }

  const xfadeVal = Math.trunc((xfade * xFadeScale) / 16384)
  const value = pos >> 4
  const rptr2 = ((pos + (amp >> 1)) & amp) >> 4

  if (index === 0) {
    state.lfo.rmp0Pos = pos
    state.lfo.rmp0Xfade = xfade
    state.lfo.rmp0XfadeVal = xfadeVal
    state.lfo.rmp0Val = value
    state.lfo.rmp0Rptr2 = rptr2
    state.lfo.rmp0Max = amp >> 4
    state.lfo.rmp0 = fixedToFloat(value)
  } else {
    state.lfo.rmp1Pos = pos
    state.lfo.rmp1Xfade = xfade
    state.lfo.rmp1XfadeVal = xfadeVal
    state.lfo.rmp1Val = value
    state.lfo.rmp1Rptr2 = rptr2
    state.lfo.rmp1Max = amp >> 4
    state.lfo.rmp1 = fixedToFloat(value)
  }
}

export function updateLfoState(state: FV1State): void {
  updateSinLfo(state, 0)
  updateSinLfo(state, 1)
  updateRampLfo(state, 0)
  updateRampLfo(state, 1)
}

export function jamSinLfo(state: FV1State, index: 0 | 1): void {
  if (index === 0) {
    state.lfo.sin0Int = 0
    state.lfo.sin0Cos = -0x7fff00
  } else {
    state.lfo.sin1Int = 0
    state.lfo.sin1Cos = -0x7fff00
  }
}

export function jamRampLfo(state: FV1State, index: 0 | 1): void {
  if (index === 0) {
    state.lfo.rmp0Pos = 0
    state.lfo.rmp0Xfade = 0
  } else {
    state.lfo.rmp1Pos = 0
    state.lfo.rmp1Xfade = 0
  }
}

export function getRampXfadeValue(state: FV1State, index: 0 | 1): number {
  return index === 0 ? state.lfo.rmp0XfadeVal : state.lfo.rmp1XfadeVal
}

export function getRampValues(state: FV1State, index: 0 | 1, rptr2: boolean): { value: number; maxPos: number } {
  const value = rptr2
    ? (index === 0 ? state.lfo.rmp0Rptr2 : state.lfo.rmp1Rptr2)
    : (index === 0 ? state.lfo.rmp0Val : state.lfo.rmp1Val)
  const maxPos = index === 0 ? state.lfo.rmp0Max : state.lfo.rmp1Max
  return { value, maxPos }
}

export function getSinValue(state: FV1State, index: 0 | 1, useCos: boolean): number {
  if (!useCos) {
    return index === 0 ? state.lfo.sin0Out : state.lfo.sin1Out
  }
  const cos = index === 0 ? state.lfo.sin0Cos : state.lfo.sin1Cos
  const amp = (index === 0 ? state.lfo.sin0Amp : state.lfo.sin1Amp) >> 8
  return signExtend24((cos * amp) >> 15)
}

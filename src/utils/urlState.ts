/**
 * URL state encoding/decoding for shareable links
 * Encodes code and knob settings into URL hash for sharing
 */

import type { PotValues } from '../fv1/types'

export interface URLState {
  code: string
  pot0: number // 0-11 range
  pot1: number // 0-11 range
  pot2: number // 0-11 range
  demo?: string // optional demo ID
}

/**
 * Encode current application state into URL hash
 * 
 * @param state - The URLState to encode
 * @returns URL hash string (e.g., "#state=...")
 */
export function encodeState(state: URLState): string {
  try {
    const json = JSON.stringify(state)
    const encoded = encodeURIComponent(json)
    const base64 = btoa(encoded)
    return `#state=${base64}`
  } catch {
    return ''
  }
}

/**
 * Decode URL hash back to URLState
 * 
 * @param hash - The URL hash string to decode
 * @returns URLState object or null if invalid
 */
export function decodeState(hash: string): URLState | null {
  try {
    const match = hash.match(/#state=([^&]+)/)
    if (!match) return null

    const base64 = match[1]
    const decoded = atob(base64)
    const json = decodeURIComponent(decoded)
    const parsed = JSON.parse(json)

    // Validate structure
    if (
      typeof parsed !== 'object' ||
      typeof parsed.code !== 'string' ||
      typeof parsed.pot0 !== 'number' ||
      typeof parsed.pot1 !== 'number' ||
      typeof parsed.pot2 !== 'number'
    ) {
      return null
    }

    // Clamp POT values to valid range [0, 11]
    return {
      code: parsed.code,
      pot0: Math.max(0, Math.min(11, parsed.pot0)),
      pot1: Math.max(0, Math.min(11, parsed.pot1)),
      pot2: Math.max(0, Math.min(11, parsed.pot2)),
      demo: parsed.demo || undefined,
    }
  } catch {
    return null
  }
}

/**
 * Get current state from application stores
 * 
 * @param code - Source code from validationStore
 * @param pots - POT values from audioStore (0.0-1.0 range)
 * @param selectedDemo - Selected demo ID (or null)
 * @returns URLState object ready for encoding
 */
export function getCurrentState(
  code: string,
  pots: PotValues,
  selectedDemo: string | null
): URLState {
  const state: URLState = {
    code,
    pot0: pots.pot0 * 11, // Convert 0.0-1.0 to 0-11
    pot1: pots.pot1 * 11,
    pot2: pots.pot2 * 11,
  }

  if (selectedDemo) {
    state.demo = selectedDemo
  }

  return state
}

/**
 * Check if a state hash is too long for safe URL sharing
 * 
 * @param hash - The encoded hash to check
 * @returns true if hash is too long (>2000 chars)
 */
export function isTooLong(hash: string): boolean {
  const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`
  return fullUrl.length > 2000
}

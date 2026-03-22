/**
 * Metadata extraction utilities for FV1Tool
 * Parses ;@fx headers from SpinASM source code
 */

export interface FxMetadata {
  version?: string
  effectName: string
  io: 'mono_mono' | 'mono_stereo' | 'stereo_stereo'
  pots: Array<{
    id: string
    label: string
  }>
  memory: Array<{
    name: string
    samples: number
  }>
  graph?: {
    nodes: string[]
    edges: Array<{
      from: string
      to: string
    }>
  }
}

/**
 * Extract metadata from SpinASM source code
 * Looks for ;@fx lines anywhere in the file (top or bottom) and parses JSON content
 * Returns null if no metadata found or parsing fails (graceful degradation)
 */
export function extractMetadata(source: string): FxMetadata | null {
  if (!source || typeof source !== 'string') {
    return null
  }

  try {
    const lines = source.split('\n')
    const jsonLines: string[] = []

    // Collect all ;@fx lines from anywhere in the file
    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith(';@fx')) {
        const content = trimmed.substring(4).trim()

        // Skip version-only lines like ";@fx v1" or ";@fx v2"
        if (content && !content.match(/^v[0-9]+$/)) {
          jsonLines.push(content)
        }
      }
    }

    // No metadata found
    if (jsonLines.length === 0) {
      return null
    }

    // Combine lines and parse JSON
    const jsonString = jsonLines.join(' ')
    const metadata = JSON.parse(jsonString) as FxMetadata

    // Validate required fields exist
    if (!metadata.effectName || !metadata.io || !metadata.pots || !metadata.memory) {
      return null
    }

    return metadata
  } catch (error) {
    // Graceful degradation: return null for any parsing errors
    // Don't throw - this allows tool to continue working without metadata
    console.debug('Metadata parsing failed:', error)
    return null
  }
}

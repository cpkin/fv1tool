/**
 * Metadata extraction utilities for SpinGPT
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
 * Looks for ;@fx headers and parses JSON content
 * Returns null if no metadata found or parsing fails (graceful degradation)
 */
export function extractMetadata(source: string): FxMetadata | null {
  if (!source || typeof source !== 'string') {
    return null
  }

  try {
    const lines = source.split('\n')
    let inMetadata = false
    let jsonLines: string[] = []
    let braceCount = 0

    for (const line of lines) {
      const trimmed = line.trim()

      // Check for ;@fx marker (start of metadata block)
      if (trimmed.startsWith(';@fx')) {
        inMetadata = true
        // Extract content after ;@fx marker
        const content = trimmed.substring(4).trim()
        
        // Skip version-only lines like ";@fx v1" or ";@fx v2"
        if (content && !content.match(/^v[0-9]+$/)) {
          jsonLines.push(content)
          // Count braces to detect complete JSON
          for (const char of content) {
            if (char === '{') braceCount++
            if (char === '}') braceCount--
          }
        }
        continue
      }

      // Continue collecting lines if we're in metadata block
      if (inMetadata) {
        // Stop if we hit a non-comment line
        if (!trimmed.startsWith(';')) {
          break
        }

        // Remove leading semicolon and @fx prefix if present
        let content = trimmed.substring(1).trim()
        if (content.startsWith('@fx')) {
          content = content.substring(3).trim()
        }

        if (content) {
          jsonLines.push(content)
          // Count braces
          for (const char of content) {
            if (char === '{') braceCount++
            if (char === '}') braceCount--
          }
        }

        // Check if we have complete JSON (all braces closed)
        if (braceCount === 0 && jsonLines.length > 0) {
          break
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

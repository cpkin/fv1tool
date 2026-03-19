import type { CompiledInstruction } from '../fv1/types'

const MAX_DELAY_RAM = 32768

export interface DelayAccessRecord {
  startAddress: number
  endAddress: number
  type: 'read' | 'write'
  label?: string
}

/**
 * Analyze compiled instructions to extract delay RAM access patterns.
 * Addresses >= MAX_DELAY_RAM are pointer-relative (subtract MAX_DELAY_RAM to get base).
 */
export function analyzeDelayAccess(instructions: CompiledInstruction[]): DelayAccessRecord[] {
  const records: DelayAccessRecord[] = []
  const seen = new Set<string>()

  for (const instr of instructions) {
    const op = instr.opcode.toUpperCase()
    let rawAddress: number | undefined
    let type: 'read' | 'write' | undefined

    switch (op) {
      case 'RDA':
        rawAddress = instr.operands[0]
        type = 'read'
        break
      case 'WRA':
        rawAddress = instr.operands[0]
        type = 'write'
        break
      case 'WRAP':
        rawAddress = instr.operands[0]
        type = 'write'
        break
      case 'RMPA':
        break
    }

    if (rawAddress !== undefined && type !== undefined) {
      // Decode: addresses >= MAX_DELAY_RAM are pointer-relative
      const isPointerRelative = rawAddress >= MAX_DELAY_RAM
      const baseAddr = isPointerRelative ? rawAddress - MAX_DELAY_RAM : rawAddress
      const addr = ((baseAddr % MAX_DELAY_RAM) + MAX_DELAY_RAM) % MAX_DELAY_RAM

      const key = `${type}:${addr}`
      if (!seen.has(key)) {
        seen.add(key)
        records.push({
          startAddress: addr,
          endAddress: addr,
          type,
        })
      }
    }
  }

  // Sort and merge adjacent records of the same type
  records.sort((a, b) => a.startAddress - b.startAddress || (a.type < b.type ? -1 : 1))

  const merged: DelayAccessRecord[] = []
  for (const rec of records) {
    const last = merged[merged.length - 1]
    if (last && last.type === rec.type && rec.startAddress <= last.endAddress + 256) {
      last.endAddress = Math.max(last.endAddress, rec.endAddress)
    } else {
      merged.push({ ...rec })
    }
  }

  // Ensure every region has a minimum visible width (at least 128 samples)
  for (const rec of merged) {
    if (rec.endAddress - rec.startAddress < 128) {
      rec.endAddress = Math.min(MAX_DELAY_RAM - 1, rec.startAddress + 128)
    }
  }

  return merged
}

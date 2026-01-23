/**
 * Simulation Limitation Warnings
 * 
 * Flags risky opcodes and patterns that may diverge from hardware behavior.
 */

import type { CompiledInstruction } from './types'

export interface SimulationWarning {
  type: 'log-exp' | 'heavy-delay' | 'precision' | 'sample-rate'
  severity: 'info' | 'warning'
  message: string
  opcodes?: string[]
}

/**
 * Analyze compiled instructions for potential fidelity issues
 */
export function analyzeSimulationLimitations(
  instructions: CompiledInstruction[]
): SimulationWarning[] {
  const warnings: SimulationWarning[] = []
  const opcodeUsage = new Map<string, number>()
  
  // Count opcode usage
  for (const inst of instructions) {
    const count = opcodeUsage.get(inst.opcode) ?? 0
    opcodeUsage.set(inst.opcode, count + 1)
  }
  
  // Check for LOG/EXP usage (known scaling differences)
  const logCount = opcodeUsage.get('log') ?? 0
  const expCount = opcodeUsage.get('exp') ?? 0
  if (logCount > 0 || expCount > 0) {
    warnings.push({
      type: 'log-exp',
      severity: 'warning',
      message: `LOG/EXP opcodes use approximate scaling (16× factor difference from hardware). Results may differ from FV-1.`,
      opcodes: ['log', 'exp'],
    })
  }
  
  // Check for heavy delay RAM usage
  const rdaCount = opcodeUsage.get('rda') ?? 0
  const wraCount = opcodeUsage.get('wra') ?? 0
  const wrapCount = opcodeUsage.get('wrap') ?? 0
  const totalDelayOps = rdaCount + wraCount + wrapCount
  
  if (totalDelayOps > 40) {
    warnings.push({
      type: 'heavy-delay',
      severity: 'info',
      message: `Heavy delay RAM usage (${totalDelayOps} ops). Simulator uses Float32 with limited resolution, may differ from hardware.`,
      opcodes: ['rda', 'wra', 'wrap'],
    })
  }
  
  // Check for RMPA (all-pass filter pattern)
  const rmpaCount = opcodeUsage.get('rmpa') ?? 0
  if (rmpaCount > 0) {
    warnings.push({
      type: 'precision',
      severity: 'info',
      message: `RMPA all-pass filters use delay RAM interpolation. Minor frequency response differences may occur.`,
      opcodes: ['rmpa'],
    })
  }
  
  return warnings
}

/**
 * Get fidelity description for UI
 */
export function getFidelityDescription(): string {
  return `This simulator targets audition-quality fidelity (trustworthy, not cycle-accurate).

Known deviations from FV-1 hardware:
• Sample rate: 32 kHz (hardware: 32.768 kHz) - slight timing difference in reverb/delay
• Delay RAM: Float32 with limited resolution (hardware: floating-point with similar constraints)
• LOG/EXP: Approximate 4-bit shift convention (may differ in extreme cases)
• Fixed-point math: Emulated in JavaScript (not true 24-bit integer)

The simulator is suitable for:
✓ Hearing how code affects sound
✓ Catching obvious bugs (NaN, clipping, silence)
✓ Tuning parameters and DSP algorithms

Not suitable for:
✗ Bit-exact hardware validation
✗ Critical timing-sensitive applications
✗ Production quality assurance (always test on hardware)`
}

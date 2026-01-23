/**
 * Official Corpus Validation Runner
 * 
 * Loads official Spin demo programs, simulates them with standardized input,
 * and compares output metrics against expected baselines.
 */

import { parseSpinAsm } from '../../parser/parseSpinAsm'
import { compileProgram } from '../compileProgram'
import { renderSimulation } from '../../audio/renderSimulation'
import { computeAudioMetrics, compareMetrics } from './metrics'
import type { AudioMetrics } from './metrics'

export interface CorpusTestResult {
  name: string
  path: string
  status: 'pass' | 'fail' | 'error'
  metrics?: AudioMetrics
  errors: string[]
  duration?: number
}

export interface CorpusRunResult {
  total: number
  passed: number
  failed: number
  errors: number
  results: CorpusTestResult[]
}

/**
 * Generate standardized test input: impulse + sine wave
 * This provides a predictable signal for testing DSP behavior.
 */
function generateTestInput(sampleRate: number, duration: number): AudioBuffer {
  const ctx = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate)
  const buffer = ctx.createBuffer(2, Math.floor(sampleRate * duration), sampleRate)
  
  const left = buffer.getChannelData(0)
  const right = buffer.getChannelData(1)
  
  // Impulse at start
  left[0] = 0.5
  right[0] = 0.5
  
  // 440 Hz sine wave (A4)
  const freq = 440
  const omega = 2 * Math.PI * freq / sampleRate
  for (let i = 1; i < buffer.length; i++) {
    const t = i / sampleRate
    const amplitude = 0.3 * Math.exp(-t * 2) // Decaying sine
    const sample = amplitude * Math.sin(omega * i)
    left[i] = sample
    right[i] = sample
  }
  
  return buffer
}

/**
 * Run a single corpus test
 */
async function runCorpusTest(
  name: string,
  path: string,
  source: string,
  expectedMetrics?: Partial<AudioMetrics>
): Promise<CorpusTestResult> {
  const startTime = performance.now()
  
  try {
    // Parse the program
    const parseResult = parseSpinAsm(source)
    
    if (parseResult.diagnostics.some(d => d.severity === 'error')) {
      return {
        name,
        path,
        status: 'error',
        errors: parseResult.diagnostics
          .filter(d => d.severity === 'error')
          .map(d => d.message),
        duration: performance.now() - startTime,
      }
    }
    
    // Compile the program
    let compiled
    try {
      compiled = compileProgram(parseResult, 'stereo_stereo')
    } catch (error) {
      return {
        name,
        path,
        status: 'error',
        errors: [error instanceof Error ? error.message : 'Compilation failed'],
        duration: performance.now() - startTime,
      }
    }
    
    // Generate test input
    const testInput = generateTestInput(32000, 0.5) // 500ms test
    
    // Render simulation
    const result = await renderSimulation({
      input: testInput,
      instructions: compiled.instructions,
      ioMode: 'stereo_stereo',
      pots: { pot0: 0.5, pot1: 0.5, pot2: 0.5 },
    })
    
    // Compute metrics
    const metrics = computeAudioMetrics(result.buffer)
    
    // Compare against expected if provided
    if (expectedMetrics) {
      const comparison = compareMetrics(metrics, expectedMetrics)
      
      return {
        name,
        path,
        status: comparison.pass ? 'pass' : 'fail',
        metrics,
        errors: comparison.errors,
        duration: performance.now() - startTime,
      }
    }
    
    // No expected metrics - just check for NaN/Infinity
    const errors: string[] = []
    if (metrics.hasNaN) errors.push('Output contains NaN')
    if (metrics.hasInfinity) errors.push('Output contains Infinity')
    
    return {
      name,
      path,
      status: errors.length > 0 ? 'fail' : 'pass',
      metrics,
      errors,
      duration: performance.now() - startTime,
    }
  } catch (error) {
    return {
      name,
      path,
      status: 'error',
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      duration: performance.now() - startTime,
    }
  }
}

/**
 * Load baseline metrics from JSON file
 */
async function loadBaselineMetrics(): Promise<Record<string, Partial<AudioMetrics>>> {
  try {
    const response = await fetch('/tests/corpus/official/metrics.json')
    if (!response.ok) {
      console.warn('Baseline metrics not found, running without validation')
      return {}
    }
    return await response.json()
  } catch (error) {
    console.warn('Failed to load baseline metrics:', error)
    return {}
  }
}

/**
 * Run validation against official corpus
 */
export async function runOfficialCorpus(): Promise<CorpusRunResult> {
  // Load all .spn files from official corpus
  const corpusFiles = import.meta.glob('/tests/corpus/official/*.spn', { 
    query: '?raw',
    import: 'default',
  })
  
  const baselines = await loadBaselineMetrics()
  const results: CorpusTestResult[] = []
  
  // Run each test
  for (const [path, loader] of Object.entries(corpusFiles)) {
    const source = await loader() as string
    const name = path.split('/').pop()?.replace('.spn', '') ?? path
    const expected = baselines[name]
    
    const result = await runCorpusTest(name, path, source, expected)
    results.push(result)
  }
  
  // Aggregate results
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const errors = results.filter(r => r.status === 'error').length
  
  return {
    total: results.length,
    passed,
    failed,
    errors,
    results,
  }
}

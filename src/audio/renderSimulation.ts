import { decodeAudio } from './decodeAudio';
import { resampleAudio } from './resampleAudio';
import {
  FV1_SAMPLE_RATE,
  INSTRUCTIONS_PER_SAMPLE,
  POT_UPDATE_BLOCK_SIZE,
} from '../fv1/constants';
import { getHandler } from '../fv1/instructions';
import { createState, resetState, updatePots } from '../fv1/state';
import type { CompiledProgram, FV1State } from '../fv1/types';
import { mapInputToADC, normalizeInput } from '../fv1/io';
import {
  RenderCancelledError,
  type RenderSimulationRequest,
  type RenderSimulationResult,
  type RenderWarning,
} from './renderTypes';

const DEFAULT_RENDER_SECONDS = 30;
const HARD_MAX_RENDER_SECONDS = 120;
const PROGRESS_THRESHOLD_SECONDS = 10;
const TARGET_PEAK = Math.pow(10, -1 / 20);

function prepareInputChannels(
  buffer: AudioBuffer,
  ioMode: CompiledProgram['ioMode'],
  frameCount: number,
): { inputL: Float32Array; inputR: Float32Array } {
  const channels = buffer.numberOfChannels;
  const left = buffer.getChannelData(0);
  const right = channels > 1 ? buffer.getChannelData(1) : left;

  const sliceChannel = (channel: Float32Array): Float32Array => channel.subarray(0, frameCount);

  if (ioMode === 'mono_mono' || ioMode === 'mono_stereo') {
    const mono = new Float32Array(frameCount);
    if (channels === 1) {
      mono.set(sliceChannel(left));
    } else {
      for (let i = 0; i < frameCount; i += 1) {
        mono[i] = 0.5 * (left[i] + right[i]);
      }
    }
    return { inputL: mono, inputR: mono };
  }

  if (channels === 1) {
    const mono = sliceChannel(left);
    return { inputL: mono, inputR: mono };
  }

  return { inputL: sliceChannel(left), inputR: sliceChannel(right) };
}

interface CachedInstruction {
  handler: (state: FV1State, operands: number[]) => void;
  operands: number[];
  opcode: string;
}

const TWO_PI = Math.PI * 2;

function wrapPhase(phase: number): number {
  return phase - Math.floor(phase);
}

function updateLfoState(state: FV1State): void {
  const lfo = state.lfo;

  lfo.sin0Phase = wrapPhase(lfo.sin0Phase + lfo.sin0Rate);
  lfo.sin1Phase = wrapPhase(lfo.sin1Phase + lfo.sin1Rate);
  lfo.rmp0Phase = wrapPhase(lfo.rmp0Phase + lfo.rmp0Rate);
  lfo.rmp1Phase = wrapPhase(lfo.rmp1Phase + lfo.rmp1Rate);

  lfo.sin0 = Math.sin(lfo.sin0Phase * TWO_PI);
  lfo.sin1 = Math.sin(lfo.sin1Phase * TWO_PI);
  lfo.rmp0 = lfo.rmp0Phase;
  lfo.rmp1 = lfo.rmp1Phase;
}

function executeSample(
  state: FV1State,
  program: CompiledProgram,
  inputL: number,
  inputR: number,
  cachedInstructions?: CachedInstruction[],
): void {
  state.pacc = state.acc;
  state.dacLWritten = false;
  state.dacRWritten = false;

  const adc = mapInputToADC(inputL, inputR, state.ioMode, state.lr);
  state.adcL = adc.adcl;
  state.adcR = adc.adcr;
  state.nextPc = null;

  if (cachedInstructions) {
      const instructionCount = cachedInstructions.length;
    for (let pc = 0; pc < instructionCount; ) {
      const cached = cachedInstructions[pc];
      const needsPc = cached.opcode === 'skp'
        || cached.opcode === 'raw'
        || cached.opcode.startsWith('skp_');
      const operands = needsPc
        ? [...cached.operands, pc]
        : cached.operands;
      cached.handler(state, operands);

      if (state.nextPc !== null) {
        pc = state.nextPc;
        state.nextPc = null;
      } else {
        pc += 1;
      }
    }
  } else {
    const instructionCount = Math.min(program.instructions.length, INSTRUCTIONS_PER_SAMPLE);
    for (let pc = 0; pc < instructionCount; ) {
      const instruction = program.instructions[pc];
      const handler = getHandler(instruction.opcode);
      const needsPc = instruction.opcode === 'skp'
        || instruction.opcode === 'raw'
        || instruction.opcode.startsWith('skp_');
      const operands = needsPc
        ? [...instruction.operands, pc]
        : instruction.operands;
      handler(state, operands);

      if (state.nextPc !== null) {
        pc = state.nextPc;
        state.nextPc = null;
      } else {
        pc += 1;
      }
    }
  }

  if (state.ioMode === 'mono_mono') {
    if (!state.dacLWritten) {
      state.dacL = state.acc;
    }
    if (!state.dacRWritten) {
      state.dacR = state.acc;
    }
  } else if (state.ioMode === 'mono_stereo') {
    if (state.lr === 0 && !state.dacLWritten) {
      state.dacL = state.acc;
    }
    if (state.lr === 1 && !state.dacRWritten) {
      state.dacR = state.acc;
    }
  } else if (state.lr === 0) {
    if (!state.dacLWritten) {
      state.dacL = state.acc;
    }
  } else if (!state.dacRWritten) {
    state.dacR = state.acc;
  }
}

function normalizeOutput(
  outputL: Float32Array,
  outputR: Float32Array,
  outputChannels: number,
): number {
  let peak = 0;
  for (let i = 0; i < outputL.length; i += 1) {
    peak = Math.max(peak, Math.abs(outputL[i]));
    if (outputChannels > 1) {
      peak = Math.max(peak, Math.abs(outputR[i]));
    }
  }

  if (peak === 0) {
    return 0;
  }

  const gain = TARGET_PEAK / peak;
  for (let i = 0; i < outputL.length; i += 1) {
    outputL[i] *= gain;
    if (outputChannels > 1) {
      outputR[i] *= gain;
    }
  }

  return peak * gain;
}

function resolveRenderLengthSeconds(
  inputDuration: number,
  requestedSeconds: number | undefined,
  warnings: RenderWarning[],
): number {
  if (requestedSeconds === undefined) {
    const target = Math.min(inputDuration, DEFAULT_RENDER_SECONDS);
    if (inputDuration > DEFAULT_RENDER_SECONDS) {
      warnings.push({
        code: 'default-limit',
        message: `Input exceeds ${DEFAULT_RENDER_SECONDS}s; rendering first ${DEFAULT_RENDER_SECONDS}s.`,
      });
    }
    return target;
  }

  let target = requestedSeconds;
  if (requestedSeconds > HARD_MAX_RENDER_SECONDS) {
    target = HARD_MAX_RENDER_SECONDS;
    warnings.push({
      code: 'hard-cap',
      message: `Requested ${requestedSeconds}s exceeds hard cap; rendering ${HARD_MAX_RENDER_SECONDS}s.`,
    });
  }

  if (target < inputDuration) {
    warnings.push({
      code: 'input-truncated',
      message: `Input truncated to ${target}s for render length request.`,
    });
  }

  return Math.min(target, inputDuration);
}

export async function renderSimulation(
  request: RenderSimulationRequest,
): Promise<RenderSimulationResult> {
  const renderStartTime = performance.now();

  if (request.abortSignal?.aborted) {
    throw new RenderCancelledError();
  }

  const warnings: RenderWarning[] = [];
  const decoded =
    request.input instanceof AudioBuffer
      ? request.input
      : await decodeAudio(request.input);
  const resampled = await resampleAudio(decoded, FV1_SAMPLE_RATE);

  const renderSeconds = resolveRenderLengthSeconds(
    resampled.duration,
    request.renderSeconds,
    warnings,
  );
  const frameCount = Math.min(
    resampled.buffer.length,
    Math.max(1, Math.floor(renderSeconds * FV1_SAMPLE_RATE)),
  );

  const program: CompiledProgram = {
    instructions: request.instructions,
    ioMode: request.ioMode,
  };
  const outputChannels = request.ioMode === 'mono_mono' ? 1 : 2;
  const { inputL, inputR } = prepareInputChannels(resampled.buffer, request.ioMode, frameCount);

  // Precompute instruction handlers for performance (fast path)
  const instructionCount = Math.min(program.instructions.length, INSTRUCTIONS_PER_SAMPLE);
  const cachedInstructions: CachedInstruction[] = new Array(instructionCount);
  for (let i = 0; i < instructionCount; i += 1) {
    const instruction = program.instructions[i];
    cachedInstructions[i] = {
      handler: getHandler(instruction.opcode),
      operands: instruction.operands,
      opcode: instruction.opcode,
    };
  }

  const state = createState(request.ioMode, request.pots ?? {});
  resetState(state);
  updatePots(state, request.pots ?? {});

  const outputL = new Float32Array(frameCount);
  const outputR = new Float32Array(frameCount);

  const totalSeconds = frameCount / FV1_SAMPLE_RATE;
  const shouldReportProgress = totalSeconds > PROGRESS_THRESHOLD_SECONDS && !!request.onProgress;
  const progressIntervalSamples = FV1_SAMPLE_RATE;

  if (shouldReportProgress && request.onProgress) {
    request.onProgress({ processedSeconds: 0, totalSeconds, progress: 0 });
  }

  for (let sample = 0; sample < frameCount; sample += 1) {
    if (request.abortSignal?.aborted) {
      throw new RenderCancelledError();
    }

    if (
      shouldReportProgress &&
      request.onProgress &&
      sample > 0 &&
      sample % progressIntervalSamples === 0
    ) {
      const processedSeconds = sample / FV1_SAMPLE_RATE;
      request.onProgress({
        processedSeconds,
        totalSeconds,
        progress: Math.min(1, processedSeconds / totalSeconds),
      });
    }

    if (sample % POT_UPDATE_BLOCK_SIZE === 0 && request.pots) {
      updatePots(state, request.pots);
    }

    const inL = normalizeInput(inputL[sample] ?? 0, false);
    const inR = normalizeInput(inputR[sample] ?? inL, false);

    updateLfoState(state);

    if (program.ioMode !== 'mono_mono') {
      state.lr = 0;
      executeSample(state, program, inL, inR, cachedInstructions);
      outputL[sample] = state.dacL;

      state.lr = 1;
      executeSample(state, program, inL, inR, cachedInstructions);
      outputR[sample] = state.dacR;
    } else {
      state.lr = 0;
      executeSample(state, program, inL, inR, cachedInstructions);
      outputL[sample] = state.dacL;
      outputR[sample] = state.dacR;
    }

    state.sampleCounter += 1;
  }

  const normalizedPeak = normalizeOutput(outputL, outputR, outputChannels);

  if (shouldReportProgress && request.onProgress) {
    request.onProgress({ processedSeconds: totalSeconds, totalSeconds, progress: 1 });
  }

  const offlineContext = new OfflineAudioContext(
    outputChannels,
    frameCount,
    FV1_SAMPLE_RATE,
  );
  const outputBuffer = offlineContext.createBuffer(outputChannels, frameCount, FV1_SAMPLE_RATE);
  outputBuffer.copyToChannel(outputL, 0);
  if (outputChannels > 1) {
    outputBuffer.copyToChannel(outputR, 1);
  }

  const source = new AudioBufferSourceNode(offlineContext, { buffer: outputBuffer });
  source.connect(offlineContext.destination);
  source.start(0);
  const rendered = await offlineContext.startRendering();

  const renderEndTime = performance.now();
  const elapsedMs = renderEndTime - renderStartTime;

  // Warn if render time exceeds 2 seconds for 30s audio (performance target)
  const targetRenderSeconds = Math.min(renderSeconds, DEFAULT_RENDER_SECONDS);
  if (elapsedMs > 2000 && targetRenderSeconds >= 30) {
    warnings.push({
      code: 'slow-render',
      message: `Render took ${(elapsedMs / 1000).toFixed(1)}s (target: <2s for 30s audio). Complex program may impact performance.`,
    });
  }

  return {
    buffer: rendered,
    duration: rendered.duration,
    sampleRate: rendered.sampleRate,
    warnings,
    resampleNote: resampled.note,
    normalizedPeak,
    elapsedMs,
  };
}

import { FV1_SAMPLE_RATE } from '../fv1/constants';

export interface ResampleResult {
  buffer: AudioBuffer;
  duration: number;
  sampleRate: number;
  note: string;
}

export async function resampleAudio(
  buffer: AudioBuffer,
  targetSampleRate: number = FV1_SAMPLE_RATE,
): Promise<ResampleResult> {
  if (buffer.sampleRate === targetSampleRate) {
    return {
      buffer,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      note: `Input already at ${targetSampleRate} Hz; no resample needed.`,
    };
  }

  const frameCount = Math.ceil(buffer.duration * targetSampleRate);
  const offlineContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    frameCount,
    targetSampleRate,
  );
  const source = new AudioBufferSourceNode(offlineContext, { buffer });
  source.connect(offlineContext.destination);
  source.start(0);

  const resampled = await offlineContext.startRendering();

  return {
    buffer: resampled,
    duration: resampled.duration,
    sampleRate: resampled.sampleRate,
    note: `Resampled from ${buffer.sampleRate} Hz to ${targetSampleRate} Hz for FV-1 simulation.`,
  };
}

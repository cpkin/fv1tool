export type DecodableAudioInput = File | ArrayBuffer;

const AudioContextConstructor =
  globalThis.AudioContext || (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

export async function decodeAudio(input: DecodableAudioInput): Promise<AudioBuffer> {
  if (!AudioContextConstructor) {
    throw new Error('Web Audio API AudioContext not available in this environment.');
  }

  const arrayBuffer = input instanceof ArrayBuffer ? input.slice(0) : await input.arrayBuffer();
  const audioContext = new AudioContextConstructor();

  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    await audioContext.close();
  }
}

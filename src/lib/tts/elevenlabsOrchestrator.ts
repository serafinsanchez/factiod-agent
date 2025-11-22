import { chunkForElevenV3 } from '@/lib/tts/chunkText';
import { toNarrationOnly } from '@/lib/tts/cleanNarration';
import {
  ELEVEN_MULTILINGUAL_V2_MAX_CHARS,
  ELEVEN_V3_SAFE_CHARS,
  generateTtsAudio,
  type TtsOptions,
} from '@/lib/tts/elevenlabs';

const MAX_TTS_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2000;
const MIN_SPLIT_CHARS = 600;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function synthesizeChunk(
  chunk: string,
  options: TtsOptions,
  depth = 0,
): Promise<Buffer> {
  for (let attempt = 1; attempt <= MAX_TTS_ATTEMPTS; attempt++) {
    try {
      return await generateTtsAudio(chunk, {
        ...options,
        modelId: options.modelId ?? 'eleven_v3',
      });
    } catch (error) {
      console.warn(
        `[TTS] Chunk (len ${chunk.length}) attempt ${attempt} failed`,
        error,
      );

      if (attempt < MAX_TTS_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      if (chunk.length <= MIN_SPLIT_CHARS) {
        throw error;
      }

      const nextLimit = Math.max(
        MIN_SPLIT_CHARS,
        Math.floor(chunk.length / 2),
      );
      const fallbackChunks = chunkForElevenV3(chunk, nextLimit);

      if (fallbackChunks.length <= 1) {
        throw error;
      }

      console.log(
        `[TTS] Splitting chunk (len ${chunk.length}) into ${fallbackChunks.length} sub-chunks (limit ${nextLimit})`,
      );

      const buffers: Buffer[] = [];
      for (const [subIndex, subChunk] of fallbackChunks.entries()) {
        console.log(
          `[TTS] → Sub-chunk ${subIndex + 1}/${fallbackChunks.length} (${subChunk.length} chars) depth ${depth + 1}`,
        );
        buffers.push(await synthesizeChunk(subChunk, options, depth + 1));
      }

      return Buffer.concat(buffers);
    }
  }

  throw new Error('Unreachable synthesizeChunk state');
}

export async function generateNarrationMultiChunk(
  rawScript: string,
  options: TtsOptions = {},
): Promise<Buffer> {
  const narrationText = toNarrationOnly(rawScript);
  const targetModel = options.modelId ?? 'eleven_v3';
  const chunkLimit =
    targetModel === 'eleven_multilingual_v2'
      ? ELEVEN_MULTILINGUAL_V2_MAX_CHARS
      : ELEVEN_V3_SAFE_CHARS;
  const chunks = chunkForElevenV3(narrationText, chunkLimit);

  if (chunks.length === 0) {
    throw new Error('No narration text available for TTS.');
  }

  console.log(
    `[TTS] ElevenLabs ${targetModel} chunking → ${chunks.length} chunk(s)`,
    chunks.map((chunk) => chunk.length),
  );

  const buffers: Buffer[] = [];
  for (const [index, chunk] of chunks.entries()) {
    console.log(
      `[TTS] Generating chunk ${index + 1}/${chunks.length} (${chunk.length} chars)`,
    );
    buffers.push(await synthesizeChunk(chunk, options));
  }

  return Buffer.concat(buffers);
}


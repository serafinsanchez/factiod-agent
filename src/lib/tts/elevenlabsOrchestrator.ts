import { chunkForElevenV3 } from '@/lib/tts/chunkText';
import { toNarrationOnly } from '@/lib/tts/cleanNarration';
import {
  ELEVEN_MULTILINGUAL_V2_MAX_CHARS,
  ELEVEN_V3_SAFE_CHARS,
  generateTtsAudio,
  TtsError,
  type TtsOptions,
} from '@/lib/tts/elevenlabs';

const MAX_TTS_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2000;
const MIN_SPLIT_CHARS = 600;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extended error with chunk context for orchestrator-level failures
 */
export class TtsChunkError extends Error {
  constructor(
    message: string,
    public readonly context: {
      chunkIndex: number;
      totalChunks: number;
      chunkLength: number;
      attempt: number;
      depth: number;
      modelId: string;
      voice?: string;
      falRequestId?: string;
    }
  ) {
    super(message);
    this.name = 'TtsChunkError';
  }
}

interface SynthesizeChunkContext {
  chunkIndex: number;
  totalChunks: number;
  modelId: string;
  voice?: string;
}

async function synthesizeChunk(
  chunk: string,
  options: TtsOptions,
  ctx: SynthesizeChunkContext,
  depth = 0,
): Promise<Buffer> {
  const { chunkIndex, totalChunks, modelId, voice } = ctx;

  for (let attempt = 1; attempt <= MAX_TTS_ATTEMPTS; attempt++) {
    try {
      return await generateTtsAudio(chunk, {
        ...options,
        modelId: options.modelId ?? 'eleven_v3',
      });
    } catch (error) {
      // Extract fal requestId if it's a TtsError
      const falRequestId = error instanceof TtsError ? error.context.falRequestId : undefined;
      
      console.warn(
        `[TTS] Chunk ${chunkIndex + 1}/${totalChunks} (len ${chunk.length}) attempt ${attempt}/${MAX_TTS_ATTEMPTS} failed` +
        (falRequestId ? ` (falRequestId: ${falRequestId})` : ''),
        error instanceof Error ? error.message : error,
      );

      if (attempt < MAX_TTS_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      if (chunk.length <= MIN_SPLIT_CHARS) {
        // Re-throw with chunk context
        const baseMessage = error instanceof Error ? error.message : String(error);
        throw new TtsChunkError(
          `TTS failed for chunk ${chunkIndex + 1}/${totalChunks} after ${attempt} attempts: ${baseMessage}`,
          {
            chunkIndex,
            totalChunks,
            chunkLength: chunk.length,
            attempt,
            depth,
            modelId,
            voice,
            falRequestId,
          }
        );
      }

      const nextLimit = Math.max(
        MIN_SPLIT_CHARS,
        Math.floor(chunk.length / 2),
      );
      const fallbackChunks = chunkForElevenV3(chunk, nextLimit);

      if (fallbackChunks.length <= 1) {
        const baseMessage = error instanceof Error ? error.message : String(error);
        throw new TtsChunkError(
          `TTS failed for chunk ${chunkIndex + 1}/${totalChunks} (cannot split further): ${baseMessage}`,
          {
            chunkIndex,
            totalChunks,
            chunkLength: chunk.length,
            attempt,
            depth,
            modelId,
            voice,
            falRequestId,
          }
        );
      }

      console.log(
        `[TTS] Splitting chunk ${chunkIndex + 1}/${totalChunks} (len ${chunk.length}) into ${fallbackChunks.length} sub-chunks (limit ${nextLimit})`,
      );

      const buffers: Buffer[] = [];
      for (const [subIndex, subChunk] of fallbackChunks.entries()) {
        console.log(
          `[TTS] → Sub-chunk ${subIndex + 1}/${fallbackChunks.length} (${subChunk.length} chars) depth ${depth + 1}`,
        );
        buffers.push(await synthesizeChunk(
          subChunk, 
          options, 
          { ...ctx, chunkIndex: subIndex, totalChunks: fallbackChunks.length },
          depth + 1
        ));
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
    buffers.push(await synthesizeChunk(chunk, options, {
      chunkIndex: index,
      totalChunks: chunks.length,
      modelId: targetModel,
      voice: options.voiceId,
    }));
  }

  return Buffer.concat(buffers);
}


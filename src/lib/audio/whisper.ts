/**
 * Whisper Audio Transcription with Word-Level Timestamps
 * 
 * Uses fal.ai's Whisper endpoint to transcribe audio and extract
 * precise word-level timestamps for audio-video synchronization.
 * 
 * Documentation: https://docs.fal.ai/model-apis/guides/convert-speech-to-text
 */

import { fal } from "@fal-ai/client";
import type {
  NarrationTimestampsData,
  NarrationSegment,
  WordTimestamp,
} from "@/types/agent";

// Configure fal client with API key from environment
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

/**
 * Whisper model endpoints available via fal.ai
 */
export const WHISPER_MODELS = {
  /** Standard Whisper large-v3 model */
  WHISPER: "fal-ai/whisper",
  /** Optimized Whisper v3 Large with 2x performance */
  WIZPER: "fal-ai/wizper",
} as const;

export type WhisperModelId = keyof typeof WHISPER_MODELS;

/**
 * Raw word timestamp from Whisper API
 * Note: fal.ai Whisper returns timestamp as [start, end] tuple
 */
interface WhisperWord {
  word: string;
  start?: number;
  end?: number;
  timestamp?: [number, number]; // fal.ai format: [start, end]
}

/**
 * Raw chunk from fal.ai Whisper API
 * Uses timestamp tuple format: [start, end]
 */
interface WhisperChunk {
  text: string;
  timestamp: [number, number]; // [start, end]
  speaker?: string;
}

/**
 * Raw segment from Whisper API (older format)
 */
interface WhisperSegment {
  text: string;
  start: number;
  end: number;
  words?: WhisperWord[];
}

/**
 * Raw transcription result from Whisper API
 * Supports both formats: chunks (from chunk_level API) and segments (from word_timestamps API)
 */
interface WhisperResult {
  text: string;
  chunks?: WhisperChunk[];
  segments?: WhisperSegment[];
  words?: WhisperWord[];
}

/**
 * Options for transcription
 */
export interface TranscriptionOptions {
  /** Which Whisper model to use */
  modelId?: WhisperModelId;
  /** Language code (e.g., "en" for English). Auto-detected if not specified. */
  language?: string;
  /** Task: "transcribe" or "translate" (to English) */
  task?: "transcribe" | "translate";
}

/**
 * Extended error with Whisper context for better debugging
 */
export class WhisperError extends Error {
  constructor(
    message: string,
    public readonly context: {
      modelId: WhisperModelId;
      model: string;
      audioUrl: string; // Redacted for safety
      falRequestId?: string;
    }
  ) {
    super(message);
    this.name = 'WhisperError';
  }
}

/**
 * Transcribe audio and extract word-level timestamps
 * 
 * @param audioUrl - URL of the audio file to transcribe
 * @param options - Transcription options
 * @returns Narration timestamps data with word-level timing
 */
export async function transcribeWithTimestamps(
  audioUrl: string,
  options: TranscriptionOptions = {}
): Promise<NarrationTimestampsData> {
  const { modelId = "WHISPER", language, task = "transcribe" } = options;
  const model = WHISPER_MODELS[modelId];

  // Redact URL for logging (show domain only)
  const redactedUrl = (() => {
    try {
      const parsed = new URL(audioUrl);
      return `${parsed.origin}/...${audioUrl.slice(-20)}`;
    } catch {
      return audioUrl.substring(0, 40) + '...';
    }
  })();

  const baseContext = {
    modelId,
    model,
    audioUrl: redactedUrl,
  };

  console.log(`🎤 Starting audio transcription with ${modelId} (v2)...`);
  console.log(`🔗 Audio URL: ${redactedUrl}`);

  let result: { data?: unknown; requestId?: string };
  try {
    result = await fal.subscribe(model, {
      input: {
        audio_url: audioUrl,
        task,
        // Cast language to satisfy fal.ai's strict union type (validated at runtime by their API)
        language: language as "en" | undefined,
        // Request structured segment + word detail from Whisper v3
        chunk_level: "segment",
        version: "3",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(`⏳ Transcription in progress...`);
        }
      },
    }) as { data?: unknown; requestId?: string };
  } catch (falError) {
    const errorMessage = falError instanceof Error ? falError.message : String(falError);
    console.error(`[Whisper] fal.ai call failed:`, falError);
    throw new WhisperError(
      `Whisper transcription failed: ${errorMessage}`,
      { ...baseContext, falRequestId: undefined }
    );
  }

  const falRequestId = result.requestId;
  if (falRequestId) {
    console.log(`🎤 fal.ai requestId: ${falRequestId}`);
  }

  // Handle both response formats: result.data (from @fal-ai/client) or direct result
  // The response structure can vary: result.data.segments or result.segments
  // Cast to our internal WhisperResult type to handle all possible response formats
  const rawResponse = (result.data || result) as unknown as WhisperResult;
  
  console.log(`✅ Transcription complete` + (falRequestId ? ` (requestId: ${falRequestId})` : ''));
  console.log(`📝 Raw response keys:`, Object.keys(rawResponse));
  console.log(`📝 Full text length: ${rawResponse.text?.length || 0} characters`);
  console.log(`📝 Has segments:`, Boolean(rawResponse.segments));
  console.log(`📝 Has chunks:`, Boolean(rawResponse.chunks));
  console.log(`📝 Has words:`, Boolean(rawResponse.words));

  // Parse the response into our structured format
  try {
    return parseWhisperResponse(rawResponse);
  } catch (parseError) {
    const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
    throw new WhisperError(
      `Failed to parse Whisper response: ${errorMessage}`,
      { ...baseContext, falRequestId }
    );
  }
}

/**
 * Parse Whisper API response into NarrationTimestampsData
 * 
 * fal.ai Whisper returns chunks with timestamp tuple format:
 * { text: "Hello world", timestamp: [0.0, 1.5] }
 */
function parseWhisperResponse(data: WhisperResult): NarrationTimestampsData {
  const segments: NarrationSegment[] = [];
  const allWords: WordTimestamp[] = [];
  let totalDurationSec = 0;

  // Process chunks from fal.ai Whisper (primary format)
  if (data.chunks && Array.isArray(data.chunks) && data.chunks.length > 0) {
    console.log(`🔍 Parsing ${data.chunks.length} chunks from fal.ai Whisper`);
    
    for (const chunk of data.chunks) {
      // fal.ai uses timestamp tuple: [start, end]
      const [start, end] = chunk.timestamp || [0, 0];
      
      // Split chunk text into words and distribute timing evenly
      const chunkText = chunk.text.trim();
      const words = chunkText.split(/\s+/).filter(Boolean);
      const chunkDuration = end - start;
      const wordDuration = words.length > 0 ? chunkDuration / words.length : 0;
      
      const segmentWords: WordTimestamp[] = [];
      
      for (let i = 0; i < words.length; i++) {
        const wordStart = start + (i * wordDuration);
        const wordEnd = start + ((i + 1) * wordDuration);
        
        const wordTimestamp: WordTimestamp = {
          word: words[i],
          start: wordStart,
          end: wordEnd,
        };
        segmentWords.push(wordTimestamp);
        allWords.push(wordTimestamp);
      }

      segments.push({
        text: chunkText,
        start,
        end,
        words: segmentWords,
      });

      // Track total duration from chunk end
      if (end > totalDurationSec) {
        totalDurationSec = end;
      }
    }
  }
  // Fallback: Process segments from older Whisper format
  else if (data.segments && Array.isArray(data.segments) && data.segments.length > 0) {
    console.log(`🔍 Parsing ${data.segments.length} segments from Whisper`);
    
    for (const segment of data.segments) {
      const segmentWords: WordTimestamp[] = [];

      // Extract words from segment if available
      if (segment.words && Array.isArray(segment.words)) {
        for (const word of segment.words) {
          // Handle both formats: direct start/end or timestamp tuple
          const wordStart = word.start ?? (word.timestamp?.[0] ?? 0);
          const wordEnd = word.end ?? (word.timestamp?.[1] ?? 0);
          
          const wordTimestamp: WordTimestamp = {
            word: word.word.trim(),
            start: wordStart,
            end: wordEnd,
          };
          segmentWords.push(wordTimestamp);
          allWords.push(wordTimestamp);

          // Track total duration
          if (wordEnd > totalDurationSec) {
            totalDurationSec = wordEnd;
          }
        }
      }

      segments.push({
        text: segment.text.trim(),
        start: segment.start,
        end: segment.end,
        words: segmentWords,
      });

      // Track total duration from segment end
      if (segment.end > totalDurationSec) {
        totalDurationSec = segment.end;
      }
    }
  }

  // If words were returned at top level (fallback for some model versions)
  if (data.words && Array.isArray(data.words) && allWords.length === 0) {
    console.log(`🔍 Parsing ${data.words.length} top-level words`);
    
    for (const word of data.words) {
      // Handle both formats: direct start/end or timestamp tuple
      const wordStart = word.start ?? (word.timestamp?.[0] ?? 0);
      const wordEnd = word.end ?? (word.timestamp?.[1] ?? 0);
      
      const wordTimestamp: WordTimestamp = {
        word: word.word.trim(),
        start: wordStart,
        end: wordEnd,
      };
      allWords.push(wordTimestamp);

      if (wordEnd > totalDurationSec) {
        totalDurationSec = wordEnd;
      }
    }
  }

  console.log(`📊 Parsed ${segments.length} segments, ${allWords.length} words`);
  console.log(`⏱️ Total duration: ${totalDurationSec.toFixed(2)}s`);

  // Validate that we got some data
  if (segments.length === 0 && allWords.length === 0) {
    console.error("❌ No segments or words found in Whisper response");
    console.error("Response structure:", JSON.stringify(data, null, 2).substring(0, 500));
    throw new Error(
      "Whisper API returned no transcription data. " +
      "Response may be in an unexpected format. " +
      `Found keys: ${Object.keys(data).join(", ")}`
    );
  }

  return {
    words: allWords,
    segments,
    totalDurationSec,
  };
}

/**
 * Check if fal.ai API key is configured
 */
export function isWhisperConfigured(): boolean {
  return Boolean(process.env.FAL_KEY);
}


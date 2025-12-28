import { fal } from '@fal-ai/client';

const FAL_KEY = process.env.FAL_KEY!;
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID!;
const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_v3';

// Voice to use for multilingual_v2 model (can be a preset name like "Daniel" or a voice ID)
// Set ELEVENLABS_MULTILINGUAL_V2_VOICE in .env.local to override the default
const MULTILINGUAL_V2_VOICE = process.env.ELEVENLABS_MULTILINGUAL_V2_VOICE ?? 'Daniel';

export const ELEVEN_V3_MAX_CHARS = 5000;
export const ELEVEN_V3_SAFE_CHARS = 3800;
export const ELEVEN_MULTILINGUAL_V2_MAX_CHARS = 10000;

if (!FAL_KEY) {
  console.warn('FAL_KEY is not set. TTS will fail.');
}

// Configure fal client with credentials
fal.config({
  credentials: FAL_KEY,
});

// Map model IDs to fal.ai endpoints
const MODEL_TO_ENDPOINT: Record<string, string> = {
  eleven_v3: 'fal-ai/elevenlabs/tts/eleven-v3',
  eleven_multilingual_v2: 'fal-ai/elevenlabs/tts/multilingual-v2',
};

export interface TtsOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

interface FalTtsResult {
  data: {
    audio: {
      url: string;
      content_type?: string;
      file_name?: string;
      file_size?: number;
    };
  };
  requestId: string;
}

// Known preset voice NAMES that work with fal.ai ElevenLabs endpoints
const PRESET_VOICE_NAMES = new Set([
  'rachel', 'domi', 'bella', 'antoni', 'elli', 'josh', 'arnold', 'adam',
  'sam', 'nicole', 'glinda', 'clyde', 'james', 'aria', 'matilda', 'liam',
  'charlotte', 'emily', 'daniel', 'sarah', 'brian', 'george', 'grace',
  'lily', 'dave', 'freya', 'gigi', 'harry', 'alice', 'dorothy', 'drew',
  'jessica', 'michael', 'mimi', 'chris', 'paul', 'serena', 'thomas', 'laura',
]);


/**
 * Check if a voice string is a known preset name (case-insensitive).
 * Returns false if it looks like a voice ID (typically 21-char alphanumeric strings).
 */
function isPresetVoiceName(voice: string): boolean {
  return PRESET_VOICE_NAMES.has(voice.toLowerCase());
}

/**
 * Extended error with TTS context for better debugging
 */
export class TtsError extends Error {
  constructor(
    message: string,
    public readonly context: {
      modelId: string;
      voice: string;
      endpoint: string;
      textLength: number;
      falRequestId?: string;
    }
  ) {
    super(message);
    this.name = 'TtsError';
  }
}

export async function generateTtsAudio(
  text: string,
  options: TtsOptions = {},
): Promise<Buffer> {
  if (!FAL_KEY) {
    throw new Error('FAL_KEY is not set.');
  }

  const modelId = options.modelId ?? DEFAULT_MODEL_ID;
  let voice = options.voiceId ?? DEFAULT_VOICE_ID;

  if (!voice) {
    throw new Error('No ElevenLabs voice ID configured.');
  }

  // For multilingual_v2, custom voice IDs may not work correctly and can produce silent audio.
  // If the voice is not a known preset name, fall back to ELEVENLABS_MULTILINGUAL_V2_VOICE.
  if (modelId === 'eleven_multilingual_v2' && !isPresetVoiceName(voice)) {
    console.warn(
      `[TTS] Voice "${voice}" is not a known preset voice name. ` +
      `Custom voice IDs may produce silent audio with eleven_multilingual_v2. ` +
      `Using fallback voice "${MULTILINGUAL_V2_VOICE}" instead.`
    );
    voice = MULTILINGUAL_V2_VOICE;
  }

  const endpoint = MODEL_TO_ENDPOINT[modelId];
  if (!endpoint) {
    throw new Error(`Unknown model ID: ${modelId}. Supported: ${Object.keys(MODEL_TO_ENDPOINT).join(', ')}`);
  }

  const baseContext = {
    modelId,
    voice,
    endpoint,
    textLength: text.length,
  };

  console.log(`[TTS] Calling fal.ai endpoint: ${endpoint} with voice: ${voice} (${text.length} chars)`);

  let result: FalTtsResult;
  try {
    result = (await fal.subscribe(endpoint, {
      input: {
        text,
        voice,
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
      },
    })) as FalTtsResult;
  } catch (falError) {
    const errorMessage = falError instanceof Error ? falError.message : String(falError);
    console.error(`[TTS] fal.ai call failed:`, falError);
    throw new TtsError(
      `fal.ai TTS call failed: ${errorMessage}`,
      { ...baseContext, falRequestId: undefined }
    );
  }

  const falRequestId = result.requestId;
  console.log(`[TTS] fal.ai requestId: ${falRequestId}`);

  // Download the audio from the returned URL
  const audioUrl = result.data.audio.url;
  console.log(`[TTS] Downloading audio from: ${audioUrl}`);
  
  let res: Response;
  try {
    res = await fetch(audioUrl);
  } catch (fetchError) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
    throw new TtsError(
      `Failed to download audio from fal.ai: ${errorMessage}`,
      { ...baseContext, falRequestId }
    );
  }

  if (!res.ok) {
    throw new TtsError(
      `Failed to download audio from fal.ai: ${res.status} ${res.statusText}`,
      { ...baseContext, falRequestId }
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(`[TTS] Downloaded audio buffer size: ${buffer.length} bytes (requestId: ${falRequestId})`);
  
  return buffer;
}

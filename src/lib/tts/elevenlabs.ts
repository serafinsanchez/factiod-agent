const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

const API_KEY = process.env.ELEVENLABS_API_KEY!;
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID!;
const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_flash_v2_5';

if (!API_KEY) {
  console.warn('ELEVENLABS_API_KEY is not set. TTS will fail.');
}

export interface TtsOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

export async function generateTtsAudio(
  text: string,
  options: TtsOptions = {},
): Promise<Buffer> {
  if (!API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not set.');
  }

  const voiceId = options.voiceId ?? DEFAULT_VOICE_ID;
  const modelId = options.modelId ?? DEFAULT_MODEL_ID;

  if (!voiceId) {
    throw new Error('No ElevenLabs voice ID configured.');
  }

  const url = `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`;

  const body = {
    text,
    model_id: modelId,
    voice_settings: {
      stability: options.stability ?? 0.5,
      similarity_boost: options.similarityBoost ?? 0.7,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS error: ${res.status} ${res.statusText} ${msg}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}


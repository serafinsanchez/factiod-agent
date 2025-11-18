import { NextRequest, NextResponse } from 'next/server';

import { generateNarrationMultiChunk } from '@/lib/tts/elevenlabsOrchestrator';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId, modelId } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "text"' },
        { status: 400 },
      );
    }

    const audioBuffer = await generateNarrationMultiChunk(text, {
      voiceId,
      modelId,
    });

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('TTS generation error', err);
    const details = err instanceof Error ? err.message : undefined;
    return NextResponse.json(
      {
        error: 'Failed to generate audio',
        details,
      },
      { status: 500 },
    );
  }
}


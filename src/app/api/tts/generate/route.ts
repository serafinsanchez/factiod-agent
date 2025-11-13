import { NextRequest, NextResponse } from 'next/server';

import { generateTtsAudio } from '@/lib/tts/elevenlabs';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId, modelId } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "text"' },
        { status: 400 },
      );
    }

    const audioBuffer = await generateTtsAudio(text, { voiceId, modelId });

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('TTS generation error', err);
    return NextResponse.json(
      {
        error: 'Failed to generate audio',
        details: err?.message,
      },
      { status: 500 },
    );
  }
}


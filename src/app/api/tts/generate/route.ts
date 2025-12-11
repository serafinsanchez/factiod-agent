import { NextRequest, NextResponse } from "next/server";

import { generateNarrationMultiChunk } from '@/lib/tts/elevenlabsOrchestrator';
import {
  PROJECTS_BUCKET,
  buildProjectAudioPath,
} from "@/lib/projects";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId, modelId, projectSlug } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: 'Missing or invalid "text"' },
        { status: 400 },
      );
    }

    const audioBuffer = await generateNarrationMultiChunk(text, {
      voiceId,
      modelId,
    });
    const audioBytes = new Uint8Array(audioBuffer);

    if (typeof projectSlug === "string" && projectSlug.trim().length > 0) {
      const slug = projectSlug.trim();
      const path = buildProjectAudioPath(slug);

      try {
        const supabase = getSupabaseServerClient();
        const { error: uploadError } = await supabase.storage
          .from(PROJECTS_BUCKET)
          .upload(path, audioBytes, {
            contentType: "audio/mpeg",
            upsert: true,
          });

        if (uploadError) {
          console.error("Supabase audio upload error:", uploadError);
        }
      } catch (storageError) {
        console.error("Supabase configuration/storage error:", storageError);
      }
    } else {
      console.warn(
        "No projectSlug provided to /api/tts/generate; skipping Supabase upload.",
      );
    }

    return new NextResponse(audioBytes, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBytes.byteLength),
        "Cache-Control": "no-store",
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


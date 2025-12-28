import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { generateNarrationMultiChunk } from '@/lib/tts/elevenlabsOrchestrator';
import {
  PROJECTS_BUCKET,
  buildProjectAudioPath,
} from "@/lib/projects";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const requestId = randomUUID().slice(0, 8);

  try {
    const { text, voiceId, modelId, projectSlug } = await req.json();

    // Validate required fields
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: 'Missing or invalid "text"', requestId, stepId: "narrationAudio" },
        { status: 400 },
      );
    }

    // projectSlug is required for persistence (downstream steps depend on stored audio)
    if (typeof projectSlug !== "string" || projectSlug.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Missing or invalid "projectSlug"',
          details: "projectSlug is required so the audio can be persisted for downstream steps (timestamps, video assembly).",
          requestId,
          stepId: "narrationAudio",
        },
        { status: 400 },
      );
    }

    const slug = projectSlug.trim();
    const path = buildProjectAudioPath(slug);

    // Generate audio
    const audioBuffer = await generateNarrationMultiChunk(text, {
      voiceId,
      modelId,
    });
    const audioBytes = new Uint8Array(audioBuffer);

    // Upload to Supabase storage — failure here must fail the entire step
    let uploadError: Error | null = null;
    try {
      const supabase = getSupabaseServerClient();
      const { error } = await supabase.storage
        .from(PROJECTS_BUCKET)
        .upload(path, audioBytes, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (error) {
        uploadError = new Error(error.message || "Supabase upload returned an error");
      }
    } catch (storageError) {
      uploadError = storageError instanceof Error
        ? storageError
        : new Error("Supabase configuration/storage error");
    }

    if (uploadError) {
      console.error("Supabase audio upload error:", uploadError);
      return NextResponse.json(
        {
          error: "Failed to persist audio to storage",
          details: uploadError.message,
          requestId,
          stepId: "narrationAudio",
          context: { path, bucket: PROJECTS_BUCKET },
        },
        { status: 500 },
      );
    }

    // Success: return audio bytes with metadata headers
    return new NextResponse(audioBytes, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBytes.byteLength),
        "Cache-Control": "no-store",
        "X-Audio-Path": path,
        "X-Request-Id": requestId,
      },
    });
  } catch (err: unknown) {
    console.error('TTS generation error', err);
    const details = err instanceof Error ? err.message : undefined;
    return NextResponse.json(
      {
        error: 'Failed to generate audio',
        details,
        requestId,
        stepId: "narrationAudio",
      },
      { status: 500 },
    );
  }
}


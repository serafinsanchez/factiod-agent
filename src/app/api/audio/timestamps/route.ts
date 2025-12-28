/**
 * API Route: Extract Narration Timestamps
 * 
 * POST /api/audio/timestamps
 * 
 * Uses Whisper to transcribe audio and extract word-level timestamps
 * for precise audio-video synchronization in the video assembly pipeline.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  transcribeWithTimestamps,
  isWhisperConfigured,
  type TranscriptionOptions,
} from "@/lib/audio/whisper";
import type { NarrationTimestampsData } from "@/types/agent";

// Allow up to 5 minutes for long audio transcription
export const maxDuration = 300;

interface TimestampsRequest {
  /** URL of the audio file to transcribe */
  audioUrl: string;
  /** Optional language code (auto-detected if not specified) */
  language?: string;
  /** Optional: Whisper model to use ("WHISPER" or "WIZPER") */
  modelId?: "WHISPER" | "WIZPER";
}

interface TimestampsResponse {
  /** The extracted timestamps data */
  timestamps: NarrationTimestampsData;
  /** Processing time in milliseconds */
  durationMs: number;
  /** Request ID for tracing */
  requestId: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
  requestId: string;
  stepId: string;
  context?: Record<string, unknown>;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<TimestampsResponse | ErrorResponse>> {
  const requestId = randomUUID().slice(0, 8);
  const stepId = "narrationTimestamps";

  try {
    // Check if Whisper is configured
    if (!isWhisperConfigured()) {
      return NextResponse.json(
        {
          error: "Whisper transcription is not configured",
          details: "FAL_KEY environment variable is not set",
          requestId,
          stepId,
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = (await request.json()) as TimestampsRequest;

    // Validate audioUrl
    if (!body.audioUrl || typeof body.audioUrl !== "string") {
      return NextResponse.json(
        { 
          error: "audioUrl is required and must be a string",
          requestId,
          stepId,
        },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(body.audioUrl);
    } catch {
      return NextResponse.json(
        { 
          error: "audioUrl must be a valid URL",
          requestId,
          stepId,
          context: { audioUrl: body.audioUrl.substring(0, 100) },
        },
        { status: 400 }
      );
    }

    const startTime = performance.now();

    // Build transcription options
    const options: TranscriptionOptions = {
      task: "transcribe",
    };

    if (body.language) {
      options.language = body.language;
    }

    if (body.modelId && (body.modelId === "WHISPER" || body.modelId === "WIZPER")) {
      options.modelId = body.modelId;
    }

    console.log(`🎤 [${requestId}] Starting timestamp extraction for audio: ${body.audioUrl.substring(0, 80)}...`);

    // Transcribe audio with word-level timestamps
    const timestamps = await transcribeWithTimestamps(body.audioUrl, options);

    const durationMs = performance.now() - startTime;

    console.log(`✅ [${requestId}] Timestamp extraction complete in ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`📊 [${requestId}] Extracted ${timestamps.words.length} words, ${timestamps.segments.length} segments`);
    console.log(`⏱️ [${requestId}] Audio duration: ${timestamps.totalDurationSec.toFixed(2)}s`);

    return NextResponse.json({
      timestamps,
      durationMs,
      requestId,
    });
  } catch (error) {
    console.error(`[${requestId}] Timestamp extraction error:`, error);
    console.error(`[${requestId}] Error stack:`, error instanceof Error ? error.stack : "No stack trace");

    const message = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = error instanceof Error && error.cause ? String(error.cause) : undefined;
    
    return NextResponse.json(
      {
        error: "Failed to extract timestamps",
        details: message,
        requestId,
        stepId,
        ...(errorDetails && { context: { cause: errorDetails } }),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check if Whisper is available
 */
export async function GET(): Promise<NextResponse> {
  const configured = isWhisperConfigured();
  
  return NextResponse.json({
    whisperAvailable: configured,
    message: configured
      ? "Whisper transcription is available"
      : "Whisper is not configured. Set FAL_KEY environment variable.",
  });
}


/**
 * API Route: Generate Video Clips Batch
 * 
 * POST /api/video/generate-batch
 * 
 * Generates multiple video clips from seed images using fal.ai WAN 2.2 model.
 * Supports all WAN 2.2 parameters with batch-level defaults and per-clip overrides.
 * Processes clips with controlled concurrency to avoid rate limiting.
 * 
 * @see https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/api
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateVideoClipsBatch,
  isFalConfigured,
  type VideoModelId,
  type VideoPreset,
  type VideoResolution,
  type VideoAspectRatio,
  type VideoQuality,
  type VideoWriteMode,
  type InterpolatorModel,
  type AccelerationLevel,
  type VideoGenerationInput,
} from "@/lib/video/fal-client";

/**
 * Per-clip input - can override batch defaults
 */
interface BatchClipInput {
  // === Required ===
  sceneNumber: number;
  imageUrl: string;
  prompt: string;

  // === FLF2V ===
  endImageUrl?: string;

  // === Per-clip overrides (optional) ===
  numFrames?: number;
  framesPerSecond?: number;
  negativePrompt?: string;
  seed?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
}

/**
 * Batch request with shared settings and per-clip inputs
 */
interface GenerateBatchRequest {
  /** Array of clips to generate */
  clips: BatchClipInput[];
  
  // === Model & Preset ===
  /** Model selection (default: WAN_2_2) */
  modelId?: VideoModelId;
  /** Preset: "quality", "balanced", or "fast" (applies to all clips) */
  preset?: VideoPreset;
  /** Concurrency level (default: 2) */
  concurrency?: number;

  // === Batch-level defaults (apply to all clips unless overridden) ===
  /** Resolution: "480p", "580p", "720p" (default: "720p") */
  resolution?: VideoResolution;
  /** Aspect ratio: "auto", "16:9", "9:16", "1:1" (default: "auto") */
  aspectRatio?: VideoAspectRatio;
  /** Video quality: "low", "medium", "high", "maximum" (default: "high") */
  videoQuality?: VideoQuality;
  /** Write mode: "fast", "balanced", "small" (default: "balanced") */
  videoWriteMode?: VideoWriteMode;
  /** Interpolation model: "none", "film", "rife" (default: "film") */
  interpolatorModel?: InterpolatorModel;
  /** Frames between each pair (0-4, default: 1) */
  numInterpolatedFrames?: number;
  /** Adjust FPS for interpolation (default: true) */
  adjustFpsForInterpolation?: boolean;
  /** Acceleration: "none", "regular" (default: "regular") */
  acceleration?: AccelerationLevel;
  /** Use LLM to expand prompts (default: false) */
  enablePromptExpansion?: boolean;
}

interface BatchClipResult {
  sceneNumber: number;
  videoUrl?: string;
  seed?: number;
  prompt?: string;
  error?: string;
  status: "success" | "error";
}

interface GenerateBatchResponse {
  results: BatchClipResult[];
  totalGenerated: number;
  totalFailed: number;
  durationMs: number;
}

export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!isFalConfigured()) {
      return NextResponse.json(
        { error: "FAL_KEY environment variable is not configured" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = (await request.json()) as GenerateBatchRequest;

    // Validate required fields
    if (!body.clips || !Array.isArray(body.clips) || body.clips.length === 0) {
      return NextResponse.json(
        { error: "clips array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate each clip
    for (const clip of body.clips) {
      if (!clip.imageUrl || !clip.prompt || typeof clip.sceneNumber !== "number") {
        return NextResponse.json(
          { error: "Each clip must have sceneNumber, imageUrl, and prompt" },
          { status: 400 }
        );
      }
    }

    const startTime = performance.now();

    // Build batch inputs with batch-level defaults and per-clip overrides
    const batchInputs = body.clips.map((clip): VideoGenerationInput & { sceneNumber: number } => ({
      sceneNumber: clip.sceneNumber,
      
      // Required
      imageUrl: clip.imageUrl,
      prompt: clip.prompt,
      
      // FLF2V
      endImageUrl: clip.endImageUrl,
      
      // Per-clip overrides or batch defaults
      numFrames: clip.numFrames,
      framesPerSecond: clip.framesPerSecond,
      negativePrompt: clip.negativePrompt,
      seed: clip.seed,
      numInferenceSteps: clip.numInferenceSteps,
      guidanceScale: clip.guidanceScale,
      
      // Batch-level settings
      resolution: body.resolution,
      aspectRatio: body.aspectRatio,
      videoQuality: body.videoQuality,
      videoWriteMode: body.videoWriteMode,
      interpolatorModel: body.interpolatorModel,
      numInterpolatedFrames: body.numInterpolatedFrames,
      adjustFpsForInterpolation: body.adjustFpsForInterpolation,
      acceleration: body.acceleration,
      enablePromptExpansion: body.enablePromptExpansion,
    }));

    const batchResults = await generateVideoClipsBatch(batchInputs, {
      modelId: body.modelId,
      preset: body.preset,
      concurrency: body.concurrency ?? 2,
      onProgress: (completed, total, sceneNumber) => {
        console.log(`📊 Progress: ${completed}/${total} (Scene ${sceneNumber})`);
      },
    });

    const durationMs = performance.now() - startTime;

    // Format results
    const results: BatchClipResult[] = batchResults.map((r) => {
      if (r.result) {
        return {
          sceneNumber: r.sceneNumber,
          videoUrl: r.result.videoUrl,
          seed: r.result.seed,
          prompt: r.result.prompt,
          status: "success" as const,
        };
      } else {
        return {
          sceneNumber: r.sceneNumber,
          error: r.error,
          status: "error" as const,
        };
      }
    });

    const totalGenerated = results.filter((r) => r.status === "success").length;
    const totalFailed = results.filter((r) => r.status === "error").length;

    const response: GenerateBatchResponse = {
      results,
      totalGenerated,
      totalFailed,
      durationMs,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Batch video generation error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Batch video generation failed: ${message}` },
      { status: 500 }
    );
  }
}


/**
 * API Route: Generate Video Clip
 * 
 * POST /api/video/generate-clip
 * 
 * Generates a single video clip from a seed image using fal.ai WAN 2.2 model.
 * Supports all WAN 2.2 parameters including FLF2V, frame interpolation, and quality settings.
 * 
 * @see https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/api
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateVideoClip,
  isFalConfigured,
  type VideoGenerationInput,
  type VideoModelId,
  type VideoPreset,
  type VideoResolution,
  type VideoAspectRatio,
  type VideoQuality,
  type VideoWriteMode,
  type InterpolatorModel,
  type AccelerationLevel,
} from "@/lib/video/fal-client";

/**
 * Request body for single clip generation
 * Supports all WAN 2.2 API parameters
 */
interface GenerateClipRequest {
  // === Required ===
  /** Scene number for tracking */
  sceneNumber: number;
  /** URL of the seed image (first frame) */
  imageUrl: string;
  /** Motion prompt describing the animation */
  prompt: string;

  // === FLF2V (First-Last-Frame-to-Video) ===
  /** Optional URL of the end image (last frame) for smoother transitions */
  endImageUrl?: string;

  // === Model & Preset ===
  /** Model selection (default: WAN_2_2) */
  modelId?: VideoModelId;
  /** Preset configuration: "quality", "balanced", or "fast" */
  preset?: VideoPreset;

  // === Frame & Duration ===
  /** Number of frames (17-161, default: 81) */
  numFrames?: number;
  /** Frames per second (4-60, default: 16) */
  framesPerSecond?: number;

  // === Quality Settings ===
  /** Resolution: "480p", "580p", "720p" (default: "720p") */
  resolution?: VideoResolution;
  /** Aspect ratio: "auto", "16:9", "9:16", "1:1" (default: "auto") */
  aspectRatio?: VideoAspectRatio;
  /** Video quality: "low", "medium", "high", "maximum" (default: "high") */
  videoQuality?: VideoQuality;
  /** Write mode: "fast", "balanced", "small" (default: "balanced") */
  videoWriteMode?: VideoWriteMode;

  // === Generation Parameters ===
  /** Inference steps (2-40, default: 27) */
  numInferenceSteps?: number;
  /** Guidance scale 1st stage (1-10, default: 3.5) */
  guidanceScale?: number;
  /** Guidance scale 2nd stage (1-10, default: 3.5) */
  guidanceScale2?: number;
  /** Shift value (1-10, default: 5) */
  shift?: number;
  /** Negative prompt */
  negativePrompt?: string;
  /** Random seed for reproducibility */
  seed?: number;

  // === Frame Interpolation ===
  /** Interpolation model: "none", "film", "rife" (default: "film") */
  interpolatorModel?: InterpolatorModel;
  /** Frames between each pair (0-4, default: 1) */
  numInterpolatedFrames?: number;
  /** Adjust FPS for interpolation (default: true) */
  adjustFpsForInterpolation?: boolean;

  // === Performance ===
  /** Acceleration: "none", "regular" (default: "regular") */
  acceleration?: AccelerationLevel;

  // === Enhancement ===
  /** Use LLM to expand prompt (default: false) */
  enablePromptExpansion?: boolean;
}

interface GenerateClipResponse {
  sceneNumber: number;
  videoUrl: string;
  seed: number;
  /** The prompt used (may be expanded if enablePromptExpansion was true) */
  prompt?: string;
  /** Request processing time in ms */
  durationMs?: number;
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
    const body = (await request.json()) as GenerateClipRequest;

    // Validate required fields
    if (!body.imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    if (!body.prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    if (typeof body.sceneNumber !== "number") {
      return NextResponse.json(
        { error: "sceneNumber is required" },
        { status: 400 }
      );
    }

    const startTime = performance.now();

    // Build full input with all WAN 2.2 parameters
    const input: VideoGenerationInput = {
      // Required
      imageUrl: body.imageUrl,
      prompt: body.prompt,
      
      // FLF2V
      endImageUrl: body.endImageUrl,
      
      // Frame & Duration
      numFrames: body.numFrames,
      framesPerSecond: body.framesPerSecond,
      
      // Quality
      resolution: body.resolution,
      aspectRatio: body.aspectRatio,
      videoQuality: body.videoQuality,
      videoWriteMode: body.videoWriteMode,
      
      // Generation
      numInferenceSteps: body.numInferenceSteps,
      guidanceScale: body.guidanceScale,
      guidanceScale2: body.guidanceScale2,
      shift: body.shift,
      negativePrompt: body.negativePrompt,
      seed: body.seed,
      
      // Interpolation
      interpolatorModel: body.interpolatorModel,
      numInterpolatedFrames: body.numInterpolatedFrames,
      adjustFpsForInterpolation: body.adjustFpsForInterpolation,
      
      // Performance
      acceleration: body.acceleration,
      
      // Enhancement
      enablePromptExpansion: body.enablePromptExpansion,
    };

    const result = await generateVideoClip(input, {
      modelId: body.modelId,
      preset: body.preset,
    });

    const durationMs = performance.now() - startTime;

    const response: GenerateClipResponse = {
      sceneNumber: body.sceneNumber,
      videoUrl: result.videoUrl,
      seed: result.seed,
      prompt: result.prompt,
      durationMs,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Video generation error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Video generation failed: ${message}` },
      { status: 500 }
    );
  }
}


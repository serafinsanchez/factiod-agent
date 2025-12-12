/**
 * fal.ai Client Wrapper for Video Generation
 * 
 * Uses the WAN 2.2 image-to-video model to animate seed images into video clips.
 * Supports FLF2V (First-Last-Frame-to-Video) for smoother video transitions.
 * 
 * API Documentation: https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/api
 * Model Playground: https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video
 */

import { fal } from "@fal-ai/client";
import { FAL_WAN_DEFAULT_NEGATIVE_PROMPT } from "@/prompts";

// Configure fal client with API key from environment
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

/**
 * WAN 2.2 Image-to-Video model endpoint (14B parameter model)
 * Generates video clips from seed images with frame interpolation
 * Supports FLF2V (First-Last-Frame-to-Video) via end_image_url parameter
 */
const WAN_I2V_MODEL = "fal-ai/wan/v2.2-a14b/image-to-video";

/**
 * Alternative model endpoints
 */
export const VIDEO_MODELS = {
  WAN_2_2: "fal-ai/wan/v2.2-a14b/image-to-video",
  WAN_2_2_SMALL: "fal-ai/wan/v2.2-1.3b/image-to-video",
  WAN_2_1: "fal-ai/wan/v2.1-1.3b/image-to-video",
  MINIMAX: "fal-ai/minimax-video/image-to-video",
} as const;

export type VideoModelId = keyof typeof VIDEO_MODELS;

/**
 * Resolution options for video generation
 */
export type VideoResolution = "480p" | "580p" | "720p";

/**
 * Aspect ratio options - "auto" determines from input image
 */
export type VideoAspectRatio = "auto" | "16:9" | "9:16" | "1:1";

/**
 * Frame interpolation models for smoother video
 */
export type InterpolatorModel = "none" | "film" | "rife";

/**
 * Video quality options - affects visual quality and file size
 */
export type VideoQuality = "low" | "medium" | "high" | "maximum";

/**
 * Video write mode - trade-off between speed and file size
 */
export type VideoWriteMode = "fast" | "balanced" | "small";

/**
 * Acceleration options - trade-off between speed and quality
 */
export type AccelerationLevel = "none" | "regular";

/**
 * Full input parameters for WAN 2.2 video generation
 * Matches the complete API schema for maximum control
 */
export interface VideoGenerationInput {
  // === Required Parameters ===
  /** URL of the seed image (first frame) to animate */
  imageUrl: string;
  /** Motion prompt describing how the image should be animated */
  prompt: string;

  // === FLF2V (First-Last-Frame-to-Video) ===
  /** Optional URL of the end image (last frame) for smoother transitions */
  endImageUrl?: string;

  // === Frame & Duration Settings ===
  /** Number of frames to generate (17-161, default: 81) */
  numFrames?: number;
  /** Frames per second (4-60, default: 16). With interpolation, final FPS = fps * (interpolatedFrames + 1) */
  framesPerSecond?: number;

  // === Quality Settings ===
  /** Resolution of output video (default: "720p") */
  resolution?: VideoResolution;
  /** Aspect ratio - "auto" determines from input image (default: "auto") */
  aspectRatio?: VideoAspectRatio;
  /** Video quality - higher = better visuals, larger file (default: "high") */
  videoQuality?: VideoQuality;
  /** Write mode - trade-off between speed and file size (default: "balanced") */
  videoWriteMode?: VideoWriteMode;

  // === Generation Parameters ===
  /** Number of inference steps (2-40, default: 27). Higher = better quality, slower */
  numInferenceSteps?: number;
  /** Guidance scale for 1st stage (1-10, default: 3.5). Higher = better prompt adherence */
  guidanceScale?: number;
  /** Guidance scale for 2nd stage (1-10, default: 3.5) */
  guidanceScale2?: number;
  /** Shift value (1-10, default: 5) */
  shift?: number;
  /** Negative prompt to avoid unwanted elements */
  negativePrompt?: string;
  /** Random seed for reproducibility */
  seed?: number;

  // === Frame Interpolation ===
  /** Interpolation model for smoother video (default: "film") */
  interpolatorModel?: InterpolatorModel;
  /** Frames to interpolate between each generated frame (0-4, default: 1) */
  numInterpolatedFrames?: number;
  /** Multiply FPS by (interpolatedFrames + 1) (default: true) */
  adjustFpsForInterpolation?: boolean;

  // === Performance ===
  /** Acceleration level - faster but lower quality (default: "regular") */
  acceleration?: AccelerationLevel;

  // === Enhancement ===
  /** Use LLM to expand prompt with details (default: false) */
  enablePromptExpansion?: boolean;

  // === Safety (usually disabled for creative content) ===
  /** Check input for safety (default: false) */
  enableSafetyChecker?: boolean;
  /** Check output for safety (default: false) */
  enableOutputSafetyChecker?: boolean;
}

/**
 * Preset configuration type
 */
export interface VideoPresetConfig {
  resolution: VideoResolution;
  numInferenceSteps: number;
  videoQuality: VideoQuality;
  interpolatorModel: InterpolatorModel;
  numInterpolatedFrames: number;
  acceleration: AccelerationLevel;
}

/**
 * Preset configurations optimized for PIP Academy kids educational videos
 * 
 * Note on duration:
 * - 81 frames = ~5 sec (short clips)
 * - 121 frames = ~8 sec (standard)  
 * - 161 frames = ~10 sec (max, for longer scenes)
 * 
 * For FLF2V (First-Last-Frame-to-Video) with minimal motion:
 * - Use "smooth" preset for best results with nearly-identical frames
 * - Higher interpolation (2-3 frames) smooths the subtle transitions
 * - Lower guidance_scale (3.0) produces more natural, less forced motion
 */
export const VIDEO_PRESETS: Record<string, VideoPresetConfig> = {
  /** 
   * High quality - for final production renders
   * Best for: Final video assembly, hero scenes
   * ~2x slower but maximum visual quality
   */
  quality: {
    resolution: "720p",
    numInferenceSteps: 35,
    videoQuality: "maximum",
    interpolatorModel: "film",
    numInterpolatedFrames: 3, // Maximum smoothness for "breathing photograph" effect
    acceleration: "none",     // No acceleration = highest quality
  },
  /** 
   * Smooth - RECOMMENDED for FLF2V minimal-motion clips
   * Best for: "Breathing photograph" style with nearly-identical first/last frames
   * Optimized for subtle micro-movements without jumpiness
   */
  smooth: {
    resolution: "720p",
    numInferenceSteps: 30,    // Slightly higher for smoother interpolation
    videoQuality: "high",
    interpolatorModel: "film", // Best for smooth, natural motion
    numInterpolatedFrames: 2,  // Extra interpolation for micro-movements
    acceleration: "none",      // No acceleration = better frame consistency
  },
  /** 
   * Balanced - general purpose production
   * Best for: Standard clips with moderate motion
   * Good quality with reasonable generation time
   */
  balanced: {
    resolution: "720p",
    numInferenceSteps: 27,
    videoQuality: "high",
    interpolatorModel: "film", // Smooth motion for subtle movements
    numInterpolatedFrames: 2,  // Increased from 1 for smoother transitions
    acceleration: "regular",
  },
  /** 
   * Fast - for previews and testing
   * Best for: Quick iterations, testing prompts
   * Lower quality but ~3x faster
   */
  fast: {
    resolution: "480p",
    numInferenceSteps: 20,
    videoQuality: "medium",
    interpolatorModel: "film", // Still use film for reasonable smoothness
    numInterpolatedFrames: 1,  // Minimal interpolation for speed
    acceleration: "regular",
  },
};

export type VideoPreset = "quality" | "smooth" | "balanced" | "fast";

/**
 * Output from video generation
 */
export interface VideoGenerationOutput {
  /** URL of the generated video */
  videoUrl: string;
  /** Seed used for generation */
  seed: number;
  /** The prompt used (may be expanded if enablePromptExpansion was true) */
  prompt?: string;
}

/**
 * Options for the generateVideoClip function
 */
export interface GenerateVideoClipOptions {
  /** Which video model to use (default: WAN_2_2) */
  modelId?: VideoModelId;
  /** Apply a preset configuration (overridden by explicit input values) */
  preset?: VideoPreset;
}

/**
 * Generate a video clip from a seed image using WAN 2.2
 * Supports FLF2V (First-Last-Frame-to-Video) when endImageUrl is provided
 * 
 * @param input - Video generation parameters (see VideoGenerationInput for full options)
 * @param options - Model selection and preset configuration
 * @returns Generated video URL and metadata
 * 
 * @example
 * // Basic usage with defaults
 * const result = await generateVideoClip({
 *   imageUrl: "https://example.com/image.jpg",
 *   prompt: "The character slowly turns their head",
 * });
 * 
 * @example
 * // High quality render with FLF2V
 * const result = await generateVideoClip({
 *   imageUrl: "https://example.com/start.jpg",
 *   endImageUrl: "https://example.com/end.jpg",
 *   prompt: "Smooth transition between poses",
 *   numFrames: 121, // Longer video
 * }, { preset: "quality" });
 */
export async function generateVideoClip(
  input: VideoGenerationInput,
  options: GenerateVideoClipOptions = {}
): Promise<VideoGenerationOutput> {
  const { modelId = "WAN_2_2", preset } = options;
  const model = VIDEO_MODELS[modelId];
  
  // Apply preset defaults if specified
  const presetConfig: Partial<VideoPresetConfig> = preset ? VIDEO_PRESETS[preset] : {};
  
  const useFLF2V = Boolean(input.endImageUrl);
  console.log(`🎬 Generating video with ${modelId}${preset ? ` (${preset} preset)` : ""}${useFLF2V ? " + FLF2V" : ""}...`);
  console.log(`📝 Prompt: ${input.prompt.substring(0, 100)}...`);
  console.log(`🖼️ First frame: ${input.imageUrl.substring(0, 50)}...`);
  if (useFLF2V) {
    console.log(`🖼️ Last frame: ${input.endImageUrl!.substring(0, 50)}...`);
  }

  // Build input object with all WAN 2.2 parameters
  // Priority: explicit input > preset > API defaults
  // Optimized for PIP Academy kids educational content
  const falInput: Record<string, unknown> = {
    // Required
    image_url: input.imageUrl,
    prompt: input.prompt,

    // Frame & Duration
    // 81 frames = ~5 sec, 121 frames = ~8 sec, 161 frames = ~10 sec (with interpolation)
    num_frames: input.numFrames ?? 81,
    frames_per_second: input.framesPerSecond ?? 16,

    // Quality Settings - optimized for YouTube kids content
    resolution: input.resolution ?? presetConfig.resolution ?? "720p",
    aspect_ratio: input.aspectRatio ?? "16:9", // YouTube standard (explicit, not "auto")
    video_quality: input.videoQuality ?? presetConfig.videoQuality ?? "high",
    video_write_mode: input.videoWriteMode ?? "balanced",

    // Generation Parameters - optimized for FLF2V smooth interpolation
    // Lower guidance_scale (3.0) produces more natural, less forced motion
    num_inference_steps: input.numInferenceSteps ?? presetConfig.numInferenceSteps ?? 27,
    guidance_scale: input.guidanceScale ?? 3.0,      // Reduced from 3.5 for smoother motion
    guidance_scale_2: input.guidanceScale2 ?? 3.0,   // Reduced from 3.5 for smoother motion
    shift: input.shift ?? 5,
    // Enhanced negative prompt for kids safety + motion quality
    negative_prompt: input.negativePrompt ?? FAL_WAN_DEFAULT_NEGATIVE_PROMPT,

    // Frame Interpolation - "film" provides smoothest motion for "breathing photograph" style
    // Higher interpolation frames (2) produce smoother transitions for FLF2V
    interpolator_model: input.interpolatorModel ?? presetConfig.interpolatorModel ?? "film",
    num_interpolated_frames: input.numInterpolatedFrames ?? presetConfig.numInterpolatedFrames ?? 2,
    adjust_fps_for_interpolation: input.adjustFpsForInterpolation ?? true,

    // Performance - default to "none" for better frame consistency in FLF2V
    acceleration: input.acceleration ?? presetConfig.acceleration ?? "none",

    // Enhancement - enable for better motion prompts
    enable_prompt_expansion: input.enablePromptExpansion ?? true,

    // Safety - ENABLED for kids educational content (PIP Academy)
    enable_safety_checker: input.enableSafetyChecker ?? true,
    enable_output_safety_checker: input.enableOutputSafetyChecker ?? true,
  };

  // Add seed only if provided (otherwise API generates random)
  if (input.seed !== undefined) {
    falInput.seed = input.seed;
  }

  // Add end_image_url for FLF2V mode if provided
  if (input.endImageUrl) {
    falInput.end_image_url = input.endImageUrl;
  }

  // Log key settings for debugging
  console.log(`⚙️ Settings: ${falInput.resolution}, ${falInput.num_frames} frames @ ${falInput.frames_per_second}fps, ${falInput.num_inference_steps} steps, interpolation: ${falInput.interpolator_model}`);

  // Add timeout to prevent stuck requests (15 minutes max for video generation)
  const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  const startTime = Date.now();
  
  let lastStatusUpdate = Date.now();
  const statusCheckInterval = 30000; // Log status every 30 seconds
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Video generation timeout after ${TIMEOUT_MS / 1000 / 60} minutes. The request may be stuck or taking longer than expected.`));
    }, TIMEOUT_MS);
  });

  const subscribePromise = fal.subscribe(model, {
    input: falInput,
    logs: true,
    onQueueUpdate: (update) => {
      const now = Date.now();
      const elapsed = ((now - startTime) / 1000).toFixed(0);
      
      if (update.status === "IN_PROGRESS") {
        console.log(`⏳ Video generation in progress... (${elapsed}s elapsed)`);
        lastStatusUpdate = now;
      } else if (update.status === "IN_QUEUE") {
        console.log(`📋 Video generation queued... (${elapsed}s elapsed)`);
        lastStatusUpdate = now;
      } else {
        console.log(`📊 Status: ${update.status} (${elapsed}s elapsed)`);
        lastStatusUpdate = now;
      }
    },
  });

  // Race between the subscribe promise and timeout
  const result = await Promise.race([subscribePromise, timeoutPromise]);

  // Extract video URL from result
  const videoData = result.data as {
    video?: { url: string };
    seed?: number;
    prompt?: string;
  };

  if (!videoData?.video?.url) {
    throw new Error("Video generation failed: No video URL in response");
  }

  console.log(`✅ Video generated successfully${useFLF2V ? " (FLF2V)" : ""}`);

  return {
    videoUrl: videoData.video.url,
    seed: videoData.seed ?? input.seed ?? 0,
    prompt: videoData.prompt,
  };
}

/**
 * Batch generation options
 */
export interface BatchGenerationOptions {
  /** Which video model to use (default: WAN_2_2) */
  modelId?: VideoModelId;
  /** Apply a preset configuration to all clips */
  preset?: VideoPreset;
  /** Max concurrent generations (default: 2) */
  concurrency?: number;
  /** Progress callback */
  onProgress?: (completed: number, total: number, sceneNumber: number) => void;
}

/**
 * Result from batch video generation
 */
export interface BatchClipResult {
  sceneNumber: number;
  result?: VideoGenerationOutput;
  error?: string;
}

/**
 * Generate multiple video clips in parallel with rate limiting
 * 
 * @param inputs - Array of video generation inputs with scene numbers
 * @param options - Batch options including model, preset, and concurrency
 * @returns Array of generation results (success or error for each)
 * 
 * @example
 * const results = await generateVideoClipsBatch(
 *   scenes.map((s, i) => ({
 *     sceneNumber: i + 1,
 *     imageUrl: s.imageUrl,
 *     prompt: s.motionPrompt,
 *     endImageUrl: s.endImageUrl, // FLF2V
 *   })),
 *   { preset: "balanced", concurrency: 3 }
 * );
 */
export async function generateVideoClipsBatch(
  inputs: Array<VideoGenerationInput & { sceneNumber: number }>,
  options: BatchGenerationOptions = {}
): Promise<BatchClipResult[]> {
  const { modelId = "WAN_2_2", preset, concurrency = 2, onProgress } = options;
  const results: BatchClipResult[] = [];
  
  console.log(`🎬 Starting batch generation: ${inputs.length} clips, concurrency: ${concurrency}${preset ? `, preset: ${preset}` : ""}`);
  
  // Process in batches to avoid rate limiting
  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (input) => {
        const result = await generateVideoClip(input, { modelId, preset });
        return { sceneNumber: input.sceneNumber, result };
      })
    );

    for (const [index, settledResult] of batchResults.entries()) {
      const sceneNumber = batch[index].sceneNumber;
      
      if (settledResult.status === "fulfilled") {
        results.push(settledResult.value);
      } else {
        results.push({
          sceneNumber,
          error: settledResult.reason?.message || "Unknown error",
        });
      }

      onProgress?.(results.length, inputs.length, sceneNumber);
    }

    // Small delay between batches to avoid rate limiting
    if (i + concurrency < inputs.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const successCount = results.filter(r => r.result).length;
  console.log(`✅ Batch complete: ${successCount}/${inputs.length} succeeded`);

  return results;
}

/**
 * Upload an image to fal.ai storage for use in video generation
 * 
 * @param imageData - Blob image data or image URL
 * @returns Public URL of the uploaded image
 */
export async function uploadImageToFal(
  imageData: string | Blob
): Promise<string> {
  if (typeof imageData === "string") {
    if (imageData.startsWith("http")) {
      // Already a URL, return as-is
      return imageData;
    }
    // Convert base64 to Blob if needed
    if (imageData.startsWith("data:")) {
      const [header, base64] = imageData.split(",");
      const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/png";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const url = await fal.storage.upload(blob);
      return url;
    }
    throw new Error("Invalid image data: expected URL, base64 data URI, or Blob");
  }

  // Upload Blob to fal storage
  const url = await fal.storage.upload(imageData);
  return url;
}

/**
 * Check if the fal.ai API key is configured
 */
export function isFalConfigured(): boolean {
  return Boolean(process.env.FAL_KEY);
}

/**
 * Calculate estimated video duration based on settings
 * 
 * @param numFrames - Number of frames to generate (default: 81)
 * @param framesPerSecond - Base FPS (default: 16)
 * @param numInterpolatedFrames - Interpolated frames between each pair (default: 1)
 * @param adjustFpsForInterpolation - Whether FPS is multiplied by interpolation (default: true)
 * @returns Estimated duration in seconds
 */
export function estimateVideoDuration(
  numFrames: number = 81,
  framesPerSecond: number = 16,
  numInterpolatedFrames: number = 1,
  adjustFpsForInterpolation: boolean = true
): number {
  // Total frames after interpolation
  const totalFrames = numFrames + (numFrames - 1) * numInterpolatedFrames;
  
  // Final FPS (adjusted if interpolation is enabled)
  const finalFps = adjustFpsForInterpolation 
    ? framesPerSecond * (numInterpolatedFrames + 1)
    : framesPerSecond;
  
  return totalFrames / finalFps;
}

/**
 * Get recommended num_frames for a target duration
 * 
 * @param targetSeconds - Desired video duration in seconds
 * @param framesPerSecond - Base FPS (default: 16)
 * @param numInterpolatedFrames - Interpolated frames (default: 1)
 * @returns Recommended num_frames value (clamped to 17-161)
 */
export function getFramesForDuration(
  targetSeconds: number,
  framesPerSecond: number = 16,
  numInterpolatedFrames: number = 1
): number {
  // With interpolation and adjust_fps_for_interpolation=true:
  // final_fps = fps * (interpolated + 1)
  // total_frames = num_frames + (num_frames - 1) * interpolated
  // duration = total_frames / final_fps
  // 
  // Solving for num_frames:
  // duration * final_fps = num_frames + (num_frames - 1) * interpolated
  // duration * fps * (interp + 1) = num_frames * (1 + interp) - interp
  // num_frames = (duration * fps * (interp + 1) + interp) / (1 + interp)
  // num_frames ≈ duration * fps (when interp is small)
  
  const multiplier = numInterpolatedFrames + 1;
  const targetTotalFrames = targetSeconds * framesPerSecond * multiplier;
  const numFrames = Math.round((targetTotalFrames + numInterpolatedFrames) / multiplier);
  
  // Clamp to API limits
  return Math.max(17, Math.min(161, numFrames));
}


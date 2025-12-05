/**
 * FFmpeg Utilities for Video Assembly
 * 
 * Provides utilities for:
 * - Trimming video clips to match audio duration
 * - Concatenating video clips
 * - Mixing audio tracks with video
 * - Assembling final video from clips + audio
 */

import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { VideoAssemblyManifest } from "@/types/agent";

// TODO: Monitor fluent-ffmpeg deprecation status
// npm shows "Package no longer supported" but the package has 2M+ weekly downloads
// and is still maintained on GitHub. Consider migrating to raw FFmpeg commands
// or an alternative library if deprecation becomes a real issue.

/**
 * Configuration for video assembly
 */
export interface AssemblyConfig {
  /** Output video resolution width */
  width?: number;
  /** Output video resolution height */
  height?: number;
  /** Video codec (default: libx264) */
  videoCodec?: string;
  /** Audio codec (default: aac) */
  audioCodec?: string;
  /** Video quality CRF (default: 18, lower = better quality) */
  crf?: number;
  /** Audio bitrate (default: 192k) */
  audioBitrate?: string;
  /** Encoding preset (default: fast) */
  preset?: string;
  /** 
   * Crossfade duration between clips in seconds (default: 0 = no crossfade)
   * Recommended: 0.3-0.5 seconds for smooth transitions without losing content
   * Set to 0 to disable crossfade (simple concatenation)
   */
  crossfadeDurationSec?: number;
}

const DEFAULT_CONFIG: Required<AssemblyConfig> = {
  width: 1920,
  height: 1080,
  videoCodec: "libx264",
  audioCodec: "aac",
  crf: 18,
  audioBitrate: "192k",
  preset: "fast",
  crossfadeDurationSec: 0.3, // Default 0.3s crossfade for smooth transitions
};

/**
 * Get the duration of a media file in seconds
 */
export async function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe media: ${err.message}`));
        return;
      }
      const duration = metadata.format.duration;
      if (typeof duration !== "number") {
        reject(new Error("Could not determine media duration"));
        return;
      }
      resolve(duration);
    });
  });
}

/**
 * Download a file from URL to local path
 */
export async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(buffer));
}

/**
 * Trim a video to a specific duration and optionally add audio
 */
export async function trimVideo(
  inputPath: string,
  outputPath: string,
  duration: number,
  audioPath?: string,
  config: AssemblyConfig = {}
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath)
      .setDuration(duration)
      .videoCodec(cfg.videoCodec)
      .addOption("-crf", String(cfg.crf))
      .addOption("-preset", cfg.preset);

    if (audioPath) {
      command = command
        .input(audioPath)
        .audioCodec(cfg.audioCodec)
        .audioBitrate(cfg.audioBitrate)
        .addOption("-shortest");
    }

    command
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`Trim failed: ${err.message}`)))
      .run();
  });
}

/**
 * Concatenate multiple video files into one (simple concat, no crossfade)
 */
export async function concatenateVideos(
  inputPaths: string[],
  outputPath: string,
  config: AssemblyConfig = {}
): Promise<void> {
  if (inputPaths.length === 0) {
    throw new Error("No input videos provided");
  }

  if (inputPaths.length === 1) {
    // Just copy the single file
    await fs.copyFile(inputPaths[0], outputPath);
    return;
  }

  // Create concat file list
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ffmpeg-concat-"));
  const concatListPath = path.join(tempDir, "concat.txt");

  const concatContent = inputPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await fs.writeFile(concatListPath, concatContent);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-c", "copy"])
      .output(outputPath)
      .on("end", async () => {
        // Cleanup
        try {
          await fs.unlink(concatListPath);
          await fs.rmdir(tempDir);
        } catch {
          // Ignore cleanup errors
        }
        resolve();
      })
      .on("error", (err) => reject(new Error(`Concat failed: ${err.message}`)))
      .run();
  });
}

/**
 * Concatenate videos with crossfade transitions between clips
 * Uses FFmpeg xfade filter for smooth dissolve transitions
 * 
 * @param inputPaths - Array of video file paths to concatenate
 * @param outputPath - Output file path
 * @param crossfadeDuration - Duration of crossfade in seconds (0.3-0.5 recommended)
 * @param config - Assembly configuration
 */
export async function concatenateVideosWithCrossfade(
  inputPaths: string[],
  outputPath: string,
  crossfadeDuration: number = 0.3,
  config: AssemblyConfig = {}
): Promise<void> {
  if (inputPaths.length === 0) {
    throw new Error("No input videos provided");
  }

  if (inputPaths.length === 1) {
    // Just copy the single file
    await fs.copyFile(inputPaths[0], outputPath);
    return;
  }

  // For crossfade, we need to get the duration of each clip
  const clipDurations: number[] = [];
  for (const inputPath of inputPaths) {
    const duration = await getMediaDuration(inputPath);
    clipDurations.push(duration);
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Build the complex filter for xfade transitions
  // Each xfade needs: offset = sum of previous clips - (crossfade * index)
  // This accounts for the overlap created by each crossfade
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    
    // Add all input files
    for (const inputPath of inputPaths) {
      command = command.input(inputPath);
    }

    // Build xfade filter chain
    // For n videos, we need n-1 xfade filters
    const filterParts: string[] = [];
    let lastOutput = "[0:v]";
    let cumulativeDuration = clipDurations[0];
    
    for (let i = 1; i < inputPaths.length; i++) {
      // Calculate offset: when to start the crossfade
      // It's the cumulative duration minus the crossfade duration
      const offset = Math.max(0, cumulativeDuration - crossfadeDuration);
      
      const currentInput = `[${i}:v]`;
      const outputLabel = i === inputPaths.length - 1 ? "[outv]" : `[v${i}]`;
      
      // xfade filter: transition type, duration, and offset
      filterParts.push(
        `${lastOutput}${currentInput}xfade=transition=fade:duration=${crossfadeDuration}:offset=${offset.toFixed(3)}${outputLabel}`
      );
      
      lastOutput = outputLabel;
      // Add current clip duration minus crossfade overlap
      cumulativeDuration = offset + clipDurations[i];
    }

    const complexFilter = filterParts.join(";");

    command
      .complexFilter(complexFilter)
      .outputOptions([
        "-map", "[outv]",
        "-map", "0:a?", // Map audio from first input if available
        "-c:v", cfg.videoCodec,
        "-crf", String(cfg.crf),
        "-preset", cfg.preset,
        "-c:a", cfg.audioCodec,
        "-b:a", cfg.audioBitrate,
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => {
        console.error("Crossfade concat failed, falling back to simple concat:", err.message);
        // Fallback to simple concatenation if crossfade fails
        concatenateVideos(inputPaths, outputPath, config)
          .then(resolve)
          .catch(reject);
      })
      .run();
  });
}

/**
 * Mix audio track with video
 */
export async function mixAudioWithVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  config: AssemblyConfig = {}
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .input(audioPath)
      .audioCodec(cfg.audioCodec)
      .audioBitrate(cfg.audioBitrate)
      .videoCodec("copy") // Don't re-encode video
      .addOption("-map", "0:v") // Video from first input
      .addOption("-map", "1:a") // Audio from second input
      .addOption("-shortest")
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`Mix failed: ${err.message}`)))
      .run();
  });
}

/**
 * Trim audio to a specific time range
 * Used to extract only the portion of narration audio needed for partial videos.
 * 
 * Uses stream copy (-c:a copy) to avoid re-encoding, which is faster and
 * avoids codec/container mismatch issues (e.g., AAC codec to MP3 container).
 * 
 * @param inputPath - Path to the input audio file
 * @param outputPath - Path for the trimmed output audio
 * @param startSec - Start time in seconds
 * @param endSec - End time in seconds
 */
export async function trimAudio(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number
): Promise<void> {
  const duration = endSec - startSec;

  if (duration <= 0) {
    throw new Error(`Invalid audio trim range: ${startSec}s to ${endSec}s`);
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSec)
      .setDuration(duration)
      .audioCodec("copy")  // Stream copy - no re-encoding, preserves original codec
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`Audio trim failed: ${err.message}`)))
      .run();
  });
}

/**
 * Assemble final video from manifest
 * 
 * This is the main function that:
 * 1. Downloads all video clips and audio
 * 2. Trims each clip to match its audio segment
 * 3. Concatenates all clips
 * 4. Trims audio to the relevant segment (for partial video sync)
 * 5. Mixes in the narration audio
 */
export async function assembleVideo(
  manifest: VideoAssemblyManifest,
  config: AssemblyConfig = {},
  onProgress?: (step: string, progress: number) => void
): Promise<string> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-assembly-"));
  
  try {
    const clips = manifest.clips;
    const trimmedPaths: string[] = [];

    // Step 1: Download and process each clip
    onProgress?.("Downloading clips", 0);
    
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const progress = ((i + 1) / clips.length) * 40; // 0-40% for download/trim
      onProgress?.(`Processing clip ${clip.clipNumber}`, progress);

      // Download video clip
      const videoPath = path.join(tempDir, `clip_${clip.clipNumber}_video.mp4`);
      await downloadFile(clip.videoUrl, videoPath);

      // Calculate clip duration from audio segment
      const clipDuration = clip.audioEndSec - clip.audioStartSec;

      // Trim video to match audio duration
      const trimmedPath = path.join(tempDir, `clip_${clip.clipNumber}_trimmed.mp4`);
      await trimVideo(videoPath, trimmedPath, clipDuration, undefined, cfg);

      trimmedPaths.push(trimmedPath);
    }

    // Step 2: Concatenate all trimmed clips (with optional crossfade)
    const useCrossfade = cfg.crossfadeDurationSec > 0;
    onProgress?.(useCrossfade ? "Concatenating clips with crossfade" : "Concatenating clips", 50);
    const concatenatedPath = path.join(tempDir, "concatenated.mp4");
    
    if (useCrossfade) {
      console.log(`🎬 Using ${cfg.crossfadeDurationSec}s crossfade between clips for smooth transitions`);
      await concatenateVideosWithCrossfade(trimmedPaths, concatenatedPath, cfg.crossfadeDurationSec, cfg);
    } else {
      await concatenateVideos(trimmedPaths, concatenatedPath, cfg);
    }

    // Step 3: Download narration audio
    onProgress?.("Downloading audio", 60);
    const audioPath = path.join(tempDir, "narration.mp3");
    await downloadFile(manifest.audioUrl, audioPath);

    // Step 4: Trim audio to relevant segment if offsets are provided (for partial video sync)
    let audioPathForMix = audioPath;
    const hasAudioOffsets = 
      typeof manifest.audioStartOffset === "number" && 
      typeof manifest.audioEndOffset === "number";
    
    if (hasAudioOffsets) {
      onProgress?.("Trimming audio segment", 70);
      const trimmedAudioPath = path.join(tempDir, "narration_trimmed.mp3");
      await trimAudio(
        audioPath, 
        trimmedAudioPath, 
        manifest.audioStartOffset!, 
        manifest.audioEndOffset!
      );
      audioPathForMix = trimmedAudioPath;
      console.log(`🔊 Audio trimmed to ${manifest.audioStartOffset!.toFixed(2)}s - ${manifest.audioEndOffset!.toFixed(2)}s`);
    }

    // Step 5: Mix audio with concatenated video
    onProgress?.("Mixing audio", 80);
    const outputPath = manifest.outputPath || path.join(tempDir, "final.mp4");
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    await mixAudioWithVideo(concatenatedPath, audioPathForMix, outputPath, cfg);

    // Step 6: Get final video info
    onProgress?.("Finalizing", 95);
    const duration = await getMediaDuration(outputPath);
    
    console.log(`✅ Video assembly complete: ${outputPath}`);
    console.log(`📊 Duration: ${duration.toFixed(2)}s`);
    if (hasAudioOffsets) {
      console.log(`📊 Audio segment: ${manifest.audioStartOffset!.toFixed(2)}s - ${manifest.audioEndOffset!.toFixed(2)}s`);
    }

    // Cleanup temp files (keep output)
    onProgress?.("Cleaning up", 100);
    for (const p of trimmedPaths) {
      try { await fs.unlink(p); } catch { /* ignore */ }
    }
    try { 
      await fs.unlink(concatenatedPath);
      await fs.unlink(audioPath);
      if (hasAudioOffsets && audioPathForMix !== audioPath) {
        await fs.unlink(audioPathForMix);
      }
    } catch { /* ignore */ }

    return outputPath;
  } catch (error) {
    // Cleanup on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
    throw error;
  }
}

/**
 * Check if FFmpeg is available on the system
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err) => {
      resolve(!err);
    });
  });
}

/**
 * Get video file information
 */
export async function getVideoInfo(filePath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe video: ${err.message}`));
        return;
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      if (!videoStream) {
        reject(new Error("No video stream found"));
        return;
      }

      resolve({
        duration: metadata.format.duration || 0,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        fps: eval(videoStream.r_frame_rate || "0") || 0,
        codec: videoStream.codec_name || "unknown",
      });
    });
  });
}


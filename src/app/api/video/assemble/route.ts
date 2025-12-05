/**
 * API Route: Assemble Final Video
 * 
 * POST /api/video/assemble
 * 
 * Assembles the final video from video clips and narration audio.
 * Uses FFmpeg to:
 * 1. Trim each video clip to match audio segment duration
 * 2. Concatenate all clips in sequence
 * 3. Mix in the narration audio track
 * 4. Output final 1080p MP4
 */

import { NextRequest, NextResponse } from "next/server";
import {
  assembleVideo,
  checkFfmpegAvailable,
  getVideoInfo,
} from "@/lib/video/ffmpeg";
import type { VideoAssemblyManifest } from "@/types/agent";
import path from "path";
import { promises as fs } from "fs";

interface AssembleRequest {
  /** Assembly manifest with clip information */
  manifest: VideoAssemblyManifest;
  /** Project slug for output path */
  projectSlug?: string;
}

interface AssembleResponse {
  /** Path to the assembled video */
  outputPath: string;
  /** Public URL to access the video */
  videoUrl?: string;
  /** Video duration in seconds */
  durationSec: number;
  /** Video dimensions */
  width: number;
  height: number;
  /** Processing time in milliseconds */
  durationMs: number;
}

export async function POST(request: NextRequest) {
  try {
    // Check FFmpeg availability
    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      return NextResponse.json(
        {
          error: "FFmpeg is not available on this system. Video assembly requires FFmpeg to be installed.",
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = (await request.json()) as AssembleRequest;

    // Validate manifest
    if (!body.manifest) {
      return NextResponse.json(
        { error: "manifest is required" },
        { status: 400 }
      );
    }

    const { manifest } = body;

    if (!manifest.clips || manifest.clips.length === 0) {
      return NextResponse.json(
        { error: "manifest.clips array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!manifest.audioUrl) {
      return NextResponse.json(
        { error: "manifest.audioUrl is required" },
        { status: 400 }
      );
    }

    // Validate each clip
    for (const clip of manifest.clips) {
      if (!clip.videoUrl) {
        return NextResponse.json(
          { error: `Clip ${clip.clipNumber} is missing videoUrl` },
          { status: 400 }
        );
      }
      if (typeof clip.audioStartSec !== "number" || typeof clip.audioEndSec !== "number") {
        return NextResponse.json(
          { error: `Clip ${clip.clipNumber} is missing audio timing information` },
          { status: 400 }
        );
      }
    }

    const startTime = performance.now();

    // Determine output path
    let outputPath = manifest.outputPath;
    if (!outputPath && body.projectSlug) {
      // Create output in public directory for the project
      const publicDir = path.join(process.cwd(), "public", "projects", body.projectSlug);
      await fs.mkdir(publicDir, { recursive: true });
      outputPath = path.join(publicDir, "final-video.mp4");
    } else if (!outputPath) {
      // Create in temp location
      const tempDir = path.join(process.cwd(), "tmp", "videos");
      await fs.mkdir(tempDir, { recursive: true });
      outputPath = path.join(tempDir, `video-${Date.now()}.mp4`);
    }

    // Update manifest with resolved output path
    const resolvedManifest: VideoAssemblyManifest = {
      ...manifest,
      outputPath,
    };

    // Assemble the video
    console.log(`🎬 Starting video assembly with ${manifest.clips.length} clips...`);
    
    const finalPath = await assembleVideo(resolvedManifest, {}, (step, progress) => {
      console.log(`📊 [${progress.toFixed(0)}%] ${step}`);
    });

    // Get video info
    const videoInfo = await getVideoInfo(finalPath);

    const durationMs = performance.now() - startTime;

    // Generate public URL if in public directory
    let videoUrl: string | undefined;
    if (finalPath.includes("/public/")) {
      videoUrl = finalPath.replace(/.*\/public/, "");
    }

    const response: AssembleResponse = {
      outputPath: finalPath,
      videoUrl,
      durationSec: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height,
      durationMs,
    };

    console.log(`✅ Video assembly complete in ${(durationMs / 1000).toFixed(1)}s`);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Video assembly error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Video assembly failed: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check FFmpeg availability
 */
export async function GET() {
  try {
    const available = await checkFfmpegAvailable();
    return NextResponse.json({
      ffmpegAvailable: available,
      message: available
        ? "FFmpeg is available and ready for video assembly"
        : "FFmpeg is not installed. Please install FFmpeg to use video assembly features.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check FFmpeg availability" },
      { status: 500 }
    );
  }
}


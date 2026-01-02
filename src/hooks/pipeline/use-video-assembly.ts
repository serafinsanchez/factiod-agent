"use client";

import { useCallback, useState } from "react";
import type { PipelineState } from "@/types/agent";
import { getOrCreateProjectSlug, getServerAudioUrl } from "@/lib/projects";
import { classifyError } from "@/lib/pipeline/error-classifier";
import { ensureStepState } from "./pipeline-types";

type UseVideoAssemblyOptions = {
  pipeline: PipelineState;
  scriptAudioUrl: string | null;
  setPipeline: React.Dispatch<React.SetStateAction<PipelineState>>;
  queueAutoSave: () => void;
};

export function useVideoAssembly({
  pipeline,
  scriptAudioUrl,
  setPipeline,
  queueAutoSave,
}: UseVideoAssemblyOptions) {
  const [isAssemblingVideo, setIsAssemblingVideo] = useState(false);
  const [videoAssemblyProgress, setVideoAssemblyProgress] = useState<string | null>(null);
  const [videoAssemblyError, setVideoAssemblyError] = useState<string | null>(null);

  const assembleVideo = useCallback(async (filename?: string) => {
    const sceneAssets = pipeline.sceneAssets;
    if (!sceneAssets || sceneAssets.length === 0) {
      setVideoAssemblyError("No scene assets available for assembly.");
      return;
    }

    const scenesWithVideo = sceneAssets.filter((s) => s.videoUrl);
    if (scenesWithVideo.length === 0) {
      setVideoAssemblyError("No video clips available. Generate scene videos first.");
      return;
    }

    // Derive server-reachable audio URL from pipeline.audioPath (never use blob: for backend)
    const audioUrlForServer = getServerAudioUrl(pipeline.audioPath);

    if (!audioUrlForServer) {
      setVideoAssemblyError(
        "Narration audio is not persisted yet. Regenerate audio or reload the project."
      );
      return;
    }

    setIsAssemblingVideo(true);
    setVideoAssemblyError(null);
    setVideoAssemblyProgress("Preparing assembly...");

    setPipeline((prev) => ({
      ...prev,
      videoAssemblyStatus: "assembling",
      finalVideoPath: undefined,
      steps: {
        ...prev.steps,
        videoAssembly: {
          ...ensureStepState(prev.steps, "videoAssembly"),
          status: "running" as const,
          errorMessage: undefined,
        },
      },
    }));

    const projectSlug = getOrCreateProjectSlug(pipeline.projectSlug, pipeline.topic);
    const outputFilename = filename || "final-video";

    // Get scene timestamps for precise audio timing
    const sceneTimestamps = pipeline.narrationTimestamps?.sceneTimestamps || [];
    const productionScript = pipeline.productionScript;

    const totalScenes = scenesWithVideo.length;
    const narrationDuration =
      pipeline.narrationTimestamps?.totalDurationSec ||
      productionScript?.totalEstimatedDurationSec ||
      totalScenes * 8;
    const avgClipDuration = narrationDuration / totalScenes;

    // Build clips with exact audio timing for perfect sync
    let cumulativeTime = 0;
    const clips = scenesWithVideo.map((scene) => {
      let audioStartSec: number;
      let audioEndSec: number;
      let timingSource: string;
      
      // Priority 1: Use exact timing stored in scene asset
      if (
        typeof scene.audioStartSec === "number" && 
        typeof scene.audioEndSec === "number" &&
        scene.audioEndSec > scene.audioStartSec
      ) {
        audioStartSec = scene.audioStartSec;
        audioEndSec = scene.audioEndSec;
        timingSource = "sceneAsset";
      } 
      // Priority 2: Use sceneTimestamps
      else {
        const sceneTs = sceneTimestamps.find((st) => st.sceneNumber === scene.sceneNumber);
        if (sceneTs && sceneTs.endSec > sceneTs.startSec) {
          audioStartSec = sceneTs.startSec;
          audioEndSec = sceneTs.endSec;
          timingSource = "sceneTimestamps";
        }
        // Priority 3: Fall back to cumulative timing
        else {
          const clipDuration = Math.max(scene.targetDurationSec || avgClipDuration, 2);
          audioStartSec = cumulativeTime;
          audioEndSec = cumulativeTime + clipDuration;
          timingSource = "cumulative";
        }
      }
      
      cumulativeTime = audioEndSec;
      
      return {
        clipNumber: scene.sceneNumber,
        videoUrl: scene.videoUrl!,
        audioStartSec,
        audioEndSec,
        _timingSource: timingSource,
      };
    });
    
    // Sort clips by audioStartSec to ensure proper ordering
    clips.sort((a, b) => {
      if (a.audioStartSec !== b.audioStartSec) {
        return a.audioStartSec - b.audioStartSec;
      }
      return a.clipNumber - b.clipNumber;
    });

    // Validate and fix timing: ensure monotonic, contiguous timings
    let timingWarnings: string[] = [];
    let previousEnd = 0;
    
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      
      // Check for overlap with previous clip
      if (clip.audioStartSec < previousEnd - 0.1) {
        timingWarnings.push(
          `Clip ${clip.clipNumber} overlaps with previous (starts at ${clip.audioStartSec.toFixed(2)}s, prev ends at ${previousEnd.toFixed(2)}s)`
        );
        // Fix: shift this clip to start at previous end
        const duration = clip.audioEndSec - clip.audioStartSec;
        clip.audioStartSec = previousEnd;
        clip.audioEndSec = previousEnd + duration;
        clip._timingSource = `${clip._timingSource}-fixed`;
      }
      
      // Check for large gap (>2s) from previous clip
      const gap = clip.audioStartSec - previousEnd;
      if (gap > 2 && previousEnd > 0) {
        timingWarnings.push(
          `Large gap (${gap.toFixed(2)}s) before clip ${clip.clipNumber}`
        );
      }
      
      // Check for invalid duration
      if (clip.audioEndSec <= clip.audioStartSec) {
        timingWarnings.push(
          `Clip ${clip.clipNumber} has invalid duration (${clip.audioStartSec.toFixed(2)}s - ${clip.audioEndSec.toFixed(2)}s)`
        );
        // Fix: give it a minimum 3s duration
        clip.audioEndSec = clip.audioStartSec + 3;
        clip._timingSource = `${clip._timingSource}-fixed`;
      }
      
      previousEnd = clip.audioEndSec;
    }

    // Log warnings if any timing issues were detected
    if (timingWarnings.length > 0) {
      console.warn(`⚠️ Clip timing issues detected and auto-fixed:`);
      timingWarnings.forEach((w) => console.warn(`   ${w}`));
    }

    // Log timing breakdown
    console.log(`📊 Clip timing breakdown:`);
    clips.forEach((clip) => {
      const duration = clip.audioEndSec - clip.audioStartSec;
      console.log(
        `   Clip ${clip.clipNumber}: ${clip.audioStartSec.toFixed(2)}s - ${clip.audioEndSec.toFixed(2)}s ` +
        `(${duration.toFixed(2)}s, source: ${clip._timingSource})`
      );
    });

    try {
      setVideoAssemblyProgress("Assembling video clips...");

      const audioStartOffset = clips.length > 0 ? clips[0].audioStartSec : 0;
      const audioEndOffset = clips.length > 0 ? clips[clips.length - 1].audioEndSec : 0;

      console.log(`🎬 Assembling ${clips.length} clips with audio range: ${audioStartOffset.toFixed(2)}s - ${audioEndOffset.toFixed(2)}s`);

      // Add timeout wrapper (15 minutes max for video assembly)
      const ASSEMBLY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ASSEMBLY_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch("/api/video/assemble", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manifest: {
              clips,
              audioUrl: audioUrlForServer,
              outputPath: `public/projects/${projectSlug}/${outputFilename}.mp4`,
              audioStartOffset,
              audioEndOffset,
            },
            projectSlug,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          throw new Error("Video assembly timed out after 15 minutes. The operation may still be processing on the server.");
        }
        throw fetchError;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }));
        throw new Error(data.error || "Failed to assemble video");
      }

      const data = await res.json();

      setVideoAssemblyProgress("Complete!");

      setPipeline((prev) => ({
        ...prev,
        finalVideoPath: data.outputPath,
        videoAssemblyStatus: "complete",
        steps: {
          ...prev.steps,
          videoAssembly: {
            ...ensureStepState(prev.steps, "videoAssembly"),
            status: "success" as const,
            responseText: data.videoUrl || data.outputPath,
            errorMessage: undefined,
          },
        },
      }));

      queueAutoSave();
    } catch (error) {
      const pipelineError = classifyError(
        error instanceof Error ? error : String(error),
        "videoAssembly"
      );
      const message = `${pipelineError.message}${pipelineError.guidance ? ` ${pipelineError.guidance}` : ""}`;
      setVideoAssemblyError(message);
      setPipeline((prev) => ({
        ...prev,
        videoAssemblyStatus: "error",
        steps: {
          ...prev.steps,
          videoAssembly: {
            ...ensureStepState(prev.steps, "videoAssembly"),
            status: "error" as const,
            errorMessage: message,
          },
        },
      }));
    } finally {
      setIsAssemblingVideo(false);
      setVideoAssemblyProgress(null);
    }
  }, [pipeline, setPipeline, queueAutoSave]);

  const resetAssemblyState = useCallback(() => {
    setIsAssemblingVideo(false);
    setVideoAssemblyProgress(null);
    setVideoAssemblyError(null);
    setPipeline((prev) => ({
      ...prev,
      videoAssemblyStatus: "idle",
      steps: {
        ...prev.steps,
        videoAssembly: {
          ...ensureStepState(prev.steps, "videoAssembly"),
          status: "idle" as const,
          errorMessage: undefined,
        },
      },
    }));
  }, [setPipeline]);

  return {
    // State
    isAssemblingVideo,
    videoAssemblyProgress,
    videoAssemblyError,
    // Setters
    setVideoAssemblyError,
    // Actions
    assembleVideo,
    resetAssemblyState,
  };
}

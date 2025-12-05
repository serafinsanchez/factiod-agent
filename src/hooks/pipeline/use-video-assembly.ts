"use client";

import { useCallback, useState } from "react";
import type { PipelineState } from "@/types/agent";
import { getOrCreateProjectSlug } from "@/lib/projects";
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

    if (!scriptAudioUrl) {
      setVideoAssemblyError("No narration audio available. Generate audio first.");
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
              audioUrl: scriptAudioUrl,
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
      const message = error instanceof Error ? error.message : "Failed to assemble video.";
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
  }, [pipeline, scriptAudioUrl, setPipeline, queueAutoSave]);

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

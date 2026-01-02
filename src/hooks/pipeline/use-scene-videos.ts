"use client";

import { useCallback, useState } from "react";
import type { PipelineState, VideoFrameMode } from "@/types/agent";
import { getFramesForDuration } from "@/lib/video/fal-client";
import { classifyError } from "@/lib/pipeline/error-classifier";
import { type ProgressState, ensureStepState } from "./pipeline-types";

type UseSceneVideosOptions = {
  pipeline: PipelineState;
  setPipeline: React.Dispatch<React.SetStateAction<PipelineState>>;
  queueAutoSave: () => void;
};

export function useSceneVideos({
  pipeline,
  setPipeline,
  queueAutoSave,
}: UseSceneVideosOptions) {
  const [isGeneratingSceneVideos, setIsGeneratingSceneVideos] = useState(false);
  const [sceneVideosProgress, setSceneVideosProgress] = useState<ProgressState>(null);
  const [sceneVideosError, setSceneVideosError] = useState<string | null>(null);

  const generateSceneVideos = useCallback(async () => {
    const sceneAssets = pipeline.sceneAssets;
    if (!sceneAssets || sceneAssets.length === 0) {
      setSceneVideosError("Run previous steps first to generate scene assets.");
      return;
    }

    const scenesReady = sceneAssets.filter((s) => s.imageUrl && s.videoPrompt);
    if (scenesReady.length === 0) {
      setSceneVideosError("No scenes ready for video generation. Ensure images and video prompts are generated.");
      return;
    }

    const previewLimit =
      typeof pipeline.scenePreviewLimit === "number" && pipeline.scenePreviewLimit > 0
        ? pipeline.scenePreviewLimit
        : null;
    const scenesToGenerate = previewLimit ? scenesReady.slice(0, previewLimit) : scenesReady;

    if (scenesToGenerate.length === 0) {
      setSceneVideosError(
        "Preview limit filtered out all scenes. Increase or clear the limit to continue.",
      );
      return;
    }

    // Get scene timestamps from narration
    const sceneTimestamps = pipeline.narrationTimestamps?.sceneTimestamps || [];
    const productionScenes = pipeline.productionScript?.scenes || [];

    // Check video frame mode
    const frameMode: VideoFrameMode = pipeline.videoFrameMode || 'flf2v';
    const isFirstFrameOnly = frameMode === 'first-frame-only';

    // Log frame mode and FLF2V status
    console.log(`🎬 Video Frame Mode: ${frameMode}`);
    if (!isFirstFrameOnly) {
      const flf2vScenes = scenesToGenerate.filter((s) => s.lastFrameImageUrl);
      console.log(`🎬 FLF2V enabled for ${flf2vScenes.length}/${scenesToGenerate.length} scenes`);
    } else {
      console.log(`🎬 First-frame-only mode: skipping endImageUrl for all scenes`);
    }

    setIsGeneratingSceneVideos(true);
    setSceneVideosError(null);
    setSceneVideosProgress({ completed: 0, total: scenesToGenerate.length });

    setPipeline((prev) => ({
      ...prev,
      steps: {
        ...prev.steps,
        sceneVideos: {
          ...ensureStepState(prev.steps, "sceneVideos"),
          status: "running" as const,
          errorMessage: undefined,
        },
      },
    }));

    const updatedAssets = [...(pipeline.sceneAssets || [])];

    // Reset targeted scenes so new clips replace any previous videos
    const scenesToGenerateSet = new Set(scenesToGenerate.map((s) => s.sceneNumber));
    for (let i = 0; i < updatedAssets.length; i++) {
      const asset = updatedAssets[i];
      if (!scenesToGenerateSet.has(asset.sceneNumber)) continue;
      updatedAssets[i] = {
        ...asset,
        videoUrl: undefined,
        targetDurationSec: undefined,
        generatedNumFrames: undefined,
        audioStartSec: undefined,
        audioEndSec: undefined,
        status: "pending" as const,
        errorMessage: undefined,
      };
    }

    // Push reset state to pipeline immediately so clip previews show as pending/cleared
    setPipeline((prev) => ({
      ...prev,
      sceneAssets: updatedAssets,
    }));

    try {
      // Process in batches of 2 to avoid rate limiting
      const batchSize = 2;
      for (let i = 0; i < scenesToGenerate.length; i += batchSize) {
        const batch = scenesToGenerate.slice(i, i + batchSize);

        const batchResults = await Promise.allSettled(
          batch.map(async (scene) => {
            const sceneTimestamp = sceneTimestamps.find(
              (st) => st.sceneNumber === scene.sceneNumber
            );
            const productionScene = productionScenes.find(
              (ps) => ps.sceneNumber === scene.sceneNumber
            );

            const MINIMUM_CLIP_DURATION = 3;
            const DEFAULT_CLIP_DURATION = 5;
            
            let numFrames: number;
            let targetDuration: number;
            let audioStartSec: number | undefined;
            let audioEndSec: number | undefined;
            let durationSource: string;

            // Priority 1: Use pre-calculated values from sceneTimestamps
            if (sceneTimestamp && sceneTimestamp.numFrames >= 17) {
              numFrames = sceneTimestamp.numFrames;
              targetDuration = sceneTimestamp.endSec - sceneTimestamp.startSec;
              audioStartSec = sceneTimestamp.startSec;
              audioEndSec = sceneTimestamp.endSec;
              durationSource = "sceneTimestamps";
            } else {
              targetDuration = DEFAULT_CLIP_DURATION;
              durationSource = "default";
              
              if (
                productionScene?.startSec !== undefined && 
                productionScene?.endSec !== undefined &&
                productionScene.endSec > productionScene.startSec
              ) {
                const timestampDuration = productionScene.endSec - productionScene.startSec;
                if (timestampDuration >= MINIMUM_CLIP_DURATION) {
                  targetDuration = timestampDuration;
                  audioStartSec = productionScene.startSec;
                  audioEndSec = productionScene.endSec;
                  durationSource = "productionScript";
                }
              }
              
              if (durationSource === "default" && productionScene?.estimatedDurationSec) {
                if (productionScene.estimatedDurationSec >= MINIMUM_CLIP_DURATION) {
                  targetDuration = productionScene.estimatedDurationSec;
                  durationSource = "estimated";
                }
              }
              
              if (targetDuration < MINIMUM_CLIP_DURATION) {
                targetDuration = MINIMUM_CLIP_DURATION;
              }

              numFrames = getFramesForDuration(targetDuration);
            }

            const requestBody: Record<string, unknown> = {
              sceneNumber: scene.sceneNumber,
              imageUrl: scene.imageUrl,
              prompt: scene.videoPrompt,
              numFrames,
            };

            // Only include endImageUrl in FLF2V mode
            if (!isFirstFrameOnly && scene.lastFrameImageUrl) {
              requestBody.endImageUrl = scene.lastFrameImageUrl;
              console.log(`🖼️ Scene ${scene.sceneNumber}: Using FLF2V with last frame`);
            } else if (isFirstFrameOnly) {
              console.log(`🖼️ Scene ${scene.sceneNumber}: First-frame-only mode (no endImageUrl)`);
            }

            console.log(
              `🎬 Scene ${scene.sceneNumber}: ${targetDuration.toFixed(2)}s → ${numFrames} frames (source: ${durationSource})`
            );

            const res = await fetch("/api/video/generate-clip", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            });

            if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || `Failed to generate video for scene ${scene.sceneNumber}`);
            }

            const result = await res.json();
            return {
              ...result,
              _timing: { targetDuration, numFrames, audioStartSec, audioEndSec },
            };
          }),
        );

        for (let j = 0; j < batch.length; j++) {
          const scene = batch[j];
          const result = batchResults[j];
          const assetIndex = updatedAssets.findIndex((a) => a.sceneNumber === scene.sceneNumber);

          if (result.status === "fulfilled") {
            const timing = result.value._timing as {
              targetDuration: number;
              numFrames: number;
              audioStartSec?: number;
              audioEndSec?: number;
            };
            
            if (assetIndex !== -1) {
              updatedAssets[assetIndex] = {
                ...updatedAssets[assetIndex],
                videoUrl: result.value.videoUrl,
                targetDurationSec: timing.targetDuration,
                generatedNumFrames: timing.numFrames,
                audioStartSec: timing.audioStartSec,
                audioEndSec: timing.audioEndSec,
                status: "complete" as const,
              };
            }
          } else {
            const sceneTimestamp = sceneTimestamps.find(
              (st) => st.sceneNumber === scene.sceneNumber
            );
            const productionScene = productionScenes.find(
              (ps) => ps.sceneNumber === scene.sceneNumber
            );
            
            let targetDuration = 5;
            let numFrames = 81;
            let audioStartSec: number | undefined;
            let audioEndSec: number | undefined;
            
            if (
              sceneTimestamp && 
              sceneTimestamp.numFrames >= 17 &&
              sceneTimestamp.startSec !== undefined &&
              sceneTimestamp.endSec !== undefined &&
              sceneTimestamp.endSec > sceneTimestamp.startSec
            ) {
              numFrames = sceneTimestamp.numFrames;
              targetDuration = sceneTimestamp.endSec - sceneTimestamp.startSec;
              audioStartSec = sceneTimestamp.startSec;
              audioEndSec = sceneTimestamp.endSec;
            } else if (
              productionScene?.startSec !== undefined &&
              productionScene?.endSec !== undefined &&
              productionScene.endSec > productionScene.startSec
            ) {
              targetDuration = productionScene.endSec - productionScene.startSec;
              audioStartSec = productionScene.startSec;
              audioEndSec = productionScene.endSec;
              numFrames = getFramesForDuration(targetDuration);
            }
            
            if (assetIndex !== -1) {
              updatedAssets[assetIndex] = {
                ...updatedAssets[assetIndex],
                targetDurationSec: targetDuration,
                generatedNumFrames: numFrames,
                audioStartSec,
                audioEndSec,
                status: "error" as const,
                errorMessage: result.reason?.message || "Unknown error",
              };
            }
          }
        }

        const successfullyGenerated = updatedAssets.filter(
          (asset) => asset.videoUrl && asset.status === "complete"
        ).length;
        setSceneVideosProgress({
          completed: successfullyGenerated,
          total: scenesToGenerate.length,
        });

        if (i + batchSize < scenesToGenerate.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const successfullyGenerated = updatedAssets.filter(
        (asset) => asset.videoUrl && asset.status === "complete"
      ).length;
      const expectedCount = scenesToGenerate.length;
      const allSucceeded = successfullyGenerated === expectedCount;

      if (allSucceeded) {
        console.log(`✅ All ${expectedCount} videos generated successfully`);
        setPipeline((prev) => ({
          ...prev,
          sceneAssets: updatedAssets,
          steps: {
            ...prev.steps,
            sceneVideos: {
              ...ensureStepState(prev.steps, "sceneVideos"),
              status: "success" as const,
              errorMessage: undefined,
            },
          },
        }));
      } else {
        const actualFailedCount = expectedCount - successfullyGenerated;
        const errorMessage = `Only ${successfullyGenerated} of ${expectedCount} videos generated successfully. ${actualFailedCount} video(s) failed.`;
        console.error(`❌ Video generation incomplete: ${errorMessage}`);
        
        setSceneVideosError(errorMessage);
        setPipeline((prev) => ({
          ...prev,
          sceneAssets: updatedAssets,
          steps: {
            ...prev.steps,
            sceneVideos: {
              ...ensureStepState(prev.steps, "sceneVideos"),
              status: "error" as const,
              errorMessage,
            },
          },
        }));
      }

      queueAutoSave();
    } catch (error) {
      const pipelineError = classifyError(
        error instanceof Error ? error : String(error),
        "sceneVideos"
      );
      const message = `${pipelineError.message}${pipelineError.guidance ? ` ${pipelineError.guidance}` : ""}`;
      setSceneVideosError(message);
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          sceneVideos: {
            ...ensureStepState(prev.steps, "sceneVideos"),
            status: "error" as const,
            errorMessage: message,
          },
        },
      }));
    } finally {
      setIsGeneratingSceneVideos(false);
    }
  }, [pipeline, setPipeline, queueAutoSave]);

  return {
    // State
    isGeneratingSceneVideos,
    sceneVideosProgress,
    sceneVideosError,
    // Setters
    setSceneVideosError,
    // Actions
    generateSceneVideos,
  };
}

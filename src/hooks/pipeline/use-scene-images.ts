"use client";

import { useCallback, useState } from "react";
import type { PipelineState, SceneAsset, VideoFrameMode } from "@/types/agent";
import { getOrCreateProjectSlug, getPublicProjectFileUrl } from "@/lib/projects";
import { slugifyTopic } from "@/lib/slug";
import { styleRequiresCharacterReference } from "@/lib/agent/visual-styles";
import { type ProgressState, ensureStepState } from "./pipeline-types";

type UseSceneImagesOptions = {
  pipeline: PipelineState;
  pipelineRef: React.MutableRefObject<PipelineState>;
  setPipeline: React.Dispatch<React.SetStateAction<PipelineState>>;
  queueAutoSave: () => void;
};

export function useSceneImages({
  pipeline,
  pipelineRef,
  setPipeline,
  queueAutoSave,
}: UseSceneImagesOptions) {
  const [isGeneratingSceneImages, setIsGeneratingSceneImages] = useState(false);
  const [sceneImagesProgress, setSceneImagesProgress] = useState<ProgressState>(null);
  const [sceneImagesError, setSceneImagesError] = useState<string | null>(null);

  const generateSceneImages = useCallback(async () => {
    const sceneAssets = pipeline.sceneAssets;
    if (!sceneAssets || sceneAssets.length === 0) {
      setSceneImagesError("Run scene image prompts step first to generate prompts.");
      return;
    }

    const scenesWithPrompts = sceneAssets.filter((s) => s.imagePrompt);
    if (scenesWithPrompts.length === 0) {
      setSceneImagesError("No image prompts available. Run the image prompts step first.");
      return;
    }

    const previewLimit =
      typeof pipeline.scenePreviewLimit === "number" && pipeline.scenePreviewLimit > 0
        ? pipeline.scenePreviewLimit
        : null;
    const scenesToGenerate = previewLimit
      ? scenesWithPrompts.slice(0, previewLimit)
      : scenesWithPrompts;

    if (scenesToGenerate.length === 0) {
      setSceneImagesError(
        "Preview limit filtered out all scenes. Increase or clear the limit to continue.",
      );
      return;
    }

    // Check video frame mode - in 'first-frame-only' mode, we skip last frame generation
    const frameMode: VideoFrameMode = pipeline.videoFrameMode || 'flf2v';
    const isFirstFrameOnly = frameMode === 'first-frame-only';

    // Count total images to generate (first frame + last frame for FLF2V scenes only if in FLF2V mode)
    const scenesWithLastFrame = isFirstFrameOnly 
      ? [] 
      : scenesToGenerate.filter((s) => s.lastFrameImagePrompt);
    const totalImages = scenesToGenerate.length + scenesWithLastFrame.length;

    // DEBUG: Log scene data
    console.log("🎬 Scene Image Generation Debug:");
    console.log("  Video Frame Mode:", frameMode);
    console.log("  Total scenes to generate:", scenesToGenerate.length);
    console.log("  Scenes with lastFramePrompt:", isFirstFrameOnly ? "N/A (first-frame-only mode)" : scenesWithLastFrame.length);
    console.log("  Total images to generate:", totalImages);

    // Reset targeted scenes so new renders replace any prior images (including history)
    const scenesToGenerateSet = new Set(scenesToGenerate.map((s) => s.sceneNumber));
    setPipeline((prev) => {
      if (!prev.sceneAssets) return prev;
      const nextAssets = prev.sceneAssets.map((asset) => {
        if (!scenesToGenerateSet.has(asset.sceneNumber)) return asset;
        return {
          ...asset,
          imageUrl: undefined,
          lastFrameImageUrl: undefined,
          status: "pending" as const,
          errorMessage: undefined,
        };
      });
      return { ...prev, sceneAssets: nextAssets };
    });

    setIsGeneratingSceneImages(true);
    setSceneImagesError(null);
    setSceneImagesProgress({ completed: 0, total: totalImages });

    setPipeline((prev) => ({
      ...prev,
      steps: {
        ...prev.steps,
        sceneImages: {
          ...ensureStepState(prev.steps, "sceneImages"),
          status: "running" as const,
          errorMessage: undefined,
        },
      },
    }));

    const projectSlug = getOrCreateProjectSlug(pipeline.projectSlug, pipeline.topic);
    let completedImages = 0;

    try {
      for (let i = 0; i < scenesToGenerate.length; i++) {
        const scene = scenesToGenerate[i];
        // In first-frame-only mode, always skip last frame even if prompt exists
        const hasLastFrame = !isFirstFrameOnly && Boolean(scene.lastFrameImagePrompt);
        
        setSceneImagesProgress({ completed: completedImages, total: totalImages });

        try {
          const currentStyleId = pipelineRef.current.visualStyleId;
          const shouldUseReferenceImage = styleRequiresCharacterReference(currentStyleId);
          const referenceImage =
            shouldUseReferenceImage && typeof pipelineRef.current.characterReferenceImage === "string"
              ? pipelineRef.current.characterReferenceImage
              : undefined;
          
          // Generate FIRST FRAME image
          const firstFrameRes = await fetch("/api/gemini/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: scene.imagePrompt,
              projectSlug,
              thumbnailPath: `projects/${projectSlug}/scene-${scene.sceneNumber}-first.png`,
              skipTextOverlay: true,
              referenceImage,
              styleId: currentStyleId,
            }),
          });

          if (!firstFrameRes.ok) {
            const data = await firstFrameRes.json();
            throw new Error(data.error || `Failed to generate first frame for scene ${scene.sceneNumber}`);
          }

          const firstFrameData = await firstFrameRes.json();
          const firstFrameBaseUrl = firstFrameData.thumbnailUrl || (firstFrameData.thumbnailPath ? getPublicProjectFileUrl(firstFrameData.thumbnailPath) : undefined);
          const firstFrameImageUrl = firstFrameBaseUrl
            ? `${firstFrameBaseUrl}${firstFrameBaseUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
            : undefined;

          completedImages++;
          setSceneImagesProgress({ completed: completedImages, total: totalImages });

          // Update pipeline state with first frame
          setPipeline((prev) => {
            const prevAssets = prev.sceneAssets || [];
            const prevAssetIndex = prevAssets.findIndex((a) => a.sceneNumber === scene.sceneNumber);
            if (prevAssetIndex !== -1 && firstFrameImageUrl) {
              const newAssets = [...prevAssets];
              newAssets[prevAssetIndex] = {
                ...newAssets[prevAssetIndex],
                imageUrl: firstFrameImageUrl,
                status: hasLastFrame ? "generating" : "complete" as const,
              };
              return {
                ...prev,
                sceneAssets: newAssets,
                projectSlug,
              };
            }
            return prev;
          });

          // Generate LAST FRAME image if FLF2V prompt is available
          let lastFrameImageUrl: string | undefined;
          if (hasLastFrame && scene.lastFrameImagePrompt) {
            const lastFrameRes = await fetch("/api/gemini/generate-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: scene.lastFrameImagePrompt,
                projectSlug,
                thumbnailPath: `projects/${projectSlug}/scene-${scene.sceneNumber}-last.png`,
                skipTextOverlay: true,
                referenceImage,
                styleId: currentStyleId,
              }),
            });

            if (!lastFrameRes.ok) {
              const data = await lastFrameRes.json();
              throw new Error(data.error || `Failed to generate last frame for scene ${scene.sceneNumber}`);
            }

            const lastFrameData = await lastFrameRes.json();
            const lastFrameBaseUrl = lastFrameData.thumbnailUrl || (lastFrameData.thumbnailPath ? getPublicProjectFileUrl(lastFrameData.thumbnailPath) : undefined);
            lastFrameImageUrl = lastFrameBaseUrl
              ? `${lastFrameBaseUrl}${lastFrameBaseUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
              : undefined;

            completedImages++;
            setSceneImagesProgress({ completed: completedImages, total: totalImages });
          }

          // Final update for this scene with both images
          setPipeline((prev) => {
            const prevAssets = prev.sceneAssets || [];
            const prevAssetIndex = prevAssets.findIndex((a) => a.sceneNumber === scene.sceneNumber);
            if (prevAssetIndex !== -1) {
              const newAssets = [...prevAssets];
              newAssets[prevAssetIndex] = {
                ...newAssets[prevAssetIndex],
                imageUrl: firstFrameImageUrl,
                lastFrameImageUrl: lastFrameImageUrl,
                status: "complete" as const,
              };
              return {
                ...prev,
                sceneAssets: newAssets,
                projectSlug,
              };
            }
            return prev;
          });
        } catch (sceneError) {
          completedImages++;
          setSceneImagesProgress({ completed: completedImages, total: totalImages });
          
          setPipeline((prev) => {
            const prevAssets = prev.sceneAssets || [];
            const prevAssetIndex = prevAssets.findIndex((a) => a.sceneNumber === scene.sceneNumber);
            if (prevAssetIndex !== -1) {
              const newAssets = [...prevAssets];
              newAssets[prevAssetIndex] = {
                ...newAssets[prevAssetIndex],
                status: "error" as const,
                errorMessage: sceneError instanceof Error ? sceneError.message : "Unknown error",
              };
              return {
                ...prev,
                sceneAssets: newAssets,
              };
            }
            return prev;
          });
        }
      }

      // Mark step as success
      setPipeline((prev) => ({
        ...prev,
        projectSlug,
        steps: {
          ...prev.steps,
          sceneImages: {
            ...ensureStepState(prev.steps, "sceneImages"),
            status: "success" as const,
            errorMessage: undefined,
          },
        },
      }));

      queueAutoSave();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate scene images.";
      setSceneImagesError(message);
      setSceneImagesProgress(null);
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          sceneImages: {
            ...ensureStepState(prev.steps, "sceneImages"),
            status: "error" as const,
            errorMessage: message,
          },
        },
      }));
    } finally {
      setIsGeneratingSceneImages(false);
    }
  }, [pipeline, pipelineRef, setPipeline, queueAutoSave]);

  const regenerateSceneImage = useCallback(
    async (sceneNumber: number, frameKind: "first" | "last" = "first") => {
      const currentPipeline = pipelineRef.current ?? pipeline;
      const sceneAssets = currentPipeline.sceneAssets;
      if (!sceneAssets || sceneAssets.length === 0) {
        setSceneImagesError("No scenes available. Run previous steps first.");
        return;
      }

      const targetScene = sceneAssets.find((scene) => scene.sceneNumber === sceneNumber);
      if (!targetScene) {
        setSceneImagesError(`Scene ${sceneNumber} was not found.`);
        return;
      }

      const prompt = frameKind === "last" 
        ? targetScene.lastFrameImagePrompt 
        : targetScene.imagePrompt;
      
      if (!prompt) {
        const frameLabel = frameKind === "last" ? "last frame" : "first frame";
        setSceneImagesError(`No prompt found for this scene's ${frameLabel}. Generate prompts first.`);
        return;
      }

      const projectSlug = getOrCreateProjectSlug(currentPipeline.projectSlug, currentPipeline.topic);
      setSceneImagesError(null);

      setPipeline((prev) => {
        if (!prev.sceneAssets) {
          return prev;
        }
        const assetIndex = prev.sceneAssets.findIndex((scene) => scene.sceneNumber === sceneNumber);
        if (assetIndex === -1) {
          return prev;
        }
        const nextAssets = [...prev.sceneAssets];
        nextAssets[assetIndex] = {
          ...nextAssets[assetIndex],
          status: "generating",
          errorMessage: undefined,
          imageUrl: frameKind === "first" ? undefined : nextAssets[assetIndex].imageUrl,
          lastFrameImageUrl:
            frameKind === "last" ? undefined : nextAssets[assetIndex].lastFrameImageUrl,
        };
        const nextPipeline = {
          ...prev,
          sceneAssets: nextAssets,
          projectSlug,
        };
        pipelineRef.current = nextPipeline;
        return nextPipeline;
      });

      try {
        const currentStyleId = currentPipeline.visualStyleId;
        const shouldUseReferenceImage = styleRequiresCharacterReference(currentStyleId);
        const referenceImage =
          shouldUseReferenceImage && typeof currentPipeline.characterReferenceImage === "string"
            ? currentPipeline.characterReferenceImage
            : undefined;
        const thumbnailPath = frameKind === "last"
          ? `projects/${projectSlug}/scene-${sceneNumber}-last.png`
          : `projects/${projectSlug}/scene-${sceneNumber}.png`;
        
        const response = await fetch("/api/gemini/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            projectSlug,
            thumbnailPath,
            skipTextOverlay: true,
            referenceImage,
            styleId: currentStyleId,
          }),
        });

        if (!response.ok) {
          let errorMessage = `Failed to regenerate image (HTTP ${response.status})`;
          try {
            const errorData = await response.json();
            if (typeof errorData?.error === "string") {
              errorMessage = errorData.error;
            }
          } catch {
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        if (data?.error) {
          throw new Error(
            typeof data.error === "string" ? data.error : `Failed to regenerate image for scene ${sceneNumber}.`
          );
        }

        const baseUrl =
          data.thumbnailUrl ||
          (data.thumbnailPath ? getPublicProjectFileUrl(data.thumbnailPath) : undefined);
        const imageUrl = baseUrl
          ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
          : undefined;

        setPipeline((prev) => {
          if (!prev.sceneAssets) {
            return prev;
          }
          const assetIndex = prev.sceneAssets.findIndex(
            (scene) => scene.sceneNumber === sceneNumber,
          );
          if (assetIndex === -1) {
            return prev;
          }
          const nextAssets = [...prev.sceneAssets];
          const updatedAsset = {
            ...nextAssets[assetIndex],
            status: "complete",
            errorMessage: undefined,
          };
          
          if (frameKind === "last") {
            updatedAsset.lastFrameImageUrl = imageUrl;
          } else {
            updatedAsset.imageUrl = imageUrl;
          }

          nextAssets[assetIndex] = updatedAsset as typeof nextAssets[number];
          const nextPipeline = {
            ...prev,
            sceneAssets: nextAssets,
            projectSlug,
          };
          pipelineRef.current = nextPipeline;
          return nextPipeline;
        });

        queueAutoSave();
      } catch (error) {
        const message =
          error instanceof Error 
            ? error.message 
            : "Failed to regenerate scene image. Please check your network connection and try again.";
        setSceneImagesError(message);
        setPipeline((prev) => {
          if (!prev.sceneAssets) {
            return prev;
          }
          const assetIndex = prev.sceneAssets.findIndex(
            (scene) => scene.sceneNumber === sceneNumber,
          );
          if (assetIndex === -1) {
            return prev;
          }
          const nextAssets = [...prev.sceneAssets];
          nextAssets[assetIndex] = {
            ...nextAssets[assetIndex],
            status: "error",
            errorMessage: message,
          };
          return {
            ...prev,
            sceneAssets: nextAssets,
          };
        });
      }
    },
    [pipeline, pipelineRef, setPipeline, queueAutoSave],
  );

  const updateSceneImagePrompt = useCallback(
    (sceneNumber: number, nextPrompt: string, frameKind: "first" | "last" = "first") => {
      let didUpdate = false;
      setPipeline((prev) => {
        if (!prev.sceneAssets) {
          return prev;
        }
        const assetIndex = prev.sceneAssets.findIndex((scene) => scene.sceneNumber === sceneNumber);
        if (assetIndex === -1) {
          return prev;
        }
        const currentPrompt = frameKind === "last"
          ? prev.sceneAssets[assetIndex].lastFrameImagePrompt
          : prev.sceneAssets[assetIndex].imagePrompt;
        
        if (currentPrompt === nextPrompt) {
          return prev;
        }
        didUpdate = true;
        const nextAssets = [...prev.sceneAssets];
        const updatedAsset = {
          ...nextAssets[assetIndex],
        };
        
        if (frameKind === "last") {
          updatedAsset.lastFrameImagePrompt = nextPrompt;
        } else {
          updatedAsset.imagePrompt = nextPrompt;
        }
        
        nextAssets[assetIndex] = updatedAsset;
        const nextPipeline = {
          ...prev,
          sceneAssets: nextAssets,
        };
        pipelineRef.current = nextPipeline;
        return nextPipeline;
      });

      if (didUpdate) {
        queueAutoSave();
      }
    },
    [pipelineRef, setPipeline, queueAutoSave],
  );

  const downloadSceneImage = useCallback(
    async (sceneNumber: number, frameKind: "first" | "last" = "first") => {
      const sceneAssets = pipeline.sceneAssets;
      if (!sceneAssets || sceneAssets.length === 0) {
        return;
      }
      const asset = sceneAssets.find((scene) => scene.sceneNumber === sceneNumber);
      const imageUrl = frameKind === "last" 
        ? asset?.lastFrameImageUrl 
        : asset?.imageUrl;
      
      if (!imageUrl) {
        return;
      }

      try {
        const response = await fetch(imageUrl, { mode: "cors" });
        if (!response.ok) {
          throw new Error(`Failed to download scene image (status ${response.status})`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const slug = slugifyTopic(pipeline.topic) || "scene";
        const frameSuffix = frameKind === "last" ? "-last" : "";
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `${slug}-scene-${String(sceneNumber).padStart(2, "0")}${frameSuffix}.png`;
        document.body?.appendChild(link);
        link.click();
        document.body?.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      } catch (error) {
        console.error("Scene image download error:", error);
      }
    },
    [pipeline.sceneAssets, pipeline.topic],
  );

  return {
    // State
    isGeneratingSceneImages,
    sceneImagesProgress,
    sceneImagesError,
    // Setters
    setSceneImagesError,
    setSceneImagesProgress,
    setIsGeneratingSceneImages,
    // Actions
    generateSceneImages,
    regenerateSceneImage,
    updateSceneImagePrompt,
    downloadSceneImage,
  };
}

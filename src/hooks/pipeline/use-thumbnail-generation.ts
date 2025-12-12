"use client";

import { useCallback, useState } from "react";
import type { PipelineState, StepRunMetrics } from "@/types/agent";
import { getOrCreateProjectSlug, buildProjectThumbnailPath, getPublicProjectFileUrl } from "@/lib/projects";
import { slugifyTopic } from "@/lib/slug";
import {
  type ThumbnailImage,
  type ThumbnailMetrics,
  calculateStepTotals,
  createCacheBustedUrl,
  ensureStepState,
  getAccumulatedSessionTotals,
} from "./pipeline-types";

type UseThumbnailGenerationOptions = {
  pipeline: PipelineState;
  pipelineRef: React.MutableRefObject<PipelineState>;
  setPipeline: React.Dispatch<React.SetStateAction<PipelineState>>;
  queueAutoSave: () => void;
};

export function useThumbnailGeneration({
  pipeline,
  pipelineRef,
  setPipeline,
  queueAutoSave,
}: UseThumbnailGenerationOptions) {
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailImage, setThumbnailImage] = useState<ThumbnailImage>(null);
  const [thumbnailGenerationTime, setThumbnailGenerationTime] = useState<number | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailMetrics, setThumbnailMetrics] = useState<ThumbnailMetrics>(null);

  const generateThumbnail = useCallback(async () => {
    const prompt = pipeline.thumbnailPrompt?.trim();
    if (!prompt) {
      const message = "Create a thumbnail prompt before rendering the image.";
      setThumbnailError(message);
      setPipeline((prev) => {
        const nextSteps = {
          ...prev.steps,
          thumbnailGenerate: {
            ...ensureStepState(prev.steps, "thumbnailGenerate"),
            status: "error" as const,
            errorMessage: message,
          },
        };
        const totals = calculateStepTotals(nextSteps);
        return {
          ...prev,
          steps: nextSteps,
          totalTokens: totals.totalTokens,
          totalCostUsd: totals.totalCostUsd,
        };
      });
      return;
    }

    // #region agent log
    {
      const overlayMatch = prompt.match(/Text Overlay:\s*"([^"]+)"/i);
      const extractedOverlay = overlayMatch?.[1] ?? null;
      fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'D',location:'src/hooks/pipeline/use-thumbnail-generation.ts:60',message:'Client about to call generate-image with current thumbnailPrompt',data:{audienceMode:typeof pipeline.audienceMode==='string'?pipeline.audienceMode:null,projectSlug:typeof pipeline.projectSlug==='string'?pipeline.projectSlug:null,topicLen:typeof pipeline.topic==='string'?pipeline.topic.length:null,promptLen:prompt.length,extractedOverlay,promptPreview:prompt.slice(0,220)},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion

    const projectSlug = getOrCreateProjectSlug(pipeline.projectSlug, pipeline.topic);
    const thumbnailPath = buildProjectThumbnailPath(projectSlug, { unique: true });

    setIsGeneratingThumbnail(true);
    setThumbnailError(null);
    setThumbnailGenerationTime(null);
    setThumbnailMetrics(null);

    setPipeline((prev) => {
      const nextSteps = {
        ...prev.steps,
        thumbnailGenerate: {
          ...ensureStepState(prev.steps, "thumbnailGenerate"),
          status: "running" as const,
          resolvedPrompt: prompt,
          errorMessage: undefined,
        },
      };
      const totals = calculateStepTotals(nextSteps);
      return {
        ...prev,
        projectSlug,
        steps: nextSteps,
        totalTokens: totals.totalTokens,
        totalCostUsd: totals.totalCostUsd,
      };
    });

    const startTime = performance.now();

    try {
      const res = await fetch("/api/gemini/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          projectSlug,
          thumbnailPath,
          audienceMode: pipeline.audienceMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate thumbnail");
      }

      const data = await res.json();
      const storagePath: string | undefined = data.thumbnailPath;
      const publicUrl =
        typeof storagePath === "string"
          ? getPublicProjectFileUrl(storagePath)
          : data.thumbnailUrl;
      const versionedUrl = createCacheBustedUrl(publicUrl);
      const durationMs = performance.now() - startTime;
      const usage = data.usage;
      const usageInputTokens =
        typeof usage?.promptTokens === "number" ? usage.promptTokens : null;
      const usageOutputTokens =
        typeof usage?.outputTokens === "number" ? usage.outputTokens : null;
      const usageTotalTokens =
        typeof usage?.totalTokens === "number" ? usage.totalTokens : null;
      const reportedCostUsd =
        typeof data.costUsd === "number" ? data.costUsd : null;

      setThumbnailImage({
        data: data.imageBase64,
        mimeType: data.mimeType,
        url: versionedUrl ?? undefined,
      });
      setThumbnailGenerationTime(durationMs);
      setThumbnailMetrics({
        inputTokens: usageInputTokens,
        outputTokens: usageOutputTokens,
        totalTokens: usageTotalTokens,
        costUsd: reportedCostUsd,
      });

      // IMPORTANT: Update pipelineRef.current BEFORE queueAutoSave() runs.
      // queueAutoSave reads pipelineRef.current; if we only update it inside a
      // React state updater, React may batch/defer execution and we can race.
      const basePipeline = pipelineRef.current;
      const thumbnailStepMetrics: StepRunMetrics = {
        inputTokens: usageInputTokens ?? 0,
        outputTokens: usageOutputTokens ?? 0,
        totalTokens:
          usageTotalTokens ?? usageInputTokens ?? usageOutputTokens ?? 0,
        costUsd: reportedCostUsd ?? 0,
        durationMs,
      };
      const nextSteps = {
        ...basePipeline.steps,
        thumbnailGenerate: {
          ...ensureStepState(basePipeline.steps, "thumbnailGenerate"),
          resolvedPrompt: prompt,
          responseText: versionedUrl ?? data.thumbnailPath ?? "",
          status: "success" as const,
          metrics: thumbnailStepMetrics,
          errorMessage: undefined,
        },
      };
      const totals = calculateStepTotals(nextSteps);
      const sessionTotals = getAccumulatedSessionTotals(
        basePipeline,
        thumbnailStepMetrics,
      );
      const nextPipeline: PipelineState = {
        ...basePipeline,
        projectSlug,
        steps: nextSteps,
        totalTokens: totals.totalTokens,
        totalCostUsd: totals.totalCostUsd,
        sessionTotalTokens: sessionTotals.sessionTotalTokens,
        sessionTotalCostUsd: sessionTotals.sessionTotalCostUsd,
        cumulativeTokens: sessionTotals.cumulativeTokens,
        cumulativeCostUsd: sessionTotals.cumulativeCostUsd,
      };

      // Only overwrite thumbnailPath if we successfully uploaded to storage.
      if (typeof storagePath === "string" && storagePath.trim().length > 0) {
        nextPipeline.thumbnailPath = storagePath;
      }

      pipelineRef.current = nextPipeline;
      setPipeline(nextPipeline);
      queueAutoSave();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setThumbnailError(message);
      setPipeline((prev) => {
        const nextSteps = {
          ...prev.steps,
          thumbnailGenerate: {
            ...ensureStepState(prev.steps, "thumbnailGenerate"),
            status: "error" as const,
            errorMessage: message,
          },
        };
        const totals = calculateStepTotals(nextSteps);
        return {
          ...prev,
          steps: nextSteps,
          totalTokens: totals.totalTokens,
          totalCostUsd: totals.totalCostUsd,
        };
      });
    } finally {
      setIsGeneratingThumbnail(false);
    }
  }, [pipeline, pipelineRef, setPipeline, queueAutoSave]);

  const downloadThumbnail = useCallback(async () => {
    if (!thumbnailImage) {
      return;
    }
    const slug = slugifyTopic(pipeline.topic);

    const triggerDownload = (href: string) => {
      const link = document.createElement("a");
      link.href = href;
      link.download = `${slug}-thumbnail.png`;
      document.body?.appendChild(link);
      link.click();
      document.body?.removeChild(link);
    };

    const dataHref =
      thumbnailImage.mimeType && thumbnailImage.data
        ? `data:${thumbnailImage.mimeType};base64,${thumbnailImage.data}`
        : null;

    if (dataHref) {
      triggerDownload(dataHref);
      return;
    }

    if (thumbnailImage.url) {
      try {
        const response = await fetch(thumbnailImage.url, { mode: "cors" });
        if (!response.ok) {
          throw new Error(`Failed to fetch thumbnail (status ${response.status})`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        triggerDownload(objectUrl);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      } catch (error) {
        console.error("Thumbnail download error:", error);
      }
    }
  }, [pipeline.topic, thumbnailImage]);

  return {
    // State
    isGeneratingThumbnail,
    thumbnailImage,
    thumbnailGenerationTime,
    thumbnailError,
    thumbnailMetrics,
    // Setters
    setThumbnailImage,
    setThumbnailGenerationTime,
    setThumbnailError,
    setThumbnailMetrics,
    // Actions
    generateThumbnail,
    downloadThumbnail,
  };
}

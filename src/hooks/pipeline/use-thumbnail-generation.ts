"use client";

import { useCallback, useState } from "react";
import type { PipelineState, StepRunMetrics } from "@/types/agent";
import {
  getOrCreateProjectSlug,
  buildProjectThumbnailPath,
  getPublicProjectFileUrl,
} from "@/lib/projects";
import { slugifyTopic } from "@/lib/slug";
import { useSettings } from "@/hooks/use-settings";
import {
  type ThumbnailImage,
  type ThumbnailMetrics,
  calculateStepTotals,
  createCacheBustedUrl,
  ensureStepState,
  getAccumulatedSessionTotals,
} from "./pipeline-types";
import {
  parseThumbnailResponse,
  hasRenderableOutput,
  safeParseJsonResponse,
} from "@/lib/thumbnail/types";

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
  const publishingSettings = useSettings("publishing");

  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailImage, setThumbnailImage] = useState<ThumbnailImage>(null);
  const [thumbnailGenerationTime, setThumbnailGenerationTime] = useState<
    number | null
  >(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailMetrics, setThumbnailMetrics] =
    useState<ThumbnailMetrics>(null);

  const generateThumbnail = useCallback(async () => {
    // Read from pipelineRef.current to get the latest state.
    // This is important when generateThumbnail is called immediately after
    // runAll updates pipelineRef.current but before React re-renders.
    const currentPipeline = pipelineRef.current;
    const prompt = currentPipeline.thumbnailPrompt?.trim();
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

    const projectSlug = getOrCreateProjectSlug(
      currentPipeline.projectSlug,
      currentPipeline.topic,
    );
    const thumbnailPath = buildProjectThumbnailPath(projectSlug, {
      unique: true,
    });

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
      const thumbnailModel =
        publishingSettings.data?.thumbnailModel ?? "nano_banana_pro";
      const provider: "gemini" | "fal" =
        thumbnailModel === "seedream_v4" ? "fal" : "gemini";
      const endpoint =
        thumbnailModel === "seedream_v4"
          ? "/api/fal/seedream/generate-image"
          : "/api/gemini/generate-image";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          projectSlug,
          thumbnailPath,
          audienceMode: currentPipeline.audienceMode,
        }),
      });

      // =====================================================================
      // Parse response with safe JSON fallback
      // =====================================================================
      const parseResult = await safeParseJsonResponse(res);

      if ("textFallback" in parseResult) {
        // Response was not valid JSON
        throw new Error(
          `Thumbnail generation failed (HTTP ${res.status}): ${parseResult.textFallback}`,
        );
      }

      const rawData = parseResult.data;

      // Check for error responses
      if (!res.ok || typeof rawData.error === "string") {
        const errorMessage =
          typeof rawData.error === "string"
            ? rawData.error
            : `Thumbnail generation failed (HTTP ${res.status})`;
        throw new Error(errorMessage);
      }

      // =====================================================================
      // Parse into unified response shape (handles both new and legacy)
      // =====================================================================
      const parsed = parseThumbnailResponse(rawData, provider);

      // =====================================================================
      // SUCCESS GUARD: Require renderable output
      // =====================================================================
      if (!hasRenderableOutput(parsed)) {
        throw new Error(
          "No thumbnail image was returned. The upload may have failed and no fallback URL is available.",
        );
      }

      // =====================================================================
      // Compute display URL (prefer Supabase URL, fall back to provider URL)
      // =====================================================================
      let displayUrl: string | undefined;

      if (parsed.thumbnailPath) {
        // Try to construct Supabase public URL
        const publicUrl = getPublicProjectFileUrl(parsed.thumbnailPath);
        if (publicUrl) {
          displayUrl = createCacheBustedUrl(publicUrl) ?? undefined;
        }
      }

      if (!displayUrl && parsed.thumbnailUrl) {
        // Use the URL from the API response (may be Supabase or provider URL)
        displayUrl = createCacheBustedUrl(parsed.thumbnailUrl) ?? undefined;
      }

      const durationMs = performance.now() - startTime;

      // =====================================================================
      // Update thumbnail image state with persistence info
      // =====================================================================
      setThumbnailImage({
        data: parsed.imageBase64,
        mimeType: parsed.mimeType,
        url: displayUrl,
        persisted: parsed.persisted,
        warnings: parsed.warnings,
        debug: parsed.debug,
      });
      setThumbnailGenerationTime(durationMs);

      const usageInputTokens = parsed.usage?.promptTokens ?? null;
      const usageOutputTokens = parsed.usage?.outputTokens ?? null;
      const usageTotalTokens = parsed.usage?.totalTokens ?? null;
      const reportedCostUsd = parsed.costUsd ?? null;

      setThumbnailMetrics({
        inputTokens: usageInputTokens,
        outputTokens: usageOutputTokens,
        totalTokens: usageTotalTokens,
        costUsd: reportedCostUsd,
      });

      // =====================================================================
      // Update pipeline state
      // =====================================================================
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
          responseText: displayUrl ?? parsed.thumbnailPath ?? "",
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

      // Only overwrite thumbnailPath if we successfully persisted to storage.
      // This prevents storing temporary provider URLs as permanent paths.
      if (parsed.persisted && typeof parsed.thumbnailPath === "string") {
        nextPipeline.thumbnailPath = parsed.thumbnailPath;
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
  }, [pipelineRef, publishingSettings.data?.thumbnailModel, setPipeline, queueAutoSave]);

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
          throw new Error(
            `Failed to fetch thumbnail (status ${response.status})`,
          );
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        triggerDownload(objectUrl);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      } catch (error) {
        console.error("Thumbnail download error:", error);
        // Fallback: open in new tab for manual download
        if (thumbnailImage.url) {
          window.open(thumbnailImage.url, "_blank");
        }
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

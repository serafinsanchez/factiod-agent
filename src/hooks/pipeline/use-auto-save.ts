"use client";

import { useCallback, useRef } from "react";
import type { PipelineState, StepId } from "@/types/agent";
import { getOrCreateProjectSlug } from "@/lib/projects";
import {
  AUTO_SAVE_ERROR_PREFIX,
  ensureSessionTotals,
  isPipelineState,
  normalizeNarrationModelId,
} from "./pipeline-types";

type UseAutoSaveOptions = {
  pipelineRef: React.MutableRefObject<PipelineState>;
  setPipeline: React.Dispatch<React.SetStateAction<PipelineState>>;
  setSelectedProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useAutoSave({
  pipelineRef,
  setPipeline,
  setSelectedProjectId,
  setSaveError,
}: UseAutoSaveOptions) {
  const autoSavePendingRef = useRef(false);
  const autoSaveProcessingRef = useRef(false);

  const reportAutoSaveError = useCallback(
    (message: string) => {
      setSaveError((prev) => {
        if (prev && !prev.startsWith(AUTO_SAVE_ERROR_PREFIX)) {
          return prev;
        }
        return `${AUTO_SAVE_ERROR_PREFIX} ${message}`;
      });
    },
    [setSaveError],
  );

  const clearAutoSaveError = useCallback(() => {
    setSaveError((prev) => {
      if (prev && prev.startsWith(AUTO_SAVE_ERROR_PREFIX)) {
        return null;
      }
      return prev;
    });
  }, [setSaveError]);

  const performAutoSave = useCallback(async () => {
    const latest = pipelineRef.current;
    const trimmedTopic = latest.topic.trim();
    if (!trimmedTopic) {
      return;
    }

    const projectSlug = getOrCreateProjectSlug(latest.projectSlug, latest.topic);
    const payload: PipelineState = {
      ...latest,
      projectSlug,
    };

    try {
      const response = await fetch("/api/history/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pipeline: payload }),
      });

      const data = await response.json();
      if (!response.ok || data?.error) {
        const message =
          (typeof data?.error === "string" && data.error) ||
          `Failed to auto-save project (status ${response.status}).`;
        throw new Error(message);
      }

      if (!isPipelineState(data)) {
        throw new Error("Server returned invalid project data during auto-save.");
      }

      setPipeline((prev) => {
        // Preserve scene assets from prev if they have more data than server response
        let mergedSceneAssets = data.sceneAssets;
        if (prev.sceneAssets && data.sceneAssets) {
          mergedSceneAssets = prev.sceneAssets.map((prevAsset) => {
            const serverAsset = data.sceneAssets?.find(
              (s) => s.sceneNumber === prevAsset.sceneNumber
            );
            if (!serverAsset) {
              return prevAsset;
            }
            return {
              ...serverAsset,
              imageUrl: prevAsset.imageUrl || serverAsset.imageUrl,
              lastFrameImageUrl: prevAsset.lastFrameImageUrl || serverAsset.lastFrameImageUrl,
              videoUrl: prevAsset.videoUrl || serverAsset.videoUrl,
            };
          });
        } else if (prev.sceneAssets && !data.sceneAssets) {
          mergedSceneAssets = prev.sceneAssets;
        }

        // Preserve local step states
        const mergedSteps = { ...data.steps };
        for (const stepId of Object.keys(prev.steps) as StepId[]) {
          const prevStep = prev.steps[stepId];
          const serverStep = data.steps?.[stepId];
          if (!prevStep) continue;
          
          const localHasMoreProgress = 
            prevStep.status === "success" ||
            prevStep.status === "stale" ||
            prevStep.status === "error" ||
            (prevStep.status === "running" && serverStep?.status === "idle") ||
            (prevStep.responseText && !serverStep?.responseText) ||
            (prevStep.metrics && !serverStep?.metrics);
          
          if (!serverStep || localHasMoreProgress) {
            mergedSteps[stepId] = prevStep;
          }
        }

        const mergedCharacterReferenceImage = prev.characterReferenceImage || data.characterReferenceImage;

        return ensureSessionTotals({
          ...prev,
          ...data,
          steps: mergedSteps,
          sceneAssets: mergedSceneAssets,
          characterReferenceImage: mergedCharacterReferenceImage,
          narrationModelId: normalizeNarrationModelId(
            data.narrationModelId ?? prev.narrationModelId,
          ),
        });
      });

      const nextSelectedId =
        typeof data.id === "string" ? data.id : latest.id ?? null;
      setSelectedProjectId(nextSelectedId);
      clearAutoSaveError();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown auto-save error.";
      reportAutoSaveError(message);
      console.warn("Auto-save project failed:", error);
    }
  }, [pipelineRef, setPipeline, setSelectedProjectId, clearAutoSaveError, reportAutoSaveError]);

  const processAutoSaveQueue = useCallback(async () => {
    if (autoSaveProcessingRef.current || !autoSavePendingRef.current) {
      return;
    }
    autoSaveProcessingRef.current = true;
    try {
      while (autoSavePendingRef.current) {
        autoSavePendingRef.current = false;
        await performAutoSave();
      }
    } finally {
      autoSaveProcessingRef.current = false;
    }
  }, [performAutoSave]);

  const queueAutoSave = useCallback(() => {
    autoSavePendingRef.current = true;
    void processAutoSaveQueue();
  }, [processAutoSaveQueue]);

  return {
    queueAutoSave,
    reportAutoSaveError,
    clearAutoSaveError,
  };
}

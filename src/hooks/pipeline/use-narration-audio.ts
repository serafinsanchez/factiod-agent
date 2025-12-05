"use client";

import { useCallback, useState } from "react";
import type { PipelineState, StepRunMetrics } from "@/types/agent";
import { getOrCreateProjectSlug, buildProjectAudioPath } from "@/lib/projects";
import {
  DEFAULT_NARRATION_MODEL,
  TTS_COST_PER_THOUSAND_CHARS_USD,
  calculateStepTotals,
  ensureStepState,
  getAccumulatedSessionTotals,
} from "./pipeline-types";

type UseNarrationAudioOptions = {
  pipelineRef: React.MutableRefObject<PipelineState>;
  setPipeline: React.Dispatch<React.SetStateAction<PipelineState>>;
  queueAutoSave: () => void;
};

export function useNarrationAudio({
  pipelineRef,
  setPipeline,
  queueAutoSave,
}: UseNarrationAudioOptions) {
  const [isGeneratingScriptAudio, setIsGeneratingScriptAudio] = useState(false);
  const [scriptAudioUrl, setScriptAudioUrl] = useState<string | null>(null);
  const [scriptAudioError, setScriptAudioError] = useState<string | null>(null);
  const [scriptAudioGenerationTimeMs, setScriptAudioGenerationTimeMs] = useState<number | null>(null);

  const runNarrationAudioStep = useCallback(
    async (scriptOverride?: string) => {
      const currentPipeline = pipelineRef.current;
      const cleanScript =
        scriptOverride?.trim() ??
        currentPipeline.narrationScript?.trim() ??
        currentPipeline.videoScript?.trim();
      const narrationModelId =
        currentPipeline.narrationModelId ?? DEFAULT_NARRATION_MODEL;
      const taggedScript =
        currentPipeline.steps.narrationAudioTags?.responseText?.trim() ?? "";
      const finalScript =
        narrationModelId === "eleven_v3" && taggedScript
          ? taggedScript
          : cleanScript;

      if (!finalScript) {
        const fallbackError = "Generate the narration script before creating audio.";
        setScriptAudioError(fallbackError);
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            narrationAudio: {
              ...prev.steps.narrationAudio,
              status: "error" as const,
              errorMessage: fallbackError,
            },
          },
        }));
        return;
      }

      const characterCount = finalScript.length;
      const estimatedCostUsd = (characterCount / 1000) * TTS_COST_PER_THOUSAND_CHARS_USD;

      setIsGeneratingScriptAudio(true);
      setScriptAudioError(null);
      setScriptAudioUrl((prev) => {
        if (prev && prev.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setScriptAudioGenerationTimeMs(null);

      const projectSlug = getOrCreateProjectSlug(currentPipeline.projectSlug, currentPipeline.topic);
      const audioPath = buildProjectAudioPath(projectSlug);

      setPipeline((prev) => ({
        ...prev,
        projectSlug,
        audioPath,
        steps: {
          ...prev.steps,
          narrationAudio: {
            ...prev.steps.narrationAudio,
            status: "running" as const,
            errorMessage: undefined,
            resolvedPrompt: "",
            responseText: "",
            metrics: undefined,
          },
        },
      }));

      const startTime = performance.now();

      try {
        const response = await fetch("/api/tts/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: finalScript, projectSlug, modelId: narrationModelId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let message = `Failed to generate audio (status ${response.status}).`;
          if (errorText) {
            try {
              const parsed = JSON.parse(errorText);
              const details =
                (typeof parsed?.details === "string" && parsed.details) ||
                (typeof parsed?.error === "string" && parsed.error);
              if (typeof details === "string" && details.trim().length > 0) {
                message = details;
              } else {
                message = errorText;
              }
            } catch {
              message = errorText;
            }
          }
          throw new Error(message);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setScriptAudioUrl(objectUrl);
        const generationDurationMs = performance.now() - startTime;
        setScriptAudioGenerationTimeMs(generationDurationMs);
        setPipeline((prev) => {
          const narrationAudioMetrics: StepRunMetrics = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            costUsd: estimatedCostUsd,
            durationMs: generationDurationMs,
          };
          const currentStep = ensureStepState(prev.steps, "narrationAudio");
          const nextSteps = {
            ...prev.steps,
            narrationAudio: {
              ...currentStep,
              status: "success" as const,
              errorMessage: undefined,
              metrics: narrationAudioMetrics,
            },
          };
          const totals = calculateStepTotals(nextSteps);
          const sessionTotals = getAccumulatedSessionTotals(prev, narrationAudioMetrics);
          return {
            ...prev,
            steps: nextSteps,
            totalTokens: totals.totalTokens,
            totalCostUsd: totals.totalCostUsd,
            sessionTotalTokens: sessionTotals.sessionTotalTokens,
            sessionTotalCostUsd: sessionTotals.sessionTotalCostUsd,
          };
        });
        queueAutoSave();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to generate audio. Please try again.";
        setScriptAudioError(message);
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            narrationAudio: {
              ...prev.steps.narrationAudio,
              status: "error" as const,
              errorMessage: message,
            },
          },
        }));
      } finally {
        setIsGeneratingScriptAudio(false);
      }
    },
    [pipelineRef, setPipeline, queueAutoSave],
  );

  return {
    // State
    isGeneratingScriptAudio,
    scriptAudioUrl,
    scriptAudioError,
    scriptAudioGenerationTimeMs,
    // Setters
    setScriptAudioUrl,
    setScriptAudioError,
    setScriptAudioGenerationTimeMs,
    // Actions
    runNarrationAudioStep,
  };
}

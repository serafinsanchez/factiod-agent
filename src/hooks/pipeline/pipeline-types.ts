"use client";

import type {
  HistoryProject,
  ModelId,
  NarrationModelId,
  PipelineState,
  StepId,
  StepRunMetrics,
  StepRunState,
  VariableKey,
  VisualStyleId,
} from "@/types/agent";
import { STEP_CONFIGS } from "@/lib/agent/steps";
import { DEFAULT_MODEL_ID, normalizeModelId } from "@/lib/llm/models";
import { DEFAULT_VISUAL_STYLE_ID } from "@/prompts/visual-styles";

// ============================================
// Types
// ============================================

export type ThumbnailImage = {
  data?: string;
  mimeType?: string;
  url?: string;
} | null;

export type ThumbnailMetrics = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
} | null;

export type PromptOverrides = Partial<Record<StepId, string>>;

export type ProgressState = {
  completed: number;
  total: number;
} | null;

// ============================================
// Constants
// ============================================

export const PIPELINE_STORAGE_KEY = "pipeline:v1";
export const DEFAULT_NARRATION_MODEL: NarrationModelId = "eleven_v3";
export const TTS_COST_PER_THOUSAND_CHARS_USD = 0.1;
export const AUTO_SAVE_ERROR_PREFIX = "Auto-save failed:";

// ============================================
// Helper Functions
// ============================================

export function createInitialSteps(): Record<StepId, StepRunState> {
  return STEP_CONFIGS.reduce(
    (acc, config) => {
      acc[config.id] = {
        id: config.id,
        status: "idle",
        resolvedPrompt: "",
        responseText: "",
      };
      return acc;
    },
    {} as Record<StepId, StepRunState>,
  );
}

export function createInitialPipeline(visualStyleId?: VisualStyleId): PipelineState {
  return {
    topic: "",
    creatorName: "",
    audienceMode: "forKids",
    model: DEFAULT_MODEL_ID,
    narrationModelId: DEFAULT_NARRATION_MODEL,
    visualStyleId: visualStyleId ?? DEFAULT_VISUAL_STYLE_ID,
    scenePreviewLimit: null,
    steps: createInitialSteps(),
    totalTokens: 0,
    totalCostUsd: 0,
    sessionTotalTokens: 0,
    sessionTotalCostUsd: 0,
    cumulativeTokens: 0,
    cumulativeCostUsd: 0,
  };
}

export function calculateStepTotals(steps: Record<StepId, StepRunState>) {
  return Object.values(steps).reduce(
    (acc, step) => {
      acc.totalTokens += step.metrics?.totalTokens ?? 0;
      acc.totalCostUsd += step.metrics?.costUsd ?? 0;
      return acc;
    },
    { totalTokens: 0, totalCostUsd: 0 },
  );
}

export function ensureStepState(
  steps: Record<StepId, StepRunState>,
  stepId: StepId,
): StepRunState {
  return (
    steps[stepId] ?? {
      id: stepId,
      status: "idle",
      resolvedPrompt: "",
      responseText: "",
    }
  );
}

export function ensureSessionTotals(pipeline: PipelineState): PipelineState {
  const fallbackTokens = typeof pipeline.totalTokens === "number" ? pipeline.totalTokens : 0;
  const fallbackCost = typeof pipeline.totalCostUsd === "number" ? pipeline.totalCostUsd : 0;
  return {
    ...pipeline,
    sessionTotalTokens:
      typeof pipeline.sessionTotalTokens === "number"
        ? pipeline.sessionTotalTokens
        : fallbackTokens,
    sessionTotalCostUsd:
      typeof pipeline.sessionTotalCostUsd === "number"
        ? pipeline.sessionTotalCostUsd
        : fallbackCost,
  };
}

export function ensureCumulativeTotals(pipeline: PipelineState): PipelineState {
  const fallbackTokens = typeof pipeline.totalTokens === "number" ? pipeline.totalTokens : 0;
  const fallbackCost = typeof pipeline.totalCostUsd === "number" ? pipeline.totalCostUsd : 0;
  return {
    ...pipeline,
    cumulativeTokens:
      typeof pipeline.cumulativeTokens === "number" ? pipeline.cumulativeTokens : fallbackTokens,
    cumulativeCostUsd:
      typeof pipeline.cumulativeCostUsd === "number"
        ? pipeline.cumulativeCostUsd
        : fallbackCost,
  };
}

export function getAccumulatedSessionTotals(
  pipeline: PipelineState,
  metrics?: StepRunMetrics,
): {
  sessionTotalTokens: number;
  sessionTotalCostUsd: number;
  cumulativeTokens: number;
  cumulativeCostUsd: number;
} {
  const currentTokens =
    typeof pipeline.sessionTotalTokens === "number"
      ? pipeline.sessionTotalTokens
      : typeof pipeline.totalTokens === "number"
        ? pipeline.totalTokens
        : 0;
  const currentCost =
    typeof pipeline.sessionTotalCostUsd === "number"
      ? pipeline.sessionTotalCostUsd
      : typeof pipeline.totalCostUsd === "number"
        ? pipeline.totalCostUsd
        : 0;

  const deltaTokens = metrics?.totalTokens ?? 0;
  const deltaCost = metrics?.costUsd ?? 0;

  return {
    sessionTotalTokens: currentTokens + deltaTokens,
    sessionTotalCostUsd: currentCost + deltaCost,
    cumulativeTokens: (pipeline.cumulativeTokens ?? pipeline.totalTokens ?? 0) + deltaTokens,
    cumulativeCostUsd: (pipeline.cumulativeCostUsd ?? pipeline.totalCostUsd ?? 0) + deltaCost,
  };
}

export function isPipelineState(value: unknown): value is PipelineState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.topic === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.steps === "object" &&
    candidate.steps !== null
  );
}

export function normalizeNarrationModelId(value: unknown): NarrationModelId {
  return value === "eleven_multilingual_v2" || value === "eleven_v3"
    ? value
    : DEFAULT_NARRATION_MODEL;
}

export function loadInitialPipeline(): PipelineState {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(PIPELINE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isPipelineState(parsed)) {
          const base = createInitialPipeline();
          const normalizedModel = normalizeModelId(parsed.model) ?? DEFAULT_MODEL_ID;
          const trimmedTopic =
            typeof parsed.topic === "string" ? parsed.topic.trim() : "";
          const resolvedModel =
            trimmedTopic.length > 0 ? normalizedModel : DEFAULT_MODEL_ID;
          const normalizedNarrationModel = normalizeNarrationModelId(
            parsed.narrationModelId,
          );
          return ensureCumulativeTotals(
            ensureSessionTotals({
              ...base,
              ...parsed,
              model: resolvedModel,
              narrationModelId: normalizedNarrationModel,
              steps: {
                ...base.steps,
                ...parsed.steps,
              },
            }),
          );
        }
      }
    } catch {
      // ignore malformed storage entries
    }
  }
  return ensureCumulativeTotals(createInitialPipeline());
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body?.appendChild(link);
  link.click();
  document.body?.removeChild(link);
  URL.revokeObjectURL(url);
}

export function createCacheBustedUrl(url?: string | null): string | undefined {
  if (!url) {
    return undefined;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

// Pipeline field mappings for variable extraction
export type PipelineStringField =
  | "keyConcepts"
  | "hookScript"
  | "quizInfo"
  | "videoScript"
  | "narrationScript"
  | "title"
  | "description"
  | "youtubeTags"
  | "chapters"
  | "thumbnailPrompt";

export const PRODUCED_VARIABLE_TO_PIPELINE_FIELD: Partial<
  Record<VariableKey, PipelineStringField>
> = {
  KeyConcepts: "keyConcepts",
  HookScript: "hookScript",
  QuizInfo: "quizInfo",
  VideoScript: "videoScript",
  NarrationScript: "narrationScript",
  Title: "title",
  Description: "description",
  YoutubeTags: "youtubeTags",
  Chapters: "chapters",
  ThumbnailPrompt: "thumbnailPrompt",
};

export function getPipelineValueForVariable(
  pipeline: PipelineState,
  key: VariableKey,
): string | undefined {
  switch (key) {
    case "Topic":
      return pipeline.topic;
    case "KeyConcepts":
      return pipeline.keyConcepts;
    case "HookScript":
      return pipeline.hookScript;
    case "QuizInfo":
      return pipeline.quizInfo;
    case "VideoScript":
      return pipeline.videoScript;
    case "NarrationScript":
      return pipeline.narrationScript;
    case "NarrationTimestamps":
      if (!pipeline.narrationTimestamps) {
        return undefined;
      }
      return JSON.stringify(pipeline.narrationTimestamps, null, 2);
    case "ProductionScript":
      if (!pipeline.productionScript) {
        return undefined;
      }
      const normalizedScript = {
        ...pipeline.productionScript,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scenes: pipeline.productionScript.scenes?.map((scene: any) => ({
          sceneNumber: scene.sceneNumber ?? scene.id ?? scene.number ?? 0,
          narrationText: scene.narrationText ?? scene.narration ?? scene.text ?? "",
          visualDescription: scene.visualDescription ?? scene.visual ?? scene.description ?? "",
          estimatedDurationSec: scene.estimatedDurationSec ?? 
                               (scene.endSec && scene.startSec ? (scene.endSec as number) - (scene.startSec as number) : 8),
        })) ?? [],
      };
      return JSON.stringify(normalizedScript, null, 2);
    case "SceneImagePrompts":
      return pipeline.sceneAssets
        ? JSON.stringify(
            pipeline.sceneAssets
              .filter((s) => s.imagePrompt)
              .map((s) => ({ sceneNumber: s.sceneNumber, imagePrompt: s.imagePrompt })),
            null,
            2,
          )
        : undefined;
    case "SceneVideoPrompts":
      return pipeline.sceneAssets
        ? JSON.stringify(
            pipeline.sceneAssets
              .filter((s) => s.videoPrompt)
              .map((s) => ({ sceneNumber: s.sceneNumber, videoPrompt: s.videoPrompt })),
            null,
            2,
          )
        : undefined;
    case "Title":
      return pipeline.title;
    case "Description":
      return pipeline.description;
    case "YoutubeTags":
      return pipeline.youtubeTags;
    case "Chapters":
      return pipeline.chapters;
    case "ThumbnailPrompt":
      return pipeline.thumbnailPrompt;
    default:
      return undefined;
  }
}

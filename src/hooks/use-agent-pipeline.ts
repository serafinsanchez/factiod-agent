"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { STEP_CONFIGS } from "@/lib/agent/steps";
import { DEFAULT_MODEL_ID, normalizeModelId } from "@/lib/llm/models";
import { slugifyTopic } from "@/lib/slug";
import {
  alignScenesToTimestamps,
  getAlignmentStats,
} from "@/lib/audio/timestamp-alignment";
import { getFramesForDuration } from "@/lib/video/fal-client";
import {
  buildProjectAudioPath,
  buildProjectThumbnailPath,
  getOrCreateProjectSlug,
  getPublicProjectFileUrl,
} from "@/lib/projects";
import type {
  HistoryProject,
  ModelId,
  NarrationModelId,
  PipelineState,
  ProductionScriptData,
  SceneAsset,
  StepId,
  StepRunMetrics,
  StepRunState,
  VariableKey,
  VisualStyleId,
} from "@/types/agent";
import {
  DEFAULT_VISUAL_STYLE_ID,
  styleRequiresCharacterReference,
  getProductionScriptStyleSections,
  getConsolidatedImagePromptsGuidance,
  getConsolidatedVideoPromptsGuidance,
} from "@/lib/agent/visual-styles";
import {
  VARIABLE_KEY_TO_PIPELINE_FIELD,
  hasVariableValue,
  VARIABLE_LABELS,
} from "@/lib/agent/variable-metadata";

type ThumbnailImage =
  | {
      data?: string;
      mimeType?: string;
      url?: string;
    }
  | null;

type ThumbnailMetrics = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
} | null;

type PromptOverrides = Partial<Record<StepId, string>>;

function createInitialSteps(): Record<StepId, StepRunState> {
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

function createInitialPipeline(visualStyleId?: VisualStyleId): PipelineState {
  return {
    topic: "",
    model: DEFAULT_MODEL_ID,
    narrationModelId: DEFAULT_NARRATION_MODEL,
    visualStyleId: visualStyleId ?? DEFAULT_VISUAL_STYLE_ID,
    scenePreviewLimit: null,
    steps: createInitialSteps(),
    totalTokens: 0,
    totalCostUsd: 0,
    sessionTotalTokens: 0,
    sessionTotalCostUsd: 0,
  };
}

function calculateStepTotals(steps: Record<StepId, StepRunState>) {
  return Object.values(steps).reduce(
    (acc, step) => {
      acc.totalTokens += step.metrics?.totalTokens ?? 0;
      acc.totalCostUsd += step.metrics?.costUsd ?? 0;
      return acc;
    },
    { totalTokens: 0, totalCostUsd: 0 },
  );
}

function ensureStepState(
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

function ensureSessionTotals(pipeline: PipelineState): PipelineState {
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

function getAccumulatedSessionTotals(
  pipeline: PipelineState,
  metrics?: StepRunMetrics,
): { sessionTotalTokens: number; sessionTotalCostUsd: number } {
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
  };
}

const PIPELINE_STORAGE_KEY = "pipeline:v1";
const DEFAULT_NARRATION_MODEL: NarrationModelId = "eleven_v3";
const TTS_COST_PER_THOUSAND_CHARS_USD = 0.1;
const AUTO_SAVE_ERROR_PREFIX = "Auto-save failed:";

function isPipelineState(value: unknown): value is PipelineState {
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

function loadInitialPipeline(): PipelineState {
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
          return ensureSessionTotals({
            ...base,
            ...parsed,
            model: resolvedModel,
            narrationModelId: normalizedNarrationModel,
            steps: {
              ...base.steps,
              ...parsed.steps,
            },
          });
        }
      }
    } catch {
      // ignore malformed storage entries
    }
  }
  return createInitialPipeline();
}

function normalizeNarrationModelId(value: unknown): NarrationModelId {
  return value === "eleven_multilingual_v2" || value === "eleven_v3"
    ? value
    : DEFAULT_NARRATION_MODEL;
}

type PipelineStringField =
  | "keyConcepts"
  | "hookScript"
  | "quizInfo"
  | "videoScript"
  | "narrationScript"
  | "title"
  | "description"
  | "thumbnailPrompt";

const PRODUCED_VARIABLE_TO_PIPELINE_FIELD: Partial<
  Record<VariableKey, PipelineStringField>
> = {
  KeyConcepts: "keyConcepts",
  HookScript: "hookScript",
  QuizInfo: "quizInfo",
  VideoScript: "videoScript",
  NarrationScript: "narrationScript",
  Title: "title",
  Description: "description",
  ThumbnailPrompt: "thumbnailPrompt",
};

function getPipelineValueForVariable(
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
      // Return JSON string for LLM consumption (word-level timestamps from audio)
      if (!pipeline.narrationTimestamps) {
        return undefined;
      }
      return JSON.stringify(pipeline.narrationTimestamps, null, 2);
    case "ProductionScript":
      // Return JSON string for LLM consumption, normalizing field names
      if (!pipeline.productionScript) {
        return undefined;
      }
      // Normalize scene data to ensure consistent field names
      const normalizedScript = {
        ...pipeline.productionScript,
        scenes: pipeline.productionScript.scenes?.map((scene: any) => ({
          sceneNumber: scene.sceneNumber ?? scene.id ?? scene.number ?? 0,
          narrationText: scene.narrationText ?? scene.narration ?? scene.text ?? "",
          visualDescription: scene.visualDescription ?? scene.visual ?? scene.description ?? "",
          estimatedDurationSec: scene.estimatedDurationSec ?? 
                               (scene.endSec && scene.startSec ? scene.endSec - scene.startSec : 8),
        })) ?? [],
      };
      return JSON.stringify(normalizedScript, null, 2);
    case "SceneImagePrompts":
      // Return JSON string for LLM consumption
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
      // Return JSON string for LLM consumption
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
    case "ThumbnailPrompt":
      return pipeline.thumbnailPrompt;
    default:
      return undefined;
  }
}

function downloadTextFile(filename: string, content: string, mimeType = "text/plain") {
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

function createCacheBustedUrl(url?: string | null): string | undefined {
  if (!url) {
    return undefined;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

export function useAgentPipeline() {
  const [pipeline, setPipeline] = useState<PipelineState>(() => createInitialPipeline());
  const [promptOverrides, setPromptOverrides] = useState<PromptOverrides>({});
  const [isRunningAll, setIsRunningAll] = useState(false);

  const [isGeneratingScriptAudio, setIsGeneratingScriptAudio] = useState(false);
  const [scriptAudioUrl, setScriptAudioUrl] = useState<string | null>(null);
  const [scriptAudioError, setScriptAudioError] = useState<string | null>(null);
  const [scriptAudioGenerationTimeMs, setScriptAudioGenerationTimeMs] = useState<
    number | null
  >(null);

  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailImage, setThumbnailImage] = useState<ThumbnailImage>(null);
  const [thumbnailGenerationTime, setThumbnailGenerationTime] = useState<number | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailMetrics, setThumbnailMetrics] = useState<ThumbnailMetrics>(null);

  const [historyProjects, setHistoryProjects] = useState<HistoryProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeletingProjectId, setIsDeletingProjectId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Video generation state
  const [isGeneratingSceneImages, setIsGeneratingSceneImages] = useState(false);
  const [sceneImagesProgress, setSceneImagesProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [sceneImagesError, setSceneImagesError] = useState<string | null>(null);

  // Character reference image state
  const [isGeneratingCharacterReference, setIsGeneratingCharacterReference] = useState(false);
  const [characterReferenceError, setCharacterReferenceError] = useState<string | null>(null);

  const [isGeneratingSceneVideos, setIsGeneratingSceneVideos] = useState(false);
  const [sceneVideosProgress, setSceneVideosProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [sceneVideosError, setSceneVideosError] = useState<string | null>(null);

  const [isAssemblingVideo, setIsAssemblingVideo] = useState(false);
  const [videoAssemblyProgress, setVideoAssemblyProgress] = useState<string | null>(null);
  const [videoAssemblyError, setVideoAssemblyError] = useState<string | null>(null);

  // Narration timestamps state
  const [isExtractingTimestamps, setIsExtractingTimestamps] = useState(false);
  const [timestampsError, setTimestampsError] = useState<string | null>(null);
  const [timestampsExtractionTimeMs, setTimestampsExtractionTimeMs] = useState<number | null>(null);

  const pipelineRef = useRef(pipeline);
  useEffect(() => {
    pipelineRef.current = pipeline;
  }, [pipeline]);

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
    [],
  );

  const clearAutoSaveError = useCallback(() => {
    setSaveError((prev) => {
      if (prev && prev.startsWith(AUTO_SAVE_ERROR_PREFIX)) {
        return null;
      }
      return prev;
    });
  }, []);

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
        // This prevents race conditions where auto-save overwrites newly generated images
        let mergedSceneAssets = data.sceneAssets;
        if (prev.sceneAssets && data.sceneAssets) {
          mergedSceneAssets = prev.sceneAssets.map((prevAsset) => {
            const serverAsset = data.sceneAssets?.find(
              (s) => s.sceneNumber === prevAsset.sceneNumber
            );
            if (!serverAsset) {
              return prevAsset;
            }
            // Keep the more complete version (prefer prev if it has URLs that server doesn't)
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

        // Preserve local step states - they should never be overwritten by server response
        // since step status is client-controlled and server response may have stale data
        // (e.g., server saved "running" but client already finished with "success")
        const mergedSteps = { ...data.steps };
        for (const stepId of Object.keys(prev.steps) as StepId[]) {
          const prevStep = prev.steps[stepId];
          const serverStep = data.steps?.[stepId];
          if (!prevStep) continue;
          
          // Keep local step if:
          // 1. Server doesn't have this step
          // 2. Local step has progressed further (success > running > idle, or error)
          // 3. Local step has more data (responseText, metrics)
          const localHasMoreProgress = 
            prevStep.status === "success" ||
            prevStep.status === "error" ||
            (prevStep.status === "running" && serverStep?.status === "idle") ||
            (prevStep.responseText && !serverStep?.responseText) ||
            (prevStep.metrics && !serverStep?.metrics);
          
          if (!serverStep || localHasMoreProgress) {
            mergedSteps[stepId] = prevStep;
          }
        }

        // Preserve characterReferenceImage from prev if server doesn't have it
        // This prevents race conditions where auto-save overwrites newly generated reference images
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
  }, [clearAutoSaveError, reportAutoSaveError, setPipeline, setSelectedProjectId]);

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

  const sharedVars = useMemo(
    () => ({
      topic: pipeline.topic,
      keyConcepts: pipeline.keyConcepts,
      hookScript: pipeline.hookScript,
      quizInfo: pipeline.quizInfo,
      videoScript: pipeline.videoScript,
      narrationScript: pipeline.narrationScript,
      title: pipeline.title,
      description: pipeline.description,
      thumbnailPrompt: pipeline.thumbnailPrompt,
    }),
    [pipeline],
  );

  const totalGenerationDurationMs = useMemo(() => {
    const stepStates = pipeline.steps ? Object.values(pipeline.steps) : [];
    return stepStates.reduce((sum, step) => sum + (step.metrics?.durationMs ?? 0), 0);
  }, [pipeline.steps]);

  const hasAnyOutputs =
    Boolean(pipeline.keyConcepts?.trim()) ||
    Boolean(pipeline.hookScript?.trim()) ||
    Boolean(pipeline.quizInfo?.trim()) ||
    Boolean(pipeline.title?.trim()) ||
    Boolean(pipeline.description?.trim()) ||
    Boolean(pipeline.thumbnailPrompt?.trim());

  const hasScript = Boolean(pipeline.videoScript?.trim());

  const hasRuntimeMetrics =
    totalGenerationDurationMs > 0 ||
    scriptAudioGenerationTimeMs !== null ||
    thumbnailGenerationTime !== null;

  const scriptDraftStats = useMemo(() => {
    const raw = pipeline.steps.script?.responseText;
    if (typeof raw !== "string") {
      return null;
    }
    const text = raw.trim();
    if (!text) {
      return null;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    const characters = text.length;
    return { words, characters };
  }, [pipeline.steps.script?.responseText]);

  const videoScriptStats = useMemo(() => {
    const raw = pipeline.videoScript;
    if (typeof raw !== "string") {
      return null;
    }
    const text = raw.trim();
    if (!text) {
      return null;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    const characters = text.length;
    return { words, characters };
  }, [pipeline.videoScript]);

  const refreshHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    setDeleteError(null);
    try {
      const response = await fetch("/api/history/list");
      const data = await response.json();
      if (!response.ok || data?.error) {
        const message =
          (typeof data?.error === "string" && data.error) || "Failed to load projects.";
        throw new Error(message);
      }
      const projects = (data.projects ?? []) as HistoryProject[];
      setHistoryProjects(projects);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load projects.";
      setHistoryError(message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    const loaded = loadInitialPipeline();
    setPipeline(loaded);
    void refreshHistory();
  }, [refreshHistory]);

  // Reset stuck "running" steps on mount (e.g., if browser was closed during execution)
  useEffect(() => {
    setPipeline((prev) => {
      let hasChanges = false;
      const updatedSteps = { ...prev.steps };
      
      // Reset ALL steps that are stuck in "running" state
      for (const stepId of Object.keys(updatedSteps) as StepId[]) {
        const step = updatedSteps[stepId];
        if (step?.status === "running") {
          updatedSteps[stepId] = {
            ...step,
            status: "idle" as const,
            errorMessage: undefined,
          };
          hasChanges = true;
        }
      }
      
      return hasChanges ? { ...prev, steps: updatedSteps } : prev;
    });
    // Also reset generation state if stuck
    setIsGeneratingSceneImages(false);
    setSceneImagesProgress(null);
  }, []);

  // Detect and fix state desync: step marked "running" but generation not active
  useEffect(() => {
    const sceneImagesStep = pipeline.steps.sceneImages;
    if (sceneImagesStep?.status === "running" && !isGeneratingSceneImages) {
      // Step is marked running but generation isn't actually happening - reset it
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          sceneImages: {
            ...sceneImagesStep,
            status: "idle" as const,
            errorMessage: undefined,
          },
        },
      }));
      setSceneImagesProgress(null);
    }
  }, [pipeline.steps.sceneImages?.status, isGeneratingSceneImages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(pipeline));
    } catch {
      // ignore quota / privacy errors
    }
  }, [pipeline]);

  useEffect(() => {
    setScriptAudioError(null);
    setScriptAudioGenerationTimeMs(null);
    setScriptAudioUrl((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
        return null;
      }
      return prev;
    });
    setPipeline((prev) => {
      const narrationAudioStep = prev.steps.narrationAudio;
      if (!narrationAudioStep || narrationAudioStep.status === "idle") {
        return prev;
      }
      return {
        ...prev,
        steps: {
          ...prev.steps,
          narrationAudio: {
            ...narrationAudioStep,
            status: "idle" as const,
            errorMessage: undefined,
            metrics: undefined,
          },
        },
      };
    });
  }, [pipeline.videoScript, pipeline.narrationScript]);

  useEffect(() => {
    if (!pipeline.audioPath) {
      return;
    }
    const publicUrl = getPublicProjectFileUrl(pipeline.audioPath);
    if (!publicUrl) {
      return;
    }
    setScriptAudioUrl((current) => {
      if (current && current.startsWith("blob:")) {
        return current;
      }
      if (current === publicUrl) {
        return current;
      }
      return publicUrl;
    });
  }, [pipeline.audioPath]);

  useEffect(() => {
    if (!scriptAudioUrl) {
      return;
    }
    setPipeline((prev) => {
      const currentStep = ensureStepState(prev.steps, "narrationAudio");
      if (currentStep.status === "success") {
        return prev;
      }
      return {
        ...prev,
        steps: {
          ...prev.steps,
          narrationAudio: {
            ...currentStep,
            status: "success" as const,
            errorMessage: undefined,
          },
        },
      };
    });
  }, [scriptAudioUrl]);

  useEffect(() => {
    return () => {
      if (scriptAudioUrl && scriptAudioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(scriptAudioUrl);
      }
    };
  }, [scriptAudioUrl]);

  useEffect(() => {
    if (!pipeline.thumbnailPath) {
      return;
    }
    const publicUrl = getPublicProjectFileUrl(pipeline.thumbnailPath);
    if (!publicUrl) {
      return;
    }
    const versionedUrl = createCacheBustedUrl(publicUrl);
    setThumbnailImage((current) => {
      if (current && current.data) {
        return current;
      }
      if (current?.url === versionedUrl) {
        return current;
      }
      return current ? { ...current, url: versionedUrl } : { url: versionedUrl };
    });
  }, [pipeline.thumbnailPath]);

  useEffect(() => {
    if (isGeneratingThumbnail) {
      return;
    }

    const hasInlineThumbnail = Boolean(thumbnailImage?.data) || Boolean(thumbnailImage?.url);

    setPipeline((prev) => {
      const currentStep = ensureStepState(prev.steps, "thumbnailGenerate");
      const hasPersistedThumbnail = Boolean(prev.thumbnailPath);
      const hasThumbnailAsset = hasInlineThumbnail || hasPersistedThumbnail;

      let nextStatus: StepRunState["status"] | null = null;
      if (hasThumbnailAsset && currentStep.status !== "success") {
        nextStatus = "success";
      } else if (!hasThumbnailAsset && currentStep.status === "running") {
        nextStatus = "idle";
      }

      if (!nextStatus) {
        return prev;
      }

      const nextSteps = {
        ...prev.steps,
        thumbnailGenerate: {
          ...currentStep,
          status: nextStatus,
          errorMessage: nextStatus === "success" ? undefined : currentStep.errorMessage,
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
  }, [isGeneratingThumbnail, thumbnailImage, pipeline.thumbnailPath]);

  const setVariable = useCallback((variableKey: VariableKey, value: string) => {
    setPipeline((prev) => {
      const field = VARIABLE_KEY_TO_PIPELINE_FIELD[variableKey];
      if (!field) {
        return prev;
      }

      if (prev[field] === value) {
        return prev;
      }

      return {
        ...prev,
        [field]: value,
      };
    });
  }, []);

  const setTopic = useCallback(
    (topic: string) => {
      setVariable("Topic", topic);
    },
    [setVariable],
  );

  const setModel = useCallback((model: ModelId) => {
    setPipeline((prev) => ({
      ...prev,
      model,
    }));
  }, []);

  const setNarrationModel = useCallback((modelId: NarrationModelId) => {
    setPipeline((prev) => ({
      ...prev,
      narrationModelId: modelId,
    }));
  }, []);

  const setScenePreviewLimit = useCallback((limit: number | null) => {
    const normalized =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : null;
    setPipeline((prev) => {
      if (prev.scenePreviewLimit === normalized) {
        return prev;
      }
      return {
        ...prev,
        scenePreviewLimit: normalized,
      };
    });
  }, []);

  const setPromptOverride = useCallback((stepId: StepId, template: string) => {
    setPromptOverrides((prev) => ({
      ...prev,
      [stepId]: template,
    }));
  }, []);

  /**
   * Extract word-level timestamps from narration audio using Whisper transcription.
   * This enables precise audio-video synchronization in the production pipeline.
   */
  const runNarrationTimestampsStep = useCallback(
    async (audioUrlOverride?: string) => {
      const currentPipeline = pipelineRef.current;

      // Use provided URL or get the current audio URL from pipeline
      const audioUrl =
        audioUrlOverride || getPublicProjectFileUrl(currentPipeline.audioPath);

      if (!audioUrl) {
        const fallbackError = "Generate narration audio before extracting timestamps.";
        setTimestampsError(fallbackError);
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            narrationTimestamps: {
              ...prev.steps.narrationTimestamps,
              status: "error" as const,
              errorMessage: fallbackError,
            },
          },
        }));
        return;
      }

      setIsExtractingTimestamps(true);
      setTimestampsError(null);
      setTimestampsExtractionTimeMs(null);

      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          narrationTimestamps: {
            ...prev.steps.narrationTimestamps,
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
        const response = await fetch("/api/audio/timestamps", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ audioUrl }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message =
            errorData?.details ||
            errorData?.error ||
            `Failed to extract timestamps (status ${response.status}).`;
          throw new Error(message);
        }

        const data = await response.json();
        const timestamps = data.timestamps;
        const durationMs = performance.now() - startTime;

        setTimestampsExtractionTimeMs(durationMs);

        // Store timestamps in pipeline state
        setPipeline((prev) => {
          const timestampsMetrics: StepRunMetrics = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            costUsd: 0.07 * (timestamps.totalDurationSec / 60), // ~$0.07/minute for Whisper
            durationMs,
          };
          const currentStep = ensureStepState(prev.steps, "narrationTimestamps");
          
          let nextProductionScript = prev.productionScript;
          let timestampsWithScenes = timestamps;
          
          if (prev.productionScript?.scenes?.length) {
            try {
              const { alignedScript, alignmentResults } = alignScenesToTimestamps(
                prev.productionScript,
                timestamps,
              );
              nextProductionScript = alignedScript;
              const stats = getAlignmentStats(alignmentResults);
              if (stats.totalScenes > 0) {
                console.log(
                  `🎯 Scene alignment refreshed: ${stats.fuzzyMatched}/${stats.totalScenes} fuzzy matches, ` +
                    `${stats.sequential} sequential, avg confidence ${(stats.averageConfidence * 100).toFixed(1)}%`,
                );
              }
              
              // Build sceneTimestamps array from alignment results and production script scenes
              const sceneTimestampsMap = new Map(
                alignedScript.scenes.map((scene) => [
                  scene.sceneNumber,
                  { narrationText: scene.narrationText, startSec: scene.startSec, endSec: scene.endSec },
                ])
              );
              
              const sceneTimestamps = alignmentResults.map((result) => {
                const sceneData = sceneTimestampsMap.get(result.sceneNumber);
                const hasValidDuration = result.endSec > result.startSec;
                const durationSec = hasValidDuration ? result.endSec - result.startSec : undefined;
                const numFrames = getFramesForDuration(durationSec ?? 5);
                return {
                  sceneNumber: result.sceneNumber,
                  narrationText: sceneData?.narrationText ?? "",
                  startSec: result.startSec,
                  endSec: result.endSec,
                  confidence: result.confidence,
                  numFrames,
                };
              });
              
              timestampsWithScenes = {
                ...timestamps,
                sceneTimestamps,
              };
            } catch (alignmentError) {
              console.warn("Scene re-alignment failed after timestamp extraction:", alignmentError);
            }
          }

          // Update step responseText to include scene timestamps for data consistency
          const nextSteps = {
            ...prev.steps,
            narrationTimestamps: {
              ...currentStep,
              status: "success" as const,
              errorMessage: undefined,
              responseText: JSON.stringify(timestampsWithScenes, null, 2),
              metrics: timestampsMetrics,
            },
          };
          const totals = calculateStepTotals(nextSteps);
          const sessionTotals = getAccumulatedSessionTotals(prev, timestampsMetrics);

          return {
            ...prev,
            productionScript: nextProductionScript,
            narrationTimestamps: timestampsWithScenes,
            steps: nextSteps,
            totalTokens: totals.totalTokens,
            totalCostUsd: totals.totalCostUsd,
            sessionTotalTokens: sessionTotals.sessionTotalTokens,
            sessionTotalCostUsd: sessionTotals.sessionTotalCostUsd,
          };
        });

        queueAutoSave();

        console.log(
          `✅ Timestamps extracted: ${
            timestamps.words?.length || 0
          } words, ${timestamps.totalDurationSec?.toFixed(1) || "?"}s`,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to extract timestamps. Please try again.";
        setTimestampsError(message);
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            narrationTimestamps: {
              ...prev.steps.narrationTimestamps,
              status: "error" as const,
              errorMessage: message,
            },
          },
        }));
      } finally {
        setIsExtractingTimestamps(false);
      }
    },
    [queueAutoSave],
  );

  const runStep = useCallback(
    async (stepId: StepId) => {
      const stepConfig = STEP_CONFIGS.find((config) => config.id === stepId);
      if (!stepConfig) {
        return;
      }

      const trimmedTopic = pipeline.topic.trim();
      if (!trimmedTopic) {
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              ...prev.steps[stepId],
              status: "error" as const,
              errorMessage: "Please enter a topic before running this step.",
            },
          },
        }));
        return;
      }

      // Validate required input variables before running the step
      const missingRequiredVars = stepConfig.inputVars.filter((varKey) => {
        return !hasVariableValue(pipeline, varKey);
      });

      if (missingRequiredVars.length > 0) {
        const missingLabels = missingRequiredVars.map(
          (key) => VARIABLE_LABELS[key] ?? key,
        );
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              ...prev.steps[stepId],
              status: "error" as const,
              errorMessage: `Missing required input variables: ${missingLabels.join(", ")}. Please run the previous steps first.`,
            },
          },
        }));
        return;
      }

      const variables: Record<string, string> = {};
      if (pipeline.keyConcepts) {
        variables.KeyConcepts = pipeline.keyConcepts;
      }
      if (pipeline.hookScript) {
        variables.HookScript = pipeline.hookScript;
      }
      if (pipeline.quizInfo) {
        variables.QuizInfo = pipeline.quizInfo;
      }
      if (pipeline.videoScript) {
        variables.VideoScript = pipeline.videoScript;
      }
      if (pipeline.narrationScript) {
        variables.NarrationScript = pipeline.narrationScript;
      }
      if (pipeline.title) {
        variables.Title = pipeline.title;
      }
      if (pipeline.description) {
        variables.Description = pipeline.description;
      }
      if (pipeline.thumbnailPrompt) {
        variables.ThumbnailPrompt = pipeline.thumbnailPrompt;
      }
      
      // Add JSON-based variables (timestamps, production script, scene prompts)
      // These are always added if they exist, as they're required by certain steps
      const narrationTimestampsValue = getPipelineValueForVariable(pipeline, 'NarrationTimestamps');
      if (narrationTimestampsValue) {
        variables.NarrationTimestamps = narrationTimestampsValue;
      }
      const productionScriptValue = getPipelineValueForVariable(pipeline, 'ProductionScript');
      if (productionScriptValue) {
        variables.ProductionScript = productionScriptValue;
      }
      const sceneImagePromptsValue = getPipelineValueForVariable(pipeline, 'SceneImagePrompts');
      if (sceneImagePromptsValue) {
        variables.SceneImagePrompts = sceneImagePromptsValue;
      }
      const sceneVideoPromptsValue = getPipelineValueForVariable(pipeline, 'SceneVideoPrompts');
      if (sceneVideoPromptsValue) {
        variables.SceneVideoPrompts = sceneVideoPromptsValue;
      }

      // Add visual style variables for steps that need them (Production Script, Scene Image Prompts, Scene Video Prompts)
      const styleSections = getProductionScriptStyleSections(pipeline.visualStyleId);
      // Production Script
      variables.VisualStyle = styleSections.styleName;
      variables.VisualStyleAtmosphere = styleSections.atmosphere;
      variables.VisualStyleOutputExample = styleSections.outputExample;
      variables.VisualStyleDescriptionGuidelines = styleSections.descriptionGuidelines;
      // Scene Image Prompts - legacy variables (kept for backwards compatibility)
      variables.VisualStyleMicroMovementTable = styleSections.microMovementTable;
      variables.VisualStyleImageHints = styleSections.imagePromptsHints;
      variables.VisualStyleImageExample = styleSections.imagePromptsExample;
      // Scene Video Prompts - legacy variables (kept for backwards compatibility)
      variables.VisualStyleBreathingExample = styleSections.breathingExample;
      variables.VisualStyleVideoHints = styleSections.videoPromptsHints;
      variables.VisualStyleVideoExample = styleSections.videoPromptsExample;
      // Consolidated guidance blocks (new, simpler approach)
      variables.VisualStyleConsolidatedImageGuidance = getConsolidatedImagePromptsGuidance(pipeline.visualStyleId);
      variables.VisualStyleConsolidatedVideoGuidance = getConsolidatedVideoPromptsGuidance(pipeline.visualStyleId);

      const promptTemplateOverride = promptOverrides[stepId];

      // Handle shell steps that run client-side (not through LLM)
      if (stepId === "narrationTimestamps") {
        await runNarrationTimestampsStep();
        return;
      }
      if (stepId === "narrationAudio") {
        // narrationAudio is handled by the NarrationAudioStep component
        // This shouldn't be called via runStep, but handle gracefully
        console.warn("narrationAudio step should be run via the audio generation UI");
        return;
      }

      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          [stepId]: {
            ...prev.steps[stepId],
            status: "running" as const,
            errorMessage: undefined,
          },
        },
      }));

      // Enhanced logging for Scene Image Prompts step
      const isSceneImagePrompts = stepId === "sceneImagePrompts";
      if (isSceneImagePrompts) {
        const productionScript = variables.ProductionScript;
        const scriptSize = productionScript ? JSON.stringify(productionScript).length : 0;
        const estimatedScenes = productionScript 
          ? (JSON.parse(productionScript)?.scenes?.length || 0)
          : 0;
        console.log("🎨 Scene Image Prompts Step Starting:");
        console.log(`  Model: ${pipeline.model}`);
        console.log(`  Production Script size: ${(scriptSize / 1024).toFixed(1)} KB`);
        console.log(`  Estimated scenes: ${estimatedScenes}`);
        console.log(`  Sending request to API...`);
      }

      const requestStartTime = Date.now();
      try {
        const response = await fetch("/api/agent/run-step", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stepId,
            model: pipeline.model,
            topic: pipeline.topic,
            variables,
            promptTemplateOverride,
          }),
        });

        if (isSceneImagePrompts) {
          const requestDuration = Date.now() - requestStartTime;
          console.log(`  ✓ API request sent (${requestDuration}ms)`);
          console.log(`  ⏳ Waiting for LLM response (this may take 30-120 seconds)...`);
        }

        let data;
        try {
          if (isSceneImagePrompts) {
            const responseTime = Date.now() - requestStartTime;
            console.log(`  ✓ Response received (${(responseTime / 1000).toFixed(1)}s total)`);
            console.log(`  📥 Parsing response...`);
          }
          data = await response.json();
        } catch (jsonError) {
          // If JSON parsing fails, treat as error
          if (isSceneImagePrompts) {
            console.error("  ❌ Failed to parse response JSON:", jsonError);
          }
          throw new Error(`Invalid response from server (status ${response.status}).`);
        }

        if (!response.ok || data?.error) {
          const message =
            (typeof data?.error === "string" && data.error) ||
            `Failed to run step (status ${response.status}).`;
          if (isSceneImagePrompts) {
            console.error(`  ❌ Step failed: ${message}`);
          }
          throw new Error(message);
        }

        if (isSceneImagePrompts) {
          const responseText = data.responseText || "";
          const responseSize = responseText.length;
          console.log(`  ✓ Response parsed successfully`);
          console.log(`  Response size: ${(responseSize / 1024).toFixed(1)} KB`);
          console.log(`  Processing SceneImagePrompts data...`);
        }

        const producedVariables: Record<string, string> = data.producedVariables ?? {};
        const currentModel = pipeline.model;
        const currentTopic = pipeline.topic;

        setPipeline((prev) => {
          const updatedSteps = {
            ...prev.steps,
            [stepId]: {
              ...prev.steps[stepId],
              resolvedPrompt: data.resolvedPrompt ?? "",
              responseText: data.responseText ?? "",
              status: "success" as const,
              metrics: data.metrics,
              errorMessage: undefined,
            },
          };

          const nextPipeline: PipelineState = {
            ...prev,
            steps: updatedSteps,
          };

          // Debug: Log all produced variables being processed
          const producedKeys = Object.keys(producedVariables);
          console.log(`🔄 Processing ${producedKeys.length} produced variables:`, producedKeys.join(", ") || "none");
          
          for (const [key, value] of Object.entries(producedVariables)) {
            console.log(`  📝 Processing variable: ${key} (${value?.length ?? 0} chars)`);
            
            // Handle special JSON outputs for video pipeline
            if (key === "ProductionScript") {
              try {
                // Extract JSON from response, handling truncated markdown fences
                let jsonStr = value.trim();
                const closedMatch = value.match(/```json\s*([\s\S]*?)\s*```/);
                if (closedMatch) {
                  jsonStr = closedMatch[1];
                } else {
                  const openMatch = value.match(/```json\s*([\s\S]*)$/);
                  if (openMatch) {
                    jsonStr = openMatch[1].trim();
                    // Try to recover truncated JSON object
                    if (jsonStr.startsWith('{') && !jsonStr.endsWith('}')) {
                      // Find last complete scene in the scenes array
                      const lastBrace = jsonStr.lastIndexOf('}');
                      if (lastBrace > 0) {
                        // Check if we're in the middle of a scenes array
                        const scenesArrayMatch = jsonStr.match(/"scenes"\s*:\s*\[/);
                        if (scenesArrayMatch) {
                          jsonStr = jsonStr.slice(0, lastBrace + 1) + ']}';
                          console.log("  ⚠️ ProductionScript response truncated, recovered partial JSON");
                        }
                      }
                    }
                  }
                }
                let parsed = JSON.parse(jsonStr) as ProductionScriptData;
                
                // Normalize scene data to handle different field names from LLM
                if (parsed.scenes && Array.isArray(parsed.scenes)) {
                  parsed.scenes = parsed.scenes.map((scene: any) => ({
                    sceneNumber: scene.sceneNumber ?? scene.id ?? scene.number ?? 0,
                    narrationText: scene.narrationText ?? scene.narration ?? scene.text ?? "",
                    visualDescription: scene.visualDescription ?? scene.visual ?? scene.description ?? "",
                    estimatedDurationSec: scene.estimatedDurationSec ?? 
                                         (scene.endSec && scene.startSec ? scene.endSec - scene.startSec : 8),
                    startSec: typeof scene.startSec === "number" ? scene.startSec : undefined,
                    endSec: typeof scene.endSec === "number" ? scene.endSec : undefined,
                  })) as ProductionScriptData["scenes"];
                }

                const narrationTimestamps = prev.narrationTimestamps;
                let updatedTimestamps = narrationTimestamps;
                if (narrationTimestamps) {
                  try {
                    const { alignedScript, alignmentResults } = alignScenesToTimestamps(
                      parsed,
                      narrationTimestamps,
                    );
                    parsed = alignedScript;
                    const stats = getAlignmentStats(alignmentResults);
                    if (stats.totalScenes > 0) {
                      console.log(
                        `🎯 Scene alignment complete: ${stats.fuzzyMatched}/${stats.totalScenes} fuzzy matches, average confidence ${(stats.averageConfidence * 100).toFixed(1)}%`,
                      );
                    }
                    
                    // Build sceneTimestamps array from alignment results and production script scenes
                    const sceneTimestampsMap = new Map(
                      alignedScript.scenes.map((scene) => [
                        scene.sceneNumber,
                        { narrationText: scene.narrationText, startSec: scene.startSec, endSec: scene.endSec },
                      ])
                    );
                    
                    const sceneTimestamps = alignmentResults.map((result) => {
                      const sceneData = sceneTimestampsMap.get(result.sceneNumber);
                      const hasValidDuration = result.endSec > result.startSec;
                      const durationSec = hasValidDuration ? result.endSec - result.startSec : undefined;
                      const numFrames = getFramesForDuration(durationSec ?? 5);
                      return {
                        sceneNumber: result.sceneNumber,
                        narrationText: sceneData?.narrationText ?? "",
                        startSec: result.startSec,
                        endSec: result.endSec,
                        confidence: result.confidence,
                        numFrames,
                      };
                    });
                    
                    updatedTimestamps = {
                      ...narrationTimestamps,
                      sceneTimestamps,
                    };
                  } catch (alignmentError) {
                    console.warn("Scene alignment failed:", alignmentError);
                  }
                }
                
                nextPipeline.productionScript = parsed;
                if (updatedTimestamps) {
                  nextPipeline.narrationTimestamps = updatedTimestamps;
                }
                
                // Initialize scene assets from production script
                if (parsed.scenes) {
                  nextPipeline.sceneAssets = parsed.scenes.map((scene) => ({
                    sceneNumber: scene.sceneNumber,
                    status: "pending" as const,
                  }));
                }
              } catch (parseError) {
                console.warn("Failed to parse ProductionScript JSON:", parseError);
              }
              continue;
            }

            if (key === "SceneImagePrompts") {
              try {
                console.log("  🔍 Extracting JSON from response...");
                // Extract JSON from response, handling truncated markdown fences
                let jsonStr = value.trim();
                // First try complete fence
                const closedMatch = value.match(/```json\s*([\s\S]*?)\s*```/);
                if (closedMatch) {
                  jsonStr = closedMatch[1];
                } else {
                  // Handle truncated response without closing fence (common when hitting token limits)
                  const openMatch = value.match(/```json\s*([\s\S]*)$/);
                  if (openMatch) {
                    jsonStr = openMatch[1].trim();
                    // Try to clean up truncated JSON array - find last complete object
                    if (jsonStr.startsWith('[')) {
                      const lastBrace = jsonStr.lastIndexOf('}');
                      if (lastBrace > 0) {
                        jsonStr = jsonStr.slice(0, lastBrace + 1) + ']';
                        console.log("  ⚠️ Response was truncated, recovered partial JSON array");
                      }
                    }
                  }
                }
                console.log(`  ✓ JSON extracted (${(jsonStr.length / 1024).toFixed(1)} KB)`);
                console.log("  🔄 Parsing JSON...");
                const parsed = JSON.parse(jsonStr) as Array<{
                  sceneNumber: number;
                  // Legacy single prompt field names
                  imagePrompt?: string;
                  prompt?: string;
                  // New FLF2V paired prompt field names
                  firstFramePrompt?: string;
                  lastFramePrompt?: string;
                }>;
                
                console.log("  ✓ JSON parsed successfully");
                console.log(`📝 Scene Image Prompts Summary:`);
                console.log(`  Total scenes: ${parsed.length}`);
                
                // Count prompts by type
                const withFirstFrame = parsed.filter(p => p.firstFramePrompt || p.imagePrompt || p.prompt).length;
                const withLastFrame = parsed.filter(p => p.lastFramePrompt).length;
                const withLegacy = parsed.filter(p => p.imagePrompt || p.prompt).length;
                
                console.log(`  First frame prompts: ${withFirstFrame}/${parsed.length}`);
                console.log(`  Last frame prompts: ${withLastFrame}/${parsed.length}`);
                if (withLegacy > 0) {
                  console.log(`  Legacy format prompts: ${withLegacy}/${parsed.length}`);
                }
                
                // Log first few scenes for verification
                const scenesToLog = Math.min(3, parsed.length);
                console.log(`  Sample scenes (first ${scenesToLog}):`);
                parsed.slice(0, scenesToLog).forEach((p) => {
                  console.log(`    Scene ${p.sceneNumber}:`, {
                    hasFirstFramePrompt: Boolean(p.firstFramePrompt),
                    hasLastFramePrompt: Boolean(p.lastFramePrompt),
                    firstFrameLength: p.firstFramePrompt?.length || p.imagePrompt?.length || p.prompt?.length || 0,
                    lastFrameLength: p.lastFramePrompt?.length || 0,
                  });
                });
                
                // Update scene assets with image prompts (supporting both legacy and FLF2V formats)
                const existingAssets = nextPipeline.sceneAssets || [];
                
                // Helper to extract first frame prompt text (handles legacy and new field names)
                const getFirstFramePrompt = (item: {
                  imagePrompt?: string;
                  prompt?: string;
                  firstFramePrompt?: string;
                }) => {
                  // Prefer new FLF2V field name, fall back to legacy
                  return item.firstFramePrompt || item.imagePrompt || item.prompt || "";
                };
                
                // Helper to extract last frame prompt text (FLF2V only)
                const getLastFramePrompt = (item: { lastFramePrompt?: string }) => {
                  return item.lastFramePrompt || "";
                };
                
                const missingLastFrameScenes = parsed
                  .filter((promptData) => !getLastFramePrompt(promptData).trim())
                  .map((p) => p.sceneNumber);
                if (missingLastFrameScenes.length > 0) {
                  console.warn(
                    `  ⚠️ FLF2V: ${missingLastFrameScenes.length}/${parsed.length} scene prompts are missing lastFramePrompt. ` +
                      `Scene numbers: ${missingLastFrameScenes.join(", ")}`,
                  );
                }

                console.log("  🔄 Updating scene assets...");
                // If sceneAssets is empty or doesn't exist, create new assets from prompts
                if (existingAssets.length === 0) {
                  nextPipeline.sceneAssets = parsed.map((promptData) => ({
                    sceneNumber: promptData.sceneNumber,
                    imagePrompt: getFirstFramePrompt(promptData),
                    lastFrameImagePrompt: getLastFramePrompt(promptData),
                    status: "pending" as const,
                  }));
                  console.log(`  ✓ Created ${parsed.length} new scene assets`);
                } else {
                  // Otherwise, update existing assets by matching sceneNumber
                  nextPipeline.sceneAssets = existingAssets.map((asset) => {
                    const promptData = parsed.find((p) => p.sceneNumber === asset.sceneNumber);
                    if (promptData) {
                      return {
                        ...asset,
                        imagePrompt: getFirstFramePrompt(promptData),
                        lastFrameImagePrompt: getLastFramePrompt(promptData),
                      };
                    }
                    return asset;
                  });
                  console.log(`  ✓ Updated ${existingAssets.length} existing scene assets`);
                }
                
                const totalTime = Date.now() - requestStartTime;
                console.log(`✅ Scene Image Prompts step completed successfully!`);
                console.log(`  Total time: ${(totalTime / 1000).toFixed(1)}s`);
                console.log(`  Scenes processed: ${parsed.length}`);
              } catch (parseError) {
                console.error("  ❌ Failed to parse SceneImagePrompts JSON:", parseError);
                console.error("  Error details:", parseError instanceof Error ? parseError.message : String(parseError));
                console.warn("Failed to parse SceneImagePrompts JSON:", parseError);
              }
              continue;
            }

            if (key === "SceneVideoPrompts") {
              console.log("🎬 SceneVideoPrompts handler triggered!");
              console.log(`  Raw value length: ${value?.length ?? 0} chars`);
              console.log(`  First 200 chars: ${value?.slice(0, 200) ?? "empty"}`);
              try {
                // Extract JSON from response, handling truncated markdown fences
                let jsonStr = value.trim();
                const closedMatch = value.match(/```json\s*([\s\S]*?)\s*```/);
                if (closedMatch) {
                  jsonStr = closedMatch[1];
                } else {
                  const openMatch = value.match(/```json\s*([\s\S]*)$/);
                  if (openMatch) {
                    jsonStr = openMatch[1].trim();
                    if (jsonStr.startsWith('[')) {
                      const lastBrace = jsonStr.lastIndexOf('}');
                      if (lastBrace > 0) {
                        jsonStr = jsonStr.slice(0, lastBrace + 1) + ']';
                        console.log("  ⚠️ SceneVideoPrompts response truncated, recovered partial JSON");
                      }
                    }
                  }
                }
                const parsed = JSON.parse(jsonStr) as Array<{ 
                  sceneNumber: number; 
                  videoPrompt?: string; 
                  motion?: string; // LLM sometimes uses "motion" instead of "videoPrompt"
                  suggestedDurationSec?: number;
                }>;
                
                // Update scene assets with video prompts
                const existingAssets = nextPipeline.sceneAssets || [];
                
                // Debug: Log scene number matching
                const existingSceneNumbers = existingAssets.map((a) => a.sceneNumber);
                const parsedSceneNumbers = parsed.map((p) => p.sceneNumber);
                console.log("🎬 SceneVideoPrompts: Matching scene numbers...");
                console.log("  Existing assets scene numbers:", existingSceneNumbers.join(", ") || "none");
                console.log("  Parsed video prompt scene numbers:", parsedSceneNumbers.join(", ") || "none");
                
                // Check which field name the LLM used
                const firstItem = parsed[0];
                const usesMotionField = firstItem && "motion" in firstItem && !("videoPrompt" in firstItem);
                if (usesMotionField) {
                  console.log("  ℹ️ LLM used 'motion' field instead of 'videoPrompt' - normalizing...");
                }
                
                // Helper to extract video prompt (handles both field names)
                const getVideoPrompt = (item: { videoPrompt?: string; motion?: string }) => {
                  return item.videoPrompt || item.motion || "";
                };
                
                // Find which scenes will be updated vs which are missing
                const matchedScenes = parsed.filter((p) => existingSceneNumbers.includes(p.sceneNumber));
                const unmatchedPrompts = parsed.filter((p) => !existingSceneNumbers.includes(p.sceneNumber));
                console.log(`  Matched scenes: ${matchedScenes.length}, Unmatched prompts: ${unmatchedPrompts.length}`);
                
                // Update existing assets
                const updatedAssets = existingAssets.map((asset) => {
                  const promptData = parsed.find((p) => p.sceneNumber === asset.sceneNumber);
                  if (promptData) {
                    const videoPromptText = getVideoPrompt(promptData);
                    return {
                      ...asset,
                      videoPrompt: videoPromptText,
                      audioDurationSec: promptData.suggestedDurationSec,
                    };
                  }
                  return asset;
                });
                
                // Add any new scene assets for unmatched video prompts
                // This handles cases where video prompts have different scene numbers than image prompts
                if (unmatchedPrompts.length > 0) {
                  console.log("  ⚠️ Creating new scene assets for unmatched video prompts:", unmatchedPrompts.map((p) => p.sceneNumber).join(", "));
                  for (const promptData of unmatchedPrompts) {
                    updatedAssets.push({
                      sceneNumber: promptData.sceneNumber,
                      videoPrompt: getVideoPrompt(promptData),
                      audioDurationSec: promptData.suggestedDurationSec,
                      status: "pending" as const,
                    });
                  }
                  // Sort by scene number
                  updatedAssets.sort((a, b) => a.sceneNumber - b.sceneNumber);
                }
                
                // Debug: Verify video prompts were actually set
                const assetsWithVideoPrompt = updatedAssets.filter((a) => a.videoPrompt);
                console.log(`  📊 Assets with videoPrompt after update: ${assetsWithVideoPrompt.length}/${updatedAssets.length}`);
                
                nextPipeline.sceneAssets = updatedAssets;
                console.log(`  ✅ Updated ${matchedScenes.length} existing assets, created ${unmatchedPrompts.length} new assets`);
              } catch (parseError) {
                console.warn("Failed to parse SceneVideoPrompts JSON:", parseError);
              }
              continue;
            }

            const field = PRODUCED_VARIABLE_TO_PIPELINE_FIELD[key as VariableKey];
            if (field) {
              nextPipeline[field] = value;
            }
          }

          nextPipeline.totalTokens = Object.values(updatedSteps).reduce(
            (sum, step) => sum + (step.metrics?.totalTokens ?? 0),
            0,
          );
          nextPipeline.totalCostUsd = Object.values(updatedSteps).reduce(
            (sum, step) => sum + (step.metrics?.costUsd ?? 0),
            0,
          );
          const sessionTotals = getAccumulatedSessionTotals(prev, data.metrics);
          nextPipeline.sessionTotalTokens = sessionTotals.sessionTotalTokens;
          nextPipeline.sessionTotalCostUsd = sessionTotals.sessionTotalCostUsd;

          return nextPipeline;
        });

        const runNarrationPipeline = async (videoScriptText: string) => {
          const hasNarrationCleanStep = STEP_CONFIGS.some(
            (config) => config.id === "narrationClean",
          );
          if (!hasNarrationCleanStep) {
            return;
          }

          setPipeline((prev) => ({
            ...prev,
            steps: {
              ...prev.steps,
              narrationClean: {
                ...prev.steps.narrationClean,
                status: "running" as const,
                errorMessage: undefined,
              },
              narrationAudioTags: {
                ...prev.steps.narrationAudioTags,
                status: "idle" as const,
                errorMessage: undefined,
              },
            },
          }));

          try {
            const narrationResponse = await fetch("/api/agent/run-step", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                stepId: "narrationClean",
                model: currentModel,
                topic: currentTopic,
                variables: {
                  VideoScript: videoScriptText,
                },
                promptTemplateOverride: promptOverrides.narrationClean,
              }),
            });

            const narrationData = await narrationResponse.json();
            if (narrationResponse.ok && !narrationData?.error) {
              const narrationProducedVariables: Record<string, string> =
                narrationData.producedVariables ?? {};
              const narrationScriptText =
                narrationProducedVariables.NarrationScript ??
                narrationData.responseText ??
                "";

              setPipeline((prev) => {
                const updatedSteps = {
                  ...prev.steps,
                  narrationClean: {
                    ...prev.steps.narrationClean,
                    resolvedPrompt: narrationData.resolvedPrompt ?? "",
                    responseText: narrationData.responseText ?? "",
                    status: "success" as const,
                    metrics: narrationData.metrics,
                    errorMessage: undefined,
                  },
                };

                const nextPipeline: PipelineState = {
                  ...prev,
                  steps: updatedSteps,
                };

                for (const [key, value] of Object.entries(narrationProducedVariables)) {
                  const field = PRODUCED_VARIABLE_TO_PIPELINE_FIELD[key as VariableKey];
                  if (field) {
                    nextPipeline[field] = value;
                  }
                }

                nextPipeline.totalTokens = Object.values(updatedSteps).reduce(
                  (sum, step) => sum + (step.metrics?.totalTokens ?? 0),
                  0,
                );
                nextPipeline.totalCostUsd = Object.values(updatedSteps).reduce(
                  (sum, step) => sum + (step.metrics?.costUsd ?? 0),
                  0,
                );
              const sessionTotals = getAccumulatedSessionTotals(
                prev,
                narrationData.metrics,
              );
              nextPipeline.sessionTotalTokens = sessionTotals.sessionTotalTokens;
              nextPipeline.sessionTotalCostUsd = sessionTotals.sessionTotalCostUsd;

                return nextPipeline;
              });

              if (narrationScriptText.trim().length > 0) {
                setPipeline((prev) => ({
                  ...prev,
                  steps: {
                    ...prev.steps,
                    narrationAudioTags: {
                      ...prev.steps.narrationAudioTags,
                      status: "running" as const,
                      errorMessage: undefined,
                    },
                  },
                }));

                try {
                  const audioTagResponse = await fetch("/api/agent/run-step", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                  stepId: "narrationAudioTags",
                  model: currentModel,
                  topic: currentTopic,
                  variables: {
                    NarrationScript: narrationScriptText,
                  },
                  promptTemplateOverride: promptOverrides.narrationAudioTags,
                }),
                  });

                  const audioTagData = await audioTagResponse.json();
                  if (audioTagResponse.ok && !audioTagData?.error) {
                    setPipeline((prev) => {
                      const audioTagProducedVariables: Record<string, string> =
                        audioTagData.producedVariables ?? {};

                      const updatedSteps = {
                        ...prev.steps,
                        narrationAudioTags: {
                          ...prev.steps.narrationAudioTags,
                          resolvedPrompt: audioTagData.resolvedPrompt ?? "",
                          responseText: audioTagData.responseText ?? "",
                          status: "success" as const,
                          metrics: audioTagData.metrics,
                          errorMessage: undefined,
                        },
                      };

                      const nextPipeline: PipelineState = {
                        ...prev,
                        steps: updatedSteps,
                      };

                      for (const [key, value] of Object.entries(
                        audioTagProducedVariables,
                      )) {
                        if (key === "NarrationScript") {
                          continue;
                        }
                        const field =
                          PRODUCED_VARIABLE_TO_PIPELINE_FIELD[key as VariableKey];
                        if (field) {
                          nextPipeline[field] = value;
                        }
                      }

                      nextPipeline.totalTokens = Object.values(updatedSteps).reduce(
                        (sum, step) => sum + (step.metrics?.totalTokens ?? 0),
                        0,
                      );
                      nextPipeline.totalCostUsd = Object.values(updatedSteps).reduce(
                        (sum, step) => sum + (step.metrics?.costUsd ?? 0),
                        0,
                      );
                      const sessionTotals = getAccumulatedSessionTotals(
                        prev,
                        audioTagData.metrics,
                      );
                      nextPipeline.sessionTotalTokens = sessionTotals.sessionTotalTokens;
                      nextPipeline.sessionTotalCostUsd = sessionTotals.sessionTotalCostUsd;

                      return nextPipeline;
                    });
                  } else {
                    throw new Error(
                      audioTagData?.error || "Failed to run narration audio tag step",
                    );
                  }
                } catch (audioTagError) {
                  const message =
                    audioTagError instanceof Error
                      ? audioTagError.message
                      : "Failed to run narration audio tag step.";
                  setPipeline((prev) => ({
                    ...prev,
                    steps: {
                      ...prev.steps,
                      narrationAudioTags: {
                        ...prev.steps.narrationAudioTags,
                        status: "error" as const,
                        errorMessage: message,
                      },
                    },
                  }));
                }
              }
            } else {
              throw new Error(
                narrationData?.error || "Failed to run narration cleaning step",
              );
            }
          } catch (narrationError) {
            const message =
              narrationError instanceof Error
                ? narrationError.message
                : "Failed to run narration cleaning step.";
            setPipeline((prev) => ({
              ...prev,
              steps: {
                ...prev.steps,
                narrationClean: {
                  ...prev.steps.narrationClean,
                  status: "error" as const,
                  errorMessage: message,
                },
              },
            }));
          }
        };

        if (producedVariables.VideoScript && stepId === "scriptQA") {
          await runNarrationPipeline(producedVariables.VideoScript);
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run step.";
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              ...prev.steps[stepId],
              status: "error" as const,
              errorMessage: message,
            },
          },
        }));
      }
    },
    [pipeline, promptOverrides, queueAutoSave, runNarrationTimestampsStep],
  );

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
    [queueAutoSave],
  );

  const runAll = useCallback(async () => {
    const trimmedTopic = pipeline.topic.trim();
    if (!trimmedTopic) {
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          keyConcepts: {
            ...prev.steps.keyConcepts,
            status: "error" as const,
            errorMessage: "Please enter a topic before running.",
          },
        },
      }));
      return;
    }

    const overrideEntries = Object.entries(promptOverrides).filter(
      ([, value]) => typeof value === "string" && value.trim(),
    ) as Array<[StepId, string]>;
    const overrides =
      overrideEntries.length > 0 ? Object.fromEntries(overrideEntries) : undefined;

    setIsRunningAll(true);

    try {
      const body: Record<string, unknown> = {
        topic: pipeline.topic,
        model: pipeline.model,
      };
      if (overrides && Object.keys(overrides).length > 0) {
        body.promptTemplateOverrides = overrides;
      }
      const response = await fetch("/api/agent/run-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (isPipelineState(data)) {
        setPipeline((prev) =>
          ensureSessionTotals({
            ...prev,
            ...data,
            id: data.id ?? prev.id,
            projectSlug: data.projectSlug ?? prev.projectSlug,
            // Preserve characterReferenceImage from prev if server doesn't have it
            characterReferenceImage: prev.characterReferenceImage || data.characterReferenceImage,
            narrationModelId: normalizeNarrationModelId(
              data.narrationModelId ?? prev.narrationModelId,
            ),
          }),
        );

        const nextNarrationScript =
          typeof data.narrationScript === "string" && data.narrationScript.trim().length > 0
            ? data.narrationScript
            : undefined;
        if (nextNarrationScript) {
          await runNarrationAudioStep(nextNarrationScript);
        }
        return;
      }
      if (!response.ok) {
        const message =
          (typeof data?.error === "string" && data.error) || "Failed to run all steps.";
        throw new Error(message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run all steps.";
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          keyConcepts: {
            ...prev.steps.keyConcepts,
            status: "error" as const,
            errorMessage: message,
          },
        },
      }));
    } finally {
      setIsRunningAll(false);
    }
  }, [pipeline, promptOverrides, runNarrationAudioStep]);

  const newProject = useCallback((visualStyleId?: VisualStyleId) => {
    setPipeline(() => createInitialPipeline(visualStyleId));
    setPromptOverrides({});
    setSelectedProjectId(null);
    setSaveError(null);
    setHistoryError(null);
    setDeleteError(null);
    setScriptAudioError(null);
    setScriptAudioGenerationTimeMs(null);
    setScriptAudioUrl((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setThumbnailImage(null);
    setThumbnailGenerationTime(null);
    setThumbnailError(null);
    setThumbnailMetrics(null);
  }, []);

  const saveProject = useCallback(async () => {
    const trimmedTopic = pipeline.topic.trim();
    if (!trimmedTopic) {
      setSaveError("Please enter a topic before saving.");
      return;
    }

    const projectSlug = getOrCreateProjectSlug(pipeline.projectSlug, pipeline.topic);

    setIsSavingProject(true);
    setSaveError(null);

    const body: Record<string, unknown> = {
      pipeline: {
        ...pipeline,
        projectSlug,
      },
    };

    try {
      const response = await fetch("/api/history/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok || data?.error) {
        const message =
          (typeof data?.error === "string" && data.error) ||
          `Failed to save project (status ${response.status}).`;
        throw new Error(message);
      }

      if (isPipelineState(data)) {
        setPipeline((prev) =>
          ensureSessionTotals({
            ...prev,
            ...data,
            // Preserve characterReferenceImage from prev if server doesn't have it
            characterReferenceImage: prev.characterReferenceImage || data.characterReferenceImage,
            narrationModelId: normalizeNarrationModelId(
              data.narrationModelId ?? prev.narrationModelId,
            ),
          }),
        );
        const nextSelectedId =
          typeof data.id === "string" ? data.id : (pipeline.id ?? null);
        setSelectedProjectId(nextSelectedId);
      }

      await refreshHistory();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save project.";
      setSaveError(message);
    } finally {
      setIsSavingProject(false);
    }
  }, [pipeline, refreshHistory]);

  const selectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId);
    setHistoryError(null);
    try {
      const response = await fetch(`/api/history/get?id=${encodeURIComponent(projectId)}`);
      const data = await response.json();
      if (!response.ok || data?.error) {
        const message =
          (typeof data?.error === "string" && data.error) ||
          `Failed to load project (status ${response.status}).`;
        throw new Error(message);
      }
      if (!isPipelineState(data)) {
        throw new Error("Server returned invalid project data.");
      }
      const loadedPipeline = data as PipelineState;
      setPipeline((prev) =>
        ensureSessionTotals({
          ...prev,
          ...loadedPipeline,
          narrationModelId: normalizeNarrationModelId(
            loadedPipeline.narrationModelId ?? prev.narrationModelId,
          ),
        }),
      );
      const audioUrl = getPublicProjectFileUrl(loadedPipeline.audioPath);
      setScriptAudioUrl((prevUrl) => {
        if (prevUrl && prevUrl.startsWith("blob:")) {
          URL.revokeObjectURL(prevUrl);
        }
        return audioUrl ?? null;
      });
      setScriptAudioError(null);

      const thumbnailUrl = getPublicProjectFileUrl(loadedPipeline.thumbnailPath);
      setThumbnailImage(
        thumbnailUrl
          ? {
              url: thumbnailUrl,
            }
          : null,
      );
      setThumbnailGenerationTime(null);
      setThumbnailError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load project.";
      setHistoryError(message);
    }
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    if (!projectId) {
      return;
    }

    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            "Delete this project and its generated assets? This cannot be undone.",
          );
    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setIsDeletingProjectId(projectId);

    try {
      const response = await fetch("/api/history/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: projectId }),
      });

      let responseData: Record<string, unknown> | null = null;
      try {
        responseData = (await response.json()) as Record<string, unknown>;
      } catch {
        responseData = null;
      }

      if (!response.ok) {
        const message =
          (responseData && typeof responseData.error === "string" && responseData.error) ||
          (responseData &&
            typeof responseData.details === "string" &&
            responseData.details) ||
          `Failed to delete project (status ${response.status}).`;
        throw new Error(message);
      }

      if (
        responseData &&
        typeof responseData.error === "string" &&
        responseData.error.trim().length > 0
      ) {
        throw new Error(responseData.error);
      }

      setHistoryProjects((prev) => prev.filter((project) => project.id !== projectId));
      setSelectedProjectId((prev) => (prev === projectId ? null : prev));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete project.";
      setDeleteError(message);
    } finally {
      setIsDeletingProjectId((current) => (current === projectId ? null : current));
    }
  }, []);

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
        body: JSON.stringify({ prompt, projectSlug, thumbnailPath }),
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

      setPipeline((prev) => {
        const thumbnailStepMetrics: StepRunMetrics = {
          inputTokens: usageInputTokens ?? 0,
          outputTokens: usageOutputTokens ?? 0,
          totalTokens:
            usageTotalTokens ?? usageInputTokens ?? usageOutputTokens ?? 0,
          costUsd: reportedCostUsd ?? 0,
          durationMs,
        };
        const nextSteps = {
          ...prev.steps,
          thumbnailGenerate: {
            ...ensureStepState(prev.steps, "thumbnailGenerate"),
            resolvedPrompt: prompt,
            responseText: versionedUrl ?? data.thumbnailPath ?? "",
            status: "success" as const,
            metrics: thumbnailStepMetrics,
            errorMessage: undefined,
          },
        };
        const totals = calculateStepTotals(nextSteps);
        const nextPipeline: PipelineState = {
          ...prev,
          steps: nextSteps,
          totalTokens: totals.totalTokens,
          totalCostUsd: totals.totalCostUsd,
        };
        const sessionTotals = getAccumulatedSessionTotals(prev, thumbnailStepMetrics);
        nextPipeline.sessionTotalTokens = sessionTotals.sessionTotalTokens;
        nextPipeline.sessionTotalCostUsd = sessionTotals.sessionTotalCostUsd;
        if (typeof storagePath === "string" && storagePath.trim().length > 0) {
          nextPipeline.thumbnailPath = storagePath;
        }
        pipelineRef.current = nextPipeline;
        return nextPipeline;
      });

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
  }, [pipeline, queueAutoSave]);

  // ============================================
  // Video Generation Handlers
  // ============================================

  /**
   * Generate a character reference image from the production script's character sheet.
   * This creates a "hero portrait" that will be used as a reference for all scene images
   * to ensure visual consistency.
   * 
   * For visual styles that don't require character consistency (paper-craft, documentary),
   * this step auto-completes without generating an image.
   */
  const generateCharacterReferenceImage = useCallback(async () => {
    // Check if the current visual style requires character reference
    const requiresCharacter = styleRequiresCharacterReference(pipeline.visualStyleId);
    
    if (!requiresCharacter) {
      // Auto-complete step for non-character styles
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          characterReferenceImage: {
            ...ensureStepState(prev.steps, "characterReferenceImage"),
            status: "success" as const,
            responseText: "Skipped - visual style does not require character reference.",
            errorMessage: undefined,
          },
        },
      }));
      return;
    }

    const productionScript = pipeline.productionScript;
    if (!productionScript?.characterSheet?.mainChild) {
      setCharacterReferenceError("No character sheet found. Run the Production Script step first.");
      return;
    }

    const characterDescription = productionScript.characterSheet.mainChild;
    const projectSlug = getOrCreateProjectSlug(pipeline.projectSlug, pipeline.topic);

    setIsGeneratingCharacterReference(true);
    setCharacterReferenceError(null);

    // Mark the step as running
    setPipeline((prev) => ({
      ...prev,
      steps: {
        ...prev.steps,
        characterReferenceImage: {
          ...ensureStepState(prev.steps, "characterReferenceImage"),
          status: "running" as const,
          errorMessage: undefined,
        },
      },
    }));

    try {
      // Build a prompt for a clean, front-facing character reference portrait
      const referencePrompt = `Pixar-style 3D animation, clean modern CGI render, rounded friendly character design, soft studio lighting, vibrant saturated colors — Character reference sheet portrait of ${characterDescription}. Clean front-facing view, neutral pose, friendly expression, full upper body visible, simple gradient background. This is a reference image for maintaining character consistency. High quality, 1920x1080, 16:9 aspect ratio.`;

      const res = await fetch("/api/gemini/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: referencePrompt,
          projectSlug,
          thumbnailPath: `projects/${projectSlug}/character-reference.png`,
          skipTextOverlay: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate character reference image");
      }

      const data = await res.json();
      
      // Store the base64 image data for use in subsequent scene generations
      const characterReferenceImage = data.imageBase64;
      
      setPipeline((prev) => ({
        ...prev,
        characterReferenceImage,
        projectSlug,
        steps: {
          ...prev.steps,
          characterReferenceImage: {
            ...ensureStepState(prev.steps, "characterReferenceImage"),
            status: "success" as const,
            errorMessage: undefined,
          },
        },
      }));

      queueAutoSave();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate character reference image.";
      setCharacterReferenceError(message);
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          characterReferenceImage: {
            ...ensureStepState(prev.steps, "characterReferenceImage"),
            status: "error" as const,
            errorMessage: message,
          },
        },
      }));
    } finally {
      setIsGeneratingCharacterReference(false);
    }
  }, [pipeline.visualStyleId, pipeline.productionScript, pipeline.projectSlug, pipeline.topic, queueAutoSave]);

  /**
   * Generate scene images from image prompts.
   * This calls the Gemini image generation API for each scene.
   * If a character reference image is available, it will be passed to ensure consistency.
   * 
   * FLF2V Support: For scenes with both firstFramePrompt (imagePrompt) and lastFramePrompt,
   * generates TWO images per scene - the first frame and last frame for WAN 2.2 FLF2V.
   */
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

    // Count total images to generate (first frame + last frame for FLF2V scenes)
    const scenesWithLastFrame = scenesToGenerate.filter((s) => s.lastFrameImagePrompt);
    const totalImages = scenesToGenerate.length + scenesWithLastFrame.length;

    // DEBUG: Log scene data to help identify missing lastFramePrompts
    console.log("🎬 Scene Image Generation Debug:");
    console.log("  Total scenes to generate:", scenesToGenerate.length);
    console.log("  Scenes with lastFramePrompt:", scenesWithLastFrame.length);
    console.log("  Total images to generate:", totalImages);
    scenesToGenerate.forEach((scene, idx) => {
      console.log(`  Scene ${scene.sceneNumber}:`, {
        hasFirstFrame: Boolean(scene.imagePrompt),
        hasLastFrame: Boolean(scene.lastFrameImagePrompt),
        firstFramePromptLength: scene.imagePrompt?.length ?? 0,
        lastFramePromptLength: scene.lastFrameImagePrompt?.length ?? 0,
      });
    });
    if (scenesWithLastFrame.length === 0) {
      console.warn(
        "⚠️ FLF2V disabled: no scenes have lastFrameImagePrompt. Videos will be generated from single frames.",
      );
    } else if (scenesWithLastFrame.length !== scenesToGenerate.length) {
      const missingCount = scenesToGenerate.length - scenesWithLastFrame.length;
      console.warn(
        `⚠️ FLF2V partial: ${missingCount}/${scenesToGenerate.length} scenes missing lastFrameImagePrompt. ` +
          "Those scenes will fall back to single-frame animation.",
      );
    }

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
        const hasLastFrame = Boolean(scene.lastFrameImagePrompt);
        
        // Set progress at start of processing
        setSceneImagesProgress({ completed: completedImages, total: totalImages });

        try {
          // Get the character reference image from pipeline state for consistency
          const characterReferenceImage = pipelineRef.current.characterReferenceImage;
          
          // Generate FIRST FRAME image
          const firstFrameRes = await fetch("/api/gemini/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: scene.imagePrompt,
              projectSlug,
              thumbnailPath: `projects/${projectSlug}/scene-${scene.sceneNumber}-first.png`,
              skipTextOverlay: true, // Scene images should not have text overlays
              referenceImage: characterReferenceImage, // Pass reference for character consistency
              styleId: pipelineRef.current.visualStyleId, // Pass visual style for style-specific image generation
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
                referenceImage: characterReferenceImage,
                styleId: pipelineRef.current.visualStyleId,
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
          // Still update progress even on error
          completedImages++;
          setSceneImagesProgress({ completed: completedImages, total: totalImages });
          
          // Update pipeline state to reflect error
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

      // Final update: just mark step as success
      // Scene assets are already updated incrementally in the loop above,
      // so we don't overwrite them here to avoid losing any updates
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
  }, [pipeline, queueAutoSave]);

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

      // Check for the appropriate prompt based on frameKind
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
        // Get the character reference image from pipeline state for consistency
        const characterReferenceImage = currentPipeline.characterReferenceImage;
        
        // Build thumbnail path based on frameKind
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
            skipTextOverlay: true, // Scene images should not have text overlays
            referenceImage: characterReferenceImage, // Pass reference for character consistency
            styleId: currentPipeline.visualStyleId, // Pass visual style for style-specific image generation
          }),
        });

        // Check if response is OK before parsing JSON
        if (!response.ok) {
          let errorMessage = `Failed to regenerate image (HTTP ${response.status})`;
          try {
            const errorData = await response.json();
            if (typeof errorData?.error === "string") {
              errorMessage = errorData.error;
            }
          } catch {
            // If JSON parsing fails, use the status text
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        if (data?.error) {
          const message =
            typeof data.error === "string" ? data.error : `Failed to regenerate image for scene ${sceneNumber}.`;
          throw new Error(message);
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
          
          // Update the appropriate image URL based on frameKind
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
    [pipeline, queueAutoSave],
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
    [queueAutoSave],
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

  /**
   * Generate scene videos from images and video prompts.
   * This calls the fal.ai WAN 2.2 API for each scene.
   * 
   * FLF2V Support: If a scene has both imageUrl (first frame) and lastFrameImageUrl (last frame),
   * both are passed to the WAN 2.2 model for smoother video transitions.
   * 
   * Audio-Synced Frames: Calculates optimal numFrames for each clip based on its
   * audio segment duration from the production script, ensuring natural transitions.
   */
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

    // Get scene timestamps from narration (primary source with pre-calculated numFrames)
    const sceneTimestamps = pipeline.narrationTimestamps?.sceneTimestamps || [];
    // Get production script scenes as fallback for timing info
    const productionScenes = pipeline.productionScript?.scenes || [];

    // Log FLF2V status
    const flf2vScenes = scenesToGenerate.filter((s) => s.lastFrameImageUrl);
    if (flf2vScenes.length > 0) {
      console.log(`🎬 FLF2V enabled for ${flf2vScenes.length}/${scenesToGenerate.length} scenes`);
      if (flf2vScenes.length !== scenesToGenerate.length) {
        console.warn(
          `⚠️ ${scenesToGenerate.length - flf2vScenes.length} scenes lack last frame images. ` +
            "Those clips will animate from a single frame.",
        );
      }
    } else {
      console.warn("⚠️ FLF2V disabled: none of the selected scenes have last frame images.");
    }

    // Log audio-synced frame calculation status
    // Priority: 1) sceneTimestamps (with pre-calculated numFrames), 2) production script timing
    const scenesWithSceneTimestamps = scenesToGenerate.filter((s) => {
      const st = sceneTimestamps.find((t) => t.sceneNumber === s.sceneNumber);
      return st?.numFrames && st.numFrames >= 17;
    });
    const scenesWithProductionTiming = scenesToGenerate.filter((s) => {
      const ps = productionScenes.find((p) => p.sceneNumber === s.sceneNumber);
      return ps?.startSec !== undefined && ps?.endSec !== undefined && ps.endSec > ps.startSec;
    });
    
    console.log(`🎵 Scene timestamps: ${scenesWithSceneTimestamps.length}/${scenesToGenerate.length} scenes have pre-calculated numFrames`);
    console.log(`📊 Production script: ${scenesWithProductionTiming.length}/${scenesToGenerate.length} scenes have timing data`);
    
    if (scenesWithSceneTimestamps.length === 0 && scenesWithProductionTiming.length === 0) {
      console.warn("⚠️ No timing data available. Using default 5 second clips for all scenes.");
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

    try {
      // Process in batches of 2 to avoid rate limiting
      const batchSize = 2;
      for (let i = 0; i < scenesToGenerate.length; i += batchSize) {
        const batch = scenesToGenerate.slice(i, i + batchSize);

        const batchResults = await Promise.allSettled(
          batch.map(async (scene) => {
            // Get pre-calculated scene timestamp with numFrames (primary source)
            const sceneTimestamp = sceneTimestamps.find(
              (st) => st.sceneNumber === scene.sceneNumber
            );
            // Find corresponding production scene as fallback
            const productionScene = productionScenes.find(
              (ps) => ps.sceneNumber === scene.sceneNumber
            );

            const MINIMUM_CLIP_DURATION = 3; // Minimum 3 seconds per clip
            const DEFAULT_CLIP_DURATION = 5; // Default if no timing data
            
            let numFrames: number;
            let targetDuration: number;
            let audioStartSec: number | undefined;
            let audioEndSec: number | undefined;
            let durationSource: string;

            // Priority 1: Use pre-calculated values from sceneTimestamps (narration alignment)
            if (sceneTimestamp && sceneTimestamp.numFrames >= 17) {
              numFrames = sceneTimestamp.numFrames;
              targetDuration = sceneTimestamp.endSec - sceneTimestamp.startSec;
              audioStartSec = sceneTimestamp.startSec;
              audioEndSec = sceneTimestamp.endSec;
              durationSource = "sceneTimestamps";
            } else {
              // Priority 2: Fall back to production script timing
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
              
              // Priority 3: Fall back to estimatedDurationSec
              if (durationSource === "default" && productionScene?.estimatedDurationSec) {
                if (productionScene.estimatedDurationSec >= MINIMUM_CLIP_DURATION) {
                  targetDuration = productionScene.estimatedDurationSec;
                  durationSource = "estimated";
                }
              }
              
              // Ensure minimum duration
              if (targetDuration < MINIMUM_CLIP_DURATION) {
                console.warn(
                  `⚠️ Scene ${scene.sceneNumber}: Duration ${targetDuration.toFixed(2)}s below minimum, using ${MINIMUM_CLIP_DURATION}s`
                );
                targetDuration = MINIMUM_CLIP_DURATION;
              }

              // Calculate optimal frame count for the target duration
              numFrames = getFramesForDuration(targetDuration);
            }

            // Build request body with optional FLF2V support (endImageUrl)
            const requestBody: Record<string, unknown> = {
              sceneNumber: scene.sceneNumber,
              imageUrl: scene.imageUrl,
              prompt: scene.videoPrompt,
              numFrames, // Audio-synced frame count
            };

            // Add lastFrameImageUrl for FLF2V if available
            if (scene.lastFrameImageUrl) {
              requestBody.endImageUrl = scene.lastFrameImageUrl;
              console.log(`🖼️ Scene ${scene.sceneNumber}: Using FLF2V with last frame`);
            }

            console.log(
              `🎬 Scene ${scene.sceneNumber}: ${targetDuration.toFixed(2)}s → ${numFrames} frames (source: ${durationSource})` +
              (audioStartSec !== undefined ? ` [${audioStartSec.toFixed(2)}s-${audioEndSec?.toFixed(2)}s]` : "")
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

            // Return result with timing info for storage
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
            // Use timing info from the generation result
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
            // For errors, get timing from sceneTimestamps or production script
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

        // Update progress based on actual successful completions, not batch completion
        const successfullyGenerated = updatedAssets.filter(
          (asset) => asset.videoUrl && asset.status === "complete"
        ).length;
        setSceneVideosProgress({
          completed: successfullyGenerated,
          total: scenesToGenerate.length,
        });

        // Small delay between batches
        if (i + batchSize < scenesToGenerate.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Check if all videos were generated successfully
      const successfullyGenerated = updatedAssets.filter(
        (asset) => asset.videoUrl && asset.status === "complete"
      ).length;
      const failedCount = updatedAssets.filter(
        (asset) => asset.status === "error"
      ).length;
      const expectedCount = scenesToGenerate.length;
      const allSucceeded = successfullyGenerated === expectedCount;

      console.log(
        `🎬 Video generation batch complete: ${successfullyGenerated}/${expectedCount} succeeded, ${failedCount} failed`
      );

      // Only mark as success if all videos were generated
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
        // Some videos failed - mark as error with details
        const actualFailedCount = expectedCount - successfullyGenerated;
        const errorMessage = `Only ${successfullyGenerated} of ${expectedCount} videos generated successfully. ${actualFailedCount} video(s) failed.`;
        console.error(`❌ Video generation incomplete: ${errorMessage}`);
        
        // Log which scenes failed for debugging
        const failedScenes = updatedAssets
          .filter((asset) => asset.status === "error")
          .map((asset) => ({
            sceneNumber: asset.sceneNumber,
            error: asset.errorMessage,
          }));
        if (failedScenes.length > 0) {
          console.error(`Failed scenes:`, failedScenes);
        }
        
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
      const message = error instanceof Error ? error.message : "Failed to generate scene videos.";
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
  }, [pipeline, queueAutoSave]);

  /**
   * Assemble final video from clips and audio.
   * This calls the FFmpeg assembly API.
   */
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

    // Get scene timestamps for precise audio timing (primary source)
    const sceneTimestamps = pipeline.narrationTimestamps?.sceneTimestamps || [];
    const productionScript = pipeline.productionScript;

    const totalScenes = scenesWithVideo.length;
    const narrationDuration =
      pipeline.narrationTimestamps?.totalDurationSec ||
      productionScript?.totalEstimatedDurationSec ||
      totalScenes * 8;
    const avgClipDuration = narrationDuration / totalScenes;

    // Build clips with exact audio timing for perfect sync
    // Priority: 1) scene asset timing (from video generation), 2) sceneTimestamps, 3) cumulative fallback
    let cumulativeTime = 0;
    const clips = scenesWithVideo.map((scene) => {
      let audioStartSec: number;
      let audioEndSec: number;
      let timingSource: string;
      
      // Priority 1: Use exact timing stored in scene asset (from video generation)
      if (
        typeof scene.audioStartSec === "number" && 
        typeof scene.audioEndSec === "number" &&
        scene.audioEndSec > scene.audioStartSec
      ) {
        audioStartSec = scene.audioStartSec;
        audioEndSec = scene.audioEndSec;
        timingSource = "sceneAsset";
      } 
      // Priority 2: Use sceneTimestamps (narration alignment)
      else {
        const sceneTs = sceneTimestamps.find((st) => st.sceneNumber === scene.sceneNumber);
        if (sceneTs && sceneTs.endSec > sceneTs.startSec) {
          audioStartSec = sceneTs.startSec;
          audioEndSec = sceneTs.endSec;
          timingSource = "sceneTimestamps";
        }
        // Priority 3: Fall back to cumulative timing based on targetDurationSec
        else {
          const clipDuration = Math.max(scene.targetDurationSec || avgClipDuration, 2);
          audioStartSec = cumulativeTime;
          audioEndSec = cumulativeTime + clipDuration;
          timingSource = "cumulative";
        }
      }
      
      // Track cumulative time for fallback calculations
      cumulativeTime = audioEndSec;
      
      return {
        clipNumber: scene.sceneNumber,
        videoUrl: scene.videoUrl!,
        audioStartSec,
        audioEndSec,
        _timingSource: timingSource, // For debugging
      };
    });
    
    // Log timing breakdown with source info
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

      // Calculate audio offsets for partial video sync
      // This ensures the audio is trimmed to exactly match the clips being assembled
      const audioStartOffset = clips.length > 0 ? clips[0].audioStartSec : 0;
      const audioEndOffset = clips.length > 0 ? clips[clips.length - 1].audioEndSec : 0;

      console.log(`🎬 Assembling ${clips.length} clips with audio range: ${audioStartOffset.toFixed(2)}s - ${audioEndOffset.toFixed(2)}s`);

      const res = await fetch("/api/video/assemble", {
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
      });

      if (!res.ok) {
        const data = await res.json();
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
  }, [pipeline, scriptAudioUrl, queueAutoSave]);

  // ============================================
  // End Video Generation Handlers
  // ============================================

  const downloadVoiceover = useCallback(() => {
    if (!scriptAudioUrl) {
      return;
    }
    const slug = slugifyTopic(pipeline.topic);
    const link = document.createElement("a");
    link.href = scriptAudioUrl;
    link.download = `${slug}-script.mp3`;
    document.body?.appendChild(link);
    link.click();
    document.body?.removeChild(link);
  }, [pipeline.topic, scriptAudioUrl]);

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

  const exportFiles = useCallback(() => {
    if (!hasAnyOutputs) {
      return;
    }
    const slug = slugifyTopic(pipeline.topic);
    const entries: Array<[string | undefined, string]> = [
      [pipeline.keyConcepts, `${slug}-key-concepts.txt`],
      [pipeline.hookScript, `${slug}-hook.txt`],
      [pipeline.quizInfo, `${slug}-quizzes.txt`],
      [pipeline.title, `${slug}-title.txt`],
      [pipeline.description, `${slug}-description.txt`],
      [pipeline.thumbnailPrompt, `${slug}-thumbnail-prompt.txt`],
    ];
    for (const [content, filename] of entries) {
      if (content && content.trim()) {
        downloadTextFile(filename, content);
      }
    }
  }, [hasAnyOutputs, pipeline]);

  const exportScriptMarkdown = useCallback(() => {
    const script = pipeline.videoScript?.trim();
    if (!script) {
      return;
    }
    const slug = slugifyTopic(pipeline.topic);
    downloadTextFile(`${slug}-script.md`, script, "text/markdown");
  }, [pipeline.topic, pipeline.videoScript]);

  const resetStepStatus = useCallback((stepId: StepId) => {
    setPipeline((prev) => {
      const currentStep = ensureStepState(prev.steps, stepId);
      if (currentStep.status === "running") {
        return {
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              ...currentStep,
              status: "idle" as const,
              errorMessage: undefined,
            },
          },
        };
      }
      return prev;
    });
  }, []);

  return {
    state: {
      pipeline,
      promptOverrides,
      historyProjects,
      selectedProjectId,
      isLoadingHistory,
      historyError,
      isSavingProject,
      saveError,
      isDeletingProjectId,
      deleteError,
      isRunningAll,
      isGeneratingScriptAudio,
      scriptAudioUrl,
      scriptAudioError,
      scriptAudioGenerationTimeMs,
      isGeneratingThumbnail,
      thumbnailImage,
      thumbnailGenerationTime,
      thumbnailError,
      thumbnailMetrics,
      // Character reference image state
      isGeneratingCharacterReference,
      characterReferenceError,
      // Video generation state
      isGeneratingSceneImages,
      sceneImagesProgress,
      sceneImagesError,
      isGeneratingSceneVideos,
      sceneVideosProgress,
      sceneVideosError,
      isAssemblingVideo,
      videoAssemblyProgress,
      videoAssemblyError,
      // Narration timestamps state
      isExtractingTimestamps,
      timestampsError,
      timestampsExtractionTimeMs,
    },
    derived: {
      sharedVars,
      totalGenerationDurationMs,
      hasAnyOutputs,
      hasScript,
      hasRuntimeMetrics,
      scriptDraftStats,
      videoScriptStats,
    },
    actions: {
      setVariable,
      setTopic,
      setModel,
      setNarrationModel,
      setScenePreviewLimit,
      setPromptOverride,
      runStep,
      runAll,
      newProject,
      saveProject,
      selectProject,
      deleteProject,
      refreshHistory,
      generateScriptAudio: runNarrationAudioStep,
      runNarrationAudioStep,
      runNarrationTimestampsStep,
      generateThumbnail,
      downloadVoiceover,
      downloadThumbnail,
      exportFiles,
      exportScriptMarkdown,
      // Character reference image action
      generateCharacterReferenceImage,
      // Video generation actions
      generateSceneImages,
      regenerateSceneImage,
      updateSceneImagePrompt,
      downloadSceneImage,
      generateSceneVideos,
      assembleVideo,
      // Step management
      resetStepStatus,
    },
  };
}

export type UseAgentPipelineReturn = ReturnType<typeof useAgentPipeline>;



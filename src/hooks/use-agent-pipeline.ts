"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { STEP_CONFIGS } from "@/lib/agent/steps";
import { DEFAULT_MODEL_ID, normalizeModelId } from "@/lib/llm/models";
import { slugifyTopic } from "@/lib/slug";
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
  StepId,
  StepRunState,
  VariableKey,
} from "@/types/agent";
import { VARIABLE_KEY_TO_PIPELINE_FIELD } from "@/lib/agent/variable-metadata";

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

function createInitialPipeline(): PipelineState {
  return {
    topic: "",
    model: DEFAULT_MODEL_ID,
    narrationModelId: DEFAULT_NARRATION_MODEL,
    steps: createInitialSteps(),
    totalTokens: 0,
    totalCostUsd: 0,
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

const PIPELINE_STORAGE_KEY = "pipeline:v1";
const DEFAULT_NARRATION_MODEL: NarrationModelId = "eleven_v3";
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
          return {
            ...base,
            ...parsed,
            model: resolvedModel,
            narrationModelId: normalizedNarrationModel,
            steps: {
              ...base.steps,
              ...parsed.steps,
            },
          };
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

      setPipeline((prev) => ({
        ...prev,
        ...data,
        narrationModelId: normalizeNarrationModelId(
          data.narrationModelId ?? prev.narrationModelId,
        ),
      }));

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

  const setPromptOverride = useCallback((stepId: StepId, template: string) => {
    setPromptOverrides((prev) => ({
      ...prev,
      [stepId]: template,
    }));
  }, []);

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

      const promptTemplateOverride = promptOverrides[stepId];

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

        const data = await response.json();
        if (!response.ok || data?.error) {
          const message =
            (typeof data?.error === "string" && data.error) ||
            `Failed to run step (status ${response.status}).`;
          throw new Error(message);
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

          for (const [key, value] of Object.entries(producedVariables)) {
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

        const runScriptQaStep = async (videoScriptText: string) => {
          const trimmedScript = videoScriptText?.trim();
          if (!trimmedScript) {
            return;
          }

          const hasScriptQaStep = STEP_CONFIGS.some((config) => config.id === "scriptQA");
          if (!hasScriptQaStep) {
            return;
          }

          setPipeline((prev) => ({
            ...prev,
            steps: {
              ...prev.steps,
              scriptQA: {
                ...prev.steps.scriptQA,
                status: "running" as const,
                errorMessage: undefined,
              },
            },
          }));

          try {
            const qaResponse = await fetch("/api/agent/run-step", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                stepId: "scriptQA",
                model: currentModel,
                topic: currentTopic,
                variables: {
                  VideoScript: trimmedScript,
                },
                promptTemplateOverride: promptOverrides.scriptQA,
              }),
            });

            const qaData = await qaResponse.json();
            if (!qaResponse.ok || qaData?.error) {
              const message =
                (typeof qaData?.error === "string" && qaData.error) ||
                `Failed to run script QA step (status ${qaResponse.status}).`;
              throw new Error(message);
            }

            const qaProducedVariables: Record<string, string> =
              qaData.producedVariables ?? {};
            const finalScript =
              qaProducedVariables.VideoScript ??
              qaData.responseText ??
              trimmedScript;

            setPipeline((prev) => {
              const updatedSteps = {
                ...prev.steps,
                scriptQA: {
                  ...prev.steps.scriptQA,
                  resolvedPrompt: qaData.resolvedPrompt ?? "",
                  responseText: qaData.responseText ?? "",
                  status: "success" as const,
                  metrics: qaData.metrics,
                  errorMessage: undefined,
                },
              };

              const nextPipeline: PipelineState = {
                ...prev,
                steps: updatedSteps,
              };

              for (const [key, value] of Object.entries(qaProducedVariables)) {
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

              return nextPipeline;
            });

            if (finalScript.trim().length > 0) {
              await runNarrationPipeline(finalScript);
            }
          } catch (qaError) {
            const message =
              qaError instanceof Error ? qaError.message : "Failed to run script QA step.";
            setPipeline((prev) => ({
              ...prev,
              steps: {
                ...prev.steps,
                scriptQA: {
                  ...prev.steps.scriptQA,
                  status: "error" as const,
                  errorMessage: message,
                },
              },
            }));

            if (trimmedScript.length > 0) {
              await runNarrationPipeline(trimmedScript);
            }
          }
        };

        if (producedVariables.VideoScript && stepId === "scriptQA") {
          await runNarrationPipeline(producedVariables.VideoScript);
        }

        if (producedVariables.VideoScript && stepId === "script") {
          await runScriptQaStep(producedVariables.VideoScript);
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
    [pipeline, promptOverrides],
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
        setScriptAudioGenerationTimeMs(performance.now() - startTime);
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            narrationAudio: {
              ...prev.steps.narrationAudio,
              status: "success" as const,
              errorMessage: undefined,
            },
          },
        }));
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
        setPipeline((prev) => ({
          ...prev,
          ...data,
          id: data.id ?? prev.id,
          projectSlug: data.projectSlug ?? prev.projectSlug,
          narrationModelId: normalizeNarrationModelId(
            data.narrationModelId ?? prev.narrationModelId,
          ),
        }));

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

  const newProject = useCallback(() => {
    setPipeline(() => createInitialPipeline());
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
        setPipeline((prev) => ({
          ...prev,
          ...data,
          narrationModelId: normalizeNarrationModelId(
            data.narrationModelId ?? prev.narrationModelId,
          ),
        }));
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
      setPipeline((prev) => ({
        ...prev,
        ...loadedPipeline,
        narrationModelId: normalizeNarrationModelId(
          loadedPipeline.narrationModelId ?? prev.narrationModelId,
        ),
      }));
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
        const nextSteps = {
          ...prev.steps,
          thumbnailGenerate: {
            ...ensureStepState(prev.steps, "thumbnailGenerate"),
            resolvedPrompt: prompt,
            responseText: versionedUrl ?? data.thumbnailPath ?? "",
            status: "success" as const,
            metrics: {
              inputTokens: usageInputTokens ?? 0,
              outputTokens: usageOutputTokens ?? 0,
              totalTokens:
                usageTotalTokens ?? usageInputTokens ?? usageOutputTokens ?? 0,
              costUsd: reportedCostUsd ?? 0,
              durationMs,
            },
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
    },
    derived: {
      sharedVars,
      totalGenerationDurationMs,
      hasAnyOutputs,
      hasScript,
      hasRuntimeMetrics,
      videoScriptStats,
    },
    actions: {
      setVariable,
      setTopic,
      setModel,
      setNarrationModel,
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
      generateThumbnail,
      downloadVoiceover,
      downloadThumbnail,
      exportFiles,
      exportScriptMarkdown,
    },
  };
}

export type UseAgentPipelineReturn = ReturnType<typeof useAgentPipeline>;



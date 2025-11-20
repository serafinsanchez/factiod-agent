"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  PipelineState,
  StepId,
  StepRunState,
  VariableKey,
} from "@/types/agent";

type ThumbnailImage =
  | {
      data?: string;
      mimeType?: string;
      url?: string;
    }
  | null;

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
    steps: createInitialSteps(),
    totalTokens: 0,
    totalCostUsd: 0,
  };
}

const PIPELINE_STORAGE_KEY = "pipeline:v1";

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
          return {
            ...base,
            ...parsed,
            model: normalizedModel,
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

  const [historyProjects, setHistoryProjects] = useState<HistoryProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeletingProjectId, setIsDeletingProjectId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
  }, [pipeline.videoScript, pipeline.narrationScript]);

  useEffect(() => {
    return () => {
      if (scriptAudioUrl && scriptAudioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(scriptAudioUrl);
      }
    };
  }, [scriptAudioUrl]);

  const setTopic = useCallback((topic: string) => {
    setPipeline((prev) => ({
      ...prev,
      topic,
    }));
  }, []);

  const setModel = useCallback((model: ModelId) => {
    setPipeline((prev) => ({
      ...prev,
      model,
    }));
  }, []);

  const setPromptOverride = useCallback((stepId: StepId, template: string) => {
    setPromptOverrides((prev) => ({
      ...prev,
      [stepId]: template,
    }));
  }, []);

  const resetPromptOverride = useCallback((stepId: StepId) => {
    setPromptOverrides((prev) => {
      if (prev[stepId] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
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
              status: "error",
              errorMessage: "Please enter a topic before running this step.",
            },
          },
        }));
        return;
      }

      const missingInputs = stepConfig.inputVars.filter((variable) => {
        if (variable === "Topic") {
          return false;
        }
        const value = getPipelineValueForVariable(pipeline, variable);
        return typeof value !== "string" || value.trim().length === 0;
      });

      if (missingInputs.length > 0) {
        const missingList = missingInputs.join(", ");
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              ...prev.steps[stepId],
              status: "error",
              errorMessage: `Missing: ${missingList}`,
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
            status: "running",
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
                status: "running",
                errorMessage: undefined,
              },
              narrationAudioTags: {
                ...prev.steps.narrationAudioTags,
                status: "idle",
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
                      status: "running",
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
                        status: "error",
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
                  status: "error",
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
                status: "running",
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
                  status: "error",
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
              status: "error",
              errorMessage: message,
            },
          },
        }));
      }
    },
    [pipeline, promptOverrides],
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
            status: "error",
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
        }));
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
            status: "error",
            errorMessage: message,
          },
        },
      }));
    } finally {
      setIsRunningAll(false);
    }
  }, [pipeline, promptOverrides]);

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

  const generateScriptAudio = useCallback(async () => {
    const script = pipeline.narrationScript?.trim() || pipeline.videoScript?.trim();
    if (!script) {
      return;
    }

    setIsGeneratingScriptAudio(true);
    setScriptAudioError(null);
    setScriptAudioUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setScriptAudioGenerationTimeMs(null);

    const projectSlug = getOrCreateProjectSlug(pipeline.projectSlug, pipeline.topic);
    const audioPath = buildProjectAudioPath(projectSlug);

    setPipeline((prev) => ({
      ...prev,
      projectSlug,
      audioPath,
    }));

    const startTime = performance.now();

    try {
      const response = await fetch("/api/tts/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: script, projectSlug }),
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate audio. Please try again.";
      setScriptAudioError(message);
    } finally {
      setIsGeneratingScriptAudio(false);
    }
  }, [pipeline]);

  const generateThumbnail = useCallback(async () => {
    const prompt = pipeline.thumbnailPrompt?.trim();
    if (!prompt) {
      return;
    }

    const projectSlug = getOrCreateProjectSlug(pipeline.projectSlug, pipeline.topic);
    const thumbnailPath = buildProjectThumbnailPath(projectSlug);

    setPipeline((prev) => ({
      ...prev,
      projectSlug,
      thumbnailPath,
    }));

    setIsGeneratingThumbnail(true);
    setThumbnailError(null);
    setThumbnailImage(null);
    setThumbnailGenerationTime(null);

    const startTime = performance.now();

    try {
      const res = await fetch("/api/gemini/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, projectSlug }),
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

      setThumbnailImage({
        data: data.imageBase64,
        mimeType: data.mimeType,
        url: publicUrl ?? undefined,
      });
      setThumbnailGenerationTime(performance.now() - startTime);
    } catch (err) {
      setThumbnailError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsGeneratingThumbnail(false);
    }
  }, [pipeline]);

  const downloadThumbnail = useCallback(() => {
    if (!thumbnailImage) {
      return;
    }
    const slug = slugifyTopic(pipeline.topic);
    const href =
      thumbnailImage.url ??
      (thumbnailImage.mimeType && thumbnailImage.data
        ? `data:${thumbnailImage.mimeType};base64,${thumbnailImage.data}`
        : null);
    if (!href) {
      return;
    }
    const link = document.createElement("a");
    link.href = href;
    link.download = `${slug}-thumbnail.png`;
    document.body?.appendChild(link);
    link.click();
    document.body?.removeChild(link);
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
      setTopic,
      setModel,
      setPromptOverride,
      resetPromptOverride,
      runStep,
      runAll,
      newProject,
      saveProject,
      selectProject,
      deleteProject,
      refreshHistory,
      generateScriptAudio,
      generateThumbnail,
      downloadThumbnail,
      exportFiles,
      exportScriptMarkdown,
    },
  };
}

export type UseAgentPipelineReturn = ReturnType<typeof useAgentPipeline>;



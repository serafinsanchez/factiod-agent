"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import StepCard from "../../components/StepCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { STEP_CONFIGS } from "../../lib/agent/steps";
import { DEFAULT_MODEL_ID, getModelOptions, normalizeModelId } from "../../lib/llm/models";
import { cn } from "@/lib/utils";
import { slugifyTopic } from "@/lib/slug";
import {
  buildProjectAudioPath,
  buildProjectThumbnailPath,
  getOrCreateProjectSlug,
  getPublicProjectFileUrl,
} from "@/lib/projects";
import type {
  ModelId,
  PipelineState,
  StepId,
  StepRunState,
  VariableKey,
} from "../../types/agent";

const MODEL_OPTIONS: ModelId[] = getModelOptions();

type StageId = "plan" | "script" | "publish";

type StageDefinition = {
  id: StageId;
  label: string;
  description: string;
  steps: StepId[];
};

const STAGES: StageDefinition[] = [
  {
    id: "plan",
    label: "Stage 1 – Plan & Hook",
    description: "Define key concepts, hook, and quizzes that shape the lesson.",
    steps: ["keyConcepts", "hook", "quizzes"],
  },
  {
    id: "script",
    label: "Stage 2 – Script & Narration",
    description: "Generate the long-form script and clean narration.",
    steps: ["script"],
  },
  {
    id: "publish",
    label: "Stage 3 – Title, Description & Thumbnail",
    description: "Create packaging that helps the video perform on YouTube.",
    steps: ["titleDescription", "thumbnail"],
  },
];

type HistoryProject = {
  id: string;
  topic: string;
  title?: string | null;
  projectSlug?: string | null;
  model: ModelId;
  createdAt?: string | null;
};

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
      // Ignore malformed entries or storage errors
    }
  }

  return createInitialPipeline();
}

function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain",
) {
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

export default function HomePage() {
  const [pipeline, setPipeline] = useState<PipelineState>(
    () => createInitialPipeline(),
  );
  const [promptOverrides, setPromptOverrides] = useState<
    Record<StepId, string | undefined>
  >(() => ({} as Record<StepId, string | undefined>));
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isGeneratingScriptAudio, setIsGeneratingScriptAudio] = useState(false);
  const [scriptAudioUrl, setScriptAudioUrl] = useState<string | null>(null);
  const [scriptAudioError, setScriptAudioError] = useState<string | null>(null);
const [scriptAudioGenerationTimeMs, setScriptAudioGenerationTimeMs] = useState<
  number | null
>(null);

  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailImage, setThumbnailImage] = useState<{
    data?: string;
    mimeType?: string;
    url?: string;
  } | null>(null);
  const [thumbnailGenerationTime, setThumbnailGenerationTime] = useState<
    number | null
  >(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  const [activeStageId, setActiveStageId] = useState<StageId>("plan");

  const [historyProjects, setHistoryProjects] = useState<HistoryProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeletingProjectId, setIsDeletingProjectId] = useState<string | null>(
    null,
  );
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
    const stepStates = pipeline.steps
      ? Object.values(pipeline.steps)
      : ([] as StepRunState[]);
    return stepStates.reduce((sum, step) => {
      return sum + (step.metrics?.durationMs ?? 0);
    }, 0);
  }, [pipeline.steps]);

  const refreshHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    setDeleteError(null);
    try {
      const response = await fetch("/api/history/list");
      const data = await response.json();

      if (!response.ok || data?.error) {
        const message =
          (typeof data?.error === "string" && data.error) ||
          "Failed to load projects.";
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

  const activeStage = useMemo(
    () => STAGES.find((stage) => stage.id === activeStageId) ?? STAGES[0],
    [activeStageId],
  );

  const visibleStepConfigs = useMemo(
    () =>
      STEP_CONFIGS.filter(
        (config) =>
          !config.hidden && activeStage.steps.includes(config.id),
      ),
    [activeStage],
  );

  // Load from localStorage after mount (client-only) to avoid hydration mismatch
  useEffect(() => {
    const loaded = loadInitialPipeline();
    setPipeline(loaded);
    // Initial history load (best-effort; ignore failures here)
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        PIPELINE_STORAGE_KEY,
        JSON.stringify(pipeline),
      );
    } catch {
      // Ignore storage failures (quota, privacy mode, etc.)
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
      if (scriptAudioUrl) {
        URL.revokeObjectURL(scriptAudioUrl);
      }
    };
  }, [scriptAudioUrl]);

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

  const handleGenerateScriptAudio = async () => {
    // Use narrationScript if available, otherwise fall back to videoScript
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

    const projectSlug = getOrCreateProjectSlug(
      pipeline.projectSlug,
      pipeline.topic,
    );
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
        error instanceof Error
          ? error.message
          : "Failed to generate audio. Please try again.";
      setScriptAudioError(message);
    } finally {
      setIsGeneratingScriptAudio(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    const prompt = pipeline.thumbnailPrompt?.trim();
    if (!prompt) {
      return;
    }

    setIsGeneratingThumbnail(true);
    setThumbnailError(null);
    setThumbnailImage(null);
    setThumbnailGenerationTime(null);

    // Use a small delay to ensure any pending state updates from saving have completed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Read the latest state values after the delay
    const projectSlug = getOrCreateProjectSlug(
      pipeline.projectSlug,
      pipeline.topic,
    );
    const thumbnailPath = buildProjectThumbnailPath(projectSlug);

    // Update pipeline state with slug and path
    setPipeline((prev) => ({
      ...prev,
      projectSlug,
      thumbnailPath,
    }));

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
  };

  const handleDownloadThumbnail = () => {
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
  };

  const handleTopicChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPipeline((prev) => ({
      ...prev,
      topic: value,
    }));
  };

  const handleModelChange = (value: string) => {
    setPipeline((prev) => ({
      ...prev,
      model: value as ModelId,
    }));
  };

  const handleRunStep = async (stepId: StepId) => {
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

      const producedVariables: Record<string, string> =
        data.producedVariables ?? {};
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

      // Auto-run narrationClean after script step completes successfully
      if (stepId === "script" && producedVariables.VideoScript) {
        const narrationCleanConfig = STEP_CONFIGS.find(
          (config) => config.id === "narrationClean",
        );
        if (narrationCleanConfig) {
          // Run narrationClean step automatically
          const narrationVariables: Record<string, string> = {
            VideoScript: producedVariables.VideoScript,
          };

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
                variables: narrationVariables,
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

                for (const [key, value] of Object.entries(
                  narrationProducedVariables,
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
                          PRODUCED_VARIABLE_TO_PIPELINE_FIELD[
                            key as VariableKey
                          ];
                        if (field) {
                          nextPipeline[field] = value;
                        }
                      }

                      nextPipeline.totalTokens = Object.values(
                        updatedSteps,
                      ).reduce(
                        (sum, step) => sum + (step.metrics?.totalTokens ?? 0),
                        0,
                      );
                      nextPipeline.totalCostUsd = Object.values(
                        updatedSteps,
                      ).reduce(
                        (sum, step) => sum + (step.metrics?.costUsd ?? 0),
                        0,
                      );

                      return nextPipeline;
                    });
                  } else {
                    throw new Error(
                      audioTagData?.error ||
                        "Failed to run narration audio tag step",
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
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run step.";
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
  };

  const handlePromptChange = (stepId: StepId, newTemplate: string) => {
    setPromptOverrides((prev) => ({
      ...prev,
      [stepId]: newTemplate,
    }));
  };

  const handleResetPrompt = (stepId: StepId) => {
    setPromptOverrides((prev) => ({
      ...prev,
      [stepId]: undefined,
    }));
  };

  const handleExportFiles = () => {
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
  };

  const handleExportScriptMd = () => {
    const script = pipeline.videoScript?.trim();
    if (!script) {
      return;
    }

    const slug = slugifyTopic(pipeline.topic);
    downloadTextFile(
      `${slug}-script.md`,
      script,
      "text/markdown",
    );
  };

  const handleNewProject = () => {
    setPipeline(() => createInitialPipeline());
    setPromptOverrides({});
    setSelectedProjectId(null);
    setActiveStageId("plan");
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
  };

  const handleSaveProject = async () => {
    const trimmedTopic = pipeline.topic.trim();
    if (!trimmedTopic) {
      setSaveError("Please enter a topic before saving.");
      return;
    }

    const projectSlug = getOrCreateProjectSlug(
      pipeline.projectSlug,
      pipeline.topic,
    );

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
  };

  const handleSelectProject = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setHistoryError(null);

    try {
      const response = await fetch(
        `/api/history/get?id=${encodeURIComponent(projectId)}`,
      );
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

      const thumbnailUrl = getPublicProjectFileUrl(
        loadedPipeline.thumbnailPath,
      );
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
  };

  const handleDeleteProject = async (projectId: string) => {
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
          (responseData &&
            typeof responseData.error === "string" &&
            responseData.error) ||
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

      setHistoryProjects((prev) =>
        prev.filter((project) => project.id !== projectId),
      );
      setSelectedProjectId((prev) => (prev === projectId ? null : prev));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete project.";
      setDeleteError(message);
    } finally {
      setIsDeletingProjectId((current) =>
        current === projectId ? null : current,
      );
    }
  };

  const handleRunAll = async () => {
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
      overrideEntries.length > 0
        ? Object.fromEntries(overrideEntries)
        : undefined;

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
          (typeof data?.error === "string" && data.error) ||
          "Failed to run all steps.";
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
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-black via-zinc-950 to-zinc-900 text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside className="mb-8 rounded-3xl border border-zinc-800/60 bg-zinc-950/60 p-4 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.8)] ring-1 ring-black/30 backdrop-blur lg:mb-0 lg:max-h-[calc(100vh-5rem)] lg:overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Projects
              </span>
              <p className="text-xs text-zinc-500">
                Saved videos appear here. Select one to reload it.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full border-zinc-700 bg-transparent px-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300 hover:border-amber-400 hover:bg-amber-500/10 hover:text-amber-50"
                onClick={handleNewProject}
              >
                New
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full border-zinc-700 bg-transparent text-zinc-400 hover:border-amber-400 hover:text-amber-200 disabled:opacity-60"
                onClick={() => {
                  void refreshHistory();
                }}
                disabled={isLoadingHistory}
              >
                {isLoadingHistory ? (
                  <span className="text-[0.65rem]">…</span>
                ) : (
                  <span className="text-xs">↻</span>
                )}
              </Button>
            </div>
          </div>
          {historyError && (
            <p className="mt-3 text-xs text-rose-400">{historyError}</p>
          )}
          {deleteError && (
            <p className="mt-2 text-xs text-rose-400">{deleteError}</p>
          )}
          <div className="mt-4 space-y-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-10rem)]">
            {historyProjects.length === 0 && !isLoadingHistory ? (
              <p className="text-xs text-zinc-600">
                No projects saved yet. Run the pipeline, then save your first
                project.
              </p>
            ) : (
              historyProjects.map((project) => {
                const isActive = project.id === selectedProjectId;
                const title =
                  project.title && project.title.trim().length > 0
                    ? project.title
                    : project.topic;
                const subtitle = project.model;
                const isDeleting = isDeletingProjectId === project.id;

                return (
                  <div
                    key={project.id}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs transition",
                      "border-zinc-800/80 bg-zinc-900/40 hover:border-amber-500/70 hover:bg-amber-500/5",
                      isActive &&
                        "border-amber-500/90 bg-amber-500/10 text-amber-50",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void handleSelectProject(project.id);
                      }}
                      className="flex flex-1 flex-col items-start text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/70"
                    >
                      <span className="line-clamp-2 text-[0.8rem] font-medium">
                        {title}
                      </span>
                      <span className="mt-0.5 text-[0.7rem] text-zinc-500">
                        {subtitle}
                      </span>
                      {project.createdAt && (
                        <span className="mt-0.5 text-[0.65rem] text-zinc-600">
                          {new Date(project.createdAt).toLocaleString()}
                        </span>
                      )}
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete project ${title}`}
                      disabled={isDeleting}
                      onClick={() => {
                        void handleDeleteProject(project.id);
                      }}
                      className={cn(
                        "flex-shrink-0 rounded-full px-2 py-1 text-sm text-zinc-500 opacity-0 transition-opacity duration-150 hover:bg-rose-500/20 hover:text-rose-100",
                        "group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
                        isDeleting && "text-rose-200",
                        isActive && "text-amber-100 hover:bg-rose-500/20 hover:text-rose-100",
                      )}
                    >
                      <span aria-hidden="true">{isDeleting ? "…" : "×"}</span>
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex flex-col gap-10">
          <header className="rounded-3xl border border-zinc-800/60 bg-zinc-950/60 p-8 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.8)] ring-1 ring-black/30 backdrop-blur">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium uppercase tracking-[0.3em] text-zinc-500">
                    Factoids Agent
                  </span>
                </div>
                <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
                  Agentic Kids Video Builder
                </h1>
                <p className="max-w-xl text-sm text-zinc-400">
                  Configure your topic, pick a model, and monitor each step of
                  the six-stage pipeline. Prompts and outputs will live here as
                  we wire up the flow.
                </p>
              </div>
              <RadioGroup
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-zinc-800/70 bg-zinc-900/60 p-4 text-sm lg:w-auto"
                value={pipeline.model}
                onValueChange={handleModelChange}
              >
                {MODEL_OPTIONS.map((option) => (
                  <div
                    key={option}
                    className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-zinc-800/80"
                  >
                    <RadioGroupItem
                      id={`model-${option}`}
                      value={option}
                      className="border-zinc-500 text-amber-400 focus-visible:outline-amber-400"
                    />
                    <Label
                      htmlFor={`model-${option}`}
                      className="text-sm font-medium capitalize text-zinc-300"
                    >
                      {option.replace("-thinking", "")}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-end">
              <div className="space-y-2">
                <Label
                  htmlFor="topic"
                  className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500"
                >
                  Topic
                </Label>
                <Input
                  id="topic"
                  placeholder="e.g. How volcanoes work"
                  value={pipeline.topic}
                  onChange={handleTopicChange}
                  className="h-12 rounded-2xl border-zinc-800 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/60"
                />
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-950/70 p-4 shadow-inner shadow-black/60">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Totals
                </span>
                <div className="mt-2 text-lg font-semibold text-zinc-200">
                  {pipeline.totalTokens.toLocaleString()} tokens
                </div>
                <div className="text-sm text-amber-300">
                  ${pipeline.totalCostUsd.toFixed(3)}
                </div>
                {hasRuntimeMetrics && (
                  <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-3 text-sm text-zinc-100">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-zinc-500">
                      Runtime
                    </span>
                    <div className="mt-2 space-y-1">
                      {totalGenerationDurationMs > 0 && (
                        <div className="flex items-center justify-between">
                          <span>LLM generation</span>
                          <span className="font-semibold">
                            {(totalGenerationDurationMs / 1000).toFixed(1)}s
                          </span>
                        </div>
                      )}
                      {scriptAudioGenerationTimeMs !== null && (
                        <div className="flex items-center justify-between">
                          <span>Audio</span>
                          <span className="font-semibold">
                            {(scriptAudioGenerationTimeMs / 1000).toFixed(1)}s
                          </span>
                        </div>
                      )}
                      {thumbnailGenerationTime !== null && (
                        <div className="flex items-center justify-between">
                          <span>Thumbnail</span>
                          <span className="font-semibold">
                            {(thumbnailGenerationTime / 1000).toFixed(1)}s
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-1 flex flex-col gap-2">
                  <Button
                    className="w-full rounded-xl bg-amber-500/90 text-black shadow hover:bg-amber-500 disabled:opacity-60"
                    onClick={handleRunAll}
                    disabled={isRunningAll || !pipeline.topic.trim()}
                  >
                    {isRunningAll ? "Running…" : "Run All Steps (Auto)"}
                  </Button>
                  <Button
                    className="w-full rounded-xl bg-emerald-500/90 text-black shadow hover:bg-emerald-500 disabled:opacity-60"
                    onClick={handleSaveProject}
                    disabled={isSavingProject || !pipeline.topic.trim()}
                  >
                    {isSavingProject ? "Saving…" : "Save Project"}
                  </Button>
                  <Button
                    className="w-full rounded-xl bg-zinc-800/80 text-zinc-100 shadow hover:bg-zinc-700 disabled:opacity-60"
                    onClick={handleExportFiles}
                    disabled={!hasAnyOutputs}
                    variant="outline"
                  >
                    Export Files
                  </Button>
                  <Button
                    className="w-full rounded-xl border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 disabled:opacity-60"
                    onClick={handleExportScriptMd}
                    disabled={!hasScript}
                    variant="outline"
                  >
                    Export Script (.md)
                  </Button>
                </div>
                {saveError && (
                  <p className="mt-1 text-xs text-rose-400">{saveError}</p>
                )}
              </div>
            </div>
          </header>

          <Card className="border-zinc-800/60 bg-zinc-950/60 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] backdrop-blur">
            <CardContent className="p-6">
              <div className="space-y-4">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Variable Preview
                </span>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      ["Topic", "topic"],
                      ["KeyConcepts", "keyConcepts"],
                      ["HookScript", "hookScript"],
                      ["QuizInfo", "quizInfo"],
                      ["VideoScript", "videoScript"],
                      ["NarrationScript", "narrationScript"],
                      ["Title", "title"],
                      ["Description", "description"],
                      ["ThumbnailPrompt", "thumbnailPrompt"],
                    ] as Array<[VariableKey, keyof typeof sharedVars]>
                  ).map(([variable, sharedKey]) => {
                    const value = sharedVars[sharedKey];
                    const hasValue =
                      typeof value === "string" && value.trim().length > 0;
                    return (
                      <div
                        key={variable}
                        className={cn(
                          "rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4",
                          hasValue && "border-amber-500/50 bg-amber-500/10",
                        )}
                      >
                        <div
                          className={cn(
                            "text-[0.7rem] font-semibold uppercase tracking-widest text-zinc-500",
                            hasValue && "text-amber-300",
                          )}
                        >
                          {variable}
                        </div>
                        <div className="mt-2 min-h-10 font-mono text-sm text-zinc-200">
                          {value ? (
                            <pre className="whitespace-pre-wrap">
                              {value.length > 280
                                ? `${value.slice(0, 280)}…`
                                : value}
                            </pre>
                          ) : (
                            <span className="text-zinc-500">(empty)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <main className="flex flex-col gap-6 pb-16">
          <section className="rounded-3xl border border-zinc-800/60 bg-zinc-950/60 p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Workflow Stages
                </span>
                <p className="text-sm text-zinc-400">
                  Move through the project one stage at a time so you only see the
                  steps you&apos;re working on.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {STAGES.map((stage) => {
                const stepStates = stage.steps.map(
                  (id) => pipeline.steps[id],
                );
                const completedCount = stepStates.filter(
                  (s) => s && s.status === "success",
                ).length;
                const totalCount = stepStates.length;
                const isActive = stage.id === activeStage.id;

                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setActiveStageId(stage.id)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition",
                      "border-zinc-800 bg-zinc-950/60 hover:border-amber-500/60 hover:bg-amber-500/5",
                      isActive &&
                        "border-amber-500/80 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.4)]",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                        {stage.label}
                      </div>
                      <div className="rounded-full bg-zinc-900 px-2 py-0.5 text-[0.7rem] text-zinc-400">
                        {completedCount}/{totalCount} done
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500">{stage.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6">
            {visibleStepConfigs.map((config) => {
              const stepState = pipeline.steps[config.id];
              const isScriptStep = config.id === "script";
              const isThumbnailStep = config.id === "thumbnail";

              return (
                <div key={config.id} className="space-y-4">
                  <StepCard
                    stepConfig={config}
                    stepState={stepState}
                    sharedVars={sharedVars}
                    templateValue={
                      promptOverrides[config.id] ?? config.promptTemplate
                    }
                    onRunStep={handleRunStep}
                    onPromptChange={handlePromptChange}
                    onResetPrompt={handleResetPrompt}
                  />
                  {isScriptStep && (
                    <div className="space-y-4 rounded-2xl border border-zinc-800/60 bg-zinc-950/60 p-4">
                      {videoScriptStats && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                            <div className="text-[0.7rem] font-semibold uppercase tracking-widest text-emerald-200">
                              Word Count
                            </div>
                            <div className="mt-1 text-2xl font-semibold text-emerald-50">
                              {videoScriptStats.words.toLocaleString()}
                            </div>
                            <p className="text-xs text-emerald-100/80">
                              Target ≥ 1,600 words for a 10-min narration.
                            </p>
                          </div>
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="text-[0.7rem] font-semibold uppercase tracking-widest text-zinc-400">
                              Character Count
                            </div>
                            <div className="mt-1 text-2xl font-semibold text-zinc-100">
                              {videoScriptStats.characters.toLocaleString()}
                            </div>
                            <p className="text-xs text-zinc-400">
                              Includes spaces and punctuation.
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                            Narration
                          </p>
                          <p className="text-sm text-zinc-400">
                            Generate ElevenLabs audio narration for this script.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="rounded-xl border-zinc-700 bg-transparent text-zinc-100 hover:border-amber-400 hover:bg-amber-500/90 hover:text-black disabled:opacity-60"
                          onClick={handleGenerateScriptAudio}
                          disabled={isGeneratingScriptAudio || !hasScript}
                        >
                          {isGeneratingScriptAudio
                            ? "Generating audio…"
                            : "Generate Voice for Script"}
                        </Button>
                      </div>
                      {scriptAudioError && (
                        <div
                          role="alert"
                          className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
                        >
                          {scriptAudioError}
                        </div>
                      )}
                      {scriptAudioUrl && (
                        <div className="mt-3 space-y-2">
                          <audio
                            controls
                            src={scriptAudioUrl}
                            className="w-full"
                          />
                          <a
                            href={scriptAudioUrl}
                            download={`${slugifyTopic(pipeline.topic)}-script.mp3`}
                            className="text-sm text-amber-300 underline hover:text-amber-200"
                          >
                            Download audio
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  {isThumbnailStep && (
                    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                            Thumbnail Image
                          </p>
                          <p className="text-sm text-zinc-400">
                            Generate a 16:9 thumbnail using Gemini Nano Banana 2.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="rounded-xl border-zinc-700 bg-transparent text-zinc-100 hover:border-amber-400 hover:bg-amber-500/90 hover:text-black disabled:opacity-60"
                          onClick={handleGenerateThumbnail}
                          disabled={
                            isGeneratingThumbnail ||
                            !pipeline.thumbnailPrompt?.trim()
                          }
                        >
                          {isGeneratingThumbnail
                            ? "Generating image…"
                            : "Generate Thumbnail"}
                        </Button>
                      </div>
                      {thumbnailError && (
                        <div
                          role="alert"
                          className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
                        >
                          {thumbnailError}
                        </div>
                      )}
                      {thumbnailImage && (
                        <div className="mt-4 space-y-3">
                          <div className="overflow-hidden rounded-xl border border-zinc-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                            src={
                              thumbnailImage.url ??
                              (thumbnailImage.mimeType && thumbnailImage.data
                                ? `data:${thumbnailImage.mimeType};base64,${thumbnailImage.data}`
                                : undefined)
                            }
                              alt="Generated thumbnail"
                              className="w-full"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            {thumbnailGenerationTime && (
                              <span className="text-xs text-zinc-500">
                                Generated in{" "}
                                {(thumbnailGenerationTime / 1000).toFixed(1)}s
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              className="h-8 text-sm text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                              onClick={handleDownloadThumbnail}
                            >
                              Download Image
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
          </main>
        </div>
      </div>
    </div>
  );
}

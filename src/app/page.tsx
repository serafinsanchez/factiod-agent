"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";

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
import { cn } from "@/lib/utils";
import type {
  ModelId,
  PipelineState,
  StepId,
  StepRunState,
  VariableKey,
} from "../../types/agent";

const MODEL_OPTIONS: ModelId[] = ["gpt5-thinking", "kimik2-thinking"];

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
    model: "gpt5-thinking",
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
          return {
            ...base,
            ...parsed,
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

function slugifyTopic(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "untitled"
  );
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
    () => loadInitialPipeline(),
  );
  const [promptOverrides, setPromptOverrides] = useState<
    Record<StepId, string | undefined>
  >(() => ({} as Record<StepId, string | undefined>));
  const [isRunningAll, setIsRunningAll] = useState(false);

  const sharedVars = useMemo(
    () => ({
      topic: pipeline.topic,
      keyConcepts: pipeline.keyConcepts,
      hookScript: pipeline.hookScript,
      quizInfo: pipeline.quizInfo,
      videoScript: pipeline.videoScript,
      title: pipeline.title,
      description: pipeline.description,
      thumbnailPrompt: pipeline.thumbnailPrompt,
    }),
    [pipeline],
  );

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

  const hasAnyOutputs =
    Boolean(pipeline.keyConcepts?.trim()) ||
    Boolean(pipeline.hookScript?.trim()) ||
    Boolean(pipeline.quizInfo?.trim()) ||
    Boolean(pipeline.title?.trim()) ||
    Boolean(pipeline.description?.trim()) ||
    Boolean(pipeline.thumbnailPrompt?.trim());

  const hasScript = Boolean(pipeline.videoScript?.trim());

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

      setPipeline((prev) => {
        const producedVariables: Record<string, string> =
          data.producedVariables ?? {};

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
        setPipeline(data);
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
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10">
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
              <div className="mt-1 flex flex-col gap-2">
                <Button
                  className="w-full rounded-xl bg-amber-500/90 text-black shadow hover:bg-amber-500 disabled:opacity-60"
                  onClick={handleRunAll}
                  disabled={isRunningAll || !pipeline.topic.trim()}
                >
                  {isRunningAll ? "Running…" : "Run All Steps (Auto)"}
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

        <main className="grid gap-6 pb-16">
          {STEP_CONFIGS.map((config) => (
            <StepCard
              key={config.id}
              stepConfig={config}
              stepState={pipeline.steps[config.id]}
              sharedVars={sharedVars}
              templateValue={promptOverrides[config.id] ?? config.promptTemplate}
              onRunStep={handleRunStep}
              onPromptChange={handlePromptChange}
              onResetPrompt={handleResetPrompt}
            />
          ))}
        </main>
      </div>
    </div>
  );
}

// components/StepCard.tsx
"use client";

import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  PipelineState,
  StepConfig,
  StepId,
  StepRunState,
  VariableKey,
} from "../types/agent";

type SharedVars = Pick<
  PipelineState,
  | "topic"
  | "keyConcepts"
  | "hookScript"
  | "quizInfo"
  | "videoScript"
  | "narrationScript"
  | "title"
  | "description"
  | "thumbnailPrompt"
>;

interface StepCardProps {
  stepConfig: StepConfig;
  stepState: StepRunState;
  sharedVars: SharedVars;
  templateValue: string;
  onRunStep: (stepId: StepId) => void;
  onPromptChange: (stepId: StepId, newTemplate: string) => void;
  onResetPrompt: (stepId: StepId) => void;
}

/**
 * Maps VariableKeys to SharedVars fields.
 * Note: ProductionScript, SceneImagePrompts, SceneVideoPrompts are JSON outputs
 * stored as structured data, not simple string fields.
 */
const VARIABLE_MAP: Partial<Record<VariableKey, keyof SharedVars>> = {
  Topic: "topic",
  KeyConcepts: "keyConcepts",
  HookScript: "hookScript",
  QuizInfo: "quizInfo",
  VideoScript: "videoScript",
  NarrationScript: "narrationScript",
  Title: "title",
  Description: "description",
  ThumbnailPrompt: "thumbnailPrompt",
  // ProductionScript, SceneImagePrompts, SceneVideoPrompts are not in SharedVars
};

export default function StepCard({
  stepConfig,
  stepState,
  sharedVars,
  templateValue,
  onRunStep,
  onPromptChange,
  onResetPrompt,
}: StepCardProps) {
  const handlePromptInput = (
    event: ChangeEvent<HTMLTextAreaElement>,
  ) => {
    onPromptChange(stepConfig.id, event.target.value);
  };

  const handleRun = () => {
    onRunStep(stepConfig.id);
  };

  const handleReset = () => {
    onResetPrompt(stepConfig.id);
  };

  const metrics = stepState.metrics;
  const isRunning = stepState.status === "running";

  const missingVars = stepConfig.inputVars.filter((variable) => {
    const sharedKey = VARIABLE_MAP[variable];
    if (!sharedKey) {
      return false;
    }
    const value = sharedVars[sharedKey];
    return typeof value !== "string" || value.trim().length === 0;
  });

  const topicMissing =
    typeof sharedVars.topic !== "string" || sharedVars.topic.trim().length === 0;

  let runDisabledReason: string | undefined;
  if (isRunning) {
    runDisabledReason = "Step is currently running.";
  } else if (topicMissing) {
    runDisabledReason = "Enter a topic before running this step.";
  } else if (missingVars.length > 0) {
    runDisabledReason = `Missing: ${missingVars.join(", ")}`;
  }

  const canRun = !runDisabledReason;

  const cardStatusClasses = cn(
    "scroll-mt-24 border transition-shadow focus-within:ring-1",
    "border-zinc-800/60 bg-zinc-950/60 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)] backdrop-blur",
    stepState.status === "running" &&
      "border-amber-500/50 ring-1 ring-amber-500/40 shadow-amber-500/10",
    stepState.status === "error" &&
      "border-rose-500/40 ring-1 ring-rose-400/40 shadow-rose-500/10",
    stepState.status === "success" &&
      "border-emerald-500/30 ring-1 ring-emerald-400/30 shadow-emerald-500/10",
  );

  return (
    <Card
      id={`step-${stepConfig.id}`}
      className={cardStatusClasses}
      aria-live={stepState.status === "error" ? "assertive" : undefined}
    >
      <CardHeader className="gap-4 border-b border-zinc-900/70 pb-6">
        <CardTitle className="text-lg font-semibold tracking-tight text-zinc-100">
          {stepConfig.label}
        </CardTitle>
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          {stepConfig.inputVars.length === 0 ? (
            <span className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-1">
              No upstream variables
            </span>
          ) : (
            stepConfig.inputVars.map((variable) => {
              const sharedKey = VARIABLE_MAP[variable];
              // For JSON variables (ProductionScript, etc.) that aren't in SharedVars,
              // we show them as available (they're handled separately)
              const value = sharedKey ? sharedVars[sharedKey] : undefined;
              const hasValue =
                typeof value === "string" && value.trim().length > 0;
              // Consider JSON variables as "special" - show different styling
              const isJsonVariable = !sharedKey;
              return (
                <span
                  key={variable}
                  className={cn(
                    "rounded-xl border px-3 py-1",
                    isJsonVariable
                      ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                      : hasValue
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                        : "border-zinc-800/80 bg-zinc-900/60 text-zinc-500",
                  )}
                >
                  {variable}
                </span>
              );
            })
          )}
        </div>
        {runDisabledReason && !isRunning && (
          <div aria-live="polite">
            <div
              className={cn(
                "mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
                missingVars.length > 0
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-zinc-700 bg-zinc-900/70 text-zinc-300",
              )}
            >
              {runDisabledReason}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            size="sm"
            className="rounded-xl bg-amber-500/90 px-4 text-black shadow hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleRun}
            disabled={!canRun}
            aria-disabled={!canRun}
            title={!canRun ? runDisabledReason : undefined}
          >
            Run Step
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
            onClick={handleReset}
          >
            Reset Prompt
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 py-6">
        {stepState.status === "error" && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200 shadow-inner shadow-rose-500/20"
          >
            {stepState.errorMessage ?? "Step failed."}
          </div>
        )}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Prompt Template
          </span>
          <Textarea
            value={templateValue}
            onChange={handlePromptInput}
            className="max-h-72 min-h-[180px] resize-none rounded-2xl border-zinc-800 bg-zinc-900/70 text-sm leading-relaxed text-zinc-200"
          />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Resolved Prompt
          </span>
          <div className="min-h-24 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 p-4 font-mono text-sm text-zinc-500">
            {stepState.status === "running" ? (
              "Running…"
            ) : stepState.resolvedPrompt ? (
              <pre className="whitespace-pre-wrap text-zinc-100">
                {stepState.resolvedPrompt}
              </pre>
            ) : (
              "Awaiting run…"
            )}
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Output
          </span>
          <div className="min-h-24 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 p-4 font-mono text-sm text-zinc-500">
            {stepState.status === "running" ? (
              "Running…"
            ) : stepState.status === "error" ? (
              <span className="font-semibold text-rose-400">
                {stepState.errorMessage ?? "Step failed."}
              </span>
            ) : stepState.responseText ? (
              <pre className="whitespace-pre-wrap text-zinc-100">
                {stepState.responseText}
              </pre>
            ) : (
              "Awaiting run…"
            )}
          </div>
        </div>
        {metrics ? (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Metrics
            </span>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-[0.7rem] font-semibold uppercase tracking-widest text-zinc-500">
                  Input Tokens
                </div>
                <div className="mt-1 text-lg font-semibold text-zinc-100">
                  {metrics.inputTokens.toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-[0.7rem] font-semibold uppercase tracking-widest text-zinc-500">
                  Output Tokens
                </div>
                <div className="mt-1 text-lg font-semibold text-zinc-100">
                  {metrics.outputTokens.toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-[0.7rem] font-semibold uppercase tracking-widest text-zinc-500">
                  Total Tokens
                </div>
                <div className="mt-1 text-lg font-semibold text-zinc-100">
                  {metrics.totalTokens.toLocaleString()}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4">
                <div className="text-[0.7rem] font-semibold uppercase tracking-widest text-amber-400">
                  Cost (USD)
                </div>
                <div className="mt-1 text-lg font-semibold text-amber-200">
                  ${metrics.costUsd.toFixed(4)}
                </div>
              </div>
              {typeof metrics.durationMs === "number" && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="text-[0.7rem] font-semibold uppercase tracking-widest text-zinc-500">
                    Duration
                  </div>
                  <div className="mt-1 text-lg font-semibold text-zinc-100">
                    {(metrics.durationMs / 1000).toFixed(1)}s
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}


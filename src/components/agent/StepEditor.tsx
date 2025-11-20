"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  PipelineState,
  StepConfig,
  StepId,
  StepRunState,
  VariableKey,
} from "@/types/agent";

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

interface StepEditorProps {
  stepConfig: StepConfig;
  stepState: StepRunState;
  sharedVars: SharedVars;
  templateValue: string;
  onRunStep: (stepId: StepId) => void;
  onPromptChange: (stepId: StepId, newTemplate: string) => void;
  onResetPrompt: (stepId: StepId) => void;
}

const VARIABLE_MAP: Record<VariableKey, keyof SharedVars> = {
  Topic: "topic",
  KeyConcepts: "keyConcepts",
  HookScript: "hookScript",
  QuizInfo: "quizInfo",
  VideoScript: "videoScript",
  NarrationScript: "narrationScript",
  Title: "title",
  Description: "description",
  ThumbnailPrompt: "thumbnailPrompt",
};

export function StepEditor({
  stepConfig,
  stepState,
  sharedVars,
  templateValue,
  onRunStep,
  onPromptChange,
  onResetPrompt,
}: StepEditorProps) {
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);

  const finalScriptStats = useMemo(() => {
    if (stepConfig.id !== "scriptQA") {
      return null;
    }
    const text = sharedVars.videoScript?.trim();
    if (!text) {
      return null;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    const characters = text.length;
    return { words, characters };
  }, [sharedVars.videoScript, stepConfig.id]);

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
  if (stepState.status === "running") {
    runDisabledReason = "Step is currently running.";
  } else if (topicMissing) {
    runDisabledReason = "Enter a topic before running this step.";
  } else if (missingVars.length > 0) {
    runDisabledReason = `Missing: ${missingVars.join(", ")}`;
  }

  const cardStatusClasses = cn(
    "border transition-shadow focus-within:ring-1",
    "border-zinc-900 bg-zinc-950/70 shadow-[0_25px_80px_-60px_rgba(0,0,0,0.9)] backdrop-blur",
    stepState.status === "running" &&
      "border-white/40 ring-1 ring-white/30 shadow-white/5",
    stepState.status === "error" &&
      "border-rose-500/40 ring-1 ring-rose-400/30 shadow-rose-500/10",
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl font-semibold tracking-tight text-white">
              {stepConfig.label}
            </CardTitle>
            <div className="flex flex-wrap gap-2 text-xs">
              {stepConfig.inputVars.length === 0 ? (
                <span className="rounded-full border border-zinc-800/80 px-3 py-1 text-zinc-500">
                  No upstream variables
                </span>
              ) : (
                stepConfig.inputVars.map((variable) => {
                  const sharedKey = VARIABLE_MAP[variable];
                  const value = sharedKey ? sharedVars[sharedKey] : undefined;
                  const hasValue = typeof value === "string" && value.trim().length > 0;
                  return (
                    <span
                      key={variable}
                      className={cn(
                        "rounded-full border px-3 py-1",
                        hasValue
                          ? "border-white/30 bg-white/10 text-white"
                          : "border-zinc-800/80 bg-zinc-900/60 text-zinc-500",
                      )}
                    >
                      {variable}
                    </span>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-full bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
              onClick={() => onRunStep(stepConfig.id)}
              disabled={Boolean(runDisabledReason)}
              title={runDisabledReason}
            >
              Run step
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-900"
              onClick={() => onResetPrompt(stepConfig.id)}
            >
              Reset prompt
            </Button>
          </div>
        </div>

        {runDisabledReason && stepState.status !== "running" && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-xs text-zinc-300">
            {runDisabledReason}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-6 py-6 lg:flex-row">
        <div className="w-full space-y-4 lg:w-1/2">
          {stepState.status === "error" && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
            >
              {stepState.errorMessage ?? "Step failed."}
            </div>
          )}

          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                Advanced prompt
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs text-zinc-300 hover:bg-zinc-900"
                onClick={() => setShowAdvancedPrompt((prev) => !prev)}
              >
                {showAdvancedPrompt ? "Hide" : "Show"}
              </Button>
            </div>
            {showAdvancedPrompt && (
              <div className="mt-3 space-y-3">
                <Textarea
                  value={templateValue}
                  onChange={(event) => onPromptChange(stepConfig.id, event.target.value)}
                  className="min-h-[180px] resize-none rounded-2xl border-zinc-900 bg-zinc-900/60 text-sm text-white"
                />
                <p className="text-xs text-zinc-500">
                  Templates support variable interpolation like <code>[Topic]</code>.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="w-full space-y-4 lg:w-1/2">
          <div className="space-y-2 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Resolved prompt
            </p>
            <div className="min-h-24 rounded-2xl border border-dashed border-zinc-900/60 bg-zinc-900/30 p-3 text-sm text-zinc-200">
              {stepState.status === "running"
                ? "Running…"
                : stepState.resolvedPrompt
                  ? stepState.resolvedPrompt
                  : "Awaiting run…"}
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Output
            </p>
            <div className="min-h-24 rounded-2xl border border-dashed border-zinc-900/60 bg-zinc-900/30 p-3 text-sm text-zinc-200">
              {stepState.status === "running"
                ? "Running…"
                : stepState.status === "error"
                  ? stepState.errorMessage ?? "Step failed."
                  : stepState.responseText || "Awaiting run…"}
            </div>
          </div>

          {finalScriptStats && (
            <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white/80">
                Final script stats
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MetricTile label="Word count" value={finalScriptStats.words.toLocaleString()} />
                <MetricTile label="Character count" value={finalScriptStats.characters.toLocaleString()} />
              </div>
              <p className="mt-2 text-xs text-white/80">
                Counts include the QA-improved script only (checklist excluded).
              </p>
            </div>
          )}

          {stepState.metrics && (
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Input tokens" value={stepState.metrics.inputTokens.toLocaleString()} />
              <MetricTile label="Output tokens" value={stepState.metrics.outputTokens.toLocaleString()} />
              <MetricTile label="Total tokens" value={stepState.metrics.totalTokens.toLocaleString()} />
              <MetricTile label="Cost (USD)" value={`$${stepState.metrics.costUsd.toFixed(4)}`} accent />
              {typeof stepState.metrics.durationMs === "number" && (
                <MetricTile
                  label="Duration"
                  value={`${(stepState.metrics.durationMs / 1000).toFixed(1)}s`}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent ? "border-white/30 bg-white/10 text-white" : "border-zinc-900 bg-zinc-950/70",
      )}
    >
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}


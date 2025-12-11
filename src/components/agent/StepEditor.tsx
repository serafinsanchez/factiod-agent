"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { ensureChecklistWordCount, extractChecklist } from "@/lib/agent/checklist";
import { cn } from "@/lib/utils";
import type {
  PipelineState,
  StepConfig,
  StepId,
  StepRunState,
  VariableKey,
} from "@/types/agent";
import { LongTextPreview } from "./LongTextPreview";

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
  pipeline: PipelineState;
  templateValue: string;
  onRunStep: (stepId: StepId) => void;
  onPromptChange: (stepId: StepId, newTemplate: string) => void;
  onEditVariable?: (variable: VariableKey) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function StepEditor({
  stepConfig,
  stepState,
  sharedVars,
  pipeline,
  templateValue: _templateValue,
  onRunStep,
  onPromptChange: _onPromptChange,
  onEditVariable,
  isCollapsed = false,
  onToggleCollapse,
}: StepEditorProps) {
  const contentRegionId = `step-${stepConfig.id}-content`;

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

  const isScriptQaStep = stepConfig.id === "scriptQA";
  const isScriptStep = stepConfig.id === "script";
  const isNarrationAudioTagsStep = stepConfig.id === "narrationAudioTags";
  const isNarrationTimestampsStep = stepConfig.id === "narrationTimestamps";
  const isNarrationStep = isNarrationAudioTagsStep;
  
  // Format narrationTimestamps step to show only scene-level timestamps
  const formattedResponseText = useMemo(() => {
    if (!isNarrationTimestampsStep || stepState.status === "running" || stepState.status === "error") {
      return null; // Use default handling
    }
    if (!stepState.responseText) {
      return null;
    }
    try {
      const parsed = JSON.parse(stepState.responseText);
      if (parsed.sceneTimestamps && Array.isArray(parsed.sceneTimestamps)) {
        // Return only the sceneTimestamps array, formatted nicely
        return JSON.stringify(parsed.sceneTimestamps, null, 2);
      }
    } catch {
      // If parsing fails, fall back to original responseText
    }
    return null;
  }, [isNarrationTimestampsStep, stepState.status, stepState.responseText]);
  
  const resolvedOutputText =
    stepState.status === "running"
      ? "Running…"
      : stepState.status === "error"
        ? stepState.errorMessage ?? "Step failed."
        : formattedResponseText ?? stepState.responseText ?? "Awaiting run…";
  const finalScriptWordCount = finalScriptStats?.words ?? null;

  const qaChecklistText = useMemo(() => {
    if (!isScriptQaStep) {
      return null;
    }
    if (stepState.status === "running") {
      return "Running…";
    }
    if (stepState.status === "error") {
      return stepState.errorMessage ?? "Step failed.";
    }
    if (!stepState.responseText) {
      return "Awaiting run…";
    }
    let checklist = extractChecklist(stepState.responseText);
    if (finalScriptWordCount) {
      checklist = ensureChecklistWordCount(checklist, finalScriptWordCount);
    }
    return checklist;
  }, [
    finalScriptWordCount,
    isScriptQaStep,
    stepState.status,
    stepState.errorMessage,
    stepState.responseText,
  ]);
  const finalScriptPreview = sharedVars.videoScript?.trim();
  const finalScriptPreviewText =
    finalScriptPreview ??
    "No QA-improved script yet. Run the Script + Script QA steps to populate this preview.";
  const stepResponseText = stepState.responseText?.trim() ?? "";
  const stepResultModalTitle = isNarrationAudioTagsStep
    ? "Narration with audio tags"
    : "Step result";
  const stepResultViewLabel =
    isScriptStep || isNarrationStep ? "View full script" : "View full result";
  const stepResultCopyLabel =
    isScriptStep || isNarrationStep ? "Copy script" : "Copy text";

  const topicMissing =
    typeof sharedVars.topic !== "string" || sharedVars.topic.trim().length === 0;

  let runDisabledReason: string | undefined;
  if (stepState.status === "running") {
    runDisabledReason = "Step is currently running.";
  } else if (topicMissing) {
    runDisabledReason = "Enter a topic before running this step.";
  }

  const cardStatusClasses = cn(
    "border transition-shadow focus-within:ring-1",
    "border-zinc-900 bg-zinc-950/70 shadow-[0_25px_80px_-60px_rgba(0,0,0,0.9)] backdrop-blur",
    stepState.status === "running" &&
      "border-white/40 ring-1 ring-white/30 shadow-white/5",
    stepState.status === "stale" &&
      "border-amber-500/40 ring-1 ring-amber-400/30 shadow-amber-500/10",
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
      <CardHeader className="space-y-4 border-b border-zinc-900/70 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl font-semibold tracking-tight text-white">
              {stepConfig.label}
            </CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onToggleCollapse && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-950/40 px-3 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-zinc-200 hover:border-white/40 hover:bg-white/10 hover:text-white"
                onClick={onToggleCollapse}
                aria-expanded={!isCollapsed}
                aria-controls={contentRegionId}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isCollapsed ? "-rotate-90" : "rotate-0",
                  )}
                />
                {isCollapsed ? "Expand" : "Collapse"}
              </Button>
            )}
            <Button
              size="sm"
              className="rounded-full bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
              onClick={() => onRunStep(stepConfig.id)}
              disabled={Boolean(runDisabledReason)}
              title={runDisabledReason}
            >
              Run step
            </Button>
          </div>
        </div>
        {runDisabledReason && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-xs text-zinc-300">
            {runDisabledReason}
          </div>
        )}
      </CardHeader>

      <CardContent
        id={contentRegionId}
        aria-hidden={isCollapsed}
        className={cn("space-y-6 py-6", isCollapsed && "hidden")}
      >
        {stepState.status === "stale" && (
          <div
            role="status"
            className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          >
            This step is out of date. Re-run it to apply the latest visual style changes.
          </div>
        )}

        {stepState.status === "error" && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          >
            {stepState.errorMessage ?? "Step failed."}
          </div>
        )}

        <div className="space-y-4">
          {isScriptQaStep ? (
            <>
              <div className="space-y-2 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
                <div className="space-y-1">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                    QA checklist & notes
                  </p>
                  <p className="text-xs text-zinc-400">
                    This is the agent’s self-report about what it fixed. It is not included in
                    exports.
                  </p>
                </div>
                <LongTextPreview
                  text={stepState.status === "success" ? qaChecklistText ?? "" : ""}
                  emptyText={qaChecklistText ?? "Awaiting checklist…"}
                  modalTitle="QA checklist & notes"
                  viewButtonLabel="View full notes"
                  copyButtonLabel="Copy notes"
                />
              </div>
              <div className="space-y-2 rounded-2xl border border-white/20 bg-white/5 p-4">
                <div className="space-y-1">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white">
                    Final script after QA
                  </p>
                  <p className="text-xs text-white/80">
                    This is what shows up in Final Outputs, drives narration, and is downloaded.
                  </p>
                </div>
                <LongTextPreview
                  text={finalScriptPreview ?? ""}
                  emptyText={finalScriptPreviewText}
                  modalTitle="Final script after QA"
                  viewButtonLabel="View full script"
                  copyButtonLabel="Copy script"
                  alignActions="end"
                  previewContainerClassName="border-white/30 bg-black/30 text-white"
                  previewClassName="text-white"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                  Step result
                </p>
                <p className="text-[0.65rem] text-zinc-500">Raw text returned by this step.</p>
              </div>
              {isScriptStep || isNarrationStep ? (
                <LongTextPreview
                  text={stepState.status === "success" ? stepResponseText : ""}
                  emptyText={resolvedOutputText}
                  modalTitle={stepResultModalTitle}
                  viewButtonLabel={stepResultViewLabel}
                  copyButtonLabel={stepResultCopyLabel}
                />
              ) : (
                <div className="min-h-24 rounded-2xl border border-dashed border-zinc-900/60 bg-zinc-900/30 p-3 text-sm text-zinc-200">
                  {resolvedOutputText}
                </div>
              )}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { VariableStatusBadge } from "./VariableStatusBadge";
import { ChevronDown, X } from "lucide-react";
import {
  VARIABLE_KEY_TO_PIPELINE_FIELD,
  VARIABLE_LABELS,
} from "@/lib/agent/variable-metadata";
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
  templateValue,
  onRunStep,
  onPromptChange,
  onEditVariable,
  isCollapsed = false,
  onToggleCollapse,
}: StepEditorProps) {
  const contentRegionId = `step-${stepConfig.id}-content`;
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(true);

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
  const isNarrationCleanStep = stepConfig.id === "narrationClean";
  const isNarrationAudioTagsStep = stepConfig.id === "narrationAudioTags";
  const isNarrationStep = isNarrationCleanStep || isNarrationAudioTagsStep;
  const resolvedOutputText =
    stepState.status === "running"
      ? "Running…"
      : stepState.status === "error"
        ? stepState.errorMessage ?? "Step failed."
        : stepState.responseText || "Awaiting run…";
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
    return extractChecklist(stepState.responseText);
  }, [isScriptQaStep, stepState.status, stepState.errorMessage, stepState.responseText]);
  const finalScriptPreview = sharedVars.videoScript?.trim();
  const finalScriptPreviewText =
    finalScriptPreview ??
    "No QA-improved script yet. Run the Script + Script QA steps to populate this preview.";
  const stepResponseText = stepState.responseText?.trim() ?? "";
  const isPromptPreviewLoading = stepState.status === "running";
  const promptPreviewText = !isPromptPreviewLoading
    ? stepState.resolvedPrompt ?? ""
    : "";
  const promptPreviewEmptyText = isPromptPreviewLoading ? "Running…" : "Awaiting run…";
  const narrationStats = useMemo(() => {
    if (!isNarrationStep) {
      return null;
    }
    const text = stepState.responseText?.trim();
    if (!text) {
      return null;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    const characters = text.length;
    return { words, characters };
  }, [isNarrationStep, stepState.responseText]);
  const stepResultModalTitle = isNarrationCleanStep
    ? "Cleaned narration"
    : isNarrationAudioTagsStep
      ? "Narration with audio tags"
      : "Step result";
  const stepResultViewLabel =
    isScriptStep || isNarrationStep ? "View full script" : "View full result";
  const stepResultCopyLabel =
    isScriptStep || isNarrationStep ? "Copy script" : "Copy text";

  const missingVars = stepConfig.inputVars.filter((variable) => {
    const sharedKey = VARIABLE_KEY_TO_PIPELINE_FIELD[variable] as keyof SharedVars | undefined;
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
  }

  const missingWarning =
    !topicMissing && missingVars.length > 0
      ? `Missing: ${missingVars.map((variable) => VARIABLE_LABELS[variable] ?? variable).join(", ")}`
      : null;

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
        <div className="flex flex-wrap gap-2 text-xs">
          {stepConfig.inputVars.length === 0 ? (
            <span className="rounded-full border border-zinc-800/80 px-3 py-1 text-zinc-500">
              No upstream variables
            </span>
          ) : (
            stepConfig.inputVars.map((variable) => {
              const sharedKey = VARIABLE_KEY_TO_PIPELINE_FIELD[variable] as keyof SharedVars | undefined;
              const value = sharedKey ? sharedVars[sharedKey] : undefined;
              const label = VARIABLE_LABELS[variable] ?? variable;
              const preview =
                typeof value === "string" && value.trim().length > 0
                  ? value.trim().slice(0, 120) +
                    (value.trim().length > 120 ? "…" : "")
                  : "No value yet";
              return (
                <VariableStatusBadge
                  key={variable}
                  name={label}
                  value={typeof value === "string" ? value : undefined}
                  title={preview}
                  onClick={onEditVariable ? () => onEditVariable(variable) : undefined}
                />
              );
            })
          )}
        </div>

        {missingWarning && (
          <div className="space-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p>{missingWarning}</p>
            {onEditVariable && (
              <div className="flex flex-wrap gap-2">
                {missingVars.map((variable) => (
                  <Button
                    key={`edit-${stepConfig.id}-${variable}`}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full border border-amber-400/50 px-3 py-1 text-[0.7rem] text-amber-100 hover:bg-amber-500/10"
                    onClick={() => onEditVariable(variable)}
                  >
                    Edit {VARIABLE_LABELS[variable] ?? variable}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

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
        {stepState.status === "error" && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          >
            {stepState.errorMessage ?? "Step failed."}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                  Prompt template
                </p>
                <p className="text-[0.65rem] text-zinc-500">
                  Adjust the logic before variables are filled in.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-xs text-zinc-200 hover:bg-zinc-900 hover:text-white"
                onClick={() => setShowAdvancedPrompt((prev) => !prev)}
              >
                {showAdvancedPrompt ? "Hide" : "Show"}
              </Button>
            </div>
            {showAdvancedPrompt && (
              <div className="mt-3 space-y-4">
                <PromptTemplatePreview
                  templateValue={templateValue}
                  onTemplateChange={(value) => onPromptChange(stepConfig.id, value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                Prompt preview
              </p>
              <p className="text-[0.65rem] text-zinc-500">
                See the prompt exactly as the model will receive it.
              </p>
            </div>
            <LongTextPreview
              text={promptPreviewText || undefined}
              emptyText={promptPreviewEmptyText}
              modalTitle="Prompt preview"
              viewButtonLabel="View full prompt"
              copyButtonLabel="Copy prompt"
              previewContainerClassName="min-h-24 border-white/5 bg-black/30 font-mono text-white shadow-inner ring-1 ring-white/5"
              previewClassName="font-mono text-[0.85rem] leading-relaxed text-white break-words"
              alignActions="end"
            />
          </div>
        </div>

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

        {narrationStats && (
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white/80">
              Narration stats
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MetricTile label="Word count" value={narrationStats.words.toLocaleString()} />
              <MetricTile
                label="Character count"
                value={narrationStats.characters.toLocaleString()}
              />
            </div>
            <p className="mt-2 text-xs text-white/80">
              Counts are based on this step&apos;s narration output.
            </p>
          </div>
        )}

        {stepState.metrics && (
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Input tokens" value={stepState.metrics.inputTokens.toLocaleString()} />
            <MetricTile label="Output tokens" value={stepState.metrics.outputTokens.toLocaleString()} />
            <MetricTile label="Total tokens" value={stepState.metrics.totalTokens.toLocaleString()} />
            <MetricTile label="Cost (USD)" value={`$${stepState.metrics.costUsd.toFixed(4)}`} />
            {typeof stepState.metrics.durationMs === "number" && (
              <MetricTile label="Duration" value={`${(stepState.metrics.durationMs / 1000).toFixed(1)}s`} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PromptTemplatePreview({
  templateValue,
  onTemplateChange,
}: {
  templateValue: string;
  onTemplateChange: (value: string) => void;
}) {
  const preparedTemplate = templateValue?.trim() ?? "";
  const hasTemplate = preparedTemplate.length > 0;
  const shouldShowGradient = preparedTemplate.length > 800;
  const [isCopied, setIsCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleCopy = async () => {
    if (!hasTemplate) {
      return;
    }
    try {
      await navigator.clipboard.writeText(templateValue);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) {
          setIsCopied(false);
        }
      }}
    >
      <div className="space-y-3">
        <div className="relative">
          <pre className="max-h-64 overflow-hidden whitespace-pre-wrap rounded-2xl border border-zinc-900/70 bg-zinc-900/40 p-4 text-sm leading-relaxed text-white">
            {hasTemplate ? templateValue : "No prompt template yet."}
          </pre>
          {hasTemplate && shouldShowGradient && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-2xl bg-linear-to-t from-zinc-950/90 via-zinc-950/30 to-transparent" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog.Trigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full border border-white/20 bg-transparent text-xs font-semibold uppercase tracking-[0.3em] text-white hover:border-white/40 hover:bg-white/10"
            >
              View & edit template
            </Button>
          </Dialog.Trigger>
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {isCopied ? "Prompt template copied" : ""}
        </span>
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-white">
                  Prompt template
                </Dialog.Title>
                <Dialog.Description className="text-xs text-zinc-400">
                  Edit the full template without scrolling fatigue.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="rounded-full border border-white/10 p-2 text-white transition hover:border-white/40 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </header>
            <div className="px-6 py-6">
              <Textarea
                value={templateValue}
                onChange={(event) => onTemplateChange(event.target.value)}
                className="h-[60vh] w-full resize-none rounded-2xl border border-white/10 bg-zinc-900/70 text-base text-white"
                aria-label="Prompt template editor"
                autoFocus
              />
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border border-white/20 bg-transparent text-sm font-semibold text-white hover:border-white/40 hover:bg-white/10 disabled:opacity-60"
                onClick={handleCopy}
                disabled={!hasTemplate}
              >
                {isCopied ? "Copied" : "Copy template"}
              </Button>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  className="rounded-full bg-white px-6 font-semibold text-zinc-900 hover:bg-zinc-200"
                >
                  Close
                </Button>
              </Dialog.Close>
            </footer>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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

function extractChecklist(responseText: string): string {
  const normalized = responseText.replace(/\r\n/g, "\n");
  const lower = normalized.toLowerCase();
  const markerIndex = lower.indexOf("final script");
  const before = markerIndex !== -1 ? normalized.slice(0, markerIndex) : normalized;
  const trimmed = before.trim();
  if (!trimmed) {
    return "Awaiting checklist…";
  }

  const checklistIndex = trimmed.toLowerCase().indexOf("checklist:");
  if (checklistIndex !== -1) {
    return trimmed.slice(checklistIndex).trim();
  }

  return trimmed;
}


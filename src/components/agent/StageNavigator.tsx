"use client";

import { useMemo, useState } from "react";

import { VariableStatusBadge } from "./VariableStatusBadge";
import type { StageDefinition, StageId } from "./stage-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { StepConfig, StepId, StepRunState, VariableKey } from "@/types/agent";

export type StageTone = "ready" | "draft" | "progress" | "success" | "error";

interface StageNavigatorProps {
  stages: StageDefinition[];
  stepConfigs: StepConfig[];
  activeStageId: StageId;
  currentStepId: StepId | null;
  stepStates: Record<StepId, StepRunState>;
  onSelectStage: (stageId: StageId) => void;
  onSelectStep: (stepId: StepId) => void;
  className?: string;
  variant?: "card" | "sidebar";
  defaultCollapsed?: boolean;
  topicInput?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
  };
  variables?: {
    key: VariableKey;
    label: string;
    value?: string | null;
  }[];
  onEditVariable?: (variable: VariableKey) => void;
  exportActions?: {
    onExportFiles: () => void;
    onExportScript: () => void;
    canExportFiles: boolean;
    canExportScript: boolean;
    onDownloadVoiceover?: () => void;
    canDownloadVoiceover?: boolean;
    onDownloadThumbnail?: () => void;
    canDownloadThumbnail?: boolean;
  };
  sessionTotals?: {
    totalTokens: number;
    totalCostUsd: number;
    llmRuntimeSeconds?: number | null;
  };
}

export const STATUS_STYLES: Record<StageTone, { text: string; dot: string; bar: string }> = {
  ready: {
    text: "text-zinc-400",
    dot: "bg-zinc-500",
    bar: "bg-zinc-600",
  },
  draft: {
    text: "text-sky-200",
    dot: "bg-sky-300",
    bar: "bg-sky-400",
  },
  progress: {
    text: "text-amber-200",
    dot: "bg-amber-300",
    bar: "bg-amber-300",
  },
  success: {
    text: "text-emerald-200",
    dot: "bg-emerald-400",
    bar: "bg-emerald-400",
  },
  error: {
    text: "text-rose-200",
    dot: "bg-rose-400",
    bar: "bg-rose-400",
  },
};

const stageLabelRegex = /^Stage\s+\d+\s*[–-]\s*/i;
const promptLabelRegex = /^Prompt\s+[\w.-]+\s*[–-]\s*/i;

function formatStageNumber(index: number) {
  return `Stage ${String(index + 1).padStart(2, "0")}`.toUpperCase();
}

function sanitizeStageLabel(label: string) {
  return label.replace(stageLabelRegex, "").trim();
}

function formatStepNumber(stepIndex: number) {
  return `Step ${String(stepIndex + 1).padStart(2, "0")}`.toUpperCase();
}

function sanitizeStepLabel(label: string) {
  return label.replace(promptLabelRegex, "").trim();
}

export function StageNavigator({
  stages,
  stepConfigs,
  activeStageId,
  currentStepId,
  stepStates,
  onSelectStage,
  onSelectStep,
  className,
  variant = "card",
  defaultCollapsed = false,
  topicInput,
  variables,
  onEditVariable,
  exportActions,
  sessionTotals,
}: StageNavigatorProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [areVariablesCollapsed, setAreVariablesCollapsed] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Record<StageId, boolean>>(() => {
    const initial: Record<StageId, boolean> = {} as Record<StageId, boolean>;
    stages.forEach((stage) => {
      initial[stage.id] = stage.id === activeStageId;
    });
    return initial;
  });

  const stepConfigMap = useMemo(
    () =>
      stepConfigs.reduce<Record<StepId, StepConfig>>((acc, config) => {
        acc[config.id] = config;
        return acc;
      }, {} as Record<StepId, StepConfig>),
    [stepConfigs],
  );

  const readyVariableCount = useMemo(() => {
    if (!variables?.length) {
      return 0;
    }
    return variables.reduce((count, variable) => {
      if (typeof variable.value === "string" && variable.value.trim().length > 0) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [variables]);

  const showSidebarExtras = variant === "sidebar";
  const topicInputId = "workflow-topic-input";
  const variableListId = "workflow-variable-list";
  const paddingClass =
    variant === "sidebar" ? (isCollapsed ? "p-3" : "p-5") : "p-5";
  const widthClass =
    variant === "sidebar"
      ? isCollapsed
        ? "lg:w-[120px]"
        : "lg:w-[320px]"
      : "";
  const containerClass = cn(
    "rounded-3xl border border-zinc-900/70 bg-zinc-950/80 shadow-[0_30px_120px_-80px_rgba(0,0,0,0.9)]",
    variant === "card" ? "space-y-4" : "space-y-5",
    paddingClass,
    showSidebarExtras && "transition-all duration-300 ease-out",
    widthClass,
    className,
  );

  const handleStageToggle = (stageId: StageId) => {
    setExpandedStages((prev) => {
      const current = typeof prev[stageId] === "boolean" ? prev[stageId] : stageId === activeStageId;
      return {
        ...prev,
        [stageId]: !current,
      };
    });
    onSelectStage(stageId);
  };

  return (
    <div className={containerClass}>
      <div className="flex items-start justify-between gap-3">
        {(!isCollapsed || !showSidebarExtras) && (
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Workflow
            </p>
            <p className="text-sm text-zinc-400">
              Jump between stages and steps without leaving your place.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed((value) => !value)}
          className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300 hover:border-zinc-600 hover:text-white"
          aria-pressed={!isCollapsed}
        >
          {isCollapsed ? "Show" : "Hide"}
        </button>
      </div>

      {!isCollapsed && showSidebarExtras && topicInput && (
        <div className="space-y-2 rounded-2xl border border-zinc-900/80 bg-zinc-950/60 p-4">
          <Label
            htmlFor={topicInputId}
            className="text-[0.55rem] font-semibold uppercase tracking-[0.35em] text-zinc-500"
          >
            {topicInput.label ?? "Topic"}
          </Label>
          <Input
            id={topicInputId}
            value={topicInput.value}
            placeholder={topicInput.placeholder}
            onChange={(event) => topicInput.onChange(event.target.value)}
            className="h-11 rounded-2xl border-none bg-zinc-900/60 text-sm text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-white/40"
          />
        </div>
      )}

      {!isCollapsed && showSidebarExtras && variables?.length ? (
        <div className="rounded-2xl border border-zinc-900/80 bg-zinc-950/60 p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setAreVariablesCollapsed((prev) => !prev)}
            aria-expanded={!areVariablesCollapsed}
            aria-controls={variableListId}
          >
            <div>
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                Variables
              </p>
              <p className="text-xs text-zinc-400">
                {readyVariableCount}/{variables.length} ready
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onEditVariable && (
                <span className="text-[0.6rem] uppercase tracking-[0.25em] text-zinc-500">
                  Tap to edit
                </span>
              )}
              <ChevronIcon
                className={cn(
                  "h-4 w-4 text-zinc-500 transition",
                  !areVariablesCollapsed && "rotate-180 text-white",
                )}
              />
            </div>
          </button>
          {!areVariablesCollapsed && (
            <div id={variableListId} className="mt-3 flex flex-wrap gap-2">
              {variables.map((variable) => (
                <VariableStatusBadge
                  key={variable.key}
                  name={variable.label}
                  value={variable.value}
                  size="sm"
                  onClick={
                    onEditVariable ? () => onEditVariable(variable.key) : undefined
                  }
                  className={cn(
                    "w-full justify-between",
                    onEditVariable ? "cursor-pointer" : "cursor-default",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {!isCollapsed && (
        <div className="space-y-3" role="navigation" aria-label="Workflow stages">
          {stages.map((stage, index) => {
            const stepStatuses = stage.steps.map(
              (stepId) => stepStates[stepId]?.status ?? "idle",
            );
            const completedCount = stepStatuses.filter((status) => status === "success").length;
            const totalCount = stage.steps.length || 1;
            const progressPercent = Math.round((completedCount / totalCount) * 100);
            const status = getStageStatus(stepStatuses);
            const statusStyles = STATUS_STYLES[status.tone];
            const isActiveStage = stage.id === activeStageId;
            const isExpanded =
              stage.id === activeStageId ? true : expandedStages[stage.id] ?? false;

            return (
              <div
                key={stage.id}
                className={cn(
                  "rounded-2xl border border-zinc-900/80 bg-zinc-950/50 px-4 py-4",
                  isActiveStage && "border-white/50 bg-white/5",
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => handleStageToggle(stage.id)}
                  aria-expanded={isExpanded}
                >
                  <div>
                    <p className="text-[0.55rem] font-semibold uppercase tracking-[0.4em] text-zinc-500">
                      {formatStageNumber(index)}
                    </p>
                    <p className="mt-1 text-base font-semibold text-white">
                      {sanitizeStageLabel(stage.label)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">{stage.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em]",
                        statusStyles.text,
                      )}
                    >
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", statusStyles.dot)}
                        aria-hidden="true"
                      />
                      {status.label}
                    </span>
                    <ChevronIcon className={cn("h-4 w-4 text-zinc-500 transition", isExpanded && "rotate-180 text-white")} />
                  </div>
                </button>

                <div className="mt-4">
                  <div className="h-1.5 rounded-full bg-zinc-900">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300 ease-out",
                        statusStyles.bar,
                      )}
                      style={{ width: `${progressPercent}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                    {completedCount}/{totalCount} steps complete
                  </p>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-2" aria-label={`${stage.label} steps`}>
                    {stage.steps.map((stepId, stepIndex) => {
                      const stepConfig = stepConfigMap[stepId];
                      if (!stepConfig) {
                        return null;
                      }

                      const stepState = stepStates[stepId];
                      const stepStatus = getStageStatus([stepState?.status ?? "idle"]);
                      const stepStyles = STATUS_STYLES[stepStatus.tone];
                      const isActiveStep = currentStepId === stepId;

                      return (
                        <button
                          key={stepId}
                          type="button"
                          onClick={() => {
                            onSelectStage(stage.id);
                            onSelectStep(stepId);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-left transition-colors",
                            isActiveStep
                              ? "border-white/70 bg-white/5 text-white"
                              : "bg-zinc-900/40 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/70",
                          )}
                          aria-current={isActiveStep ? "step" : undefined}
                        >
                          <div>
                            <p className="text-[0.5rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                              {formatStepNumber(stepIndex)}
                            </p>
                            <p className="mt-1 text-sm font-medium">
                              {sanitizeStepLabel(stepConfig.label)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em]",
                              stepStyles.text,
                            )}
                          >
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", stepStyles.dot)}
                              aria-hidden="true"
                            />
                            {stepStatus.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isCollapsed && exportActions && (
        <div className="space-y-4 rounded-2xl border border-zinc-900/80 bg-zinc-950/60 p-4">
          <div>
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Exports
            </p>
            <p className="text-xs text-zinc-400">Download the latest outputs.</p>
          </div>
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={exportActions.onExportFiles}
              disabled={!exportActions.canExportFiles}
              className="h-11 w-full rounded-2xl border-zinc-800 bg-transparent text-sm text-zinc-200 hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export text files
            </Button>
            <Button
              variant="outline"
              onClick={exportActions.onExportScript}
              disabled={!exportActions.canExportScript}
              className="h-11 w-full rounded-2xl border-zinc-800 bg-transparent text-sm text-zinc-200 hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export script (.md)
            </Button>
            {exportActions.onDownloadVoiceover && (
              <Button
                variant="outline"
                onClick={exportActions.onDownloadVoiceover}
                disabled={!exportActions.canDownloadVoiceover}
                className="h-11 w-full rounded-2xl border-zinc-800 bg-transparent text-sm text-zinc-200 hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Download voiceover (.mp3)
              </Button>
            )}
            {exportActions.onDownloadThumbnail && (
              <Button
                variant="outline"
                onClick={exportActions.onDownloadThumbnail}
                disabled={!exportActions.canDownloadThumbnail}
                className="h-11 w-full rounded-2xl border-zinc-800 bg-transparent text-sm text-zinc-200 hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Download thumbnail (.png)
              </Button>
            )}
          </div>
          {sessionTotals && (
            <div className="rounded-2xl border border-zinc-900/70 bg-zinc-950/50 p-4 text-sm">
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                Session totals
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-xl font-semibold text-white">
                  {sessionTotals.totalTokens.toLocaleString()} tokens
                </span>
                <span className="text-sm text-zinc-400">${sessionTotals.totalCostUsd.toFixed(3)}</span>
              </div>
              {typeof sessionTotals.llmRuntimeSeconds === "number" && (
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-semibold uppercase tracking-[0.3em]">LLM runtime</span>
                  <span className="text-sm font-semibold text-white">
                    {sessionTotals.llmRuntimeSeconds.toFixed(1)}s
                  </span>
                </div>
              )}
              <p className="mt-2 text-xs text-zinc-500">Numbers refresh after each step finishes.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function getStageStatus(stepStatuses: StepRunState["status"][]): {
  label: string;
  tone: StageTone;
} {
  if (stepStatuses.some((status) => status === "error")) {
    return { label: "Needs attention", tone: "error" };
  }
  if (stepStatuses.some((status) => status === "running")) {
    return { label: "Running", tone: "progress" };
  }
  if (stepStatuses.length > 0 && stepStatuses.every((status) => status === "success")) {
    return { label: "Done", tone: "success" };
  }
  if (stepStatuses.some((status) => status === "success")) {
    return { label: "Draft", tone: "draft" };
  }
  return { label: "Ready", tone: "ready" };
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


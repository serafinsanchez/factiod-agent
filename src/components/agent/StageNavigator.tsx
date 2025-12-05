"use client";

import { useEffect, useMemo, useState } from "react";

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
  onCollapseChange?: (collapsed: boolean) => void;
  onExpandAllSteps?: () => void;
  onCollapseAllSteps?: () => void;
  // Additional state for deriving correct narrationAudio step status
  narrationAudioState?: {
    hasAudioUrl: boolean;
    hasError: boolean;
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
  onCollapseChange,
  onExpandAllSteps,
  onCollapseAllSteps,
  narrationAudioState,
}: StageNavigatorProps) {
  // Derive correct step states, overriding narrationAudio status if we have audio
  const derivedStepStates = useMemo(() => {
    if (!narrationAudioState) {
      return stepStates;
    }
    const narrationStep = stepStates.narrationAudio;
    if (!narrationStep) {
      return stepStates;
    }
    // If we have audio URL and no error, and status is "running", override to "success"
    const shouldOverrideToSuccess =
      narrationAudioState.hasAudioUrl &&
      !narrationAudioState.hasError &&
      narrationStep.status === "running";
    if (!shouldOverrideToSuccess) {
      return stepStates;
    }
    return {
      ...stepStates,
      narrationAudio: {
        ...narrationStep,
        status: "success" as const,
      },
    };
  }, [stepStates, narrationAudioState]);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [areVariablesCollapsed, setAreVariablesCollapsed] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Record<StageId, boolean>>(() => {
    const initial: Record<StageId, boolean> = {} as Record<StageId, boolean>;
    stages.forEach((stage) => {
      initial[stage.id] = stage.id === activeStageId;
    });
    return initial;
  });

  useEffect(() => {
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

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
    variant === "sidebar" ? (isCollapsed ? "p-1" : "p-0") : "p-5";
  const collapsedWidthClass = "lg:w-fit lg:min-w-[52px]";
  const widthClass =
    variant === "sidebar"
      ? isCollapsed
        ? collapsedWidthClass
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
  const drawerId = `${variant}-workflow-drawer`;
  const toggleLabel = isCollapsed ? "Open workflow drawer" : "Close workflow drawer";
  const showStepToggleButtons = !isCollapsed && (onExpandAllSteps || onCollapseAllSteps);

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
    <div className={containerClass} id={drawerId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 text-zinc-300 transition hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-controls={drawerId}
            aria-expanded={!isCollapsed}
            aria-label={toggleLabel}
          >
            <DrawerToggleIcon isOpen={!isCollapsed} />
            <span className="sr-only">{toggleLabel}</span>
          </button>
        </div>
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

      {!isCollapsed && showStepToggleButtons && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-900/80 bg-zinc-950/60 p-3">
          {onExpandAllSteps && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onExpandAllSteps}
              className="flex-1 rounded-full border-zinc-800/70 bg-zinc-900/40 px-4 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-zinc-200 hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              Expand all
            </Button>
          )}
          {onCollapseAllSteps && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCollapseAllSteps}
              className="flex-1 rounded-full border-zinc-800/70 bg-zinc-900/40 px-4 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-zinc-200 hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              Collapse all
            </Button>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className="space-y-3" role="navigation" aria-label="Workflow stages">
          {stages.map((stage, index) => {
            const stepStatuses = stage.steps.map(
              (stepId) => derivedStepStates[stepId]?.status ?? "idle",
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

                      const stepState = derivedStepStates[stepId];
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
              className="h-11 w-full rounded-2xl border-zinc-800 bg-transparent text-sm text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export text files
            </Button>
            <Button
              variant="outline"
              onClick={exportActions.onExportScript}
              disabled={!exportActions.canExportScript}
              className="h-11 w-full rounded-2xl border-zinc-800 bg-transparent text-sm text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export script (.md)
            </Button>
            {exportActions.onDownloadVoiceover && (
              <Button
                variant="outline"
                onClick={exportActions.onDownloadVoiceover}
                disabled={!exportActions.canDownloadVoiceover}
                className="h-11 w-full rounded-2xl border-zinc-800 bg-transparent text-sm text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Download voiceover (.mp3)
              </Button>
            )}
            {exportActions.onDownloadThumbnail && (
              <Button
                variant="outline"
                onClick={exportActions.onDownloadThumbnail}
                disabled={!exportActions.canDownloadThumbnail}
                className="h-11 w-full rounded-2xl border-zinc-800 bg-transparent text-sm text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold uppercase tracking-[0.3em]">LLM runtime</span>
                <span className="text-sm font-semibold text-white">
                  {typeof sessionTotals.llmRuntimeSeconds === "number"
                    ? `${sessionTotals.llmRuntimeSeconds.toFixed(1)}s`
                    : "--"}
                </span>
              </div>
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

function DrawerToggleIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={cn("h-4 w-4 text-current transition duration-300", isOpen ? "rotate-0" : "rotate-180")}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
    >
      <rect
        x="3.75"
        y="4.75"
        width="16.5"
        height="14.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10.5 4.5v15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d={isOpen ? "M14 9l4 3.5L14 16" : "M13 9l-4 3.5L13 16"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


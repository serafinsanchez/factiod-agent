"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";

import { ProjectSidebar } from "./ProjectSidebar";
import { StageView } from "./StageView";
import { OutputPreview } from "./OutputPreview";
import { VariableEditor } from "./VariableEditor";
import { StageNavigator } from "./StageNavigator";
import { StyleSelector } from "./StyleSelector";
import { STAGES, type StageId } from "./stage-config";
import type { UseAgentPipelineReturn } from "@/hooks/use-agent-pipeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { STEP_CONFIGS } from "@/lib/agent/steps";
import { getModelOptions } from "@/lib/llm/models";
import {
  VARIABLE_DEFINITIONS,
  getVariableDisplayValue,
  getVariableValueFromPipeline,
} from "@/lib/agent/variable-metadata";
import { cn } from "@/lib/utils";
import type { ModelId, StepId, VariableKey, VisualStyleId } from "@/types/agent";

const MODEL_OPTIONS = getModelOptions();
const MODEL_LABELS: Record<ModelId, string> = {
  "gpt-5.1-2025-11-13": "GPT 5.1",
  "kimik2-thinking": "Kimi K2",
  "claude-sonnet-4.5": "Claude Sonnet 4.5",
  "gemini-3-pro": "Gemini 3 Pro",
};

type AgentShellProps = {
  state: UseAgentPipelineReturn["state"];
  derived: UseAgentPipelineReturn["derived"];
  actions: UseAgentPipelineReturn["actions"];
  activeStageId: StageId;
  onStageChangeAction: (stageId: StageId) => void;
};

export function AgentShell({
  state,
  derived,
  actions,
  activeStageId,
  onStageChangeAction,
}: AgentShellProps) {
  const {
    pipeline,
    historyProjects,
    selectedProjectId,
    historyError,
    deleteError,
    isDeletingProjectId,
    isSavingProject,
    saveError,
    isRunningAll,
  } = state;

  const hasTopic = Boolean(pipeline.topic.trim());
  const [editingVariable, setEditingVariable] = useState<VariableKey | null>(null);
  const [isProjectSidebarCollapsed, setIsProjectSidebarCollapsed] = useState(true);
  const [visibleStepId, setVisibleStepId] = useState<StepId | null>(null);
  const [isStyleSelectorOpen, setIsStyleSelectorOpen] = useState(false);
  const [collapsedSteps, setCollapsedSteps] = useState<Record<StepId, boolean>>(() => {
    const initial: Record<StepId, boolean> = {} as Record<StepId, boolean>;
    STEP_CONFIGS.forEach((config) => {
      initial[config.id] = true;
    });
    return initial;
  });

  const editorInitialValue = useMemo(() => {
    if (!editingVariable) {
      return "";
    }
    return getVariableValueFromPipeline(state.pipeline, editingVariable) ?? "";
  }, [editingVariable, state.pipeline]);

  const variableSummaries = useMemo(
    () =>
      VARIABLE_DEFINITIONS.map((definition) => ({
        key: definition.key,
        label: definition.label,
        value: getVariableDisplayValue(state.pipeline, definition.key),
      })),
    [state.pipeline],
  );
  const canDownloadVoiceover = Boolean(state.scriptAudioUrl);
  const canDownloadThumbnail = Boolean(
    state.thumbnailImage?.url || state.thumbnailImage?.data,
  );
  const stepToStageMap = useMemo(() => {
    const map: Record<StepId, StageId> = {} as Record<StepId, StageId>;
    STAGES.forEach((stage) => {
      stage.steps.forEach((stepId) => {
        map[stepId] = stage.id;
      });
    });
    return map;
  }, []);
  const handleNewProject = () => {
    setIsStyleSelectorOpen(true);
  };

  const handleStyleSelected = (styleId: VisualStyleId) => {
    setIsStyleSelectorOpen(false);
    actions.newProject(styleId);
    onStageChangeAction("plan");
  };

  const sidebarProps = {
    projects: historyProjects,
    selectedProjectId,
    currentPipelineId: pipeline.id ?? null,
    currentTopic: pipeline.topic,
    isSavingCurrentProject: isSavingProject,
    isDeletingProjectId,
    historyError,
    deleteError,
    saveError,
    onNewProject: handleNewProject,
    onSelectProject: actions.selectProject,
    onDeleteProject: actions.deleteProject,
    onSaveProject: actions.saveProject,
    defaultCollapsed: true,
  };

  const handleStageSelect = (stageId: StageId) => {
    onStageChangeAction(stageId);
    requestAnimationFrame(() => {
      const target = document.getElementById(`stage-${stageId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const handleStepJump = (stepId: StepId) => {
    const parentStageId = stepToStageMap[stepId];
    if (parentStageId) {
      onStageChangeAction(parentStageId);
    }
    const element = document.getElementById(`step-${stepId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleStepCollapseChange = useCallback((stepId: StepId, collapsed: boolean) => {
    setCollapsedSteps((prev) => {
      if (prev[stepId] === collapsed) {
        return prev;
      }
      return {
        ...prev,
        [stepId]: collapsed,
      };
    });
  }, []);

  const setAllStepsCollapsed = useCallback((collapsed: boolean) => {
    setCollapsedSteps((prev) => {
      let changed = false;
      const next: Record<StepId, boolean> = { ...prev };
      STEP_CONFIGS.forEach((config) => {
        if (next[config.id] !== collapsed) {
          next[config.id] = collapsed;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const handleExpandAllSteps = useCallback(() => {
    setAllStepsCollapsed(false);
  }, [setAllStepsCollapsed]);

  const handleCollapseAllSteps = useCallback(() => {
    setAllStepsCollapsed(true);
  }, [setAllStepsCollapsed]);

  const handleVisibleStepChange = useCallback(
    (stepId: StepId | null) => {
      setVisibleStepId(stepId);
      if (!stepId) {
        return;
      }
      const parentStageId = stepToStageMap[stepId];
      if (parentStageId && parentStageId !== activeStageId) {
        onStageChangeAction(parentStageId);
      }
    },
    [activeStageId, onStageChangeAction, stepToStageMap],
  );

  const desktopSidebarClass = cn(
    "hidden md:flex md:flex-col md:flex-none transition-all duration-300",
    isProjectSidebarCollapsed
      ? "md:w-fit md:min-w-[60px] md:px-1 md:py-1 md:border md:border-zinc-900/70 md:bg-zinc-950/85 md:rounded-3xl md:shadow-[0_25px_80px_-40px_rgba(0,0,0,0.75)]"
      : "md:w-[260px] md:px-4 md:py-8 md:border-r md:border-zinc-900/70 md:bg-zinc-950/80",
  );

  return (
    <div className="flex min-h-screen bg-zinc-950/98 text-zinc-100">
      <aside className={desktopSidebarClass}>
        <div className="sticky top-6">
          <div className="max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain pr-2 scrollbar-hide">
            <ProjectSidebar
              {...sidebarProps}
              className="h-full rounded-none border-none bg-transparent p-0 shadow-none"
              onCollapseChange={setIsProjectSidebarCollapsed}
            />
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <div className="flex w-full flex-col gap-8 px-4 py-8 md:px-6 lg:pl-10 lg:pr-0 xl:pl-16 xl:pr-0 2xl:pl-24 2xl:pr-0">
          <div className="md:hidden">
            <ProjectSidebar {...sidebarProps} />
          </div>

          <main className="flex w-full flex-col gap-8 pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10">
            <div className="flex flex-col gap-8">
              <Card className="border border-zinc-900/60 bg-zinc-950/80 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.85)]">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col items-center gap-8 text-center">
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-4">
                      <Image
                        src="/goally-penguin-logo-sunglasses-short-only.png.webp"
                        width={177}
                        height={199}
                        alt="Penguin mascot wearing sunglasses"
                        className="h-12 w-auto drop-shadow-[0_8px_20px_rgba(0,0,0,0.55)] sm:h-16"
                        sizes="(min-width: 640px) 64px, 48px"
                        priority
                      />
                      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                        Factoids Video Generator
                      </h1>
                    </div>
                  </div>

                    <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <div className="space-y-2">
                        <RadioGroup
                          className="flex flex-wrap justify-center gap-2"
                          value={pipeline.model}
                          onValueChange={(value) => {
                            actions.setModel(value as typeof pipeline.model);
                          }}
                        >
                          {MODEL_OPTIONS.map((option) => (
                            <label
                              key={option}
                              htmlFor={`model-${option}`}
                              className={cn(
                                "flex items-center gap-2 rounded-2xl border px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] transition-colors",
                                pipeline.model === option
                                  ? "border-white/70 bg-white/5 text-white"
                                  : "border-zinc-900/60 text-zinc-500 hover:border-zinc-800 hover:text-zinc-200",
                              )}
                            >
                              <RadioGroupItem
                                id={`model-${option}`}
                                value={option}
                                className={cn(
                                  "h-3.5 w-3.5 border-zinc-700 text-zinc-100",
                                  pipeline.model === option && "border-white text-white",
                                )}
                              />
                              <span>{MODEL_LABELS[option] ?? option}</span>
                            </label>
                          ))}
                        </RadioGroup>
                      </div>

                      <div className="space-y-4">
                        <Input
                          id="agent-topic"
                          placeholder="e.g. Why the moon changes shape"
                          value={pipeline.topic}
                          onChange={(event) => actions.setTopic(event.target.value)}
                          className="mx-auto h-14 w-full max-w-xl rounded-full border border-white/15 bg-zinc-900/80 px-6 text-lg text-white placeholder:text-zinc-500 shadow-[0_25px_80px_rgba(0,0,0,0.65)] focus-visible:ring-2 focus-visible:ring-white/70"
                        />
                        {/* Run pipeline button intentionally hidden for now (user request) */}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <section className="rounded-3xl border border-zinc-900/70 bg-zinc-950/70 p-6 shadow-[0_25px_80px_-60px_rgba(0,0,0,0.85)] lg:hidden">
                <StageNavigator
                  stages={STAGES}
                  stepConfigs={STEP_CONFIGS}
                  activeStageId={activeStageId}
                  currentStepId={visibleStepId}
                  stepStates={state.pipeline.steps}
                  onSelectStage={handleStageSelect}
                  onSelectStep={handleStepJump}
                  onExpandAllSteps={handleExpandAllSteps}
                  onCollapseAllSteps={handleCollapseAllSteps}
                  exportActions={{
                    onExportFiles: actions.exportFiles,
                    onExportScript: actions.exportScriptMarkdown,
                    canExportFiles: derived.hasAnyOutputs,
                    canExportScript: derived.hasScript,
                    onDownloadVoiceover: actions.downloadVoiceover,
                    canDownloadVoiceover,
                    onDownloadThumbnail: actions.downloadThumbnail,
                    canDownloadThumbnail,
                  }}
                  sessionTotals={{
                    totalTokens: pipeline.sessionTotalTokens ?? pipeline.totalTokens,
                    totalCostUsd: pipeline.sessionTotalCostUsd ?? pipeline.totalCostUsd,
                  }}
                  narrationAudioState={{
                    hasAudioUrl: Boolean(state.scriptAudioUrl),
                    hasError: Boolean(state.scriptAudioError),
                  }}
                />
              </section>

              <section className="space-y-6">
                <StageView
                  stages={STAGES}
                  activeStageId={activeStageId}
                  stepConfigs={STEP_CONFIGS}
                  state={state}
                  derived={derived}
                  actions={actions}
                  onEditVariable={(variable) => setEditingVariable(variable)}
                  onVisibleStepChange={handleVisibleStepChange}
                  collapsedSteps={collapsedSteps}
                  onStepCollapseChangeAction={handleStepCollapseChange}
                />
              </section>

              <section className="rounded-3xl border border-zinc-900/70 bg-zinc-950/80 p-6 shadow-[0_25px_80px_-60px_rgba(0,0,0,0.85)]">
                <OutputPreview state={state} derived={derived} actions={actions} />
              </section>
            </div>

            <div className="hidden lg:block">
              <div className="sticky top-6">
                <div className="max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain pr-2 scrollbar-hide">
                  <StageNavigator
                    variant="sidebar"
                    defaultCollapsed
                    stages={STAGES}
                    stepConfigs={STEP_CONFIGS}
                    activeStageId={activeStageId}
                    currentStepId={visibleStepId}
                    stepStates={state.pipeline.steps}
                    onSelectStage={handleStageSelect}
                    onSelectStep={handleStepJump}
                    onExpandAllSteps={handleExpandAllSteps}
                    onCollapseAllSteps={handleCollapseAllSteps}
                    topicInput={{
                      value: pipeline.topic,
                      onChange: (value) => actions.setTopic(value),
                      placeholder: "e.g. How volcanoes work",
                      label: "Topic",
                    }}
                    variables={variableSummaries}
                    onEditVariable={(variable) => setEditingVariable(variable)}
                    exportActions={{
                      onExportFiles: actions.exportFiles,
                      onExportScript: actions.exportScriptMarkdown,
                      canExportFiles: derived.hasAnyOutputs,
                      canExportScript: derived.hasScript,
                      onDownloadVoiceover: actions.downloadVoiceover,
                      canDownloadVoiceover,
                      onDownloadThumbnail: actions.downloadThumbnail,
                      canDownloadThumbnail,
                    }}
                    sessionTotals={{
                      totalTokens: pipeline.sessionTotalTokens ?? pipeline.totalTokens,
                      totalCostUsd: pipeline.sessionTotalCostUsd ?? pipeline.totalCostUsd,
                    }}
                    narrationAudioState={{
                      hasAudioUrl: Boolean(state.scriptAudioUrl),
                      hasError: Boolean(state.scriptAudioError),
                    }}
                  />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <VariableEditor
        key={editingVariable ?? "closed"}
        isOpen={editingVariable !== null}
        variableKey={editingVariable}
        initialValue={editorInitialValue}
        onClose={() => setEditingVariable(null)}
        onSave={(variable, value) => {
          actions.setVariable(variable, value);
          setEditingVariable(null);
        }}
      />

      <StyleSelector
        isOpen={isStyleSelectorOpen}
        onSelect={handleStyleSelected}
        onClose={() => setIsStyleSelectorOpen(false)}
      />
    </div>
  );
}


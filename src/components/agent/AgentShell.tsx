"use client";

import { useCallback, useMemo, useState } from "react";

import { ProjectSidebar } from "./ProjectSidebar";
import { StageView } from "./StageView";
import { OutputPreview } from "./OutputPreview";
import { VariableEditor } from "./VariableEditor";
import { StageNavigator } from "./StageNavigator";
import { STAGES, type StageId } from "./stage-config";
import type { UseAgentPipelineReturn } from "@/hooks/use-agent-pipeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { STEP_CONFIGS } from "@/lib/agent/steps";
import { getModelOptions } from "@/lib/llm/models";
import {
  VARIABLE_DEFINITIONS,
  VARIABLE_KEY_TO_PIPELINE_FIELD,
  getVariableValueFromPipeline,
} from "@/lib/agent/variable-metadata";
import { cn } from "@/lib/utils";
import type { StepId, VariableKey } from "@/types/agent";

const MODEL_OPTIONS = getModelOptions();

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
    isLoadingHistory,
    historyError,
    deleteError,
    isDeletingProjectId,
    isSavingProject,
    saveError,
    isRunningAll,
  } = state;

  const hasTopic = Boolean(pipeline.topic.trim());
  const [editingVariable, setEditingVariable] = useState<VariableKey | null>(null);
  const [visibleStepId, setVisibleStepId] = useState<StepId | null>(null);

  const editorInitialValue = useMemo(() => {
    if (!editingVariable) {
      return "";
    }
    return getVariableValueFromPipeline(state.pipeline, editingVariable) ?? "";
  }, [editingVariable, state.pipeline]);

  const variableSummaries = useMemo(
    () =>
      VARIABLE_DEFINITIONS.map((definition) => {
        const field = VARIABLE_KEY_TO_PIPELINE_FIELD[definition.key];
        const rawValue = state.pipeline[field];
        return {
          key: definition.key,
          label: definition.label,
          value: typeof rawValue === "string" ? rawValue : "",
        };
      }),
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
    actions.newProject();
    onStageChangeAction("plan");
  };

  const sidebarProps = {
    projects: historyProjects,
    selectedProjectId,
    currentPipelineId: pipeline.id ?? null,
    currentTopic: pipeline.topic,
    isSavingCurrentProject: isSavingProject,
    isLoading: isLoadingHistory,
    isDeletingProjectId,
    historyError,
    deleteError,
    saveError,
    onNewProject: handleNewProject,
    onRefresh: actions.refreshHistory,
    onSelectProject: actions.selectProject,
    onDeleteProject: actions.deleteProject,
    onSaveProject: actions.saveProject,
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

  return (
    <div className="flex min-h-screen bg-zinc-950/98 text-zinc-100">
      <aside className="hidden md:flex md:w-[260px] md:flex-none md:flex-col md:border-r md:border-zinc-900/70 md:bg-zinc-950/80 md:px-4 md:py-8">
        <ProjectSidebar
          {...sidebarProps}
          className="h-full rounded-none border-none bg-transparent p-0 shadow-none"
        />
      </aside>

      <div className="flex-1">
        <div className="flex w-full flex-col gap-8 px-4 py-8 md:px-6 lg:px-10 xl:px-16 2xl:px-24">
          <div className="md:hidden">
            <ProjectSidebar {...sidebarProps} />
          </div>

          <main className="flex w-full flex-col gap-8 pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10">
            <div className="flex flex-col gap-8">
              <Card className="border border-zinc-900/60 bg-zinc-950/80 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.85)]">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-center lg:gap-12">
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                          Agentic Kids Video Builder
                        </h1>
                        <p className="max-w-2xl text-sm text-zinc-400">
                          Start with a kid-friendly topic, pick how much reasoning power you need, and we’ll guide you through each stage of the pipeline with guardrails.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-5 rounded-3xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <div className="space-y-2">
                        <RadioGroup
                          className="flex flex-wrap gap-2"
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
                              <span>{option.replace("-thinking", "")}</span>
                            </label>
                          ))}
                        </RadioGroup>
                      </div>

                      <div className="space-y-3">
                        <Label
                          htmlFor="agent-topic"
                          className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white"
                        >
                          Topic
                        </Label>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Input
                            id="agent-topic"
                            placeholder="e.g. Why the moon changes shape"
                            value={pipeline.topic}
                            onChange={(event) => actions.setTopic(event.target.value)}
                            className="h-12 flex-1 rounded-2xl border-zinc-50/10 bg-zinc-900 text-base text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-white/60"
                          />
                          <Button
                            onClick={actions.runAll}
                            disabled={isRunningAll || !hasTopic}
                            className="h-12 rounded-2xl bg-white text-sm font-semibold uppercase tracking-[0.2em] text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
                          >
                            {isRunningAll ? "Running…" : "Run pipeline"}
                          </Button>
                        </div>
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
                    totalTokens: pipeline.totalTokens,
                    totalCostUsd: pipeline.totalCostUsd,
                    llmRuntimeSeconds:
                      derived.hasRuntimeMetrics && derived.totalGenerationDurationMs > 0
                        ? derived.totalGenerationDurationMs / 1000
                        : undefined,
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
                    stages={STAGES}
                    stepConfigs={STEP_CONFIGS}
                    activeStageId={activeStageId}
                    currentStepId={visibleStepId}
                    stepStates={state.pipeline.steps}
                    onSelectStage={handleStageSelect}
                    onSelectStep={handleStepJump}
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
                    totalTokens: pipeline.totalTokens,
                    totalCostUsd: pipeline.totalCostUsd,
                    llmRuntimeSeconds:
                      derived.hasRuntimeMetrics && derived.totalGenerationDurationMs > 0
                        ? derived.totalGenerationDurationMs / 1000
                        : undefined,
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
    </div>
  );
}


"use client";

import { ProjectSidebar } from "./ProjectSidebar";
import { StageNavigator } from "./StageNavigator";
import { StageView } from "./StageView";
import { OutputPreview } from "./OutputPreview";
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
import { cn } from "@/lib/utils";

const MODEL_OPTIONS = getModelOptions();

type AgentShellProps = {
  state: UseAgentPipelineReturn["state"];
  derived: UseAgentPipelineReturn["derived"];
  actions: UseAgentPipelineReturn["actions"];
  activeStageId: StageId;
  onStageChange: (stageId: StageId) => void;
};

export function AgentShell({
  state,
  derived,
  actions,
  activeStageId,
  onStageChange,
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

  return (
    <div className="min-h-screen bg-zinc-950/98 text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
        <ProjectSidebar
          projects={historyProjects}
          selectedProjectId={selectedProjectId}
          isLoading={isLoadingHistory}
          isDeletingProjectId={isDeletingProjectId}
          historyError={historyError}
          deleteError={deleteError}
          onNewProject={() => {
            actions.newProject();
            onStageChange("plan");
          }}
          onRefresh={actions.refreshHistory}
          onSelectProject={actions.selectProject}
          onDeleteProject={actions.deleteProject}
          className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]"
        />

        <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-16">
          <Card className="border border-zinc-900/60 bg-zinc-950/80 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.85)]">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-zinc-500">
                    Factiod Agent
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Agentic Kids Video Builder
                  </h1>
                  <p className="max-w-xl text-sm text-zinc-400">
                    Configure the topic, pick a reasoning model, and work through the pipeline with a focused, minimalist workspace.
                  </p>
                </div>
                <RadioGroup
                  className="flex flex-wrap gap-3 rounded-2xl border border-zinc-900 bg-zinc-950/70 p-3 text-sm"
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
                        "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em]",
                        pipeline.model === option
                          ? "bg-white text-zinc-900"
                          : "text-zinc-500 hover:text-zinc-200",
                      )}
                    >
                      <RadioGroupItem
                        id={`model-${option}`}
                        value={option}
                        className="border-zinc-600 text-zinc-100"
                      />
                      {option.replace("-thinking", "")}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start">
                <div className="space-y-2">
                  <Label
                    htmlFor="agent-topic"
                    className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500"
                  >
                    Topic
                  </Label>
                  <Input
                    id="agent-topic"
                    placeholder="e.g. How volcanoes work"
                    value={pipeline.topic}
                    onChange={(event) => actions.setTopic(event.target.value)}
                    className="h-12 rounded-2xl border-zinc-900 bg-zinc-900/60 text-base text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-white/40"
                  />
                </div>

                <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-4 text-sm">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-zinc-500">
                    Totals
                  </p>
                  <div className="mt-2 text-2xl font-semibold">
                    {pipeline.totalTokens.toLocaleString()} tokens
                  </div>
                  <div className="text-sm text-zinc-400">
                    ${pipeline.totalCostUsd.toFixed(3)}
                  </div>
                  {derived.hasRuntimeMetrics && (
                    <div className="mt-3 space-y-1 text-xs text-zinc-400">
                      {derived.totalGenerationDurationMs > 0 && (
                        <div className="flex justify-between">
                          <span>LLM runtime</span>
                          <span className="font-medium text-zinc-200">
                            {(derived.totalGenerationDurationMs / 1000).toFixed(1)}s
                          </span>
                        </div>
                      )}
                      {state.scriptAudioGenerationTimeMs !== null && (
                        <div className="flex justify-between">
                          <span>Audio</span>
                          <span className="font-medium text-zinc-200">
                            {(state.scriptAudioGenerationTimeMs / 1000).toFixed(1)}s
                          </span>
                        </div>
                      )}
                      {state.thumbnailGenerationTime !== null && (
                        <div className="flex justify-between">
                          <span>Thumbnail</span>
                          <span className="font-medium text-zinc-200">
                            {(state.thumbnailGenerationTime / 1000).toFixed(1)}s
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-4 flex flex-col gap-2 text-sm">
                    <Button
                      onClick={actions.runAll}
                      disabled={isRunningAll || !hasTopic}
                      className="w-full rounded-2xl bg-white text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
                    >
                      {isRunningAll ? "Running…" : "Run entire pipeline"}
                    </Button>
                    <Button
                      onClick={actions.saveProject}
                      disabled={isSavingProject || !hasTopic}
                      className="w-full rounded-2xl border border-white/20 bg-transparent text-white hover:bg-white/10"
                      variant="outline"
                    >
                      {isSavingProject ? "Saving…" : "Save project"}
                    </Button>
                    <Button
                      onClick={actions.exportFiles}
                      disabled={!derived.hasAnyOutputs}
                      className="w-full rounded-2xl border border-zinc-800 bg-transparent text-zinc-200 hover:border-zinc-500 hover:text-white"
                      variant="outline"
                    >
                      Export text files
                    </Button>
                    <Button
                      onClick={actions.exportScriptMarkdown}
                      disabled={!derived.hasScript}
                      className="w-full rounded-2xl border border-zinc-800 bg-transparent text-zinc-200 hover:border-zinc-500 hover:text-white"
                      variant="outline"
                    >
                      Export script (.md)
                    </Button>
                  </div>
                  {saveError && (
                    <p className="mt-3 text-xs text-rose-300" role="alert">
                      {saveError}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <section className="rounded-3xl border border-zinc-900/70 bg-zinc-950/70 p-6 shadow-[0_25px_80px_-60px_rgba(0,0,0,0.85)]">
            <StageNavigator
              stages={STAGES}
              activeStageId={activeStageId}
              stepStates={state.pipeline.steps}
              onSelect={onStageChange}
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
            />
          </section>

          <section className="rounded-3xl border border-zinc-900/70 bg-zinc-950/80 p-6 shadow-[0_25px_80px_-60px_rgba(0,0,0,0.85)]">
            <OutputPreview state={state} derived={derived} actions={actions} />
          </section>
        </main>
      </div>
    </div>
  );
}


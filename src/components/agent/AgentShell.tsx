"use client";

import { useCallback, useMemo, useState } from "react";

import { StageView } from "./StageView";
import { VariableEditor } from "./VariableEditor";
import { StageNavBar } from "./StageNavBar";
import { StyleSelector } from "./StyleSelector";
import { STAGES, type StageId } from "./stage-config";
import type { UseAgentPipelineReturn } from "@/hooks/use-agent-pipeline";
import { STEP_CONFIGS, getStepConfigs } from "@/lib/agent/steps";
import { getVariableValueFromPipeline } from "@/lib/agent/variable-metadata";
import type { AudienceMode, StepId, VariableKey, VisualStyleId } from "@/types/agent";
import type { StageDefinition } from "./stage-config";

type AgentShellProps = {
  state: UseAgentPipelineReturn["state"];
  derived: UseAgentPipelineReturn["derived"];
  actions: UseAgentPipelineReturn["actions"];
  activeStageId: StageId;
  onStageChangeAction: (stageId: StageId) => void;
  stages?: StageDefinition[];
  /** When true, open the create-project (style + audience) modal on mount. */
  openCreateProjectModal?: boolean;
};

export function AgentShell({
  state,
  derived,
  actions,
  activeStageId,
  onStageChangeAction,
  stages = STAGES,
  openCreateProjectModal = false,
}: AgentShellProps) {
  const [editingVariable, setEditingVariable] = useState<VariableKey | null>(null);
  const [isStyleSelectorOpen, setIsStyleSelectorOpen] = useState(openCreateProjectModal);
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

  const stepToStageMap = useMemo(() => {
    const map: Record<StepId, StageId> = {} as Record<StepId, StageId>;
    stages.forEach((stage) => {
      stage.steps.forEach((stepId) => {
        map[stepId] = stage.id;
      });
    });
    return map;
  }, [stages]);

  const stepConfigs = useMemo(
    () => getStepConfigs(state.pipeline.audienceMode ?? "forKids"),
    [state.pipeline.audienceMode],
  );

  const handleStyleSelected = (_styleId: VisualStyleId, audienceMode: AudienceMode) => {
    setIsStyleSelectorOpen(false);
    const seedTopic = state.pipeline.topic;
    const seedCreatorName = state.pipeline.creatorName ?? "";
    actions.newProject(undefined, audienceMode);
    actions.setPipeline((prev) => ({
      ...prev,
      topic: seedTopic,
      creatorName: seedCreatorName,
    }));
    onStageChangeAction("scriptAudio");
  };

  const handleStageSelect = (stageId: StageId) => {
    onStageChangeAction(stageId);
    requestAnimationFrame(() => {
      const target = document.getElementById(`stage-${stageId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
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

  const handleVisibleStepChange = useCallback(
    (stepId: StepId | null) => {
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
    <div className="min-h-screen bg-zinc-950/98 text-zinc-100">
      <StageNavBar
        stages={stages}
        activeStageId={activeStageId}
        onSelectStage={handleStageSelect}
      />

      <div className="flex w-full flex-col gap-8 px-4 py-8 md:px-6 lg:px-10 xl:px-14 2xl:px-20">
        <main className="flex w-full flex-col gap-8 pb-16">
          <section className="space-y-6">
            <StageView
              stages={stages}
              activeStageId={activeStageId}
              stepConfigs={stepConfigs}
              state={state}
              derived={derived}
              actions={actions}
              onEditVariable={(variable) => setEditingVariable(variable)}
              onVisibleStepChange={handleVisibleStepChange}
              collapsedSteps={collapsedSteps}
              onStepCollapseChangeAction={handleStepCollapseChange}
            />
          </section>
        </main>
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
        key={`${isStyleSelectorOpen ? "open" : "closed"}:${state.pipeline.visualStyleId ?? "default"}:${state.pipeline.audienceMode ?? "forKids"}`}
        isOpen={isStyleSelectorOpen}
        initialStyleId={state.pipeline.visualStyleId ?? undefined}
        initialAudienceMode={state.pipeline.audienceMode ?? "forKids"}
        showVisualStyle={false}
        contextLabel="New Project"
        title="Choose an audience"
        description="Pick the tone and complexity. Visual style uses your Settings default (changeable later in Timing + Story)."
        confirmLabel="Create project"
        footerText="You can change audience on the next project; style can be changed later in Timing + Story."
        onSelect={handleStyleSelected}
        onClose={() => setIsStyleSelectorOpen(false)}
      />
    </div>
  );
}

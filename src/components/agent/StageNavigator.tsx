"use client";

import { cn } from "@/lib/utils";
import type { StepId, StepRunState } from "@/types/agent";

import type { StageDefinition, StageId } from "./stage-config";

interface StageNavigatorProps {
  stages: StageDefinition[];
  activeStageId: StageId;
  stepStates: Record<StepId, StepRunState>;
  onSelect: (stageId: StageId) => void;
}

export function StageNavigator({
  stages,
  activeStageId,
  stepStates,
  onSelect,
}: StageNavigatorProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
          Workflow
        </p>
        <p className="text-sm text-zinc-400">
          Move stage by stage so you only see what matters right now.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {stages.map((stage) => {
          const completedCount = stage.steps.filter(
            (stepId) => stepStates[stepId]?.status === "success",
          ).length;
          const totalCount = stage.steps.length;
          const isActive = stage.id === activeStageId;

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelect(stage.id)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-colors",
                "border-zinc-900/80 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/60",
                isActive && "border-white/70 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.2)]",
              )}
            >
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                <span>{stage.label}</span>
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[0.65rem] text-zinc-400">
                  {completedCount}/{totalCount}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{stage.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}


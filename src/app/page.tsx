"use client";

import { useState } from "react";

import { AgentShell } from "@/components/agent/AgentShell";
import type { StageId } from "@/components/agent/stage-config";
import { useAgentPipeline } from "@/hooks/use-agent-pipeline";

export default function HomePage() {
  const pipeline = useAgentPipeline();
  const [activeStageId, setActiveStageId] = useState<StageId>("plan");

  return (
    <AgentShell
      state={pipeline.state}
      derived={pipeline.derived}
      actions={pipeline.actions}
      activeStageId={activeStageId}
      onStageChangeAction={setActiveStageId}
    />
  );
}


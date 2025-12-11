"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { AgentShell } from "@/components/agent/AgentShell";
import type { StageDefinition, StageId } from "@/components/agent/stage-config";
import { useAgentPipeline } from "@/hooks/use-agent-pipeline";

type ProjectPageClientProps = {
  stages: StageDefinition[];
};

export default function ProjectPageClient({ stages }: ProjectPageClientProps) {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const pipeline = useAgentPipeline();
  const [activeStageId, setActiveStageId] = useState<StageId>("scriptAudio");
  const initializedRef = useRef(false);

  const creatorName = searchParams.get("creator");
  const topic = searchParams.get("topic");

  const projectId = useMemo(() => params?.id ?? "new", [params]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (projectId === "new") {
      pipeline.actions.newProject();
      if (creatorName) {
        pipeline.actions.setPipeline((prev) => ({ ...prev, creatorName }));
      }
      if (topic) {
        pipeline.actions.setTopic(topic);
      }
      return;
    }

    pipeline.actions.selectProject(projectId);
  }, [pipeline.actions, projectId, creatorName, topic]);

  return (
    <AgentShell
      state={pipeline.state}
      derived={pipeline.derived}
      actions={pipeline.actions}
      stages={stages}
      activeStageId={activeStageId}
      onStageChangeAction={setActiveStageId}
    />
  );
}


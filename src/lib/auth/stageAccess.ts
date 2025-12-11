import { STAGES, type StageDefinition } from "@/components/agent/stage-config";

export function getStagesForRole(role?: string): StageDefinition[] {
  if (role === "videoteam") {
    return STAGES.filter((stage) => stage.id === "scriptAudio" || stage.id === "publishing").map(
      (stage) => {
        if (stage.id !== "publishing") {
          return stage;
        }

        return {
          ...stage,
          steps: stage.steps.filter((stepId) => stepId !== "videoAssembly"),
        };
      },
    );
  }

  return STAGES;
}

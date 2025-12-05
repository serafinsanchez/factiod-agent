import type { StepConfig, SceneAsset } from "@/types/agent";
import type { UseAgentPipelineReturn } from "@/hooks/use-agent-pipeline";

export interface StepComponentProps {
  stepConfig: StepConfig;
  state: UseAgentPipelineReturn["state"];
  actions: UseAgentPipelineReturn["actions"];
}

export interface NarrationAudioStepProps extends StepComponentProps {
  topic: string;
}

export type FrameKind = "first" | "last";

export interface FrameTile {
  sceneNumber: number;
  frameKind: FrameKind;
  imageUrl: string;
}

export type SceneTimeRange = {
  start: number;
  end: number;
};

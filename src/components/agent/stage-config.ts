import type { StepId } from "@/types/agent";

export type StageId =
  | "scriptAudio"
  | "timingStory"
  | "imagery"
  | "videoGen"
  | "publishing";

export interface StageDefinition {
  id: StageId;
  label: string;
  description: string;
  steps: StepId[];
}

export const STAGES: StageDefinition[] = [
  {
    id: "scriptAudio",
    label: "Script + Audio",
    description: "Write the story, add QA, and render the voiceover.",
    steps: ["keyConcepts", "hook", "quizzes", "script", "scriptQA", "narrationAudioTags", "narrationAudio"],
  },
  {
    id: "timingStory",
    label: "Timing and Story",
    description: "Create the production script and align narration timestamps per scene.",
    steps: ["productionScript", "narrationTimestamps"],
  },
  {
    id: "imagery",
    label: "Imagery",
    description: "Generate character reference, scene image prompts, and scene images.",
    steps: ["characterReferenceImage", "sceneImagePrompts", "sceneImages"],
  },
  {
    id: "videoGen",
    label: "Video Gen",
    description: "Create motion prompts and render scene videos.",
    steps: ["sceneVideoPrompts", "sceneVideos"],
  },
  {
    id: "publishing",
    label: "Publishing",
    description: "Create title/description and thumbnail.",
    steps: ["videoAssembly", "titleDescription", "thumbnail", "thumbnailGenerate"],
  },
];


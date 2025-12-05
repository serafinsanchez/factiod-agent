import type { StepId } from "@/types/agent";

export type StageId = "plan" | "script" | "video" | "publish";

export interface StageDefinition {
  id: StageId;
  label: string;
  description: string;
  steps: StepId[];
}

export const STAGES: StageDefinition[] = [
  {
    id: "plan",
    label: "Plan & Hook",
    description: "Define key concepts, hook, and quizzes that shape the lesson.",
    steps: ["keyConcepts", "hook", "quizzes"],
  },
  {
    id: "script",
    label: "Script & Narration",
    description:
      "Generate the script, run QA, clean narration, add audio tags, and render the ElevenLabs voiceover.",
    steps: ["script", "scriptQA", "narrationClean", "narrationAudioTags", "narrationAudio"],
  },
  {
    id: "video",
    label: "Video Generation",
    description:
      "Create production script, extract narration timestamps aligned to scenes, generate scene images and video clips, then assemble the final video.",
    steps: [
      "productionScript",
      "narrationTimestamps",
      "characterReferenceImage",
      "sceneImagePrompts",
      "sceneImages",
      "sceneVideoPrompts",
      "sceneVideos",
      "videoAssembly",
    ],
  },
  {
    id: "publish",
    label: "Title, Description & Thumbnail",
    description: "Create packaging that helps the video perform on YouTube.",
    steps: ["titleDescription", "thumbnail", "thumbnailGenerate"],
  },
];


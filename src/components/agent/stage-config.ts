import type { StepId } from "@/types/agent";

export type StageId = "plan" | "script" | "publish";

export interface StageDefinition {
  id: StageId;
  label: string;
  description: string;
  steps: StepId[];
}

export const STAGES: StageDefinition[] = [
  {
    id: "plan",
    label: "Stage 1 – Plan & Hook",
    description: "Define key concepts, hook, and quizzes that shape the lesson.",
    steps: ["keyConcepts", "hook", "quizzes"],
  },
  {
    id: "script",
    label: "Stage 2 – Script & Narration",
    description: "Generate the long-form script and clean narration.",
    steps: ["script"],
  },
  {
    id: "publish",
    label: "Stage 3 – Title, Description & Thumbnail",
    description: "Create packaging that helps the video perform on YouTube.",
    steps: ["titleDescription", "thumbnail"],
  },
];


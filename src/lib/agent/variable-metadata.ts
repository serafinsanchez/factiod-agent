import type { PipelineState, VariableKey } from "@/types/agent";

export type VariableFieldKey = Extract<
  keyof PipelineState,
  | "topic"
  | "keyConcepts"
  | "hookScript"
  | "quizInfo"
  | "videoScript"
  | "narrationScript"
  | "title"
  | "description"
  | "thumbnailPrompt"
>;

export type VariableDefinition = {
  key: VariableKey;
  label: string;
  description: string;
};

export const VARIABLE_KEY_TO_PIPELINE_FIELD: Record<VariableKey, VariableFieldKey> = {
  Topic: "topic",
  KeyConcepts: "keyConcepts",
  HookScript: "hookScript",
  QuizInfo: "quizInfo",
  VideoScript: "videoScript",
  NarrationScript: "narrationScript",
  Title: "title",
  Description: "description",
  ThumbnailPrompt: "thumbnailPrompt",
};

export const VARIABLE_LABELS: Record<VariableKey, string> = {
  Topic: "Topic",
  KeyConcepts: "Key concepts",
  HookScript: "Hook",
  QuizInfo: "Quiz info",
  VideoScript: "Video script",
  NarrationScript: "Elevenlabs script",
  Title: "Title",
  Description: "Description",
  ThumbnailPrompt: "Thumbnail prompt",
};

export const VARIABLE_DEFINITIONS: VariableDefinition[] = [
  {
    key: "Topic",
    label: VARIABLE_LABELS.Topic,
    description: "Overall video idea used by every step.",
  },
  {
    key: "KeyConcepts",
    label: VARIABLE_LABELS.KeyConcepts,
    description: "Three high-level teaching points.",
  },
  {
    key: "HookScript",
    label: VARIABLE_LABELS.HookScript,
    description: "Opening hook shown at the start of the script.",
  },
  {
    key: "QuizInfo",
    label: VARIABLE_LABELS.QuizInfo,
    description: "Quiz pauses injected later in the script.",
  },
  {
    key: "VideoScript",
    label: VARIABLE_LABELS.VideoScript,
    description: "Primary narrator-ready script content.",
  },
  {
    key: "NarrationScript",
    label: VARIABLE_LABELS.NarrationScript,
    description: "Clean narration text used for voiceover.",
  },
  {
    key: "Title",
    label: VARIABLE_LABELS.Title,
    description: "YouTube-friendly title.",
  },
  {
    key: "Description",
    label: VARIABLE_LABELS.Description,
    description: "Channel description that includes promo copy.",
  },
  {
    key: "ThumbnailPrompt",
    label: VARIABLE_LABELS.ThumbnailPrompt,
    description: "Midjourney/Gemini prompt for generating the thumbnail.",
  },
];

export function getVariableValueFromPipeline(
  pipeline: PipelineState,
  variable: VariableKey,
): string | undefined {
  const field = VARIABLE_KEY_TO_PIPELINE_FIELD[variable];
  if (!field) {
    return undefined;
  }
  const value = pipeline[field];
  return typeof value === "string" ? value : undefined;
}



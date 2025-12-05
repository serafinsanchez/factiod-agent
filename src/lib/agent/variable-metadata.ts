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
  /**
   * Structured variables (e.g., JSON) may need to be treated differently in the UI.
   * Defaults to "text" for editable string variables.
   */
  valueType?: "text" | "json";
  /**
   * Marks variables that are derived from the pipeline and shouldn't be edited manually.
   */
  isReadOnly?: boolean;
};

/**
 * Maps simple string VariableKeys to their PipelineState field names.
 * Note: ProductionScript, SceneImagePrompts, and SceneVideoPrompts are JSON data
 * stored separately in the pipeline state as structured objects.
 */
export const VARIABLE_KEY_TO_PIPELINE_FIELD: Partial<Record<VariableKey, VariableFieldKey>> = {
  Topic: "topic",
  KeyConcepts: "keyConcepts",
  HookScript: "hookScript",
  QuizInfo: "quizInfo",
  VideoScript: "videoScript",
  NarrationScript: "narrationScript",
  Title: "title",
  Description: "description",
  ThumbnailPrompt: "thumbnailPrompt",
  // Note: ProductionScript, SceneImagePrompts, SceneVideoPrompts are JSON outputs
  // and stored as structured data, not simple strings
};

export const VARIABLE_LABELS: Record<VariableKey, string> = {
  Topic: "Topic",
  KeyConcepts: "Key concepts",
  HookScript: "Hook",
  QuizInfo: "Quiz info",
  VideoScript: "Video script",
  NarrationScript: "Elevenlabs script",
  NarrationTimestamps: "Narration timestamps",
  ProductionScript: "Production script",
  CharacterReferenceImage: "Character reference",
  SceneImagePrompts: "Scene image prompts",
  SceneVideoPrompts: "Scene video prompts",
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
    key: "NarrationTimestamps",
    label: VARIABLE_LABELS.NarrationTimestamps,
    description: "Word-level timestamps from narration audio for precise video sync.",
    valueType: "json",
    isReadOnly: true,
  },
  {
    key: "ProductionScript",
    label: VARIABLE_LABELS.ProductionScript,
    description: "JSON breakdown of script into timed scenes for video generation.",
  },
  {
    key: "CharacterReferenceImage",
    label: VARIABLE_LABELS.CharacterReferenceImage,
    description: "Base64-encoded reference image for visual consistency across scenes.",
    isReadOnly: true,
  },
  {
    key: "SceneImagePrompts",
    label: VARIABLE_LABELS.SceneImagePrompts,
    description: "Image generation prompts for each scene.",
  },
  {
    key: "SceneVideoPrompts",
    label: VARIABLE_LABELS.SceneVideoPrompts,
    description: "Motion prompts for animating each scene image.",
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
  if (field) {
    const value = pipeline[field];
    return typeof value === "string" ? value : undefined;
  }

  // Handle structured variables that are not stored as plain strings.
  switch (variable) {
    case "NarrationTimestamps": {
      if (pipeline.narrationTimestamps) {
        return JSON.stringify(pipeline.narrationTimestamps, null, 2);
      }
      const raw = pipeline.steps?.narrationTimestamps?.responseText;
      if (typeof raw !== "string" || !raw.trim()) {
        return undefined;
      }
      try {
        const parsed = JSON.parse(raw);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return raw;
      }
    }
    default:
      return undefined;
  }
}

/**
 * Checks if a variable exists and has a value in the pipeline.
 * Handles both string variables and JSON variables (ProductionScript, SceneImagePrompts, SceneVideoPrompts).
 */
export function hasVariableValue(
  pipeline: PipelineState,
  variable: VariableKey,
): boolean {
  // Check string variables
  const field = VARIABLE_KEY_TO_PIPELINE_FIELD[variable];
  if (field) {
    const value = pipeline[field];
    return typeof value === "string" && value.trim().length > 0;
  }

  // Check JSON variables
  switch (variable) {
    case "NarrationTimestamps":
      // Primary: structured timestamps on the pipeline
      if (pipeline.narrationTimestamps?.words?.length) {
        return true;
      }
      // Fallback: parse step response text in case pipeline didn't hydrate the field
      try {
        const raw = pipeline.steps?.narrationTimestamps?.responseText;
        if (typeof raw !== "string" || !raw.trim()) {
          return false;
        }
        const parsed = JSON.parse(raw) as {
          words?: Array<unknown>;
        };
        return Array.isArray(parsed.words) && parsed.words.length > 0;
      } catch {
        return false;
      }
    case "ProductionScript":
      return Boolean(pipeline.productionScript?.scenes?.length);
    case "CharacterReferenceImage":
      return Boolean(pipeline.characterReferenceImage);
    case "SceneImagePrompts":
      return Boolean(pipeline.sceneAssets?.some((asset) => asset.imagePrompt));
    case "SceneVideoPrompts":
      return Boolean(pipeline.sceneAssets?.some((asset) => asset.videoPrompt));
    default:
      return false;
  }
}

/**
 * Gets the string representation of a variable value for display purposes.
 * For JSON variables, returns a summary string if available.
 */
export function getVariableDisplayValue(
  pipeline: PipelineState,
  variable: VariableKey,
): string | undefined {
  // Check string variables
  const field = VARIABLE_KEY_TO_PIPELINE_FIELD[variable];
  if (field) {
    const value = pipeline[field];
    return typeof value === "string" ? value : undefined;
  }

  // Check JSON variables
  switch (variable) {
    case "NarrationTimestamps":
      if (pipeline.narrationTimestamps) {
        const timestamps = pipeline.narrationTimestamps;
        const duration = timestamps.totalDurationSec?.toFixed(1) ?? "?";
        
        // Show scene-level alignment info if available
        if (timestamps.sceneTimestamps && timestamps.sceneTimestamps.length > 0) {
          const sceneCount = timestamps.sceneTimestamps.length;
          const alignedCount = timestamps.sceneTimestamps.filter((s) => s.confidence > 0).length;
          if (alignedCount === sceneCount) {
            return `${sceneCount} scenes aligned, ${duration}s`;
          } else {
            return `${alignedCount}/${sceneCount} scenes aligned, ${duration}s`;
          }
        }
        
        // Fallback to word count if scene timestamps not available
        if (timestamps.words?.length) {
          const wordCount = timestamps.words.length;
          return `${wordCount} words, ${duration}s`;
        }
      }
      // Fallback: derive a summary from the step response text if present
      try {
        const raw = pipeline.steps?.narrationTimestamps?.responseText;
        if (typeof raw !== "string" || !raw.trim()) {
          return undefined;
        }
        const parsed = JSON.parse(raw) as {
          words?: Array<unknown>;
          totalDurationSec?: number;
          sceneTimestamps?: Array<unknown>;
        };
        
        // Check for scene timestamps first
        if (parsed.sceneTimestamps && Array.isArray(parsed.sceneTimestamps) && parsed.sceneTimestamps.length > 0) {
          const sceneCount = parsed.sceneTimestamps.length;
          const duration =
            typeof parsed.totalDurationSec === "number"
              ? parsed.totalDurationSec.toFixed(1)
              : "?";
          return `${sceneCount} scenes aligned, ${duration}s`;
        }
        
        // Fallback to word count
        if (Array.isArray(parsed.words) && parsed.words.length > 0) {
          const wordCount = parsed.words.length;
          const duration =
            typeof parsed.totalDurationSec === "number"
              ? parsed.totalDurationSec.toFixed(1)
              : "?";
          return `${wordCount} words, ${duration}s`;
        }
      } catch {
        // If parsing fails, fall through to undefined
      }
      return undefined;
    case "ProductionScript":
      if (pipeline.productionScript?.scenes?.length) {
        return `${pipeline.productionScript.scenes.length} scenes`;
      }
      return undefined;
    case "CharacterReferenceImage":
      return pipeline.characterReferenceImage ? "Generated" : undefined;
    case "SceneImagePrompts":
      const imagePromptsCount = pipeline.sceneAssets?.filter((asset) => asset.imagePrompt).length ?? 0;
      return imagePromptsCount > 0 ? `${imagePromptsCount} prompts` : undefined;
    case "SceneVideoPrompts":
      const videoPromptsCount = pipeline.sceneAssets?.filter((asset) => asset.videoPrompt).length ?? 0;
      return videoPromptsCount > 0 ? `${videoPromptsCount} prompts` : undefined;
    default:
      return undefined;
  }
}



import type {
  ScriptAudioSettings,
  TimingStoryboardSettings,
  ImagerySettings,
  VideoGenSettings,
  PublishingSettings,
  GlobalSettings,
} from "./types";
import { STEP_CONFIGS } from "@/lib/agent/steps";

/**
 * Extract prompt templates from step configs
 */
const getPromptByStepId = (stepId: string): string => {
  const config = STEP_CONFIGS.find((c) => c.id === stepId);
  return config?.promptTemplate || "";
};

/**
 * Default Script + Audio settings
 * Note: audioVoice will be populated from ELEVENLABS_VOICE_ID env var via the API route
 */
export const DEFAULT_SCRIPT_AUDIO_SETTINGS: ScriptAudioSettings = {
  // Model & Defaults
  llmModel: "claude-sonnet-4.5",
  defaultWordCount: 1500,

  // Audio
  audioVoice: "", // Will be populated from ELEVENLABS_VOICE_ID env var by the API route if available
  narrationModel: "eleven_v3",
  stability: 0.5,
  similarityBoost: 0.75,

  // Prompts
  promptKeyConcepts: getPromptByStepId("keyConcepts"),
  promptHook: getPromptByStepId("hook"),
  promptQuizzes: getPromptByStepId("quizzes"),
  promptScript: getPromptByStepId("script"),
  promptScriptQA: getPromptByStepId("scriptQA"),
  promptNarrationClean: getPromptByStepId("narrationClean"),
  promptNarrationAudioTags: getPromptByStepId("narrationAudioTags"),
};

/**
 * Default Timing + Storyboard settings
 */
export const DEFAULT_TIMING_STORYBOARD_SETTINGS: TimingStoryboardSettings = {
  promptProductionScript: getPromptByStepId("productionScript"),
  sceneDurationMin: 5,
  sceneDurationMax: 10,
};

/**
 * Default Imagery settings
 */
export const DEFAULT_IMAGERY_SETTINGS: ImagerySettings = {
  defaultVisualStyle: "pixar-3d",
  videoFrameMode: "flf2v",
  characterReferenceEnabled: true,
  promptSceneImagePrompts: getPromptByStepId("sceneImagePrompts"),
};

/**
 * Default Video Gen settings
 */
export const DEFAULT_VIDEO_GEN_SETTINGS: VideoGenSettings = {
  videoModel: "WAN_2_2",
  preset: "balanced",
  resolution: "720p",
  aspectRatio: "16:9",
  numInferenceSteps: 27,
  guidanceScale: 3.0,
  interpolatorModel: "film",
  numInterpolatedFrames: 2,
  negativePrompt:
    "blur, distort, low quality, blurry, pixelated, watermark, ugly, deformed, scary, violent, blood, gore, inappropriate, adult content, nsfw, dark, creepy, jerky motion, sudden movement, rapid change",
  promptSceneVideoPrompts: getPromptByStepId("sceneVideoPrompts"),
};

/**
 * Default Publishing settings
 */
export const DEFAULT_PUBLISHING_SETTINGS: PublishingSettings = {
  promptTitleDescription: getPromptByStepId("titleDescription"),
  promptThumbnail: getPromptByStepId("thumbnail"),
  defaultPromoCopy: "",
};

/**
 * Default Global settings
 */
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  defaultProjectCreator: "",
  autoSaveDrafts: true,
  costTrackingDisplay: true,
};

/**
 * Get default settings for a specific key
 */
export function getDefaultSettings(key: string): unknown {
  switch (key) {
    case "scriptAudio":
      return DEFAULT_SCRIPT_AUDIO_SETTINGS;
    case "timingStoryboard":
      return DEFAULT_TIMING_STORYBOARD_SETTINGS;
    case "imagery":
      return DEFAULT_IMAGERY_SETTINGS;
    case "videoGen":
      return DEFAULT_VIDEO_GEN_SETTINGS;
    case "publishing":
      return DEFAULT_PUBLISHING_SETTINGS;
    case "global":
      return DEFAULT_GLOBAL_SETTINGS;
    default:
      return {};
  }
}

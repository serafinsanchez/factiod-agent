import type { ModelId, NarrationModelId, VisualStyleId, VideoFrameMode } from "@/types/agent";
import type { VideoModelId, VideoPreset, VideoResolution, VideoAspectRatio, InterpolatorModel } from "@/lib/video/fal-client";

/**
 * Settings key types - corresponds to tab names
 */
export type SettingsKey = 
  | "scriptAudio"
  | "timingStoryboard"
  | "imagery"
  | "videoGen"
  | "publishing"
  | "global";

/**
 * Script + Audio Settings
 */
export interface ScriptAudioSettings {
  // Model & Defaults
  llmModel: ModelId;
  defaultWordCount: number;
  
  // Audio
  audioVoice: string;
  narrationModel: NarrationModelId;
  stability: number;
  similarityBoost: number;
  
  // Prompts
  promptKeyConcepts: string;
  promptHook: string;
  promptQuizzes: string;
  promptScript: string;
  promptScriptQA: string;
  promptNarrationAudioTags: string;
}

/**
 * Timing + Storyboard Settings
 */
export interface TimingStoryboardSettings {
  promptProductionScript: string;
  sceneDurationMin: number;
  sceneDurationMax: number;
}

/**
 * Imagery Settings
 */
export interface ImagerySettings {
  defaultVisualStyle: VisualStyleId;
  videoFrameMode: VideoFrameMode;
  characterReferenceEnabled: boolean;
  promptSceneImagePrompts: string;
}

/**
 * Video Gen Settings
 */
export interface VideoGenSettings {
  videoModel: VideoModelId;
  preset: VideoPreset;
  resolution: VideoResolution;
  aspectRatio: VideoAspectRatio;
  numInferenceSteps: number;
  guidanceScale: number;
  interpolatorModel: InterpolatorModel;
  numInterpolatedFrames: number;
  negativePrompt: string;
  promptSceneVideoPrompts: string;
}

/**
 * Publishing Settings
 */
export interface PublishingSettings {
  thumbnailModel: "nano_banana_pro" | "seedream_v4";
  promptTitleDescription: string;
  promptThumbnail: string;
  defaultPromoCopy: string;
}

/**
 * Global Settings
 */
export interface GlobalSettings {
  defaultProjectCreator: string;
  autoSaveDrafts: boolean;
  costTrackingDisplay: boolean;
}

/**
 * Union type of all settings
 */
export type SettingsValue =
  | ScriptAudioSettings
  | TimingStoryboardSettings
  | ImagerySettings
  | VideoGenSettings
  | PublishingSettings
  | GlobalSettings;

/**
 * Map of settings keys to their types
 */
export interface SettingsMap {
  scriptAudio: ScriptAudioSettings;
  timingStoryboard: TimingStoryboardSettings;
  imagery: ImagerySettings;
  videoGen: VideoGenSettings;
  publishing: PublishingSettings;
  global: GlobalSettings;
}

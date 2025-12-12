export type ModelId =
  | 'claude-sonnet-4.5'
  | 'claude-opus-4.5'
  | 'gpt-5.1-2025-11-13'
  | 'gpt-5.2'
  | 'kimik2-thinking'
  | 'gemini-3-pro';
export type NarrationModelId = 'eleven_v3' | 'eleven_multilingual_v2';

/**
 * Visual style for video generation.
 * Each style has different prompt templates and visual characteristics.
 */
export type VisualStyleId = 'pixar-3d' | 'paper-craft' | 'documentary';

/**
 * Audience mode for prompt tuning.
 * - 'forKids': explicitly kid-targeted tone (current default).
 * - 'forEveryone': family-friendly content suitable for kids, teens, and adults.
 */
export type AudienceMode = 'forKids' | 'forEveryone';

/**
 * Video frame generation mode.
 * - 'flf2v': First-Last-Frame-to-Video - generates both first and last frame images,
 *   WAN 2.2 interpolates between them for smoother, more controlled motion.
 * - 'first-frame-only': Single image mode - generates only the first frame,
 *   WAN 2.2 generates motion freely from the starting image.
 */
export type VideoFrameMode = 'flf2v' | 'first-frame-only';

export type StepId =
  | 'keyConcepts'
  | 'hook'
  | 'quizzes'
  | 'script'
  | 'scriptQA'
  | 'narrationAudioTags'
  | 'narrationAudio'
  | 'narrationTimestamps'
  | 'productionScript'
  | 'characterReferenceImage'
  | 'sceneImagePrompts'
  | 'sceneImages'
  | 'sceneVideoPrompts'
  | 'sceneVideos'
  | 'videoAssembly'
  | 'titleDescription'
  | 'thumbnail'
  | 'thumbnailGenerate';

export type VariableKey =
  | 'Topic'
  | 'KeyConcepts'
  | 'HookScript'
  | 'QuizInfo'
  | 'VideoScript'
  | 'NarrationScript'
  | 'NarrationTimestamps'
  | 'ProductionScript'
  | 'CharacterReferenceImage'
  | 'SceneImagePrompts'
  | 'SceneVideoPrompts'
  | 'Title'
  | 'Description'
  | 'YoutubeTags'
  | 'Chapters'
  | 'ThumbnailPrompt';

export interface StepConfig {
  id: StepId;
  label: string;
  defaultModel: ModelId;
  promptTemplate: string;
  inputVars: VariableKey[];
  outputVars: VariableKey[];
  hidden?: boolean; // If true, step is internal and not shown in UI
}

export interface StepRunMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  /**
   * Time taken to run the step on the backend, in milliseconds.
   * Optional for backwards compatibility with older saved pipeline state.
   */
  durationMs?: number;
}

export interface StepRunState {
  id: StepId;
  resolvedPrompt: string;
  responseText: string;
  status: 'idle' | 'running' | 'success' | 'error' | 'stale';
  errorMessage?: string;
  metrics?: StepRunMetrics;
}

export interface PipelineState {
  topic: string;
  /** Optional creator label for display in project lists */
  creatorName?: string | null;
  /** Prompt tuning preset for the project's content audience. */
  audienceMode?: AudienceMode;
  keyConcepts?: string;
  hookScript?: string;
  quizInfo?: string;
  videoScript?: string;
  narrationScript?: string;
  title?: string;
  description?: string;
  /** Comma-separated YouTube upload tags (max 500 chars). */
  youtubeTags?: string;
  /** Video chapters for YouTube description (timestamps + titles). */
  chapters?: string;
  thumbnailPrompt?: string;
  steps: Record<StepId, StepRunState>;
  model: ModelId;
  totalTokens: number;
  totalCostUsd: number;
  sessionTotalTokens?: number;
  sessionTotalCostUsd?: number;
  /**
   * Cumulative totals across all saves/iterations of the project.
   * Used for admin reporting; session totals continue to reflect the current run.
   */
  cumulativeTokens?: number;
  cumulativeCostUsd?: number;
  narrationModelId?: NarrationModelId;
  /**
   * Optional fields used for persistence of projects/history.
   * These are kept optional so older saved state continues to work.
   */
  id?: string;
  projectSlug?: string;
  scriptPath?: string;
  audioPath?: string;
  thumbnailPath?: string;
  
  // Audio timestamps for audio-video sync
  narrationTimestamps?: NarrationTimestampsData;
  
  // Video pipeline fields
  /** Visual style for video generation (affects prompts, character usage, etc.) */
  visualStyleId?: VisualStyleId;
  /**
   * Video frame generation mode.
   * - 'flf2v' (default): Generate first + last frame images; WAN 2.2 interpolates between them
   * - 'first-frame-only': Generate single image; WAN 2.2 generates motion from one frame
   */
  videoFrameMode?: VideoFrameMode;
  productionScript?: ProductionScriptData;
  /** Base64-encoded character reference image for visual consistency across scenes */
  characterReferenceImage?: string;
  sceneAssets?: SceneAsset[];
  finalVideoPath?: string;
  videoAssemblyStatus?: 'idle' | 'assembling' | 'complete' | 'error';
  /**
   * Optional limiter for Stage 3 so users can preview only the first N scenes
   * before committing to full image/video generation. When null/undefined we
   * run the entire scene list.
   */
  scenePreviewLimit?: number | null;
}

export interface HistoryProject {
  id: string;
  topic: string;
  title?: string | null;
  /** Creator attribution for the project list */
  creatorName?: string | null;
  projectSlug?: string | null;
  model: ModelId;
  createdAt?: string | null;
  pipeline?: PipelineState | null;
}

export type ProjectStatus = "draft" | "in-progress" | "review" | "complete";

// ============================================
// Audio Timestamps Types
// ============================================

/**
 * A single word with its timing in the narration audio.
 */
export interface WordTimestamp {
  word: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
}

/**
 * A segment of narration (typically a sentence) with word-level timestamps.
 */
export interface NarrationSegment {
  text: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  words: WordTimestamp[];
}

/**
 * Scene-level timestamp alignment result.
 */
export interface SceneTimestamp {
  sceneNumber: number;
  narrationText: string;
  startSec: number;
  endSec: number;
  confidence: number;
  /** Calculated WAN 2.2 num_frames (clamped 17-161) */
  numFrames: number;
}

/**
 * Complete narration timestamps data extracted from audio via Whisper.
 */
export interface NarrationTimestampsData {
  /** All words with their individual timestamps */
  words: WordTimestamp[];
  /** Segments (sentences) with word-level breakdown */
  segments: NarrationSegment[];
  /** Total duration of the audio in seconds */
  totalDurationSec: number;
  /** Scene-level timestamps aligned to production script scenes (if available) */
  sceneTimestamps?: SceneTimestamp[];
}

// ============================================
// Video Pipeline Types
// ============================================

/**
 * A single scene in the production script.
 * Each scene corresponds to one video clip (5-10 seconds).
 */
export interface ProductionScene {
  sceneNumber: number;
  narrationText: string;
  visualDescription: string;
  /** Estimated duration if timestamps are not available */
  estimatedDurationSec: number;
  /** Precise start time from audio timestamps (if available) */
  startSec?: number;
  /** Precise end time from audio timestamps (if available) */
  endSec?: number;
  /** Hint for how this scene transitions to the next */
  transitionHint?: "same-framing" | "same-subject" | "related-cut" | "topic-change";
  /** Group this scene belongs to for organization */
  sceneGroup?: string;
}

/**
 * Assets generated for a single scene.
 * Supports FLF2V (First-Last-Frame-to-Video) with separate first and last frame images.
 */
export interface SceneAsset {
  sceneNumber: number;
  /** Image generation prompt for the first frame (starting pose) */
  imagePrompt?: string;
  /** URL of the generated first frame image */
  imageUrl?: string;
  /** Image generation prompt for the last frame (end state after micro-movement) */
  lastFrameImagePrompt?: string;
  /** URL of the generated last frame image for FLF2V */
  lastFrameImageUrl?: string;
  videoPrompt?: string;
  videoUrl?: string;
  audioDurationSec?: number;
  /** Target duration in seconds calculated from audio timestamps (for debugging/display) */
  targetDurationSec?: number;
  /** Number of frames used for video generation (calculated from targetDurationSec) */
  generatedNumFrames?: number;
  /** Precise audio start time in seconds from narration timestamps (for assembly sync) */
  audioStartSec?: number;
  /** Precise audio end time in seconds from narration timestamps (for assembly sync) */
  audioEndSec?: number;
  status: 'pending' | 'generating' | 'complete' | 'error';
  errorMessage?: string;
}

/**
 * Character sheet for visual consistency.
 */
export interface CharacterSheet {
  mainChild: string;
}

/**
 * Full production script with all scenes.
 */
export interface ProductionScriptData {
  globalAtmosphere: string;
  characterSheet?: CharacterSheet;
  scenes: ProductionScene[];
  totalEstimatedDurationSec: number;
}

/**
 * Video assembly manifest for FFmpeg.
 */
export interface VideoAssemblyManifest {
  clips: Array<{
    clipNumber: number;
    videoUrl: string;
    audioStartSec: number;
    audioEndSec: number;
  }>;
  audioUrl: string;
  outputPath: string;
  /**
   * Optional: Start offset for audio extraction (in seconds).
   * When provided, only the portion of audio from audioStartOffset to audioEndOffset
   * will be used. This ensures perfect sync for partial video assembly.
   */
  audioStartOffset?: number;
  /**
   * Optional: End offset for audio extraction (in seconds).
   * When provided along with audioStartOffset, the audio will be trimmed to this range.
   */
  audioEndOffset?: number;
}


import type { AudienceMode, StepConfig, StepId } from '../../types/agent';
import { DEFAULT_MODEL_ID } from '../llm/models';
import { getPromptByAudience } from '@/prompts/audience-prompts';

// Prompts centralized under src/prompts.

type StepConfigBase = Omit<StepConfig, 'promptTemplate'>;

const STEP_CONFIG_BASE: StepConfigBase[] = [
  {
    id: 'keyConcepts',
    label: 'Key Concepts',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic'],
    outputVars: ['KeyConcepts'],
  },
  {
    id: 'hook',
    label: 'Hook',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic', 'KeyConcepts'],
    outputVars: ['HookScript'],
  },
  {
    id: 'quizzes',
    label: 'Quiz Generation',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic', 'KeyConcepts', 'HookScript'],
    outputVars: ['QuizInfo'],
  },
  {
    id: 'script',
    label: 'Script Generation',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic', 'KeyConcepts', 'HookScript', 'QuizInfo'],
    outputVars: ['VideoScript'],
  },
  {
    id: 'scriptQA',
    label: 'Script QA',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['VideoScript'],
    outputVars: ['VideoScript'],
  },
  {
    id: 'narrationAudioTags',
    label: 'Narration Audio Tags (for Elevenlabs v3)',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['NarrationScript'],
    outputVars: [],
  },
  {
    id: 'narrationAudio',
    label: 'Narration Audio (Voiceover)',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['NarrationScript'],
    outputVars: [],
  },
  {
    id: 'narrationTimestamps',
    label: 'Narration Timestamps',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['NarrationScript', 'ProductionScript'], // Requires production script to align scene-level timestamps
    outputVars: ['NarrationTimestamps'],
  },
  // ============================================
  // Video Pipeline Steps
  // ============================================
  {
    id: 'productionScript',
    label: 'Production Script',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['VideoScript', 'Topic', 'KeyConcepts'],
    outputVars: ['ProductionScript'],
    // Note: VisualStyle, VisualStyleAtmosphere, VisualStyleOutputExample, and VisualStyleDescriptionGuidelines
    // are injected at runtime based on pipeline.visualStyleId (see interpolatePrompt)
  },
  {
    id: 'characterReferenceImage',
    label: 'Character Reference Image',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['ProductionScript'],
    outputVars: [],
  },
  {
    id: 'sceneImagePrompts',
    label: 'Scene Image Prompts',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['ProductionScript'],
    outputVars: ['SceneImagePrompts'],
    // Note: VisualStyleConsolidatedImageGuidance is injected at runtime based on pipeline.visualStyleId
  },
  {
    id: 'sceneImages',
    label: 'Generate Scene Images',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['SceneImagePrompts'],
    outputVars: [],
  },
  {
    id: 'sceneVideoPrompts',
    label: 'Scene Video Prompts',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['SceneImagePrompts'],
    outputVars: ['SceneVideoPrompts'],
    // Note: VisualStyleConsolidatedVideoGuidance is injected at runtime based on pipeline.visualStyleId
  },
  {
    id: 'sceneVideos',
    label: 'Generate Scene Videos',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['SceneVideoPrompts'],
    outputVars: [],
  },
  {
    id: 'videoAssembly',
    label: 'Assemble Final Video',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: [],
    outputVars: [],
  },
  {
    id: 'titleDescription',
    label: 'Title & Description',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic', 'KeyConcepts', 'HookScript', 'QuizInfo', 'VideoScript'],
    outputVars: ['Title', 'Description', 'YoutubeTags', 'Chapters'],
  },
  {
    id: 'thumbnail',
    label: 'Thumbnail Prompt',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic', 'KeyConcepts'],
    outputVars: ['ThumbnailPrompt'],
  },
  {
    id: 'thumbnailGenerate',
    label: 'Generate Thumbnail',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['ThumbnailPrompt'],
    outputVars: [],
  },
];

const STEP_CONFIG_BASE_MAP: Record<StepId, StepConfigBase> = STEP_CONFIG_BASE.reduce(
  (acc, config) => {
    acc[config.id] = config;
    return acc;
  },
  {} as Record<StepId, StepConfigBase>,
);

export function getStepConfigForAudience(stepId: StepId, audienceMode: AudienceMode): StepConfig {
  const config = STEP_CONFIG_BASE_MAP[stepId];
  if (!config) {
    throw new Error(`Unknown step: ${stepId}`);
  }
  return {
    ...config,
    promptTemplate: getPromptByAudience(stepId, audienceMode),
  };
}

export function getStepConfigs(audienceMode: AudienceMode = 'forKids'): StepConfig[] {
  return STEP_CONFIG_BASE.map((config) => ({
    ...config,
    promptTemplate: getPromptByAudience(config.id, audienceMode),
  }));
}

// Backwards-compatible default (kid-focused prompts).
export const STEP_CONFIGS: StepConfig[] = getStepConfigs('forKids');

/**
 * Steps that trigger client-side workflows (Gemini image gen, ElevenLabs TTS, fal.ai, FFmpeg, etc.)
 * instead of calling the backend LLM runner. These should never be invoked via /api/agent/run-step.
 */
export const CLIENT_SHELL_STEP_IDS: StepId[] = [
  'narrationAudio',
  'narrationTimestamps',
  'characterReferenceImage',
  'sceneImages',
  'sceneVideos',
  'videoAssembly',
  'thumbnailGenerate',
];

const CLIENT_SHELL_STEP_ID_SET = new Set<StepId>(CLIENT_SHELL_STEP_IDS);

export function isClientShellStep(stepId: StepId): boolean {
  return CLIENT_SHELL_STEP_ID_SET.has(stepId);
}

export const SERVER_EXECUTABLE_STEP_IDS: StepId[] = STEP_CONFIGS.map((config) => config.id).filter(
  (stepId) => !isClientShellStep(stepId),
);

const STEP_CONFIG_MAP: Record<StepId, StepConfig> = STEP_CONFIGS.reduce(
  (acc, config) => {
    acc[config.id] = config;
    return acc;
  },
  {} as Record<StepId, StepConfig>,
);

export function getStepConfig(stepId: StepId): StepConfig {
  const config = STEP_CONFIG_MAP[stepId];
  if (!config) {
    throw new Error(`Unknown step: ${stepId}`);
  }
  return config;
}


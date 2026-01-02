import type { PipelineError, PipelineErrorCode, StepId } from '@/types/agent';

/**
 * Error pattern definitions for classification.
 * Each pattern maps to a code, retryability flag, and user guidance.
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  code: PipelineErrorCode;
  retryable: boolean;
  guidance: string;
}> = [
  {
    pattern: /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|network/i,
    code: 'NETWORK_TIMEOUT',
    retryable: true,
    guidance: 'Check your internet connection and try again. The server may be temporarily unavailable.',
  },
  {
    pattern: /rate.?limit|429|too many requests|quota exceeded|resource exhausted/i,
    code: 'RATE_LIMIT',
    retryable: true,
    guidance: 'API rate limit reached. Wait a few minutes before retrying.',
  },
  {
    pattern: /json|parse|syntax.*error|unexpected token|invalid.*json/i,
    code: 'INVALID_LLM_OUTPUT',
    retryable: true,
    guidance: 'The AI returned invalid output. This is usually temporary - try running the step again.',
  },
  {
    pattern: /upload|storage|s3|supabase.*storage|bucket|failed to persist/i,
    code: 'STORAGE_UPLOAD_FAILED',
    retryable: true,
    guidance: 'Failed to upload file to storage. Check your connection and try again.',
  },
  {
    pattern: /cancelled|aborted|abort/i,
    code: 'CANCELLED',
    retryable: false,
    guidance: 'The operation was cancelled.',
  },
  {
    pattern: /validation|invalid|missing required|please enter/i,
    code: 'VALIDATION_FAILED',
    retryable: false,
    guidance: 'Please check the input values and try again.',
  },
  {
    pattern: /generate.*image|image.*generation|gemini.*image|imagen/i,
    code: 'MEDIA_GENERATION_FAILED',
    retryable: true,
    guidance: 'Image generation failed. The prompt may need adjustment, or try again.',
  },
  {
    pattern: /generate.*video|video.*generation|wan|fal\.ai|clip.*generation/i,
    code: 'MEDIA_GENERATION_FAILED',
    retryable: true,
    guidance: 'Video generation failed. Check scene images are valid and try again.',
  },
  {
    pattern: /ffmpeg|assembly|assemble.*video|video.*assembly/i,
    code: 'MEDIA_GENERATION_FAILED',
    retryable: true,
    guidance: 'Video assembly failed. Ensure all video clips and audio are valid.',
  },
  {
    pattern: /audio|tts|elevenlabs|speech|voiceover/i,
    code: 'MEDIA_GENERATION_FAILED',
    retryable: true,
    guidance: 'Audio generation failed. Check your API key and script content.',
  },
];

/**
 * Step-specific guidance to append to generic error messages.
 */
const STEP_GUIDANCE: Partial<Record<StepId, string>> = {
  keyConcepts: 'Check that your topic is clear and specific.',
  script: 'Try adjusting the topic or key concepts for better results.',
  scriptQA: 'The script may need manual adjustment to meet word count requirements.',
  narrationAudio: 'Ensure the narration script is valid. Try a different voice model if issues persist.',
  narrationTimestamps: 'Audio may need to be regenerated for better timestamp detection.',
  productionScript: 'The script may be too complex. Try simplifying or shortening it.',
  characterReferenceImage: 'Try regenerating with different character descriptions.',
  sceneImagePrompts: 'Check that the production script has valid scene descriptions.',
  sceneImages: 'Some prompts may trigger content filters. You can regenerate individual scenes.',
  sceneVideoPrompts: 'Ensure scene images were generated successfully first.',
  sceneVideos: 'Video generation can take 1-2 minutes per scene. Ensure scene images exist.',
  videoAssembly: 'This step has a 15-minute timeout. Ensure all video clips are valid.',
  thumbnailGenerate: 'Check that the thumbnail prompt was generated successfully.',
};

/**
 * Classify an error into a structured PipelineError with code and guidance.
 */
export function classifyError(
  error: Error | string,
  stepId?: StepId
): PipelineError {
  const message = typeof error === 'string' ? error : error.message;

  // Find matching pattern
  for (const { pattern, code, retryable, guidance } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      const stepGuidance = stepId ? STEP_GUIDANCE[stepId] : undefined;
      return {
        code,
        message,
        guidance: stepGuidance ? `${guidance} ${stepGuidance}` : guidance,
        retryable,
        stepId,
      };
    }
  }

  // Default to unknown error
  const stepGuidance = stepId ? STEP_GUIDANCE[stepId] : undefined;
  return {
    code: 'UNKNOWN',
    message,
    guidance: stepGuidance
      ? `An unexpected error occurred. ${stepGuidance}`
      : 'An unexpected error occurred. Try running the step again.',
    retryable: true,
    stepId,
  };
}

/**
 * Get the label for a step ID for display purposes.
 */
export function getStepLabel(stepId: StepId): string {
  const labels: Record<StepId, string> = {
    keyConcepts: 'Key Concepts',
    hook: 'Hook Script',
    quizzes: 'Quiz Questions',
    script: 'Video Script',
    scriptQA: 'Script QA',
    narrationAudioTags: 'Audio Tags',
    narrationAudio: 'Narration Audio',
    narrationTimestamps: 'Audio Timestamps',
    productionScript: 'Production Script',
    characterReferenceImage: 'Character Reference',
    sceneImagePrompts: 'Image Prompts',
    sceneImages: 'Scene Images',
    sceneVideoPrompts: 'Video Prompts',
    sceneVideos: 'Scene Videos',
    videoAssembly: 'Video Assembly',
    titleDescription: 'Title & Description',
    thumbnail: 'Thumbnail Prompt',
    thumbnailGenerate: 'Thumbnail Image',
  };
  return labels[stepId] || stepId;
}

/**
 * Check if an error is likely transient and should be retried.
 */
export function isTransientError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message;

  // Always retry network/timeout errors
  if (/timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|network/i.test(message)) {
    return true;
  }

  // Retry rate limit errors
  if (/rate.?limit|429|too many requests/i.test(message)) {
    return true;
  }

  // Retry transient server errors
  if (/50[0234]|service unavailable|bad gateway|internal server error/i.test(message)) {
    return true;
  }

  return false;
}

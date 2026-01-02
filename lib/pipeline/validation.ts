import type { PipelineState, StepId, VariableKey } from '@/types/agent';
import { hasVariableValue, VARIABLE_LABELS } from '@/src/lib/agent/variable-metadata';
import { getStepConfig, STEP_CONFIGS } from '@/lib/agent/steps';
import { getStepLabel } from './error-classifier';

/**
 * Validation result type.
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

/**
 * Validation error codes.
 */
export type ValidationErrorCode =
  | 'TOPIC_EMPTY'
  | 'TOPIC_WHITESPACE_ONLY'
  | 'MISSING_DEPENDENCY'
  | 'SCENE_COUNT_MISMATCH'
  | 'AUDIO_NOT_GENERATED'
  | 'CHARACTER_REF_MISSING'
  | 'STEP_IN_ERROR_STATE'
  | 'PARTIAL_SCENE_GENERATION'
  | 'NO_SCENE_IMAGES'
  | 'NO_SCENE_VIDEOS';

/**
 * A single validation error with recovery hint.
 */
export interface ValidationError {
  stepId: StepId;
  code: ValidationErrorCode;
  message: string;
  severity: 'error' | 'warning';
  recoveryHint?: string;
}

/**
 * Maps variable keys to the step that produces them.
 */
const VARIABLE_PRODUCING_STEP: Partial<Record<VariableKey, StepId>> = {
  KeyConcepts: 'keyConcepts',
  HookScript: 'hook',
  QuizInfo: 'quizzes',
  VideoScript: 'script',
  NarrationScript: 'script', // Derived from VideoScript
  ProductionScript: 'productionScript',
  CharacterReferenceImage: 'characterReferenceImage',
  SceneImagePrompts: 'sceneImagePrompts',
  SceneVideoPrompts: 'sceneVideoPrompts',
  Title: 'titleDescription',
  Description: 'titleDescription',
  YoutubeTags: 'titleDescription',
  Chapters: 'titleDescription',
  ThumbnailPrompt: 'thumbnail',
  NarrationTimestamps: 'narrationTimestamps',
};

/**
 * Validate that the topic is present and not just whitespace.
 */
export function validateTopic(pipeline: PipelineState): ValidationResult {
  const errors: ValidationError[] = [];

  if (!pipeline.topic) {
    errors.push({
      stepId: 'keyConcepts',
      code: 'TOPIC_EMPTY',
      message: 'Topic is required before running the pipeline.',
      severity: 'error',
      recoveryHint: 'Enter a topic at the top of the page.',
    });
  } else if (!pipeline.topic.trim()) {
    errors.push({
      stepId: 'keyConcepts',
      code: 'TOPIC_WHITESPACE_ONLY',
      message: 'Topic cannot be only whitespace.',
      severity: 'error',
      recoveryHint: 'Enter a valid topic with actual content.',
    });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate that all input dependencies for a step are available.
 */
export function validateStepDependencies(
  pipeline: PipelineState,
  stepId: StepId
): ValidationResult {
  const errors: ValidationError[] = [];
  const stepConfig = getStepConfig(stepId);

  for (const inputVar of stepConfig.inputVars) {
    if (!hasVariableValue(pipeline, inputVar)) {
      const producingStep = VARIABLE_PRODUCING_STEP[inputVar];
      errors.push({
        stepId,
        code: 'MISSING_DEPENDENCY',
        message: `Missing required input: ${VARIABLE_LABELS[inputVar]}`,
        severity: 'error',
        recoveryHint: producingStep
          ? `Run the "${getStepLabel(producingStep)}" step first.`
          : undefined,
      });
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate that scene counts are consistent between productionScript and sceneAssets.
 */
export function validateSceneConsistency(pipeline: PipelineState): ValidationResult {
  const errors: ValidationError[] = [];

  const productionSceneCount = pipeline.productionScript?.scenes?.length ?? 0;
  const sceneAssetCount = pipeline.sceneAssets?.length ?? 0;

  if (productionSceneCount > 0 && sceneAssetCount > 0) {
    if (productionSceneCount !== sceneAssetCount) {
      errors.push({
        stepId: 'sceneImagePrompts',
        code: 'SCENE_COUNT_MISMATCH',
        message: `Scene count mismatch: production script has ${productionSceneCount} scenes but scene assets has ${sceneAssetCount}.`,
        severity: 'warning',
        recoveryHint: 'Re-run the Scene Image Prompts step to regenerate scene assets.',
      });
    }
  }

  // Check for partial scene image generation
  if (pipeline.sceneAssets?.length) {
    const withImages = pipeline.sceneAssets.filter((s) => s.imageUrl).length;
    const withErrors = pipeline.sceneAssets.filter((s) => s.status === 'error').length;

    if (withImages > 0 && withImages < sceneAssetCount) {
      errors.push({
        stepId: 'sceneImages',
        code: 'PARTIAL_SCENE_GENERATION',
        message: `Only ${withImages}/${sceneAssetCount} scene images generated.${withErrors > 0 ? ` ${withErrors} failed.` : ''}`,
        severity: 'warning',
        recoveryHint: 'You can retry failed scenes individually or run image generation again.',
      });
    }

    // Check for partial video generation
    const withVideos = pipeline.sceneAssets.filter((s) => s.videoUrl).length;

    if (withVideos > 0 && withVideos < sceneAssetCount) {
      errors.push({
        stepId: 'sceneVideos',
        code: 'PARTIAL_SCENE_GENERATION',
        message: `Only ${withVideos}/${sceneAssetCount} scene videos generated.`,
        severity: 'warning',
        recoveryHint: 'Run scene video generation to complete missing videos.',
      });
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate that audio is ready for video assembly.
 */
export function validateAudioReadiness(pipeline: PipelineState): ValidationResult {
  const errors: ValidationError[] = [];

  if (!pipeline.audioPath) {
    errors.push({
      stepId: 'videoAssembly',
      code: 'AUDIO_NOT_GENERATED',
      message: 'Narration audio has not been generated or saved.',
      severity: 'error',
      recoveryHint: 'Generate and save the narration audio before assembling the video.',
    });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate that scene images exist for video generation.
 */
export function validateSceneImagesForVideos(pipeline: PipelineState): ValidationResult {
  const errors: ValidationError[] = [];

  const hasAnyImages = pipeline.sceneAssets?.some((s) => s.imageUrl);

  if (!hasAnyImages) {
    errors.push({
      stepId: 'sceneVideos',
      code: 'NO_SCENE_IMAGES',
      message: 'No scene images have been generated.',
      severity: 'error',
      recoveryHint: 'Generate scene images before generating videos.',
    });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate that scene videos exist for assembly.
 */
export function validateSceneVideosForAssembly(pipeline: PipelineState): ValidationResult {
  const errors: ValidationError[] = [];

  const hasAnyVideos = pipeline.sceneAssets?.some((s) => s.videoUrl);

  if (!hasAnyVideos) {
    errors.push({
      stepId: 'videoAssembly',
      code: 'NO_SCENE_VIDEOS',
      message: 'No scene videos have been generated.',
      severity: 'error',
      recoveryHint: 'Generate scene videos before assembling the final video.',
    });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Check if any step is in an error state that should block execution.
 */
export function validateNoBlockingErrors(
  pipeline: PipelineState,
  stepIds: StepId[]
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const stepId of stepIds) {
    const step = pipeline.steps[stepId];
    if (step?.status === 'error' && step.errorMessage) {
      errors.push({
        stepId,
        code: 'STEP_IN_ERROR_STATE',
        message: `Step "${getStepLabel(stepId)}" is in error state: ${step.errorMessage}`,
        severity: 'warning',
        recoveryHint: 'Clear the error and retry the step, or the Run All will retry it.',
      });
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Run all pre-flight validations before starting Run All.
 */
export function runPreflightValidation(pipeline: PipelineState): ValidationResult {
  const allErrors: ValidationError[] = [];

  // Always validate topic
  const topicResult = validateTopic(pipeline);
  if (!topicResult.valid) {
    allErrors.push(...topicResult.errors);
  }

  // Scene consistency (warnings only, don't block)
  const sceneResult = validateSceneConsistency(pipeline);
  if (!sceneResult.valid) {
    // Add only warnings, not errors
    const warnings = sceneResult.errors.filter((e) => e.severity === 'warning');
    allErrors.push(...warnings);
  }

  return allErrors.length > 0 ? { valid: false, errors: allErrors } : { valid: true };
}

/**
 * Validate a specific step before execution.
 * This is called just before running each step in the pipeline.
 */
export function validateBeforeStep(
  pipeline: PipelineState,
  stepId: StepId
): ValidationResult {
  const allErrors: ValidationError[] = [];

  // Validate dependencies
  const depResult = validateStepDependencies(pipeline, stepId);
  if (!depResult.valid) {
    allErrors.push(...depResult.errors);
  }

  // Step-specific validations
  switch (stepId) {
    case 'sceneVideos': {
      const imgResult = validateSceneImagesForVideos(pipeline);
      if (!imgResult.valid) {
        allErrors.push(...imgResult.errors);
      }
      break;
    }
    case 'videoAssembly': {
      const audioResult = validateAudioReadiness(pipeline);
      if (!audioResult.valid) {
        allErrors.push(...audioResult.errors);
      }
      const videoResult = validateSceneVideosForAssembly(pipeline);
      if (!videoResult.valid) {
        allErrors.push(...videoResult.errors);
      }
      break;
    }
  }

  return allErrors.length > 0 ? { valid: false, errors: allErrors } : { valid: true };
}

/**
 * Get a human-readable summary of validation errors.
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return '';

  const criticalErrors = errors.filter((e) => e.severity === 'error');
  const warnings = errors.filter((e) => e.severity === 'warning');

  const parts: string[] = [];

  if (criticalErrors.length > 0) {
    parts.push(`Errors:\n${criticalErrors.map((e) => `  - ${e.message}`).join('\n')}`);
  }

  if (warnings.length > 0) {
    parts.push(`Warnings:\n${warnings.map((e) => `  - ${e.message}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

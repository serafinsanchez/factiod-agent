"use client";

import { useCallback, useRef, useState } from "react";
import type {
  PipelineState,
  RunAllState,
  StepId,
  PipelineError,
  AudienceMode,
} from "@/types/agent";
import { classifyError, getStepLabel } from "@/lib/pipeline/error-classifier";
import { runPreflightValidation, validateBeforeStep } from "@/lib/pipeline/validation";
import { isClientShellStep } from "@/lib/agent/steps";

/**
 * Full pipeline step order for "Run All" including all media generation steps.
 * This extends the server-side batch to include all client-side steps.
 */
export const FULL_PIPELINE_STEPS: StepId[] = [
  // Phase 1: Script Generation (server-side batch via /api/agent/run-all)
  "keyConcepts",
  "hook",
  "quizzes",
  "script",
  "scriptQA",
  "narrationAudioTags",
  "titleDescription",
  "thumbnail",
  // Phase 2: Audio Generation (client-side)
  "narrationAudio",
  "thumbnailGenerate",
  // Phase 3: Video Pipeline (client-side)
  "productionScript",
  "narrationTimestamps",
  "characterReferenceImage",
  "sceneImagePrompts",
  "sceneImages",
  "sceneVideoPrompts",
  "sceneVideos",
  "videoAssembly",
];

/**
 * Steps that are handled by the server-side batch endpoint.
 */
export const SERVER_BATCH_STEPS: StepId[] = [
  "keyConcepts",
  "hook",
  "quizzes",
  "script",
  "scriptQA",
  "narrationAudioTags",
  "titleDescription",
  "thumbnail",
];

const SERVER_BATCH_STEPS_SET = new Set(SERVER_BATCH_STEPS);

/**
 * Create the initial RunAllState.
 */
export function createInitialRunAllState(): RunAllState {
  return {
    status: "idle",
    currentStepId: null,
    currentStepIndex: 0,
    totalSteps: FULL_PIPELINE_STEPS.length,
    completedStepIds: [],
    failedStepId: null,
    error: null,
    startedAt: null,
    isResume: false,
  };
}

/**
 * Options for the useRunAllPipeline hook.
 */
export interface UseRunAllPipelineOptions {
  /** Current pipeline state */
  pipeline: PipelineState;
  /** Ref to current pipeline state (for async access) */
  pipelineRef: React.MutableRefObject<PipelineState>;
  /** Update pipeline state */
  setPipeline: React.Dispatch<React.SetStateAction<PipelineState>>;
  /** Run the server-side batch steps */
  runServerBatch: () => Promise<void>;
  /** Run a single server-side LLM step */
  runStep: (stepId: StepId) => Promise<void>;
  /** Step executors for client-side steps */
  stepExecutors: {
    runNarrationAudioStep: (script?: string) => Promise<void>;
    runNarrationTimestampsStep: () => Promise<void>;
    generateCharacterReferenceImage: () => Promise<void>;
    generateSceneImages: () => Promise<void>;
    generateSceneVideos: () => Promise<void>;
    assembleVideo: () => Promise<void>;
    generateThumbnail: () => Promise<void>;
  };
  /** Trigger auto-save */
  queueAutoSave: () => void;
}

/**
 * Hook to orchestrate the full "Run All" pipeline with resume capability.
 */
export function useRunAllPipeline(options: UseRunAllPipelineOptions) {
  const {
    pipeline,
    pipelineRef,
    setPipeline,
    runServerBatch,
    runStep,
    stepExecutors,
    queueAutoSave,
  } = options;

  const [runAllState, setRunAllState] = useState<RunAllState>(createInitialRunAllState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRunningRef = useRef(false);

  /**
   * Check if a step has already completed successfully.
   */
  const isStepComplete = useCallback(
    (stepId: StepId): boolean => {
      const step = pipelineRef.current.steps[stepId];
      return step?.status === "success";
    },
    [pipelineRef]
  );

  /**
   * Update the run all state in both local state and pipeline state.
   */
  const updateRunAllState = useCallback(
    (updates: Partial<RunAllState>) => {
      setRunAllState((prev) => {
        const next = { ...prev, ...updates };
        // Also update the pipeline state for persistence
        setPipeline((p) => ({ ...p, runAllState: next }));
        return next;
      });
    },
    [setPipeline]
  );

  /**
   * Execute a client-side step by ID.
   */
  const executeClientStep = useCallback(
    async (stepId: StepId): Promise<void> => {
      switch (stepId) {
        case "narrationAudio":
          await stepExecutors.runNarrationAudioStep();
          break;
        case "narrationTimestamps":
          await stepExecutors.runNarrationTimestampsStep();
          break;
        case "characterReferenceImage":
          await stepExecutors.generateCharacterReferenceImage();
          break;
        case "sceneImages":
          await stepExecutors.generateSceneImages();
          break;
        case "sceneVideos":
          await stepExecutors.generateSceneVideos();
          break;
        case "videoAssembly":
          await stepExecutors.assembleVideo();
          break;
        case "thumbnailGenerate":
          await stepExecutors.generateThumbnail();
          break;
        default:
          // Server-side LLM step - call runStep
          await runStep(stepId);
          break;
      }
    },
    [stepExecutors, runStep]
  );

  /**
   * Check if a step failed after execution.
   */
  const checkStepFailed = useCallback(
    (stepId: StepId): string | null => {
      const step = pipelineRef.current.steps[stepId];
      if (step?.status === "error") {
        return step.errorMessage || `Step ${getStepLabel(stepId)} failed`;
      }
      return null;
    },
    [pipelineRef]
  );

  /**
   * Run the full pipeline.
   */
  const runFullPipeline = useCallback(
    async (resume = false) => {
      // Prevent concurrent runs
      if (isRunningRef.current) {
        console.warn("Pipeline is already running");
        return;
      }
      isRunningRef.current = true;
      abortControllerRef.current = new AbortController();

      const completedSteps: StepId[] = [];
      const skippedSteps: StepId[] = [];
      let currentStep: StepId | null = null;

      try {
        // Pre-flight validation
        const validation = runPreflightValidation(pipelineRef.current);
        if (!validation.valid) {
          const criticalErrors = validation.errors.filter((e) => e.severity === "error");
          if (criticalErrors.length > 0) {
            const firstError = criticalErrors[0];
            updateRunAllState({
              status: "error",
              failedStepId: firstError.stepId,
              error: {
                code: "VALIDATION_FAILED",
                message: firstError.message,
                guidance: firstError.recoveryHint || "Fix the validation error and try again.",
                retryable: false,
                stepId: firstError.stepId,
              },
            });
            return;
          }
        }

        // Clear stale step errors when starting fresh (not resuming)
        if (!resume) {
          const clearedSteps = Object.fromEntries(
            Object.entries(pipelineRef.current.steps).map(([stepId, step]) => [
              stepId,
              step?.status === "error"
                ? { ...step, status: "idle" as const, errorMessage: undefined }
                : step,
            ])
          ) as PipelineState["steps"];

          // Update both ref and state synchronously to avoid race conditions
          pipelineRef.current = { ...pipelineRef.current, steps: clearedSteps };
          setPipeline((prev) => ({ ...prev, steps: clearedSteps }));
        }

        // Initialize run state
        updateRunAllState({
          status: "running",
          startedAt: Date.now(),
          error: null,
          failedStepId: null,
          isResume: resume,
          completedStepIds: [],
          currentStepIndex: 0,
          currentStepId: FULL_PIPELINE_STEPS[0],
        });

        // Determine starting point for resume
        let startIndex = 0;
        if (resume && pipelineRef.current.runAllState?.failedStepId) {
          const failedStepIndex = FULL_PIPELINE_STEPS.indexOf(
            pipelineRef.current.runAllState.failedStepId
          );
          if (failedStepIndex >= 0) {
            startIndex = failedStepIndex;
            // Mark previously completed steps as skipped
            for (let i = 0; i < startIndex; i++) {
              if (isStepComplete(FULL_PIPELINE_STEPS[i])) {
                skippedSteps.push(FULL_PIPELINE_STEPS[i]);
              }
            }
          }
        }

        // Phase 1: Run server-side batch steps (if not resuming past them)
        const lastServerStepIndex = FULL_PIPELINE_STEPS.indexOf(
          SERVER_BATCH_STEPS[SERVER_BATCH_STEPS.length - 1]
        );

        if (startIndex <= lastServerStepIndex) {
          // Check if any server steps need to run
          const serverStepsToRun = SERVER_BATCH_STEPS.filter((stepId) => {
            if (resume && isStepComplete(stepId)) {
              skippedSteps.push(stepId);
              return false;
            }
            return true;
          });

          if (serverStepsToRun.length > 0) {
            updateRunAllState({
              currentStepId: serverStepsToRun[0],
              currentStepIndex: FULL_PIPELINE_STEPS.indexOf(serverStepsToRun[0]),
            });

            await runServerBatch();

            // Check if cancelled
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error("Pipeline cancelled");
            }

            // Mark server steps as completed
            for (const stepId of SERVER_BATCH_STEPS) {
              if (!skippedSteps.includes(stepId)) {
                completedSteps.push(stepId);
              }
            }

            updateRunAllState({
              completedStepIds: [...completedSteps],
            });
          }
        }

        // Phase 2: Run remaining client-side steps sequentially
        const clientSteps = FULL_PIPELINE_STEPS.filter(
          (stepId) => !SERVER_BATCH_STEPS_SET.has(stepId)
        );

        for (const stepId of clientSteps) {
          // Check for cancellation before each step
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error("Pipeline cancelled");
          }

          // Get step index
          const stepIndex = FULL_PIPELINE_STEPS.indexOf(stepId);

          // Skip if before our start point (resume)
          if (stepIndex < startIndex) {
            if (isStepComplete(stepId)) {
              skippedSteps.push(stepId);
            }
            continue;
          }

          // Skip if already completed (resume)
          if (resume && isStepComplete(stepId)) {
            skippedSteps.push(stepId);
            continue;
          }

          // Update current step BEFORE validation so error handler knows which step failed
          currentStep = stepId;
          updateRunAllState({
            currentStepId: stepId,
            currentStepIndex: stepIndex,
            completedStepIds: [...completedSteps],
          });

          // Validate step dependencies
          const stepValidation = validateBeforeStep(pipelineRef.current, stepId);
          if (!stepValidation.valid) {
            const criticalErrors = stepValidation.errors.filter((e) => e.severity === "error");
            if (criticalErrors.length > 0) {
              const firstError = criticalErrors[0];
              throw new Error(
                `${firstError.message}${firstError.recoveryHint ? ` ${firstError.recoveryHint}` : ""}`
              );
            }
          }

          // Execute the step
          await executeClientStep(stepId);

          // Check for cancellation after step
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error("Pipeline cancelled");
          }

          // Check if step failed
          const errorMsg = checkStepFailed(stepId);
          if (errorMsg) {
            throw new Error(errorMsg);
          }

          // Mark step as completed
          completedSteps.push(stepId);
          updateRunAllState({
            completedStepIds: [...completedSteps],
          });

          // Auto-save after each step
          queueAutoSave();
        }

        // Success! All steps completed
        updateRunAllState({
          status: "completed",
          currentStepId: null,
          completedStepIds: completedSteps,
        });
      } catch (error) {
        const pipelineError = classifyError(
          error instanceof Error ? error : String(error),
          currentStep ?? undefined
        );

        updateRunAllState({
          status: pipelineError.code === "CANCELLED" ? "cancelled" : "error",
          failedStepId: currentStep,
          error: pipelineError,
          completedStepIds: completedSteps,
        });
      } finally {
        isRunningRef.current = false;
        abortControllerRef.current = null;
        queueAutoSave();
      }
    },
    [
      pipelineRef,
      updateRunAllState,
      isStepComplete,
      runServerBatch,
      executeClientStep,
      checkStepFailed,
      queueAutoSave,
    ]
  );

  /**
   * Start the full pipeline from the beginning.
   */
  const startFullPipeline = useCallback(() => {
    return runFullPipeline(false);
  }, [runFullPipeline]);

  /**
   * Resume from the failed step.
   */
  const resumeFromError = useCallback(() => {
    if (runAllState.status !== "error" && runAllState.status !== "cancelled") {
      console.warn("Cannot resume: pipeline is not in error state");
      return;
    }

    // Clear the error on the failed step before resuming
    const failedStepId = runAllState.failedStepId;
    if (failedStepId) {
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          [failedStepId]: {
            ...prev.steps[failedStepId],
            status: "idle" as const,
            errorMessage: undefined,
          },
        },
      }));
    }

    return runFullPipeline(true);
  }, [runAllState.status, runAllState.failedStepId, setPipeline, runFullPipeline]);

  /**
   * Cancel the running pipeline.
   */
  const cancelPipeline = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  /**
   * Reset to initial state.
   */
  const resetRunAllState = useCallback(() => {
    const initial = createInitialRunAllState();
    setRunAllState(initial);
    setPipeline((prev) => ({ ...prev, runAllState: initial }));
  }, [setPipeline]);

  /**
   * Get progress information for display.
   */
  const getProgress = useCallback(() => {
    const { currentStepIndex, totalSteps, completedStepIds, currentStepId } = runAllState;
    return {
      current: currentStepIndex + 1,
      total: totalSteps,
      completed: completedStepIds.length,
      percentage: Math.round((completedStepIds.length / totalSteps) * 100),
      currentStepLabel: currentStepId ? getStepLabel(currentStepId) : null,
    };
  }, [runAllState]);

  return {
    // State
    runAllState,
    isRunning: runAllState.status === "running",
    canResume:
      (runAllState.status === "error" || runAllState.status === "cancelled") &&
      runAllState.error?.retryable !== false,
    hasCompleted: runAllState.status === "completed",
    hasFailed: runAllState.status === "error",

    // Actions
    startFullPipeline,
    resumeFromError,
    cancelPipeline,
    resetRunAllState,

    // Helpers
    getProgress,
    getStepLabel,
  };
}

export type UseRunAllPipelineReturn = ReturnType<typeof useRunAllPipeline>;

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { STEP_CONFIGS } from "@/lib/agent/steps";
import { DEFAULT_MODEL_ID } from "@/lib/llm/models";
import { slugifyTopic } from "@/lib/slug";
import { toNarrationOnly } from "@/lib/tts/cleanNarration";
import {
  alignScenesToTimestamps,
  getAlignmentStats,
} from "@/lib/audio/timestamp-alignment";
import { getFramesForDuration } from "@/lib/video/fal-client";
import { getOrCreateProjectSlug, getPublicProjectFileUrl } from "@/lib/projects";
import type {
  AudienceMode,
  ModelId,
  NarrationModelId,
  PipelineState,
  ProductionScriptData,
  ProductionScene,
  StepId,
  StepRunMetrics,
  StepRunState,
  VariableKey,
  VideoFrameMode,
  VisualStyleId,
} from "@/types/agent";
import { getPromptByAudience } from "@/prompts/audience-prompts";
import {
  styleRequiresCharacterReference,
  getProductionScriptStyleSections,
  getConsolidatedImagePromptsGuidance,
  getConsolidatedVideoPromptsGuidance,
  getVideoFrameModeImageTask,
  getVideoFrameModeImageRules,
  getVideoFrameModeVideoTask,
  getVideoFrameModeVideoRules,
} from "@/prompts/visual-styles";
import {
  VARIABLE_KEY_TO_PIPELINE_FIELD,
  hasVariableValue,
  VARIABLE_LABELS,
} from "@/lib/agent/variable-metadata";

// Import from pipeline subdirectory
import {
  type PromptOverrides,
  PIPELINE_STORAGE_KEY,
  createInitialPipeline,
  calculateStepTotals,
  ensureStepState,
  ensureSessionTotals,
  ensureCumulativeTotals,
  getAccumulatedSessionTotals,
  isPipelineState,
  normalizeNarrationModelId,
  downloadTextFile,
  createCacheBustedUrl,
  getPipelineValueForVariable,
} from "./pipeline/pipeline-types";
import { useAutoSave } from "./pipeline/use-auto-save";
import { useProjectHistory } from "./pipeline/use-project-history";
import { useNarrationAudio } from "./pipeline/use-narration-audio";
import { useThumbnailGeneration } from "./pipeline/use-thumbnail-generation";
import { useSceneImages } from "./pipeline/use-scene-images";
import { useSceneVideos } from "./pipeline/use-scene-videos";
import { useVideoAssembly } from "./pipeline/use-video-assembly";

const AUDIENCE_OVERRIDDEN_STEP_IDS: ReadonlySet<StepId> = new Set<StepId>([
  "keyConcepts",
  "hook",
  "quizzes",
  "script",
  "scriptQA",
  "narrationAudioTags",
  "productionScript",
  "sceneImagePrompts",
  "titleDescription",
  "thumbnail",
]);

const RUN_ALL_OVERRIDE_STEP_IDS: ReadonlySet<StepId> = new Set<StepId>([
  "keyConcepts",
  "hook",
  "quizzes",
  "script",
  "scriptQA",
  "narrationAudioTags",
  "titleDescription",
  "thumbnail",
]);

function resetStepsAfterTopicChange(
  steps: Record<StepId, StepRunState>,
): Record<StepId, StepRunState> {
  const nextSteps: Record<StepId, StepRunState> = {} as Record<StepId, StepRunState>;
  for (const [stepId, step] of Object.entries(steps) as Array<[StepId, StepRunState]>) {
    nextSteps[stepId] = {
      ...step,
      status: "idle",
      resolvedPrompt: "",
      responseText: "",
      errorMessage: undefined,
      metrics: undefined,
    };
  }
  return nextSteps;
}

export function useAgentPipeline() {
  // ============================================
  // Core State
  // ============================================
  const [pipeline, setPipeline] = useState<PipelineState>(() => createInitialPipeline());
  const [promptOverrides, setPromptOverrides] = useState<PromptOverrides>({});
  const [isRunningAll, setIsRunningAll] = useState(false);

  const pipelineRef = useRef(pipeline);
  useEffect(() => {
    pipelineRef.current = pipeline;
  }, [pipeline]);

  // ============================================
  // Timestamps state
  // ============================================
  const [isExtractingTimestamps, setIsExtractingTimestamps] = useState(false);
  const [timestampsError, setTimestampsError] = useState<string | null>(null);
  const [timestampsExtractionTimeMs, setTimestampsExtractionTimeMs] = useState<number | null>(null);

  // ============================================
  // Character reference state
  // ============================================
  const [isGeneratingCharacterReference, setIsGeneratingCharacterReference] = useState(false);
  const [characterReferenceError, setCharacterReferenceError] = useState<string | null>(null);

  // ============================================
  // Composed Hooks
  // ============================================

  // Project history (must be initialized first for setSaveError)
  const projectHistory = useProjectHistory({
    pipeline,
    setPipeline,
    setPromptOverrides,
    setScriptAudioUrl: (fn) => narrationAudio.setScriptAudioUrl?.(fn as unknown as string | null),
    setScriptAudioError: (val) => narrationAudio.setScriptAudioError?.(val),
    setScriptAudioGenerationTimeMs: (val) => narrationAudio.setScriptAudioGenerationTimeMs?.(val),
    setThumbnailImage: (val) => thumbnailGen.setThumbnailImage?.(val),
    setThumbnailGenerationTime: (val) => thumbnailGen.setThumbnailGenerationTime?.(val),
    setThumbnailError: (val) => thumbnailGen.setThumbnailError?.(val),
    setThumbnailMetrics: () => thumbnailGen.setThumbnailMetrics?.(null),
  });

  // Auto-save
  const autoSave = useAutoSave({
    pipelineRef,
    setPipeline,
    setSelectedProjectId: projectHistory.setSelectedProjectId,
    setSaveError: projectHistory.setSaveError,
  });

  // Narration audio
  const narrationAudio = useNarrationAudio({
    pipelineRef,
    setPipeline,
    queueAutoSave: autoSave.queueAutoSave,
  });

  // Thumbnail generation
  const thumbnailGen = useThumbnailGeneration({
    pipeline,
    pipelineRef,
    setPipeline,
    queueAutoSave: autoSave.queueAutoSave,
  });

  // Scene images
  const sceneImages = useSceneImages({
    pipeline,
    pipelineRef,
    setPipeline,
    queueAutoSave: autoSave.queueAutoSave,
  });

  // Scene videos
  const sceneVideos = useSceneVideos({
    pipeline,
    setPipeline,
    queueAutoSave: autoSave.queueAutoSave,
  });

  // Video assembly
  const videoAssembly = useVideoAssembly({
    pipeline,
    scriptAudioUrl: narrationAudio.scriptAudioUrl,
    setPipeline,
    queueAutoSave: autoSave.queueAutoSave,
  });

  // ============================================
  // Derived Values
  // ============================================
  const sharedVars = useMemo(
    () => ({
      topic: pipeline.topic,
      keyConcepts: pipeline.keyConcepts,
      hookScript: pipeline.hookScript,
      quizInfo: pipeline.quizInfo,
      videoScript: pipeline.videoScript,
      narrationScript: pipeline.narrationScript,
      title: pipeline.title,
      description: pipeline.description,
      thumbnailPrompt: pipeline.thumbnailPrompt,
    }),
    [pipeline],
  );

  const totalGenerationDurationMs = useMemo(() => {
    const stepStates = pipeline.steps ? Object.values(pipeline.steps) : [];
    return stepStates.reduce((sum, step) => sum + (step.metrics?.durationMs ?? 0), 0);
  }, [pipeline.steps]);

  const hasAnyOutputs =
    Boolean(pipeline.keyConcepts?.trim()) ||
    Boolean(pipeline.hookScript?.trim()) ||
    Boolean(pipeline.quizInfo?.trim()) ||
    Boolean(pipeline.title?.trim()) ||
    Boolean(pipeline.description?.trim()) ||
    Boolean(pipeline.thumbnailPrompt?.trim());

  const hasScript = Boolean(pipeline.videoScript?.trim());

  const hasRuntimeMetrics =
    totalGenerationDurationMs > 0 ||
    narrationAudio.scriptAudioGenerationTimeMs !== null ||
    thumbnailGen.thumbnailGenerationTime !== null;

  const scriptDraftStats = useMemo(() => {
    const raw = pipeline.steps.script?.responseText;
    if (typeof raw !== "string") return null;
    const text = raw.trim();
    if (!text) return null;
    const words = text.split(/\s+/).filter(Boolean).length;
    const characters = text.length;
    return { words, characters };
  }, [pipeline.steps.script?.responseText]);

  const videoScriptStats = useMemo(() => {
    const raw = pipeline.videoScript;
    if (typeof raw !== "string") return null;
    const text = raw.trim();
    if (!text) return null;
    const words = text.split(/\s+/).filter(Boolean).length;
    const characters = text.length;
    return { words, characters };
  }, [pipeline.videoScript]);

  // ============================================
  // Effects
  // ============================================

  // Load initial pipeline and history
  useEffect(() => {
    void projectHistory.refreshHistory();
  }, [projectHistory.refreshHistory]);

  // Reset stuck "running" steps on mount
  useEffect(() => {
    setPipeline((prev) => {
      let hasChanges = false;
      const updatedSteps = { ...prev.steps };
      
      for (const stepId of Object.keys(updatedSteps) as StepId[]) {
        const step = updatedSteps[stepId];
        if (step?.status === "running") {
          updatedSteps[stepId] = {
            ...step,
            status: "idle" as const,
            errorMessage: undefined,
          };
          hasChanges = true;
        }
      }
      
      return hasChanges ? { ...prev, steps: updatedSteps } : prev;
    });
    sceneImages.setIsGeneratingSceneImages(false);
    sceneImages.setSceneImagesProgress(null);
  }, []);

  // Persist pipeline to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(pipeline));
    } catch {
      // ignore quota / privacy errors
    }
  }, [pipeline]);

  // Sync audio URL from pipeline.audioPath
  useEffect(() => {
    if (!pipeline.audioPath) return;
    // Important: `audioPath` is set before the MP3 upload finishes.
    // If we bind the <audio> player to the public storage URL too early,
    // the browser may cache a 404/empty response and require a second click.
    if (narrationAudio.isGeneratingScriptAudio) return;
    if (pipeline.steps?.narrationAudio?.status === "running") return;
    const publicUrl = getPublicProjectFileUrl(pipeline.audioPath);
    if (!publicUrl) return;
    const versionedUrl = createCacheBustedUrl(publicUrl);
    if (!versionedUrl) return;
    narrationAudio.setScriptAudioUrl((current: string | null) => {
      if (current && current.startsWith("blob:")) return current;
      if (current === versionedUrl) return current;
      return versionedUrl;
    });
  }, [
    pipeline.audioPath,
    pipeline.steps?.narrationAudio?.status,
    narrationAudio.isGeneratingScriptAudio,
  ]);

  // Sync thumbnail from pipeline.thumbnailPath
  useEffect(() => {
    if (!pipeline.thumbnailPath) return;
    const publicUrl = getPublicProjectFileUrl(pipeline.thumbnailPath);
    if (!publicUrl) return;
    const versionedUrl = createCacheBustedUrl(publicUrl);
    thumbnailGen.setThumbnailImage((current) => {
      if (current && current.data) return current;
      if (current?.url === versionedUrl) return current;
      return current ? { ...current, url: versionedUrl } : { url: versionedUrl };
    });
  }, [pipeline.thumbnailPath]);

  // ============================================
  // Basic Setters
  // ============================================

  const setVariable = useCallback((variableKey: VariableKey, value: string) => {
    setPipeline((prev) => {
      const field = VARIABLE_KEY_TO_PIPELINE_FIELD[variableKey];
      if (!field) return prev;
      if (prev[field] === value) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const setTopic = useCallback((topic: string) => {
    setPipeline((prev) => {
      if (prev.topic === topic) {
        return prev;
      }

      const prevTrimmed = prev.topic.trim();
      const nextTrimmed = topic.trim();

      if (prevTrimmed === nextTrimmed) {
        return { ...prev, topic };
      }

      const clearedSteps = resetStepsAfterTopicChange(prev.steps);

      return {
        ...prev,
        topic,
        keyConcepts: "",
        hookScript: "",
        quizInfo: "",
        videoScript: "",
        narrationScript: "",
        title: "",
        description: "",
        thumbnailPrompt: "",
        narrationTimestamps: undefined,
        productionScript: undefined,
        characterReferenceImage: undefined,
        sceneAssets: undefined,
        finalVideoPath: undefined,
        videoAssemblyStatus: "idle",
        scriptPath: undefined,
        audioPath: undefined,
        thumbnailPath: undefined,
        steps: clearedSteps,
      };
    });
  }, []);

  const setModel = useCallback((model: ModelId) => {
    setPipeline((prev) => ({ ...prev, model }));
  }, []);

  const setNarrationModel = useCallback((modelId: NarrationModelId) => {
    setPipeline((prev) => ({ ...prev, narrationModelId: modelId }));
  }, []);

  const setScenePreviewLimit = useCallback((limit: number | null) => {
    const normalized =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : null;
    setPipeline((prev) => {
      if (prev.scenePreviewLimit === normalized) return prev;
      return { ...prev, scenePreviewLimit: normalized };
    });
  }, []);

  const setPromptOverride = useCallback((stepId: StepId, template: string) => {
    setPromptOverrides((prev) => ({ ...prev, [stepId]: template }));
  }, []);

  // ============================================
  // Narration Timestamps Step
  // ============================================
  const runNarrationTimestampsStep = useCallback(
    async (audioUrlOverride?: string) => {
      const currentPipeline = pipelineRef.current;
      const audioUrl =
        audioUrlOverride || getPublicProjectFileUrl(currentPipeline.audioPath);

      if (!audioUrl) {
        const fallbackError = "Generate narration audio before extracting timestamps.";
        setTimestampsError(fallbackError);
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            narrationTimestamps: {
              ...prev.steps.narrationTimestamps,
              status: "error" as const,
              errorMessage: fallbackError,
            },
          },
        }));
        return;
      }

      setIsExtractingTimestamps(true);
      setTimestampsError(null);
      setTimestampsExtractionTimeMs(null);

      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          narrationTimestamps: {
            ...prev.steps.narrationTimestamps,
            status: "running" as const,
            errorMessage: undefined,
            resolvedPrompt: "",
            responseText: "",
            metrics: undefined,
          },
        },
      }));

      const startTime = performance.now();

      try {
        const response = await fetch("/api/audio/timestamps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioUrl }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData?.details || errorData?.error || `Failed to extract timestamps (status ${response.status}).`
          );
        }

        const data = await response.json();
        const timestamps = data.timestamps;
        const durationMs = performance.now() - startTime;

        setTimestampsExtractionTimeMs(durationMs);

        setPipeline((prev) => {
          const timestampsMetrics: StepRunMetrics = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            costUsd: 0.07 * (timestamps.totalDurationSec / 60),
            durationMs,
          };
          const currentStep = ensureStepState(prev.steps, "narrationTimestamps");
          
          let nextProductionScript = prev.productionScript;
          let timestampsWithScenes = timestamps;
          
          if (prev.productionScript?.scenes?.length) {
            try {
              const { alignedScript, alignmentResults } = alignScenesToTimestamps(
                prev.productionScript,
                timestamps,
              );
              nextProductionScript = alignedScript;
              
              const sceneTimestampsMap = new Map(
                alignedScript.scenes.map((scene) => [
                  scene.sceneNumber,
                  { narrationText: scene.narrationText, startSec: scene.startSec, endSec: scene.endSec },
                ])
              );
              
              const sceneTimestamps = alignmentResults.map((result) => {
                const sceneData = sceneTimestampsMap.get(result.sceneNumber);
                const hasValidDuration = result.endSec > result.startSec;
                const durationSec = hasValidDuration ? result.endSec - result.startSec : undefined;
                const numFrames = getFramesForDuration(durationSec ?? 5);
                return {
                  sceneNumber: result.sceneNumber,
                  narrationText: sceneData?.narrationText ?? "",
                  startSec: result.startSec,
                  endSec: result.endSec,
                  confidence: result.confidence,
                  numFrames,
                };
              });
              
              timestampsWithScenes = { ...timestamps, sceneTimestamps };
            } catch (alignmentError) {
              console.warn("Scene re-alignment failed after timestamp extraction:", alignmentError);
            }
          }

          const nextSteps = {
            ...prev.steps,
            narrationTimestamps: {
              ...currentStep,
              status: "success" as const,
              errorMessage: undefined,
              responseText: JSON.stringify(timestampsWithScenes, null, 2),
              metrics: timestampsMetrics,
            },
          };
          const totals = calculateStepTotals(nextSteps);
          const sessionTotals = getAccumulatedSessionTotals(prev, timestampsMetrics);

          return {
            ...prev,
            productionScript: nextProductionScript,
            narrationTimestamps: timestampsWithScenes,
            steps: nextSteps,
            totalTokens: totals.totalTokens,
            totalCostUsd: totals.totalCostUsd,
            sessionTotalTokens: sessionTotals.sessionTotalTokens,
            sessionTotalCostUsd: sessionTotals.sessionTotalCostUsd,
            cumulativeTokens: sessionTotals.cumulativeTokens,
            cumulativeCostUsd: sessionTotals.cumulativeCostUsd,
          };
        });

        autoSave.queueAutoSave();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to extract timestamps. Please try again.";
        setTimestampsError(message);
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            narrationTimestamps: {
              ...prev.steps.narrationTimestamps,
              status: "error" as const,
              errorMessage: message,
            },
          },
        }));
      } finally {
        setIsExtractingTimestamps(false);
      }
    },
    [autoSave.queueAutoSave],
  );

  // ============================================
  // Character Reference Image
  // ============================================
  const generateCharacterReferenceImage = useCallback(async () => {
    const requiresCharacter = styleRequiresCharacterReference(pipeline.visualStyleId);
    
    if (!requiresCharacter) {
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          characterReferenceImage: {
            ...ensureStepState(prev.steps, "characterReferenceImage"),
            status: "success" as const,
            responseText: "Skipped - visual style does not require character reference.",
            errorMessage: undefined,
          },
        },
      }));
      return;
    }

    const productionScript = pipeline.productionScript;
    if (!productionScript?.characterSheet?.mainChild) {
      setCharacterReferenceError("No character sheet found. Run the Production Script step first.");
      return;
    }

    const characterDescription = productionScript.characterSheet.mainChild;
    const projectSlug = getOrCreateProjectSlug(pipeline.projectSlug, pipeline.topic);

    setIsGeneratingCharacterReference(true);
    setCharacterReferenceError(null);

    setPipeline((prev) => ({
      ...prev,
      steps: {
        ...prev.steps,
        characterReferenceImage: {
          ...ensureStepState(prev.steps, "characterReferenceImage"),
          status: "running" as const,
          errorMessage: undefined,
        },
      },
    }));

    try {
      const referencePrompt = `Pixar-style 3D animation, clean modern CGI render, rounded friendly character design, soft studio lighting, vibrant saturated colors — Character reference sheet portrait of ${characterDescription}. Clean front-facing view, neutral pose, friendly expression, full upper body visible, simple gradient background. This is a reference image for maintaining character consistency. High quality, 1920x1080, 16:9 aspect ratio.`;

      const res = await fetch("/api/gemini/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: referencePrompt,
          projectSlug,
          thumbnailPath: `projects/${projectSlug}/character-reference.png`,
          skipTextOverlay: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate character reference image");
      }

      const data = await res.json();
      const characterReferenceImage = data.imageBase64;
      
      setPipeline((prev) => ({
        ...prev,
        characterReferenceImage,
        projectSlug,
        steps: {
          ...prev.steps,
          characterReferenceImage: {
            ...ensureStepState(prev.steps, "characterReferenceImage"),
            status: "success" as const,
            errorMessage: undefined,
          },
        },
      }));

      autoSave.queueAutoSave();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate character reference image.";
      setCharacterReferenceError(message);
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          characterReferenceImage: {
            ...ensureStepState(prev.steps, "characterReferenceImage"),
            status: "error" as const,
            errorMessage: message,
          },
        },
      }));
    } finally {
      setIsGeneratingCharacterReference(false);
    }
  }, [pipeline.visualStyleId, pipeline.productionScript, pipeline.projectSlug, pipeline.topic, autoSave.queueAutoSave]);

  // ============================================
  // Run Step (LLM execution)
  // ============================================
  const runStep = useCallback(
    async (stepId: StepId) => {
      const stepConfig = STEP_CONFIGS.find((config) => config.id === stepId);
      if (!stepConfig) return;

      const trimmedTopic = pipeline.topic.trim();
      if (!trimmedTopic) {
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              ...prev.steps[stepId],
              status: "error" as const,
              errorMessage: "Please enter a topic before running this step.",
            },
          },
        }));
        return;
      }

      // Validate required input variables
      const missingRequiredVars = stepConfig.inputVars.filter((varKey) => {
        return !hasVariableValue(pipeline, varKey);
      });

      if (missingRequiredVars.length > 0) {
        const missingLabels = missingRequiredVars.map(
          (key) => VARIABLE_LABELS[key] ?? key,
        );
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              ...prev.steps[stepId],
              status: "error" as const,
              errorMessage: `Missing required input variables: ${missingLabels.join(", ")}. Please run the previous steps first.`,
            },
          },
        }));
        return;
      }

      // Build variables object
      const variables: Record<string, string> = {};
      if (pipeline.keyConcepts) variables.KeyConcepts = pipeline.keyConcepts;
      if (pipeline.hookScript) variables.HookScript = pipeline.hookScript;
      if (pipeline.quizInfo) variables.QuizInfo = pipeline.quizInfo;
      if (pipeline.videoScript) variables.VideoScript = pipeline.videoScript;
      if (pipeline.narrationScript) variables.NarrationScript = pipeline.narrationScript;
      if (pipeline.title) variables.Title = pipeline.title;
      if (pipeline.description) variables.Description = pipeline.description;
      if (pipeline.thumbnailPrompt) variables.ThumbnailPrompt = pipeline.thumbnailPrompt;
      
      // Add JSON-based variables
      const narrationTimestampsValue = getPipelineValueForVariable(pipeline, 'NarrationTimestamps');
      if (narrationTimestampsValue) variables.NarrationTimestamps = narrationTimestampsValue;
      const productionScriptValue = getPipelineValueForVariable(pipeline, 'ProductionScript');
      if (productionScriptValue) variables.ProductionScript = productionScriptValue;
      const sceneImagePromptsValue = getPipelineValueForVariable(pipeline, 'SceneImagePrompts');
      if (sceneImagePromptsValue) variables.SceneImagePrompts = sceneImagePromptsValue;
      const sceneVideoPromptsValue = getPipelineValueForVariable(pipeline, 'SceneVideoPrompts');
      if (sceneVideoPromptsValue) variables.SceneVideoPrompts = sceneVideoPromptsValue;

      // Add visual style variables
      const styleSections = getProductionScriptStyleSections(pipeline.visualStyleId);
      variables.VisualStyle = styleSections.styleName;
      variables.VisualStyleAtmosphere = styleSections.atmosphere;
      variables.VisualStyleOutputExample = styleSections.outputExample;
      variables.VisualStyleDescriptionGuidelines = styleSections.descriptionGuidelines;
      variables.VisualStyleMicroMovementTable = styleSections.microMovementTable;
      variables.VisualStyleImageHints = styleSections.imagePromptsHints;
      variables.VisualStyleImageExample = styleSections.imagePromptsExample;
      variables.VisualStyleBreathingExample = styleSections.breathingExample;
      variables.VisualStyleVideoHints = styleSections.videoPromptsHints;
      variables.VisualStyleVideoExample = styleSections.videoPromptsExample;
      
      // Add video frame mode variables
      const frameMode: VideoFrameMode = pipeline.videoFrameMode || 'flf2v';
      variables.VideoFrameMode = frameMode === 'flf2v' ? 'FLF2V (First-Last-Frame-to-Video)' : 'First Frame Only';
      variables.VisualStyleConsolidatedImageGuidance = getConsolidatedImagePromptsGuidance(pipeline.visualStyleId, frameMode);
      variables.VisualStyleConsolidatedVideoGuidance = getConsolidatedVideoPromptsGuidance(pipeline.visualStyleId, frameMode);
      variables.VideoFrameModeImageTask = getVideoFrameModeImageTask(frameMode);
      variables.VideoFrameModeImageRules = getVideoFrameModeImageRules(frameMode);
      variables.VideoFrameModeVideoTask = getVideoFrameModeVideoTask(frameMode);
      variables.VideoFrameModeVideoRules = getVideoFrameModeVideoRules(frameMode);

      const audienceMode: AudienceMode = pipeline.audienceMode ?? "forKids";
      const manualPromptOverride = promptOverrides[stepId];
      const hasManualOverride =
        typeof manualPromptOverride === "string" && manualPromptOverride.trim().length > 0;

      const promptTemplateOverride = hasManualOverride
        ? manualPromptOverride
        : audienceMode === "forEveryone" && AUDIENCE_OVERRIDDEN_STEP_IDS.has(stepId)
          ? getPromptByAudience(stepId, audienceMode)
          : undefined;

      // Handle shell steps
      if (stepId === "narrationTimestamps") {
        await runNarrationTimestampsStep();
        return;
      }
      if (stepId === "narrationAudio") {
        console.warn("narrationAudio step should be run via the audio generation UI");
        return;
      }

      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          [stepId]: {
            ...prev.steps[stepId],
            status: "running" as const,
            errorMessage: undefined,
          },
        },
      }));

      try {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'post-fix',hypothesisId:'J',location:'src/hooks/use-agent-pipeline-new.ts:runStep:request',message:'Calling /api/agent/run-step',data:{stepId,model:pipeline.model,audienceMode:pipeline.audienceMode ?? "forKids",hasPromptOverride:typeof promptTemplateOverride==="string" && promptTemplateOverride.trim().length>0,variablesKeys:Object.keys(variables).slice(0,40)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        const response = await fetch("/api/agent/run-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepId,
            model: pipeline.model,
            topic: pipeline.topic,
            variables,
            promptTemplateOverride,
            audienceMode: pipeline.audienceMode ?? "forKids",
          }),
        });

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'post-fix',hypothesisId:'K',location:'src/hooks/use-agent-pipeline-new.ts:runStep:response-meta',message:'Received /api/agent/run-step response headers',data:{stepId,status:response.status,ok:response.ok},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log

        const data = await response.json();

        if (!response.ok || data?.error) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'post-fix',hypothesisId:'L',location:'src/hooks/use-agent-pipeline-new.ts:runStep:error',message:'run-step returned error',data:{stepId,status:response.status,ok:response.ok,apiError:typeof data?.error==="string"?data.error:null},timestamp:Date.now()})}).catch(()=>{});
          // #endregion agent log
          throw new Error(
            (typeof data?.error === "string" && data.error) ||
            `Failed to run step (status ${response.status}).`
          );
        }

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'post-fix',hypothesisId:'M',location:'src/hooks/use-agent-pipeline-new.ts:runStep:success',message:'run-step succeeded',data:{stepId,responseTextChars:typeof data?.responseText==="string"?data.responseText.length:null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log

        const producedVariables: Record<string, string> = data.producedVariables ?? {};

        // IMPORTANT: Update pipelineRef.current BEFORE queueAutoSave() runs.
        // queueAutoSave reads pipelineRef.current; if we only update it inside a
        // React state updater, React may batch/defer execution and we can race.
        const basePipeline = pipelineRef.current;

        const prevVideoScript =
          typeof basePipeline.videoScript === "string" ? basePipeline.videoScript : "";
        const prevNarrationScript =
          typeof basePipeline.narrationScript === "string"
            ? basePipeline.narrationScript
            : "";
        const prevDerivedNarration = prevVideoScript
          ? toNarrationOnly(prevVideoScript)
          : "";
        const shouldAutoUpdateNarrationScript =
          prevNarrationScript.trim().length === 0 ||
          (prevVideoScript.trim().length > 0 &&
            prevNarrationScript.trim() === prevDerivedNarration.trim());

        const updatedSteps = {
          ...basePipeline.steps,
          [stepId]: {
            ...basePipeline.steps[stepId],
            resolvedPrompt: data.resolvedPrompt ?? "",
            responseText: data.responseText ?? "",
            status: "success" as const,
            metrics: data.metrics,
            errorMessage: undefined,
          },
        };

        const nextPipeline: PipelineState = {
          ...basePipeline,
          steps: updatedSteps,
        };

        // Process produced variables
        for (const [key, value] of Object.entries(producedVariables)) {
          if (key === "ProductionScript") {
            try {
              let jsonStr = value.trim();
              const closedMatch = value.match(/```json\s*([\s\S]*?)\s*```/);
              if (closedMatch) {
                jsonStr = closedMatch[1];
              } else {
                const openMatch = value.match(/```json\s*([\s\S]*)$/);
                if (openMatch) {
                  jsonStr = openMatch[1].trim();
                  if (jsonStr.startsWith("{") && !jsonStr.endsWith("}")) {
                    const lastBrace = jsonStr.lastIndexOf("}");
                    if (lastBrace > 0) {
                      const scenesArrayMatch = jsonStr.match(/"scenes"\s*:\s*\[/);
                      if (scenesArrayMatch) {
                        jsonStr = jsonStr.slice(0, lastBrace + 1) + "]}";
                      }
                    }
                  }
                }
              }
              let parsed = JSON.parse(jsonStr) as ProductionScriptData;

              if (parsed.scenes && Array.isArray(parsed.scenes)) {
                parsed.scenes = parsed.scenes.map((scene) => {
                  const sceneLike = scene as Partial<ProductionScene> &
                    Record<string, unknown>;

                  const sceneNumber =
                    typeof sceneLike.sceneNumber === "number"
                      ? sceneLike.sceneNumber
                      : typeof sceneLike.id === "number"
                        ? sceneLike.id
                        : typeof sceneLike.number === "number"
                          ? sceneLike.number
                          : 0;

                  const narrationText =
                    typeof sceneLike.narrationText === "string"
                      ? sceneLike.narrationText
                      : typeof sceneLike.narration === "string"
                        ? sceneLike.narration
                        : typeof sceneLike.text === "string"
                          ? sceneLike.text
                          : "";

                  const visualDescription =
                    typeof sceneLike.visualDescription === "string"
                      ? sceneLike.visualDescription
                      : typeof sceneLike.visual === "string"
                        ? sceneLike.visual
                        : typeof sceneLike.description === "string"
                          ? sceneLike.description
                          : "";

                  const estimatedDurationSec =
                    typeof sceneLike.estimatedDurationSec === "number"
                      ? sceneLike.estimatedDurationSec
                      : typeof sceneLike.endSec === "number" &&
                          typeof sceneLike.startSec === "number"
                        ? sceneLike.endSec - sceneLike.startSec
                        : 8;

                  const startSec =
                    typeof sceneLike.startSec === "number"
                      ? sceneLike.startSec
                      : undefined;
                  const endSec =
                    typeof sceneLike.endSec === "number"
                      ? sceneLike.endSec
                      : undefined;
                  const transitionHint =
                    typeof sceneLike.transitionHint === "string"
                      ? sceneLike.transitionHint
                      : undefined;
                  const sceneGroup =
                    typeof sceneLike.sceneGroup === "string"
                      ? sceneLike.sceneGroup
                      : undefined;

                  return {
                    sceneNumber,
                    narrationText,
                    visualDescription,
                    estimatedDurationSec,
                    startSec,
                    endSec,
                    transitionHint,
                    sceneGroup,
                  };
                }) as ProductionScriptData["scenes"];
              }

              const narrationTimestamps = nextPipeline.narrationTimestamps;
              if (narrationTimestamps) {
                try {
                  const { alignedScript } = alignScenesToTimestamps(
                    parsed,
                    narrationTimestamps,
                  );
                  parsed = alignedScript;
                } catch {
                  // ignore alignment errors
                }
              }

              nextPipeline.productionScript = parsed;
              nextPipeline.sceneAssets =
                parsed.scenes?.map((scene) => ({
                  sceneNumber: scene.sceneNumber,
                  imagePrompt: "",
                  videoPrompt: "",
                  status: "pending",
                })) ?? [];
            } catch (parseError) {
              console.error("Failed to parse ProductionScript:", parseError);
            }
          } else if (key === "SceneImagePrompts") {
            try {
              let jsonStr = value.trim();
              const closedMatch = value.match(/```json\s*([\s\S]*?)\s*```/);
              if (closedMatch) jsonStr = closedMatch[1];

              const parsed = JSON.parse(jsonStr) as Array<{
                sceneNumber: number;
                firstFramePrompt?: string;
                lastFramePrompt?: string;
                imagePrompt?: string;
                prompt?: string;
              }>;

              const existingAssets = nextPipeline.sceneAssets || [];
              const getFirstFramePrompt = (item: (typeof parsed)[0]) => {
                return item.firstFramePrompt || item.imagePrompt || item.prompt || "";
              };
              const getLastFramePrompt = (item: (typeof parsed)[0]) => {
                return item.lastFramePrompt || "";
              };

              nextPipeline.sceneAssets = existingAssets.map((asset) => {
                const promptData = parsed.find(
                  (p) => p.sceneNumber === asset.sceneNumber,
                );
                if (promptData) {
                  return {
                    ...asset,
                    imagePrompt: getFirstFramePrompt(promptData),
                    lastFrameImagePrompt: getLastFramePrompt(promptData),
                    status: "pending" as const,
                  };
                }
                return asset;
              });
            } catch (parseError) {
              console.error("Failed to parse SceneImagePrompts:", parseError);
            }
          } else if (key === "SceneVideoPrompts") {
            try {
              let jsonStr = value.trim();
              const closedMatch = value.match(/```json\s*([\s\S]*?)\s*```/);
              if (closedMatch) jsonStr = closedMatch[1];

              const parsed = JSON.parse(jsonStr) as Array<{
                sceneNumber: number;
                videoPrompt?: string;
                motion?: string;
              }>;

              const existingAssets = nextPipeline.sceneAssets || [];
              const getVideoPrompt = (item: (typeof parsed)[0]) => {
                return item.videoPrompt || item.motion || "";
              };

              nextPipeline.sceneAssets = existingAssets.map((asset) => {
                const promptData = parsed.find(
                  (p) => p.sceneNumber === asset.sceneNumber,
                );
                if (promptData) {
                  return {
                    ...asset,
                    videoPrompt: getVideoPrompt(promptData),
                  };
                }
                return asset;
              });
            } catch (parseError) {
              console.error("Failed to parse SceneVideoPrompts:", parseError);
            }
          } else {
            // Handle simple string variables
            const fieldMap: Record<string, keyof PipelineState> = {
              KeyConcepts: "keyConcepts",
              HookScript: "hookScript",
              QuizInfo: "quizInfo",
              VideoScript: "videoScript",
              NarrationScript: "narrationScript",
              Title: "title",
              Description: "description",
              YoutubeTags: "youtubeTags",
              Chapters: "chapters",
              ThumbnailPrompt: "thumbnailPrompt",
            };
            const field = fieldMap[key];
            if (field) {
              (nextPipeline as unknown as Record<
                keyof PipelineState,
                PipelineState[keyof PipelineState]
              >)[field] = value as PipelineState[typeof field];
            }

            if (
              key === "VideoScript" &&
              typeof value === "string" &&
              shouldAutoUpdateNarrationScript
            ) {
              nextPipeline.narrationScript = toNarrationOnly(value);
            }
          }
        }

        const totals = calculateStepTotals(updatedSteps);
        const sessionTotals = getAccumulatedSessionTotals(basePipeline, data.metrics);

        const result: PipelineState = {
          ...nextPipeline,
          totalTokens: totals.totalTokens,
          totalCostUsd: totals.totalCostUsd,
          sessionTotalTokens: sessionTotals.sessionTotalTokens,
          sessionTotalCostUsd: sessionTotals.sessionTotalCostUsd,
          cumulativeTokens: sessionTotals.cumulativeTokens,
          cumulativeCostUsd: sessionTotals.cumulativeCostUsd,
        };

        pipelineRef.current = result;
        setPipeline(result);
        autoSave.queueAutoSave();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run step.";
        setPipeline((prev) => ({
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              ...prev.steps[stepId],
              status: "error" as const,
              errorMessage: message,
            },
          },
        }));
      }
    },
    [pipeline, promptOverrides, autoSave.queueAutoSave, runNarrationTimestampsStep],
  );

  // ============================================
  // Run All Steps
  // ============================================
  const runAll = useCallback(async () => {
    const trimmedTopic = pipeline.topic.trim();
    if (!trimmedTopic) {
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          keyConcepts: {
            ...prev.steps.keyConcepts,
            status: "error" as const,
            errorMessage: "Please enter a topic before running.",
          },
        },
      }));
      return;
    }

    const audienceMode: AudienceMode = pipeline.audienceMode ?? "forKids";

    const baseOverrides: Partial<Record<StepId, string>> = {};
    if (audienceMode === "forEveryone") {
      for (const stepId of RUN_ALL_OVERRIDE_STEP_IDS) {
        if (!AUDIENCE_OVERRIDDEN_STEP_IDS.has(stepId)) {
          continue;
        }
        baseOverrides[stepId] = getPromptByAudience(stepId, audienceMode);
      }
    }

    const manualOverrideEntries = Object.entries(promptOverrides)
      .filter(([stepId, value]) => {
        if (!RUN_ALL_OVERRIDE_STEP_IDS.has(stepId as StepId)) {
          return false;
        }
        return typeof value === "string" && value.trim().length > 0;
      })
      .map(([stepId, value]) => [stepId as StepId, value as string] as const);

    const manualOverrides = Object.fromEntries(manualOverrideEntries) as Partial<Record<StepId, string>>;

    const mergedOverrides = { ...baseOverrides, ...manualOverrides };
    const overrides = Object.keys(mergedOverrides).length > 0 ? mergedOverrides : undefined;

    setIsRunningAll(true);

    try {
      const body: Record<string, unknown> = {
        topic: pipeline.topic,
        model: pipeline.model,
      };
      if (overrides && Object.keys(overrides).length > 0) {
        body.promptTemplateOverrides = overrides;
      }
      const response = await fetch("/api/agent/run-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (isPipelineState(data)) {
        setPipeline((prev) =>
          ensureCumulativeTotals(
            ensureSessionTotals({
              ...prev,
              ...data,
              id: data.id ?? prev.id,
              projectSlug: data.projectSlug ?? prev.projectSlug,
              characterReferenceImage: prev.characterReferenceImage || data.characterReferenceImage,
              narrationModelId: normalizeNarrationModelId(
                data.narrationModelId ?? prev.narrationModelId,
              ),
            }),
          ),
        );

        const nextNarrationScript =
          typeof data.narrationScript === "string" && data.narrationScript.trim().length > 0
            ? data.narrationScript
            : undefined;
        if (nextNarrationScript) {
          await narrationAudio.runNarrationAudioStep(nextNarrationScript);
        }
        return;
      }
      if (!response.ok) {
        throw new Error(
          (typeof data?.error === "string" && data.error) || "Failed to run all steps."
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run all steps.";
      setPipeline((prev) => ({
        ...prev,
        steps: {
          ...prev.steps,
          keyConcepts: {
            ...prev.steps.keyConcepts,
            status: "error" as const,
            errorMessage: message,
          },
        },
      }));
    } finally {
      setIsRunningAll(false);
    }
  }, [pipeline, promptOverrides, narrationAudio.runNarrationAudioStep]);

  // ============================================
  // Utility Actions
  // ============================================
  const downloadVoiceover = useCallback(() => {
    if (!narrationAudio.scriptAudioUrl) return;
    const slug = slugifyTopic(pipeline.topic);
    const link = document.createElement("a");
    link.href = narrationAudio.scriptAudioUrl;
    link.download = `${slug}-script.mp3`;
    document.body?.appendChild(link);
    link.click();
    document.body?.removeChild(link);
  }, [pipeline.topic, narrationAudio.scriptAudioUrl]);

  const exportFiles = useCallback(() => {
    if (!hasAnyOutputs) return;
    const slug = slugifyTopic(pipeline.topic);
    const entries: Array<[string | undefined, string]> = [
      [pipeline.keyConcepts, `${slug}-key-concepts.txt`],
      [pipeline.hookScript, `${slug}-hook.txt`],
      [pipeline.quizInfo, `${slug}-quizzes.txt`],
      [pipeline.title, `${slug}-title.txt`],
      [pipeline.description, `${slug}-description.txt`],
      [pipeline.thumbnailPrompt, `${slug}-thumbnail-prompt.txt`],
    ];
    for (const [content, filename] of entries) {
      if (content && content.trim()) {
        downloadTextFile(filename, content);
      }
    }
  }, [hasAnyOutputs, pipeline]);

  const exportScriptMarkdown = useCallback(() => {
    const script = pipeline.videoScript?.trim();
    if (!script) return;
    const slug = slugifyTopic(pipeline.topic);
    downloadTextFile(`${slug}-script.md`, script, "text/markdown");
  }, [pipeline.topic, pipeline.videoScript]);

  const resetStepStatus = useCallback((stepId: StepId) => {
    setPipeline((prev) => {
      const currentStep = ensureStepState(prev.steps, stepId);
      if (currentStep.status === "running") {
        return {
          ...prev,
          steps: {
            ...prev.steps,
            [stepId]: {
              ...currentStep,
              status: "idle" as const,
              errorMessage: undefined,
            },
          },
        };
      }
      return prev;
    });
  }, []);

  // ============================================
  // Return Object
  // ============================================
  return {
    state: {
      pipeline,
      promptOverrides,
      historyProjects: projectHistory.historyProjects,
      selectedProjectId: projectHistory.selectedProjectId,
      isLoadingHistory: projectHistory.isLoadingHistory,
      historyError: projectHistory.historyError,
      isSavingProject: projectHistory.isSavingProject,
      saveError: projectHistory.saveError,
      isDeletingProjectId: projectHistory.isDeletingProjectId,
      deleteError: projectHistory.deleteError,
      isRunningAll,
      isGeneratingScriptAudio: narrationAudio.isGeneratingScriptAudio,
      scriptAudioUrl: narrationAudio.scriptAudioUrl,
      scriptAudioError: narrationAudio.scriptAudioError,
      scriptAudioGenerationTimeMs: narrationAudio.scriptAudioGenerationTimeMs,
      isGeneratingThumbnail: thumbnailGen.isGeneratingThumbnail,
      thumbnailImage: thumbnailGen.thumbnailImage,
      thumbnailGenerationTime: thumbnailGen.thumbnailGenerationTime,
      thumbnailError: thumbnailGen.thumbnailError,
      thumbnailMetrics: thumbnailGen.thumbnailMetrics,
      isGeneratingCharacterReference,
      characterReferenceError,
      isGeneratingSceneImages: sceneImages.isGeneratingSceneImages,
      sceneImagesProgress: sceneImages.sceneImagesProgress,
      sceneImagesError: sceneImages.sceneImagesError,
      isGeneratingSceneVideos: sceneVideos.isGeneratingSceneVideos,
      sceneVideosProgress: sceneVideos.sceneVideosProgress,
      sceneVideosError: sceneVideos.sceneVideosError,
      isAssemblingVideo: videoAssembly.isAssemblingVideo,
      videoAssemblyProgress: videoAssembly.videoAssemblyProgress,
      videoAssemblyError: videoAssembly.videoAssemblyError,
      isExtractingTimestamps,
      timestampsError,
      timestampsExtractionTimeMs,
    },
    derived: {
      sharedVars,
      totalGenerationDurationMs,
      hasAnyOutputs,
      hasScript,
      hasRuntimeMetrics,
      scriptDraftStats,
      videoScriptStats,
    },
    actions: {
      setPipeline,
      setVariable,
      setTopic,
      setModel,
      setNarrationModel,
      setScenePreviewLimit,
      setPromptOverride,
      runStep,
      runAll,
      newProject: projectHistory.newProject,
      saveProject: projectHistory.saveProject,
      selectProject: projectHistory.selectProject,
      deleteProject: projectHistory.deleteProject,
      refreshHistory: projectHistory.refreshHistory,
      generateScriptAudio: narrationAudio.runNarrationAudioStep,
      runNarrationAudioStep: narrationAudio.runNarrationAudioStep,
      runNarrationTimestampsStep,
      generateThumbnail: thumbnailGen.generateThumbnail,
      downloadVoiceover,
      downloadThumbnail: thumbnailGen.downloadThumbnail,
      exportFiles,
      exportScriptMarkdown,
      generateCharacterReferenceImage,
      generateSceneImages: sceneImages.generateSceneImages,
      regenerateSceneImage: sceneImages.regenerateSceneImage,
      updateSceneImagePrompt: sceneImages.updateSceneImagePrompt,
      downloadSceneImage: sceneImages.downloadSceneImage,
      generateSceneVideos: sceneVideos.generateSceneVideos,
      assembleVideo: videoAssembly.assembleVideo,
      resetAssemblyState: videoAssembly.resetAssemblyState,
      resetStepStatus,
    },
  };
}

export type UseAgentPipelineReturn = ReturnType<typeof useAgentPipeline>;

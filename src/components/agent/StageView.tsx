"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { StepEditor } from "./StepEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugifyTopic } from "@/lib/slug";
import type { StepConfig, StepId, VariableKey, SceneAsset } from "@/types/agent";
import { ChevronDown, Download, PenLine, RefreshCw, X } from "lucide-react";

import type { UseAgentPipelineReturn } from "@/hooks/use-agent-pipeline";
import type { StageDefinition, StageId } from "./stage-config";

const GEMINI_THUMBNAIL_COST = {
  modelLabel: "Gemini 3 Pro (1K-4K)",
  tokenRange: { min: 1210, max: 2000 },
  pricePerMillionUsd: 20,
  costRangeUsd: { min: 0.024, max: 0.04 },
} as const;

const GEMINI_THUMBNAIL_TOKEN_RANGE_TEXT = `${GEMINI_THUMBNAIL_COST.tokenRange.min.toLocaleString()}-${GEMINI_THUMBNAIL_COST.tokenRange.max.toLocaleString()} tokens`;
const GEMINI_THUMBNAIL_COST_RANGE_TEXT = `$${GEMINI_THUMBNAIL_COST.costRangeUsd.min.toFixed(3)}-$${GEMINI_THUMBNAIL_COST.costRangeUsd.max.toFixed(3)}`;
const GEMINI_THUMBNAIL_PRICE_TEXT = `$${GEMINI_THUMBNAIL_COST.pricePerMillionUsd}/1M tokens`;

interface StageViewProps {
  stages: StageDefinition[];
  activeStageId: StageId;
  stepConfigs: StepConfig[];
  state: UseAgentPipelineReturn["state"];
  derived: UseAgentPipelineReturn["derived"];
  actions: UseAgentPipelineReturn["actions"];
  onEditVariable?: (variable: VariableKey) => void;
  onVisibleStepChange?: (stepId: StepId | null) => void;
  onVisibleStageChange?: (stageId: StageId) => void;
  collapsedSteps: Record<StepId, boolean>;
  onStepCollapseChangeAction: (stepId: StepId, collapsed: boolean) => void;
}

export function StageView({
  stages,
  activeStageId,
  stepConfigs,
  state,
  derived,
  actions,
  onEditVariable,
  onVisibleStepChange,
  onVisibleStageChange,
  collapsedSteps,
  onStepCollapseChangeAction,
}: StageViewProps) {
  const stepRefs = useRef<Record<StepId, HTMLElement | null>>({} as Record<StepId, HTMLElement | null>);
  const stageRefs = useRef<Record<StageId, HTMLElement | null>>({} as Record<StageId, HTMLElement | null>);
  const lastVisibleStep = useRef<StepId | null>(null);
  const lastVisibleStage = useRef<StageId | null>(null);

  const stepConfigMap = useMemo(
    () =>
      stepConfigs.reduce<Record<StepId, StepConfig>>((acc, config) => {
        acc[config.id] = config;
        return acc;
      }, {} as Record<StepId, StepConfig>),
    [stepConfigs],
  );

  const stageEntries = useMemo(
    () =>
      stages.map((stage) => {
        const visibleStepConfigs = stage.steps
          .map((stepId) => stepConfigMap[stepId])
          .filter((config): config is StepConfig => Boolean(config) && !config.hidden);

        return {
          stage,
          steps: visibleStepConfigs,
        };
      }),
    [stages, stepConfigMap],
  );

  const orderedStepConfigs = useMemo(
    () => stageEntries.flatMap((entry) => entry.steps),
    [stageEntries],
  );

  useEffect(() => {
    if (!onVisibleStepChange) {
      return;
    }

    const firstStepId = orderedStepConfigs[0]?.id ?? null;
    lastVisibleStep.current = firstStepId;
    onVisibleStepChange(firstStepId ?? null);
  }, [orderedStepConfigs, onVisibleStepChange]);

  useEffect(() => {
    if (!onVisibleStepChange) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        let nextStepId: StepId | null = null;
        if (intersecting.length > 0) {
          nextStepId = (intersecting[0].target.getAttribute("data-step-id") ??
            null) as StepId | null;
        } else if (entries.length > 0) {
          const closest = entries.reduce((prev, entry) => {
            const prevDelta = Math.abs(prev.boundingClientRect.top);
            const nextDelta = Math.abs(entry.boundingClientRect.top);
            return nextDelta < prevDelta ? entry : prev;
          });
          nextStepId = (closest.target.getAttribute("data-step-id") ?? null) as StepId | null;
        }

        if (nextStepId && nextStepId !== lastVisibleStep.current) {
          lastVisibleStep.current = nextStepId;
          onVisibleStepChange(nextStepId);
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0.2 },
    );

    orderedStepConfigs.forEach((config) => {
      const node = stepRefs.current[config.id];
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [orderedStepConfigs, onVisibleStepChange]);

  useEffect(() => {
    if (!onVisibleStageChange) {
      return;
    }

    const firstStageId = stages[0]?.id ?? null;
    if (firstStageId) {
      lastVisibleStage.current = firstStageId;
      onVisibleStageChange(firstStageId);
    }
  }, [stages, onVisibleStageChange]);

  useEffect(() => {
    if (!onVisibleStageChange) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        let nextStageId: StageId | null = null;
        if (intersecting.length > 0) {
          nextStageId = (intersecting[0].target.getAttribute("data-stage-id") ??
            null) as StageId | null;
        } else if (entries.length > 0) {
          const closest = entries.reduce((prev, entry) => {
            const prevDelta = Math.abs(prev.boundingClientRect.top);
            const nextDelta = Math.abs(entry.boundingClientRect.top);
            return nextDelta < prevDelta ? entry : prev;
          });
          nextStageId = (closest.target.getAttribute("data-stage-id") ?? null) as StageId | null;
        }

        if (nextStageId && nextStageId !== lastVisibleStage.current) {
          lastVisibleStage.current = nextStageId;
          onVisibleStageChange(nextStageId);
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0.25 },
    );

    stageEntries.forEach(({ stage }) => {
      const node = stageRefs.current[stage.id];
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [stageEntries, onVisibleStageChange]);

  return (
    <div id="stage-view-top" className="space-y-8">
      {stageEntries.map(({ stage, steps }, index) => (
        <section
          key={stage.id}
          id={`stage-${stage.id}`}
          data-stage-id={stage.id}
          ref={(node) => {
            stageRefs.current[stage.id] = node;
          }}
          className={`space-y-6 rounded-3xl border border-zinc-900/70 bg-zinc-950/60 p-6 shadow-[0_25px_80px_-60px_rgba(0,0,0,0.85)] scroll-mt-32 transition-colors ${
            stage.id === activeStageId ? "border-white/60 bg-white/5 shadow-white/10" : ""
          }`}
        >
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              {`Stage ${String(index + 1).padStart(2, "0")}`}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
              {stage.label}
            </p>
            <p className="mt-2 text-sm text-zinc-400">{stage.description}</p>
          </div>

          <div className="space-y-6">
            {steps.map((config) => {
              if (config.id === "narrationAudio") {
                return (
                  <div
                    key={config.id}
                    id={`step-${config.id}`}
                    data-step-id={config.id}
                    ref={(node) => {
                      stepRefs.current[config.id] = node;
                    }}
                    className="space-y-4 scroll-mt-32"
                  >
                    <NarrationAudioStep
                      stepConfig={config}
                      state={state}
                      actions={actions}
                      topic={state.pipeline.topic}
                    />
                  </div>
                );
              }

              if (config.id === "thumbnailGenerate") {
                return (
                  <div
                    key={config.id}
                    id={`step-${config.id}`}
                    data-step-id={config.id}
                    ref={(node) => {
                      stepRefs.current[config.id] = node;
                    }}
                    className="space-y-4 scroll-mt-32"
                  >
                    <ThumbnailGenerationStep
                      stepConfig={config}
                      state={state}
                      actions={actions}
                    />
                  </div>
                );
              }

              // Video generation step handlers
              if (config.id === "characterReferenceImage") {
                return (
                  <div
                    key={config.id}
                    id={`step-${config.id}`}
                    data-step-id={config.id}
                    ref={(node) => {
                      stepRefs.current[config.id] = node;
                    }}
                    className="space-y-4 scroll-mt-32"
                  >
                    <CharacterReferenceStep
                      stepConfig={config}
                      state={state}
                      actions={actions}
                    />
                  </div>
                );
              }

              if (config.id === "sceneImages") {
                return (
                  <div
                    key={config.id}
                    id={`step-${config.id}`}
                    data-step-id={config.id}
                    ref={(node) => {
                      stepRefs.current[config.id] = node;
                    }}
                    className="space-y-4 scroll-mt-32"
                  >
                    <SceneImagesStep
                      stepConfig={config}
                      state={state}
                      actions={actions}
                    />
                  </div>
                );
              }

              if (config.id === "sceneVideos") {
                return (
                  <div
                    key={config.id}
                    id={`step-${config.id}`}
                    data-step-id={config.id}
                    ref={(node) => {
                      stepRefs.current[config.id] = node;
                    }}
                    className="space-y-4 scroll-mt-32"
                  >
                    <SceneVideosStep
                      stepConfig={config}
                      state={state}
                      actions={actions}
                    />
                  </div>
                );
              }

              if (config.id === "videoAssembly") {
                return (
                  <div
                    key={config.id}
                    id={`step-${config.id}`}
                    data-step-id={config.id}
                    ref={(node) => {
                      stepRefs.current[config.id] = node;
                    }}
                    className="space-y-4 scroll-mt-32"
                  >
                    <VideoAssemblyStep
                      stepConfig={config}
                      state={state}
                      actions={actions}
                    />
                  </div>
                );
              }

              const isStepCollapsed = collapsedSteps[config.id] ?? true;

              return (
                <div
                  key={config.id}
                  id={`step-${config.id}`}
                  data-step-id={config.id}
                  ref={(node) => {
                    stepRefs.current[config.id] = node;
                  }}
                  className="space-y-4 scroll-mt-32"
                >
                  <StepEditor
                    stepConfig={config}
                    stepState={state.pipeline.steps[config.id]}
                    sharedVars={derived.sharedVars}
                    pipeline={state.pipeline}
                    templateValue={state.promptOverrides[config.id] ?? config.promptTemplate}
                    onRunStep={actions.runStep}
                    onPromptChange={actions.setPromptOverride}
                    onEditVariable={onEditVariable}
                    isCollapsed={isStepCollapsed}
                    onToggleCollapse={() => onStepCollapseChangeAction(config.id, !isStepCollapsed)}
                  />

                  {!isStepCollapsed && config.id === "script" && (
                    <ScriptExtras
                      derived={derived}
                    />
                  )}
                </div>
              );
            })}

            {steps.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-800/60 bg-zinc-950/40 p-4 text-sm text-zinc-500">
                No visible steps configured for this stage.
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function ScriptExtras({
  derived,
}: {
  derived: UseAgentPipelineReturn["derived"];
}) {
  const draftStats = derived.scriptDraftStats;

  if (!draftStats) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
      <div>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
          Initial script stats
        </p>
        <p className="text-xs text-zinc-500">Captured right after Script Generation.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/80 p-4">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Word count
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {draftStats.words.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-500">Before QA tightening.</p>
        </div>
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/80 p-4">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Character count
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {draftStats.characters.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-500">Includes spaces & punctuation.</p>
        </div>
      </div>
    </div>
  );
}

function NarrationAudioStep({
  stepConfig,
  state,
  actions,
  topic,
}: {
  stepConfig: StepConfig;
  state: UseAgentPipelineReturn["state"];
  actions: UseAgentPipelineReturn["actions"];
  topic: string;
}) {
  const stepState = state.pipeline.steps[stepConfig.id];
  const cleanNarrationText =
    state.pipeline.narrationScript?.trim() ??
    state.pipeline.videoScript?.trim() ??
    "";
  const audioTaggedNarration =
    state.pipeline.steps.narrationAudioTags?.responseText?.trim() ?? "";
  const cleanChars = cleanNarrationText.length;
  const taggedChars = audioTaggedNarration ? audioTaggedNarration.length : cleanChars;
  const narrationReady = cleanChars > 0;
  const rawStatus = stepState?.status ?? "idle";
  const slug = slugifyTopic(topic);
  const audioUrl = state.scriptAudioUrl;
  
  // Derive the effective status - if we have audio and no error, consider it success
  // This handles cases where the step status update hasn't propagated yet
  const hasAudioAndNoError = Boolean(audioUrl) && !state.scriptAudioError;
  const status = hasAudioAndNoError && rawStatus === "running" ? "success" : rawStatus;
  
  // Only show "Generating" if actively generating AND not yet successful
  const isRunning = state.isGeneratingScriptAudio && status !== "success" && status !== "error";
  const generationTimeText =
    typeof state.scriptAudioGenerationTimeMs === "number"
      ? `${(state.scriptAudioGenerationTimeMs / 1000).toFixed(1)}s`
      : null;
  const errorMessage = state.scriptAudioError ?? stepState?.errorMessage;
  const selectedModel = state.pipeline.narrationModelId ?? "eleven_v3";
  const selectedModelLabel =
    selectedModel === "eleven_v3" ? "Eleven v3" : "Eleven Multilingual v2";
  const pricingPerThousand = "$0.10 / 1K characters";
  const formatCostEstimate = (chars: number) => {
    if (!chars) {
      return "Waiting for script";
    }
    const cost = (chars / 1000) * 0.1;
    return `${chars.toLocaleString()} chars → ~$${cost.toFixed(2)}`;
  };
  const modelOptions = [
    {
      id: "eleven_v3" as const,
      label: "Eleven v3",
      description: "Expressive delivery with narration audio tags.",
      limit: "≈5,000 chars • ~3 minutes",
      chars: taggedChars,
      scriptNote: audioTaggedNarration
        ? "Using narration audio tags."
        : "Audio tags missing — falling back to cleaned narration.",
    },
    {
      id: "eleven_multilingual_v2" as const,
      label: "Eleven Multilingual v2",
      description: "Long-form, tag-free narration (multilingual).",
      limit: "≈10,000 chars • ~10 minutes",
      chars: cleanChars,
      scriptNote: "Always uses the cleaned narration from the previous step.",
    },
  ];

  const statusLabel =
    status === "success"
      ? "Complete"
      : status === "running"
        ? "Generating"
        : status === "error"
          ? "Needs attention"
          : "Ready";

  const statusToneClasses =
    status === "success"
      ? "text-emerald-200"
      : status === "error"
        ? "text-rose-200"
        : status === "running"
          ? "text-amber-200"
          : "text-zinc-400";

  const buttonDisabled = !narrationReady || isRunning;

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            {stepConfig.label}
          </p>
          <p className="text-sm text-zinc-400">
            Choose an ElevenLabs voice model and render the final narration audio.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span
            className={`text-[0.6rem] font-semibold uppercase tracking-[0.3em] ${statusToneClasses}`}
          >
            {statusLabel}
          </span>
          <Button
            variant="outline"
            className="rounded-2xl border border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white disabled:opacity-60"
            disabled={buttonDisabled}
            onClick={() => actions.runNarrationAudioStep()}
            title={
              narrationReady
                ? undefined
                : "Generate the narration script before running this step."
            }
          >
            {isRunning ? "Generating…" : `Generate voice • ${selectedModelLabel}`}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-900/70 bg-zinc-950/50 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300">
              Voice model & pricing
            </p>
            <p className="text-sm text-zinc-400">
              fal.ai (running ElevenLabs TTS) charges {pricingPerThousand}. Estimates update with your script length.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {modelOptions.map((option) => {
            const isSelected = option.id === selectedModel;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => actions.setNarrationModel(option.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? "border-white/60 bg-white/10 text-white"
                    : "border-zinc-900 bg-transparent text-zinc-200 hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="text-xs text-zinc-400">{option.description}</p>
                  </div>
                  {isSelected && (
                    <span className="text-[0.55rem] font-semibold uppercase tracking-[0.35em] text-emerald-200">
                      Active
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-zinc-300">{option.limit}</p>
                <p className="text-xs text-zinc-500">{option.scriptNote}</p>
                <p className="mt-3 text-xs text-zinc-400">
                  {formatCostEstimate(option.chars)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {!narrationReady && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          Run the Script → Narration Cleaner (and Audio Tags for Eleven v3) steps before
          creating the voiceover.
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
        >
          {errorMessage}
        </div>
      )}

      {audioUrl && (
        <div className="space-y-2">
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <a
              href={audioUrl}
              download={`${slug || "voiceover"}-script.mp3`}
              className="text-white underline-offset-4 hover:underline"
            >
              Download audio
            </a>
            {generationTimeText && (
              <span className="text-xs text-zinc-500">Generated in {generationTimeText}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ThumbnailGenerationStep({
  stepConfig,
  state,
  actions,
}: {
  stepConfig: StepConfig;
  state: UseAgentPipelineReturn["state"];
  actions: UseAgentPipelineReturn["actions"];
}) {
  const inlineThumbnailSrc =
    state.thumbnailImage?.mimeType && state.thumbnailImage?.data
      ? `data:${state.thumbnailImage.mimeType};base64,${state.thumbnailImage.data}`
      : undefined;
  const thumbnailSrc = inlineThumbnailSrc ?? state.thumbnailImage?.url ?? undefined;
  const promptReady = Boolean(state.pipeline.thumbnailPrompt?.trim());
  const stepState = state.pipeline.steps[stepConfig.id];
  const status = stepState?.status ?? "idle";
  const isRunning = state.isGeneratingThumbnail || status === "running";
  const statusLabel =
    status === "success"
      ? "Complete"
      : status === "running"
        ? "Generating"
        : status === "error"
          ? "Needs attention"
          : "Ready";
  const statusToneClasses =
    status === "success"
      ? "text-emerald-200"
      : status === "error"
        ? "text-rose-200"
        : status === "running"
          ? "text-amber-200"
          : "text-zinc-400";
  const buttonDisabled = isRunning || !promptReady;
  const errorMessage = stepState?.errorMessage ?? state.thumbnailError;

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            {stepConfig.label}
          </p>
          <p className="text-sm text-zinc-400">
            Render the latest thumbnail prompt with Gemini 3 Pro Image Preview.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span className={`text-[0.6rem] font-semibold uppercase tracking-[0.3em] ${statusToneClasses}`}>
            {statusLabel}
          </span>
          <Button
            variant="outline"
            className="rounded-2xl border border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white disabled:opacity-60"
            disabled={buttonDisabled}
            onClick={actions.generateThumbnail}
            title={
              promptReady
                ? undefined
                : "Generate a thumbnail prompt before running this step."
            }
          >
            {state.isGeneratingThumbnail ? "Generating…" : "Generate thumbnail"}
          </Button>
        </div>
      </div>

      {!promptReady && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          Create a thumbnail prompt before rendering the image.
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
        >
          {errorMessage}
        </div>
      )}

      {thumbnailSrc ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailSrc} alt="Generated thumbnail" className="w-full" />
          </div>
          <div className="flex items-center justify-between">
            {state.thumbnailGenerationTime !== null ? (
              <span className="text-xs text-zinc-500">
                Generated in {(state.thumbnailGenerationTime / 1000).toFixed(1)}s
              </span>
            ) : (
              <span className="text-xs text-zinc-500">Generation complete</span>
            )}
            <Button
              variant="ghost"
              className="h-8 rounded-full px-4 text-sm text-white hover:bg-white/10 hover:text-white"
              onClick={actions.downloadThumbnail}
            >
              Download image
            </Button>
          </div>

          <ThumbnailMetricsPanel state={state} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800/60 bg-zinc-950/40 p-4 text-sm text-zinc-400">
          Run this step to render the thumbnail frame once your prompt looks good.
        </div>
      )}
    </div>
  );
}

function ThumbnailMetricsPanel({
  state,
}: {
  state: UseAgentPipelineReturn["state"];
}) {
  type MetricTileDescriptor = {
    label: string;
    value: string;
    accent?: boolean;
  };

  const durationValue =
    state.thumbnailGenerationTime !== null
      ? `${(state.thumbnailGenerationTime / 1000).toFixed(1)}s`
      : "—";
  const metrics = state.thumbnailMetrics;
  const hasActualMetrics =
    Boolean(metrics) &&
    (typeof metrics?.inputTokens === "number" ||
      typeof metrics?.outputTokens === "number" ||
      typeof metrics?.totalTokens === "number" ||
      typeof metrics?.costUsd === "number");

  const formatTokens = (value?: number | null) =>
    typeof value === "number" ? value.toLocaleString() : "—";
  const formatCost = (value?: number | null) =>
    typeof value === "number" ? `$${value.toFixed(4)}` : "—";

  const metricTiles: MetricTileDescriptor[] = hasActualMetrics
    ? [
        {
          label: "Input tokens",
          value: formatTokens(metrics?.inputTokens),
        },
        {
          label: "Output tokens",
          value: formatTokens(metrics?.outputTokens),
        },
        {
          label: "Total tokens",
          value: formatTokens(metrics?.totalTokens),
        },
        {
          label: "Cost (USD)",
          value: formatCost(metrics?.costUsd),
          accent: true,
        },
      ]
    : [
        {
          label: "Input tokens",
          value: GEMINI_THUMBNAIL_TOKEN_RANGE_TEXT,
        },
        {
          label: "Output tokens",
          value: "Image data (n/a)",
        },
        {
          label: "Total tokens",
          value: GEMINI_THUMBNAIL_TOKEN_RANGE_TEXT,
        },
        {
          label: "Est. cost (USD)",
          value: GEMINI_THUMBNAIL_COST_RANGE_TEXT,
          accent: true,
        },
      ];

  const gridTiles: MetricTileDescriptor[] = [
    ...metricTiles,
    {
      label: "Duration",
      value: durationValue,
    },
  ];

  const noteText = hasActualMetrics
    ? `Gemini bills image tokens at ${GEMINI_THUMBNAIL_PRICE_TEXT}. Values above reflect this run.`
    : `Gemini bills image tokens at ${GEMINI_THUMBNAIL_PRICE_TEXT}. Showing the typical range until we can read billing metadata from the API.`;

  return (
    <div className="rounded-2xl border border-zinc-900/80 bg-zinc-950/50 p-4">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
        Thumbnail run metrics (Gemini 3 Pro 1K-4K)
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {gridTiles.map((tile) => (
          <ThumbnailMetricTile
            key={`${tile.label}-${tile.value}`}
            label={tile.label}
            value={tile.value}
            accent={tile.accent}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">{noteText}</p>
    </div>
  );
}

function ThumbnailMetricTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? "border-white/30 bg-white/10 text-white" : "border-zinc-900 bg-zinc-950/70"
      }`}
    >
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

// ============================================
// Video Generation Steps
// ============================================

function CharacterReferenceStep({
  stepConfig,
  state,
  actions,
}: {
  stepConfig: StepConfig;
  state: UseAgentPipelineReturn["state"];
  actions: UseAgentPipelineReturn["actions"];
}) {
  const stepState = state.pipeline.steps[stepConfig.id];
  const status = stepState?.status ?? "idle";
  const hasProductionScript = Boolean(state.pipeline.productionScript?.characterSheet?.mainChild);
  const hasReferenceImage = Boolean(state.pipeline.characterReferenceImage);
  const characterDescription = state.pipeline.productionScript?.characterSheet?.mainChild;
  const errorMessage = state.characterReferenceError ?? stepState?.errorMessage;
  
  // If we have the image, treat as complete regardless of status (handles saved state)
  const effectiveStatus = hasReferenceImage && status !== "error" ? "success" : status;
  const isRunning = state.isGeneratingCharacterReference || (effectiveStatus === "running");

  const statusLabel =
    effectiveStatus === "success"
      ? "Complete"
      : effectiveStatus === "error"
        ? "Error"
        : isRunning
          ? "Generating..."
          : "Not started";

  const statusColor =
    effectiveStatus === "success"
      ? "text-emerald-400"
      : effectiveStatus === "error"
        ? "text-rose-400"
        : isRunning
          ? "text-amber-200"
          : "text-zinc-400";

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{stepConfig.label}</h3>
          <p className="text-sm text-zinc-400">
            Generate a reference image for character consistency across all scenes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
          <Button
            size="sm"
            className="rounded-full bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
            onClick={() => actions.generateCharacterReferenceImage()}
            disabled={isRunning || !hasProductionScript}
            title={!hasProductionScript ? "Run Production Script first to get character sheet" : undefined}
          >
            {isRunning ? "Generating..." : hasReferenceImage ? "Regenerate" : "Generate Reference"}
          </Button>
        </div>
      </div>

      {!hasProductionScript && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Run the Production Script step first to generate a character sheet.
        </div>
      )}

      {characterDescription && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Character Description
          </p>
          <p className="text-sm text-zinc-300">{characterDescription}</p>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {errorMessage}
        </div>
      )}

      {hasReferenceImage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
            Character Reference Ready
          </p>
          <p className="text-sm text-emerald-200 mb-4">
            This reference image will be used to maintain character consistency across all scene images.
          </p>
          <div className="relative overflow-hidden rounded-lg border border-emerald-500/20">
            <img
              src={`data:image/png;base64,${state.pipeline.characterReferenceImage}`}
              alt="Character reference"
              className="w-full max-w-md mx-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

type FrameKind = "first" | "last";

interface FrameTile {
  sceneNumber: number;
  frameKind: FrameKind;
  imageUrl: string;
}

function SceneImagesStep({
  stepConfig,
  state,
  actions,
}: {
  stepConfig: StepConfig;
  state: UseAgentPipelineReturn["state"];
  actions: UseAgentPipelineReturn["actions"];
}) {
  const stepState = state.pipeline.steps[stepConfig.id];
  const status = stepState?.status ?? "idle";
  const isRunning = state.isGeneratingSceneImages || status === "running";
  const progress = state.sceneImagesProgress;
  const sceneAssets = state.pipeline.sceneAssets;
  const hasPrompts = sceneAssets?.some((s) => s.imagePrompt);
  const completedCount = sceneAssets?.filter((s) => s.imageUrl).length ?? 0;
  const totalCount = sceneAssets?.length ?? 0;
  const hasScenePreviews = Boolean(sceneAssets?.some((s) => s.imageUrl));
  const previewLimitValue =
    typeof state.pipeline.scenePreviewLimit === "number"
      ? state.pipeline.scenePreviewLimit.toString()
      : "";
  const [selectedSceneNumber, setSelectedSceneNumber] = useState<number | null>(null);
  const [selectedFrameKind, setSelectedFrameKind] = useState<FrameKind>("first");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Build flat list of frame tiles (first + last for each scene)
  const frameTiles = useMemo<FrameTile[]>(() => {
    if (!sceneAssets) return [];
    const tiles: FrameTile[] = [];
    for (const scene of sceneAssets) {
      if (scene.imageUrl) {
        tiles.push({
          sceneNumber: scene.sceneNumber,
          frameKind: "first",
          imageUrl: scene.imageUrl,
        });
      }
      if (scene.lastFrameImageUrl) {
        tiles.push({
          sceneNumber: scene.sceneNumber,
          frameKind: "last",
          imageUrl: scene.lastFrameImageUrl,
        });
      }
    }
    // Sort by scene number, then first before last
    tiles.sort((a, b) => {
      if (a.sceneNumber !== b.sceneNumber) return a.sceneNumber - b.sceneNumber;
      return a.frameKind === "first" ? -1 : 1;
    });
    return tiles;
  }, [sceneAssets]);

  const sceneTimingMap = useMemo(() => {
    const scenes = state.pipeline.productionScript?.scenes;
    const timingMap = new Map<number, { start: number; end: number }>();
    if (!scenes || scenes.length === 0) {
      return timingMap;
    }
    let elapsed = 0;
    scenes.forEach((scene) => {
      const duration = Math.max(scene.estimatedDurationSec ?? 0, 0);
      const start = elapsed;
      const end = start + duration;
      timingMap.set(scene.sceneNumber, { start, end });
      elapsed = end;
    });
    return timingMap;
  }, [state.pipeline.productionScript]);

  const selectedSceneAsset = useMemo(() => {
    if (selectedSceneNumber === null || !sceneAssets) {
      return null;
    }
    return sceneAssets.find((scene) => scene.sceneNumber === selectedSceneNumber) ?? null;
  }, [sceneAssets, selectedSceneNumber]);

  useEffect(() => {
    if (isLightboxOpen && !selectedSceneAsset) {
      setIsLightboxOpen(false);
    }
  }, [isLightboxOpen, selectedSceneAsset]);

  const selectedTiming =
    selectedSceneNumber !== null ? sceneTimingMap.get(selectedSceneNumber) : undefined;

  const handleOpenLightbox = (sceneNumber: number, frameKind: FrameKind) => {
    setSelectedSceneNumber(sceneNumber);
    setSelectedFrameKind(frameKind);
    setIsLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
    setSelectedSceneNumber(null);
  };

  const handlePromptChange = (nextPrompt: string) => {
    if (selectedSceneNumber !== null) {
      actions.updateSceneImagePrompt(selectedSceneNumber, nextPrompt, selectedFrameKind);
    }
  };

  const handleRegenerate = () => {
    if (selectedSceneNumber !== null) {
      actions.regenerateSceneImage(selectedSceneNumber, selectedFrameKind);
    }
  };

  const handleDownload = () => {
    if (selectedSceneNumber !== null) {
      actions.downloadSceneImage(selectedSceneNumber, selectedFrameKind);
    }
  };
  
  const statusLabel =
    status === "success"
      ? "Complete"
      : status === "running"
        ? `Generating ${progress?.completed ?? 0}/${progress?.total ?? 0}`
        : status === "error"
          ? "Needs attention"
          : "Ready";

  const statusToneClasses =
    status === "success"
      ? "text-emerald-200"
      : status === "error"
        ? "text-rose-200"
        : status === "running"
          ? "text-amber-200"
          : "text-zinc-400";

  const buttonDisabled = isRunning || !hasPrompts;
  const errorMessage = state.sceneImagesError ?? stepState?.errorMessage;

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            {stepConfig.label}
          </p>
          <p className="text-sm text-zinc-400">
            Generate first &amp; last frame images for each scene using Gemini. {completedCount}/{totalCount} complete.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span className={`text-[0.6rem] font-semibold uppercase tracking-[0.3em] ${statusToneClasses}`}>
            {statusLabel}
          </span>
          <Button
            variant="outline"
            className="rounded-2xl border border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white disabled:opacity-60"
            disabled={buttonDisabled}
            onClick={actions.generateSceneImages}
            title={hasPrompts ? undefined : "Generate image prompts first."}
          >
            {isRunning ? "Generating…" : "Generate images"}
          </Button>
        </div>
      </div>

      {!hasPrompts && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          Run the Scene Image Prompts step first to generate prompts.
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
        >
          {errorMessage}
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-zinc-900/80 bg-zinc-950/40 p-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Run scope
          </p>
          {typeof state.pipeline.scenePreviewLimit === "number" && state.pipeline.scenePreviewLimit > 0 ? (
            <span className="text-xs text-emerald-200">
              Previewing first {state.pipeline.scenePreviewLimit} scenes
            </span>
          ) : (
            <span className="text-xs text-zinc-400">All scenes</span>
          )}
        </div>
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="e.g. 5"
          value={previewLimitValue}
          onChange={(event) => {
            const raw = event.target.value;
            if (!raw) {
              actions.setScenePreviewLimit(null);
              return;
            }
            const parsed = Number(raw);
            actions.setScenePreviewLimit(Number.isFinite(parsed) ? parsed : null);
          }}
          className="h-11 rounded-2xl border-zinc-800 bg-zinc-950/80 text-sm text-white placeholder:text-zinc-500"
        />
        <p className="text-xs text-zinc-500">
          Number of scenes to generate. Each scene produces 2 images (first &amp; last frame), e.g. 5 scenes → 10 images. Leave blank or 0 to render every scene.
        </p>
      </div>

      {progress && isRunning && (
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Processing scene {Math.min(progress.completed + 1, progress.total)} of {progress.total}...
          </p>
        </div>
      )}

      {hasScenePreviews && frameTiles.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {frameTiles.slice(0, 16).map((tile) => (
            <button
              key={`${tile.sceneNumber}-${tile.frameKind}`}
              type="button"
              onClick={() => handleOpenLightbox(tile.sceneNumber, tile.frameKind)}
              className="group relative aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-black/30 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tile.imageUrl}
                alt={`Scene ${tile.sceneNumber} ${tile.frameKind} frame`}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-white">
                Shot {String(tile.sceneNumber).padStart(2, "0")} – {tile.frameKind === "first" ? "First" : "Last"}
              </span>
            </button>
          ))}
          {frameTiles.length > 16 && (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50">
              <span className="text-xs text-zinc-500">+{frameTiles.length - 16} more</span>
            </div>
          )}
        </div>
      )}

      <SceneImageLightbox
        open={isLightboxOpen && Boolean(selectedSceneAsset)}
        sceneAsset={selectedSceneAsset}
        frameKind={selectedFrameKind}
        timeRange={selectedTiming}
        onClose={handleCloseLightbox}
        onPromptChange={handlePromptChange}
        onRegenerate={handleRegenerate}
        onDownload={handleDownload}
      />
    </div>
  );
}

function SceneVideosStep({
  stepConfig,
  state,
  actions,
}: {
  stepConfig: StepConfig;
  state: UseAgentPipelineReturn["state"];
  actions: UseAgentPipelineReturn["actions"];
}) {
  const stepState = state.pipeline.steps[stepConfig.id];
  const status = stepState?.status ?? "idle";
  const isRunning = state.isGeneratingSceneVideos || status === "running";
  const progress = state.sceneVideosProgress;
  const sceneAssets = state.pipeline.sceneAssets;
  const hasReadyScenes = sceneAssets?.some((s) => s.imageUrl && s.videoPrompt);
  const completedCount = sceneAssets?.filter((s) => s.videoUrl).length ?? 0;
  const totalCount = sceneAssets?.filter((s) => s.imageUrl && s.videoPrompt).length ?? 0;
  const previewLimit = state.pipeline.scenePreviewLimit;

  // Debug: breakdown of scene readiness
  const totalScenes = sceneAssets?.length ?? 0;
  const scenesWithImage = sceneAssets?.filter((s) => s.imageUrl).length ?? 0;
  const scenesWithVideoPrompt = sceneAssets?.filter((s) => s.videoPrompt).length ?? 0;
  const readySceneCount = sceneAssets?.filter((s) => s.imageUrl && s.videoPrompt).length ?? 0;
  
  // Get scene numbers for debugging mismatches
  const sceneNumbersWithImage = sceneAssets?.filter((s) => s.imageUrl).map((s) => s.sceneNumber) ?? [];
  const sceneNumbersWithVideoPrompt = sceneAssets?.filter((s) => s.videoPrompt).map((s) => s.sceneNumber) ?? [];
  const readySceneNumbers = sceneAssets?.filter((s) => s.imageUrl && s.videoPrompt).map((s) => s.sceneNumber) ?? [];

  // Video clips ready for display
  const videoClips = useMemo(() => {
    if (!sceneAssets) return [];
    return sceneAssets
      .filter((s) => s.videoUrl)
      .sort((a, b) => a.sceneNumber - b.sceneNumber);
  }, [sceneAssets]);

  // Lightbox state
  const [selectedVideoScene, setSelectedVideoScene] = useState<number | null>(null);
  const [isVideoLightboxOpen, setIsVideoLightboxOpen] = useState(false);

  const selectedVideoAsset = useMemo(() => {
    if (selectedVideoScene === null || !sceneAssets) return null;
    return sceneAssets.find((s) => s.sceneNumber === selectedVideoScene) ?? null;
  }, [sceneAssets, selectedVideoScene]);

  const handleOpenVideoLightbox = (sceneNumber: number) => {
    setSelectedVideoScene(sceneNumber);
    setIsVideoLightboxOpen(true);
  };

  const handleCloseVideoLightbox = () => {
    setIsVideoLightboxOpen(false);
    setSelectedVideoScene(null);
  };

  const statusLabel =
    status === "success"
      ? "Complete"
      : status === "running"
        ? `Generating ${progress?.completed ?? 0}/${progress?.total ?? 0}`
        : status === "error"
          ? "Needs attention"
          : "Ready";

  const statusToneClasses =
    status === "success"
      ? "text-emerald-200"
      : status === "error"
        ? "text-rose-200"
        : status === "running"
          ? "text-amber-200"
          : "text-zinc-400";

  const buttonDisabled = isRunning || !hasReadyScenes;
  const errorMessage = state.sceneVideosError ?? stepState?.errorMessage;

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            {stepConfig.label}
          </p>
          <p className="text-sm text-zinc-400">
            Animate scene images using fal.ai WAN 2.2. {completedCount}/{totalCount} complete.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span className={`text-[0.6rem] font-semibold uppercase tracking-[0.3em] ${statusToneClasses}`}>
            {statusLabel}
          </span>
          <Button
            variant="outline"
            className="rounded-2xl border border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white disabled:opacity-60"
            disabled={buttonDisabled}
            onClick={actions.generateSceneVideos}
            title={hasReadyScenes ? undefined : "Generate scene images and video prompts first."}
          >
            {isRunning ? "Generating…" : "Generate videos"}
          </Button>
        </div>
      </div>

      {!hasReadyScenes && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          Generate scene images and video prompts before creating video clips.
        </div>
      )}

      {/* Debug panel: Scene readiness breakdown */}
      {totalScenes > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Scene Readiness Debug
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-500">Total Scenes</p>
              <p className="text-lg font-semibold text-white">{totalScenes}</p>
            </div>
            <div className={`rounded-xl border p-3 ${scenesWithImage > 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950/60"}`}>
              <p className="text-xs text-zinc-500">With Image</p>
              <p className={`text-lg font-semibold ${scenesWithImage > 0 ? "text-emerald-200" : "text-zinc-400"}`}>{scenesWithImage}</p>
            </div>
            <div className={`rounded-xl border p-3 ${scenesWithVideoPrompt > 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950/60"}`}>
              <p className="text-xs text-zinc-500">With Video Prompt</p>
              <p className={`text-lg font-semibold ${scenesWithVideoPrompt > 0 ? "text-emerald-200" : "text-zinc-400"}`}>{scenesWithVideoPrompt}</p>
            </div>
            <div className={`rounded-xl border p-3 ${readySceneCount > 0 ? "border-white/30 bg-white/10" : "border-rose-500/30 bg-rose-500/10"}`}>
              <p className="text-xs text-zinc-500">Ready (Both)</p>
              <p className={`text-lg font-semibold ${readySceneCount > 0 ? "text-white" : "text-rose-200"}`}>{readySceneCount}</p>
            </div>
          </div>
          
          {/* Show scene number details if there's a mismatch */}
          {scenesWithImage > 0 && scenesWithVideoPrompt > 0 && readySceneCount === 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-2">
              <p className="text-xs font-semibold text-rose-200">Scene Number Mismatch Detected</p>
              <p className="text-xs text-rose-100">
                Images on scenes: {sceneNumbersWithImage.join(", ") || "none"}
              </p>
              <p className="text-xs text-rose-100">
                Video prompts on scenes: {sceneNumbersWithVideoPrompt.join(", ") || "none"}
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                The scene numbers don&apos;t overlap. This usually means the video prompts step created new scene entries instead of updating existing ones.
              </p>
            </div>
          )}
          
          {/* Show ready scene numbers when available */}
          {readySceneCount > 0 && (
            <p className="text-xs text-zinc-500">
              Ready scenes: {readySceneNumbers.join(", ")}
            </p>
          )}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
        >
          {errorMessage}
        </div>
      )}

      {progress && isRunning && (
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Generating video clip {progress.completed + 1} of {progress.total}...
            <br />
            <span className="text-zinc-600">Each clip takes 2-5 minutes to generate.</span>
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-900/80 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-400">
        {typeof previewLimit === "number" && previewLimit > 0 ? (
          <>
            This run will animate only the first {previewLimit} ready scenes. Update the limit above
            if you need more.
          </>
        ) : (
          "Currently set to animate every ready scene. Set a preview limit above to trim the run."
        )}
      </div>

      {completedCount > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            ✅ {completedCount} video clips generated
          </p>
          
          {/* Video clips grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {videoClips.slice(0, 8).map((clip) => (
              <button
                key={clip.sceneNumber}
                type="button"
                onClick={() => handleOpenVideoLightbox(clip.sceneNumber)}
                className="group relative aspect-video overflow-hidden rounded-xl border border-emerald-500/20 bg-black/30 text-left transition hover:border-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {/* Use image as thumbnail */}
                {clip.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={clip.imageUrl}
                    alt={`Scene ${clip.sceneNumber} video`}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-900">
                    <span className="text-xs text-zinc-500">No thumbnail</span>
                  </div>
                )}
                
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-80 transition group-hover:opacity-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg">
                    <svg
                      className="ml-0.5 h-5 w-5 text-zinc-900"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                
                {/* Scene label */}
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-white">
                  Shot {String(clip.sceneNumber).padStart(2, "0")}
                </span>
                
                {/* Duration badge - shows target duration if available */}
                {clip.targetDurationSec !== undefined && (
                  <span className="absolute right-2 bottom-2 rounded-full bg-black/70 px-1.5 py-0.5 text-[0.5rem] font-medium text-emerald-300">
                    {clip.targetDurationSec.toFixed(1)}s
                  </span>
                )}
              </button>
            ))}
            
            {videoClips.length > 8 && (
              <div className="flex aspect-video items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-950/30">
                <span className="text-xs text-emerald-300">+{videoClips.length - 8} more</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video lightbox */}
      <VideoClipLightbox
        open={isVideoLightboxOpen && Boolean(selectedVideoAsset?.videoUrl)}
        sceneAsset={selectedVideoAsset}
        onClose={handleCloseVideoLightbox}
      />
    </div>
  );
}

function VideoClipLightbox({
  open,
  sceneAsset,
  onClose,
}: {
  open: boolean;
  sceneAsset: SceneAsset | null;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  // Pause video when closing
  useEffect(() => {
    if (!open && videoRef.current) {
      videoRef.current.pause();
    }
  }, [open]);

  if (!open || !sceneAsset || !sceneAsset.videoUrl) {
    return null;
  }

  const dialogTitleId = `video-lightbox-title-${sceneAsset.sceneNumber}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-4xl space-y-4 rounded-3xl border border-white/10 bg-zinc-950/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.7)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/5 p-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <p
            id={dialogTitleId}
            className="text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-zinc-400"
          >
            Video clip preview
          </p>
          <p className="text-2xl font-semibold text-white">
            Shot {String(sceneAsset.sceneNumber).padStart(2, "0")}
          </p>
          {/* Audio-synced clip metadata */}
          {(sceneAsset.targetDurationSec !== undefined || sceneAsset.generatedNumFrames !== undefined) && (
            <p className="mt-1 text-xs text-zinc-500">
              {sceneAsset.targetDurationSec !== undefined && (
                <span className="mr-3">
                  Target: <span className="text-emerald-400">{sceneAsset.targetDurationSec.toFixed(2)}s</span>
                </span>
              )}
              {sceneAsset.generatedNumFrames !== undefined && (
                <span>
                  Frames: <span className="text-amber-400">{sceneAsset.generatedNumFrames}</span>
                </span>
              )}
            </p>
          )}
        </div>

        <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
          <video
            ref={videoRef}
            src={sceneAsset.videoUrl}
            controls
            autoPlay
            className="h-full w-full object-contain"
          />
        </div>

        {sceneAsset.videoPrompt && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Video Prompt
            </p>
            <p className="text-sm text-zinc-300">{sceneAsset.videoPrompt}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <a
            href={sceneAsset.videoUrl}
            download={`scene-${String(sceneAsset.sceneNumber).padStart(2, "0")}.mp4`}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition"
          >
            <Download className="h-4 w-4" />
            Download clip
          </a>
        </div>
      </div>
    </div>
  );
}

function VideoAssemblyStep({
  stepConfig,
  state,
  actions,
}: {
  stepConfig: StepConfig;
  state: UseAgentPipelineReturn["state"];
  actions: UseAgentPipelineReturn["actions"];
}) {
  const [filename, setFilename] = useState("final-video");
  const stepState = state.pipeline.steps[stepConfig.id];
  const status = stepState?.status ?? "idle";
  const isRunning = state.isAssemblingVideo || status === "running";
  const sceneAssets = state.pipeline.sceneAssets;
  const hasVideos = sceneAssets?.some((s) => s.videoUrl);
  const hasAudio = Boolean(state.scriptAudioUrl);
  const canAssemble = hasVideos && hasAudio;
  const finalVideoPath = state.pipeline.finalVideoPath;

  const statusLabel =
    status === "success"
      ? "Complete"
      : status === "running"
        ? state.videoAssemblyProgress || "Assembling"
        : status === "error"
          ? "Needs attention"
          : "Ready";

  const statusToneClasses =
    status === "success"
      ? "text-emerald-200"
      : status === "error"
        ? "text-rose-200"
        : status === "running"
          ? "text-amber-200"
          : "text-zinc-400";

  const buttonDisabled = isRunning || !canAssemble;
  const errorMessage = state.videoAssemblyError ?? stepState?.errorMessage;

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            {stepConfig.label}
          </p>
          <p className="text-sm text-zinc-400">
            Combine video clips with narration audio into the final video.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span className={`text-[0.6rem] font-semibold uppercase tracking-[0.3em] ${statusToneClasses}`}>
            {statusLabel}
          </span>
          <Button
            variant="outline"
            className="rounded-2xl border border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white disabled:opacity-60"
            disabled={buttonDisabled}
            onClick={() => actions.assembleVideo(filename || undefined)}
            title={canAssemble ? undefined : "Generate video clips and narration audio first."}
          >
            {isRunning ? "Assembling…" : "Assemble video"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-filename" className="text-sm text-zinc-400">
          Output filename
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="video-filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="final-video"
            disabled={isRunning}
            className="flex-1 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500"
          />
          <span className="text-sm text-zinc-500">.mp4</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-3 py-1 text-xs ${hasVideos ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-800 text-zinc-500"}`}>
          {hasVideos ? "✓" : "○"} Video clips
        </span>
        <span className={`rounded-full px-3 py-1 text-xs ${hasAudio ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-800 text-zinc-500"}`}>
          {hasAudio ? "✓" : "○"} Narration audio
        </span>
      </div>

      {!canAssemble && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          {!hasVideos && "Generate scene videos first. "}
          {!hasAudio && "Generate narration audio first."}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
        >
          {errorMessage}
        </div>
      )}

      {state.videoAssemblyProgress && isRunning && (
        <div className="rounded-2xl border border-zinc-900/80 bg-zinc-950/50 p-4">
          <p className="text-sm text-zinc-300">{state.videoAssemblyProgress}</p>
        </div>
      )}

      {finalVideoPath && status === "success" && (
        <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm text-emerald-100">🎬 Video assembly complete!</p>
          <p className="text-xs text-zinc-400">Output: {finalVideoPath}</p>
        </div>
      )}
    </div>
  );
}

type SceneTimeRange = {
  start: number;
  end: number;
};

function SceneImageLightbox({
  open,
  sceneAsset,
  frameKind = "first",
  timeRange,
  onClose,
  onPromptChange,
  onRegenerate,
  onDownload,
}: {
  open: boolean;
  sceneAsset: SceneAsset | null;
  frameKind?: FrameKind;
  timeRange?: SceneTimeRange;
  onClose: () => void;
  onPromptChange: (prompt: string) => void;
  onRegenerate: () => void;
  onDownload: () => void;
}) {
  // Determine which prompt to show based on frame kind
  const currentPrompt =
    frameKind === "last"
      ? sceneAsset?.lastFrameImagePrompt ?? ""
      : sceneAsset?.imagePrompt ?? "";
  const currentImageUrl =
    frameKind === "last"
      ? sceneAsset?.lastFrameImageUrl
      : sceneAsset?.imageUrl;

  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState(currentPrompt);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setPromptDraft(currentPrompt);
    setIsEditingPrompt(false);
  }, [currentPrompt]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !sceneAsset) {
    return null;
  }

  const dialogTitleId = `scene-lightbox-title-${sceneAsset.sceneNumber}-${frameKind}`;
  const formattedTimeRange = formatSceneTimeRange(timeRange);
  const isRegenerating = sceneAsset.status === "generating";
  const canDownload = Boolean(currentImageUrl);
  const canRegenerate = Boolean(currentPrompt);
  const frameLabel = frameKind === "first" ? "First Frame" : "Last Frame";

  const handlePromptSave = () => {
    onPromptChange(promptDraft.trim());
    setIsEditingPrompt(false);
  };

  const focusPrompt = () => {
    window.setTimeout(() => {
      promptRef.current?.focus();
      promptRef.current?.setSelectionRange(promptDraft.length, promptDraft.length);
    }, 0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-5xl space-y-6 rounded-3xl border border-white/10 bg-zinc-950/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.7)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/5 p-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-4">
            <div>
              <p
                id={dialogTitleId}
                className="text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-zinc-400"
              >
                Scene preview – {frameLabel}
              </p>
              <p className="text-2xl font-semibold text-white">
                Shot {String(sceneAsset.sceneNumber).padStart(2, "0")}
              </p>
              {formattedTimeRange && (
                <p className="text-sm text-zinc-400">Timestamp {formattedTimeRange}</p>
              )}
            </div>

            {currentImageUrl ? (
              <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImageUrl}
                  alt={`Scene ${sceneAsset.sceneNumber} ${frameLabel}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 text-sm text-zinc-400">
                No image generated for this frame yet.
              </div>
            )}

            {sceneAsset.errorMessage && (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
                {sceneAsset.errorMessage}
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/4 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-400">
                Prompt
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full text-[0.6rem] font-semibold uppercase tracking-[0.3em]"
                onClick={() => {
                  if (isEditingPrompt) {
                    handlePromptSave();
                  } else {
                    setIsEditingPrompt(true);
                    focusPrompt();
                  }
                }}
              >
                <PenLine className="h-4 w-4" />
                {isEditingPrompt ? "Save" : "Edit"}
              </Button>
            </div>

            <textarea
              ref={promptRef}
              value={promptDraft}
              disabled={!isEditingPrompt}
              onChange={(event) => setPromptDraft(event.target.value)}
              className="min-h-[160px] w-full resize-none rounded-2xl border border-white/20 bg-zinc-900/60 p-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/60 focus:outline-none disabled:opacity-70"
            />

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={onRegenerate}
                disabled={!canRegenerate || isRegenerating}
                className="gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-white hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
                {isRegenerating ? "Regenerating…" : "Regenerate"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onDownload}
                disabled={!canDownload}
                className="gap-2 rounded-full px-5 text-white disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>

            <p className="text-xs text-zinc-500">
              Use the pencil icon to tweak this prompt, then click regenerate to refresh the shot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatSceneTimeRange(range?: SceneTimeRange) {
  if (!range) {
    return null;
  }
  const start = formatSceneTimestamp(range.start);
  const end = formatSceneTimestamp(range.end);
  return `${start}–${end}`;
}

function formatSceneTimestamp(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}


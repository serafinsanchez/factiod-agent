"use client";

import { useEffect, useMemo, useRef } from "react";

import { StepEditor } from "./StepEditor";
import { Button } from "@/components/ui/button";
import { slugifyTopic } from "@/lib/slug";
import type { StepConfig, StepId, VariableKey } from "@/types/agent";

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
  onStepCollapseChange: (stepId: StepId, collapsed: boolean) => void;
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
  onStepCollapseChange,
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
                    templateValue={state.promptOverrides[config.id] ?? config.promptTemplate}
                    onRunStep={actions.runStep}
                    onPromptChange={actions.setPromptOverride}
                    onEditVariable={onEditVariable}
                    isCollapsed={isStepCollapsed}
                    onToggleCollapse={() => onStepCollapseChange(config.id, !isStepCollapsed)}
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
  return (
    <div className="space-y-4 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
      {derived.videoScriptStats && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-200">
              Word count
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {derived.videoScriptStats.words.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-400">Aim for ≥ 1,600 words (≈10 minutes).</p>
          </div>
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/80 p-4">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Character count
            </p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {derived.videoScriptStats.characters.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500">Includes spaces and punctuation.</p>
          </div>
        </div>
      )}

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
  const status = stepState?.status ?? "idle";
  const isRunning = state.isGeneratingScriptAudio || status === "running";
  const slug = slugifyTopic(topic);
  const audioUrl = state.scriptAudioUrl;
  const generationTimeText =
    typeof state.scriptAudioGenerationTimeMs === "number"
      ? `${(state.scriptAudioGenerationTimeMs / 1000).toFixed(1)}s`
      : null;
  const errorMessage = state.scriptAudioError ?? stepState?.errorMessage;
  const selectedModel = state.pipeline.narrationModelId ?? "eleven_v3";
  const selectedModelLabel =
    selectedModel === "eleven_v3" ? "Eleven v3" : "Eleven Multilingual v2";
  const pricingPerThousand = "$0.30 / 1K characters";
  const formatCostEstimate = (chars: number) => {
    if (!chars) {
      return "Waiting for script";
    }
    const cost = (chars / 1000) * 0.3;
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
            className="rounded-2xl border border-white/30 bg-transparent text-white hover:bg-white/10 disabled:opacity-60"
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
              ElevenLabs charges {pricingPerThousand}. Estimates update with your script length.
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
            className="rounded-2xl border border-white/30 bg-transparent text-white hover:bg-white/10 disabled:opacity-60"
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
              className="h-8 rounded-full px-4 text-sm text-white hover:bg-white/10"
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


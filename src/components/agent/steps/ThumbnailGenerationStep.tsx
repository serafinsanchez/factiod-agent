"use client";

import { Button } from "@/components/ui/button";
import type { UseAgentPipelineReturn } from "@/hooks/use-agent-pipeline";
import type { StepComponentProps } from "../shared/step-types";

const GEMINI_THUMBNAIL_COST = {
  modelLabel: "Gemini 3 Pro (1K-4K)",
  tokenRange: { min: 1210, max: 2000 },
  pricePerMillionUsd: 20,
  costRangeUsd: { min: 0.024, max: 0.04 },
} as const;

const GEMINI_THUMBNAIL_TOKEN_RANGE_TEXT = `${GEMINI_THUMBNAIL_COST.tokenRange.min.toLocaleString()}-${GEMINI_THUMBNAIL_COST.tokenRange.max.toLocaleString()} tokens`;
const GEMINI_THUMBNAIL_COST_RANGE_TEXT = `$${GEMINI_THUMBNAIL_COST.costRangeUsd.min.toFixed(3)}-$${GEMINI_THUMBNAIL_COST.costRangeUsd.max.toFixed(3)}`;
const GEMINI_THUMBNAIL_PRICE_TEXT = `$${GEMINI_THUMBNAIL_COST.pricePerMillionUsd}/1M tokens`;

export function ThumbnailGenerationStep({
  stepConfig,
  state,
  actions,
}: StepComponentProps) {
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
        { label: "Input tokens", value: formatTokens(metrics?.inputTokens) },
        { label: "Output tokens", value: formatTokens(metrics?.outputTokens) },
        { label: "Total tokens", value: formatTokens(metrics?.totalTokens) },
        { label: "Cost (USD)", value: formatCost(metrics?.costUsd), accent: true },
      ]
    : [
        { label: "Input tokens", value: GEMINI_THUMBNAIL_TOKEN_RANGE_TEXT },
        { label: "Output tokens", value: "Image data (n/a)" },
        { label: "Total tokens", value: GEMINI_THUMBNAIL_TOKEN_RANGE_TEXT },
        { label: "Est. cost (USD)", value: GEMINI_THUMBNAIL_COST_RANGE_TEXT, accent: true },
      ];

  const gridTiles: MetricTileDescriptor[] = [
    ...metricTiles,
    { label: "Duration", value: durationValue },
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
          <div
            key={`${tile.label}-${tile.value}`}
            className={`rounded-2xl border p-4 ${
              tile.accent ? "border-white/30 bg-white/10 text-white" : "border-zinc-900 bg-zinc-950/70"
            }`}
          >
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              {tile.label}
            </p>
            <p className="mt-1 text-xl font-semibold text-white">{tile.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">{noteText}</p>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import type { StepComponentProps } from "../shared/step-types";

export function CharacterReferenceStep({
  stepConfig,
  state,
  actions,
}: StepComponentProps) {
  const stepState = state.pipeline.steps[stepConfig.id];
  const status = stepState?.status ?? "idle";
  const hasProductionScript = Boolean(state.pipeline.productionScript?.characterSheet?.mainChild);
  const hasReferenceImage = Boolean(state.pipeline.characterReferenceImage);
  const characterDescription = state.pipeline.productionScript?.characterSheet?.mainChild;
  const errorMessage = state.characterReferenceError ?? stepState?.errorMessage;
  
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
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

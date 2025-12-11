"use client";

import { Button } from "@/components/ui/button";
import { slugifyTopic } from "@/lib/slug";
import type { NarrationAudioStepProps } from "../shared/step-types";

export function NarrationAudioStep({
  stepConfig,
  state,
  actions,
  topic,
}: NarrationAudioStepProps) {
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
  
  const hasAudioAndNoError = Boolean(audioUrl) && !state.scriptAudioError;
  const status = hasAudioAndNoError && rawStatus === "running" ? "success" : rawStatus;
  
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
          Run the Script QA (and Audio Tags for Eleven v3) steps before creating the voiceover.
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

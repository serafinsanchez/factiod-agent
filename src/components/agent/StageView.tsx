"use client";

import { StepEditor } from "./StepEditor";
import { Button } from "@/components/ui/button";
import { slugifyTopic } from "@/lib/slug";
import type { StepConfig } from "@/types/agent";

import type { UseAgentPipelineReturn } from "@/hooks/use-agent-pipeline";
import type { StageDefinition, StageId } from "./stage-config";

interface StageViewProps {
  stages: StageDefinition[];
  activeStageId: StageId;
  stepConfigs: StepConfig[];
  state: UseAgentPipelineReturn["state"];
  derived: UseAgentPipelineReturn["derived"];
  actions: UseAgentPipelineReturn["actions"];
}

export function StageView({
  stages,
  activeStageId,
  stepConfigs,
  state,
  derived,
  actions,
}: StageViewProps) {
  const stage = stages.find((entry) => entry.id === activeStageId) ?? stages[0];
  const visibleSteps = stepConfigs.filter(
    (config) => !config.hidden && stage.steps.includes(config.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
          {stage.label}
        </p>
        <p className="text-sm text-zinc-400">{stage.description}</p>
      </div>

      <div className="space-y-6">
        {visibleSteps.map((config) => (
          <div key={config.id} className="space-y-4">
            <StepEditor
              stepConfig={config}
              stepState={state.pipeline.steps[config.id]}
              sharedVars={derived.sharedVars}
              templateValue={state.promptOverrides[config.id] ?? config.promptTemplate}
              onRunStep={actions.runStep}
              onPromptChange={actions.setPromptOverride}
              onResetPrompt={actions.resetPromptOverride}
            />

            {config.id === "script" && (
              <ScriptExtras
                state={state}
                derived={derived}
                actions={actions}
                topic={state.pipeline.topic}
              />
            )}

            {config.id === "thumbnail" && (
              <ThumbnailExtras state={state} actions={actions} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScriptExtras({
  state,
  derived,
  actions,
  topic,
}: {
  state: UseAgentPipelineReturn["state"];
  derived: UseAgentPipelineReturn["derived"];
  actions: UseAgentPipelineReturn["actions"];
  topic: string;
}) {
  const slug = slugifyTopic(topic);

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Narration audio
          </p>
          <p className="text-sm text-zinc-400">
            Generate ElevenLabs narration using the cleaned script.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-2xl border border-white/30 bg-transparent text-white hover:bg-white/10 disabled:opacity-60"
          disabled={state.isGeneratingScriptAudio || !derived.hasScript}
          onClick={actions.generateScriptAudio}
        >
          {state.isGeneratingScriptAudio ? "Generating…" : "Generate voice"}
        </Button>
      </div>

      {state.scriptAudioError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
        >
          {state.scriptAudioError}
        </div>
      )}

      {state.scriptAudioUrl && (
        <div className="space-y-2">
          <audio controls src={state.scriptAudioUrl} className="w-full" />
          <a
            href={state.scriptAudioUrl}
            download={`${slug}-script.mp3`}
            className="text-sm text-white underline-offset-4 hover:underline"
          >
            Download audio
          </a>
          {state.scriptAudioGenerationTimeMs !== null && (
            <p className="text-xs text-zinc-500">
              Generated in {(state.scriptAudioGenerationTimeMs / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ThumbnailExtras({
  state,
  actions,
}: {
  state: UseAgentPipelineReturn["state"];
  actions: UseAgentPipelineReturn["actions"];
}) {
  const thumbnailSrc =
    state.thumbnailImage?.url ??
    (state.thumbnailImage?.mimeType && state.thumbnailImage?.data
      ? `data:${state.thumbnailImage.mimeType};base64,${state.thumbnailImage.data}`
      : undefined);

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Thumbnail image
          </p>
          <p className="text-sm text-zinc-400">
            Generate a 16:9 thumbnail prompt with Gemini Nano Banana 2.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-2xl border border-white/30 bg-transparent text-white hover:bg-white/10 disabled:opacity-60"
          disabled={
            state.isGeneratingThumbnail || !state.pipeline.thumbnailPrompt?.trim()
          }
          onClick={actions.generateThumbnail}
        >
          {state.isGeneratingThumbnail ? "Generating…" : "Generate thumbnail"}
        </Button>
      </div>

      {state.thumbnailError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
        >
          {state.thumbnailError}
        </div>
      )}

      {thumbnailSrc && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailSrc} alt="Generated thumbnail" className="w-full" />
          </div>
          <div className="flex items-center justify-between">
            {state.thumbnailGenerationTime !== null && (
              <span className="text-xs text-zinc-500">
                Generated in {(state.thumbnailGenerationTime / 1000).toFixed(1)}s
              </span>
            )}
            <Button
              variant="ghost"
              className="h-8 rounded-full px-4 text-sm text-white hover:bg-white/10"
              onClick={actions.downloadThumbnail}
            >
              Download image
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


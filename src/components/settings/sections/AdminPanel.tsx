"use client";

import { useMemo } from "react";
import type { PipelineState, StepId, StepRunState } from "@/types/agent";
import { STEP_CONFIGS, CLIENT_SHELL_STEP_IDS } from "@/lib/agent/steps";

// Provider mapping for cost breakdown
type Provider = "Gemini (LLM)" | "Gemini (Image)" | "ElevenLabs" | "FAL.ai" | "FFmpeg (Local)";

const STEP_TO_PROVIDER: Record<StepId, Provider> = {
  // LLM steps (Gemini)
  keyConcepts: "Gemini (LLM)",
  hook: "Gemini (LLM)",
  quizzes: "Gemini (LLM)",
  script: "Gemini (LLM)",
  scriptQA: "Gemini (LLM)",
  narrationAudioTags: "Gemini (LLM)",
  productionScript: "Gemini (LLM)",
  sceneImagePrompts: "Gemini (LLM)",
  sceneVideoPrompts: "Gemini (LLM)",
  titleDescription: "Gemini (LLM)",
  thumbnail: "Gemini (LLM)",
  // Image generation (Gemini)
  characterReferenceImage: "Gemini (Image)",
  sceneImages: "Gemini (Image)",
  thumbnailGenerate: "Gemini (Image)",
  // Audio (ElevenLabs)
  narrationAudio: "ElevenLabs",
  // Video/Audio processing (FAL.ai)
  narrationTimestamps: "FAL.ai",
  sceneVideos: "FAL.ai",
  // Local processing
  videoAssembly: "FFmpeg (Local)",
};

const PROVIDER_COLORS: Record<Provider, string> = {
  "Gemini (LLM)": "bg-blue-500/20 text-blue-400",
  "Gemini (Image)": "bg-purple-500/20 text-purple-400",
  "ElevenLabs": "bg-green-500/20 text-green-400",
  "FAL.ai": "bg-orange-500/20 text-orange-400",
  "FFmpeg (Local)": "bg-zinc-500/20 text-zinc-400",
};

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-zinc-600/20 text-zinc-400",
  running: "bg-yellow-500/20 text-yellow-400",
  success: "bg-green-500/20 text-green-400",
  error: "bg-red-500/20 text-red-400",
};

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

function formatDuration(ms: number): string {
  if (ms >= 60000) {
    return `${(ms / 60000).toFixed(1)}m`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

interface ProviderMetrics {
  cost: number;
  tokens: number;
  duration: number;
  stepCount: number;
}

type AdminPanelProps = {
  pipeline: PipelineState | null;
  isLoading?: boolean;
};

export function AdminPanel({ pipeline, isLoading = false }: AdminPanelProps) {

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!pipeline?.steps) {
      return {
        totalCost: 0,
        totalTokens: 0,
        totalDuration: 0,
        stepsRun: 0,
        stepsTotal: STEP_CONFIGS.length,
        providerMetrics: {} as Record<Provider, ProviderMetrics>,
        stepMetrics: [] as Array<{
          id: StepId;
          label: string;
          status: string;
          provider: Provider;
          inputTokens: number;
          outputTokens: number;
          totalTokens: number;
          cost: number;
          duration: number;
        }>,
        operationBreakdown: {
          llmSteps: 0,
          shellSteps: 0,
        },
      };
    }

    const providerMetrics: Record<Provider, ProviderMetrics> = {
      "Gemini (LLM)": { cost: 0, tokens: 0, duration: 0, stepCount: 0 },
      "Gemini (Image)": { cost: 0, tokens: 0, duration: 0, stepCount: 0 },
      "ElevenLabs": { cost: 0, tokens: 0, duration: 0, stepCount: 0 },
      "FAL.ai": { cost: 0, tokens: 0, duration: 0, stepCount: 0 },
      "FFmpeg (Local)": { cost: 0, tokens: 0, duration: 0, stepCount: 0 },
    };

    let totalCost = 0;
    let totalTokens = 0;
    let totalDuration = 0;
    let stepsRun = 0;
    let llmSteps = 0;
    let shellSteps = 0;

    const stepMetrics = STEP_CONFIGS.map((config) => {
      const stepState = pipeline.steps[config.id] as StepRunState | undefined;
      const provider = STEP_TO_PROVIDER[config.id];
      const isShellStep = CLIENT_SHELL_STEP_IDS.includes(config.id);

      const inputTokens = stepState?.metrics?.inputTokens ?? 0;
      const outputTokens = stepState?.metrics?.outputTokens ?? 0;
      const tokens = stepState?.metrics?.totalTokens ?? 0;
      const cost = stepState?.metrics?.costUsd ?? 0;
      const duration = stepState?.metrics?.durationMs ?? 0;
      const status = stepState?.status ?? "idle";

      // Only count completed steps
      if (status === "success") {
        stepsRun++;
        totalCost += cost;
        totalTokens += tokens;
        totalDuration += duration;

        providerMetrics[provider].cost += cost;
        providerMetrics[provider].tokens += tokens;
        providerMetrics[provider].duration += duration;
        providerMetrics[provider].stepCount++;

        if (isShellStep) {
          shellSteps++;
        } else {
          llmSteps++;
        }
      }

      return {
        id: config.id,
        label: config.label,
        status,
        provider,
        inputTokens,
        outputTokens,
        totalTokens: tokens,
        cost,
        duration,
      };
    });

    return {
      totalCost,
      totalTokens,
      totalDuration,
      stepsRun,
      stepsTotal: STEP_CONFIGS.length,
      providerMetrics,
      stepMetrics,
      operationBreakdown: {
        llmSteps,
        shellSteps,
      },
    };
  }, [pipeline]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading session data...</div>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex flex-col gap-6">
        <div className="border-b border-zinc-800 pb-4">
          <h2 className="text-2xl font-semibold text-white">Admin Panel</h2>
          <p className="text-sm text-zinc-400 mt-1">Session analytics & costs</p>
        </div>
        <div className="flex items-center justify-center h-64 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="text-center">
            <p className="text-zinc-400">No active session</p>
            <p className="text-sm text-zinc-500 mt-1">Start a project to see analytics</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-2xl font-semibold text-white">Admin Panel</h2>
        <p className="text-sm text-zinc-400 mt-1">Session analytics & costs</p>
      </div>

      {/* Totals: Session vs Project */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">This Session</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-zinc-500">Cost</p>
              <p className="mt-1 text-xl font-semibold text-green-400">
                {formatCost(pipeline.sessionTotalCostUsd ?? metrics.totalCost)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-zinc-500">Tokens</p>
              <p className="mt-1 text-xl font-semibold text-blue-400">
                {formatTokens(pipeline.sessionTotalTokens ?? metrics.totalTokens)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Project Total</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-zinc-500">Cost</p>
              <p className="mt-1 text-xl font-semibold text-green-400">
                {formatCost(pipeline.cumulativeCostUsd ?? pipeline.totalCostUsd ?? metrics.totalCost)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-zinc-500">Tokens</p>
              <p className="mt-1 text-xl font-semibold text-blue-400">
                {formatTokens(pipeline.cumulativeTokens ?? pipeline.totalTokens ?? metrics.totalTokens)}
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Project totals roll forward across saves; session totals reset per run.
          </p>
        </div>
      </div>

      {/* Session Overview */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Session Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Cost</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{formatCost(metrics.totalCost)}</p>
          </div>
          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Tokens</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{formatTokens(metrics.totalTokens)}</p>
          </div>
          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Duration</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{formatDuration(metrics.totalDuration)}</p>
          </div>
          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Steps Run</p>
            <p className="text-2xl font-bold text-orange-400 mt-1">
              {metrics.stepsRun} / {metrics.stepsTotal}
            </p>
          </div>
        </div>
      </div>

      {/* Model & Operation Summary */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Model & Operations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Models Used */}
          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <p className="text-sm font-medium text-zinc-300 mb-3">Models Used</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">LLM Model:</span>
                <span className="text-white font-mono">{pipeline.model}</span>
              </div>
              {pipeline.narrationModelId && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Narration:</span>
                  <span className="text-white font-mono">{pipeline.narrationModelId}</span>
                </div>
              )}
              {pipeline.visualStyleId && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Visual Style:</span>
                  <span className="text-white font-mono">{pipeline.visualStyleId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Operation Breakdown */}
          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <p className="text-sm font-medium text-zinc-300 mb-3">Operation Breakdown</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">LLM Steps:</span>
                <span className="text-blue-400 font-mono">{metrics.operationBreakdown.llmSteps}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Shell/Client Steps:</span>
                <span className="text-purple-400 font-mono">{metrics.operationBreakdown.shellSteps}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-zinc-700">
                <span className="text-zinc-400">Total Completed:</span>
                <span className="text-white font-mono">{metrics.stepsRun}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown by Provider */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Cost by Provider</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.entries(metrics.providerMetrics) as [Provider, ProviderMetrics][])
            .filter(([, m]) => m.stepCount > 0)
            .sort(([, a], [, b]) => b.cost - a.cost)
            .map(([provider, providerData]) => (
              <div
                key={provider}
                className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 text-xs rounded ${PROVIDER_COLORS[provider]}`}>
                    {provider}
                  </span>
                  <span className="text-sm text-zinc-400">{providerData.stepCount} steps</span>
                </div>
                <div className="space-y-1 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Cost:</span>
                    <span className="text-green-400 font-mono">{formatCost(providerData.cost)}</span>
                  </div>
                  {providerData.tokens > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Tokens:</span>
                      <span className="text-blue-400 font-mono">{formatTokens(providerData.tokens)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Duration:</span>
                    <span className="text-purple-400 font-mono">{formatDuration(providerData.duration)}</span>
                  </div>
                </div>
              </div>
            ))}
          {Object.values(metrics.providerMetrics).every((m) => m.stepCount === 0) && (
            <div className="col-span-full p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 text-center">
              <p className="text-zinc-500">No provider costs yet - run some steps first</p>
            </div>
          )}
        </div>
      </div>

      {/* Step-by-Step Metrics Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Step-by-Step Metrics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Step</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Provider</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">In Tokens</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Out Tokens</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Cost</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {metrics.stepMetrics.map((step, index) => (
                <tr
                  key={step.id}
                  className={`border-b border-zinc-800/50 ${
                    index % 2 === 0 ? "bg-zinc-900/30" : "bg-zinc-900/10"
                  }`}
                >
                  <td className="py-3 px-4 text-white">{step.label}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[step.status]}`}>
                      {step.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs rounded ${PROVIDER_COLORS[step.provider]}`}>
                      {step.provider}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-300">
                    {step.inputTokens > 0 ? formatTokens(step.inputTokens) : "-"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-300">
                    {step.outputTokens > 0 ? formatTokens(step.outputTokens) : "-"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-green-400">
                    {step.cost > 0 ? formatCost(step.cost) : "-"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-purple-400">
                    {step.duration > 0 ? formatDuration(step.duration) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Topic Info */}
      {pipeline.topic && (
        <div className="space-y-4 pt-4 border-t border-zinc-800">
          <h3 className="text-lg font-semibold text-white">Current Project</h3>
          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <p className="text-sm text-zinc-400">Topic</p>
            <p className="text-white mt-1">{pipeline.topic}</p>
            {pipeline.title && (
              <>
                <p className="text-sm text-zinc-400 mt-3">Title</p>
                <p className="text-white mt-1">{pipeline.title}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

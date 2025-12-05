import type {
  ModelId,
  StepConfig,
  StepRunMetrics,
  VariableKey,
} from '../../types/agent';
import { callModel } from '../llm/client';
import { estimateCost } from '../llm/costs';
import { interpolatePrompt } from './interpolate';

export interface RunStepInput {
  step: StepConfig;
  model: ModelId;
  topic: string;
  variables: Record<string, string>;
  promptTemplateOverride?: string;
}

export interface RunStepOutput {
  resolvedPrompt: string;
  responseText: string;
  metrics: StepRunMetrics;
  producedVariables: Record<string, string>;
}

export async function runStep({
  step,
  model,
  topic,
  variables,
  promptTemplateOverride,
}: RunStepInput): Promise<RunStepOutput> {
  const vars: Record<string, string> = {
    ...variables,
    Topic: topic,
  };

  const template = promptTemplateOverride ?? step.promptTemplate;
  const resolvedPrompt = interpolatePrompt(template, vars);

  // Steps that need higher token limits for long outputs
  const isProductionScript = step.id === 'productionScript';
  const isSceneImagePrompts = step.id === 'sceneImagePrompts';
  const isSceneVideoPrompts = step.id === 'sceneVideoPrompts';
  const needsHighTokenLimit = isProductionScript || isSceneImagePrompts || isSceneVideoPrompts;

  // Enhanced logging for long-output steps
  if (needsHighTokenLimit) {
    const promptSize = resolvedPrompt.length;
    console.log(`[runStep] 🎬 ${step.label} - Calling LLM:`);
    console.log(`[runStep]   Model: ${model}`);
    console.log(`[runStep]   Prompt size: ${(promptSize / 1024).toFixed(1)} KB`);
    console.log(`[runStep]   Max tokens: 16384`);
    console.log(`[runStep]   Starting model call (this may take 30-120 seconds)...`);
  }

  const startTime = Date.now();
  // Use higher token limit for steps that produce long JSON outputs:
  // - Production Script: 60-80 scenes × ~150 words each ≈ 12000+ tokens
  // - Scene image prompts: 60-80 scenes × 2 prompts × ~50 words ≈ 8000-11000 tokens
  // - Scene video prompts: 60-80 scenes × 1 prompt × ~40 words ≈ 4000-6000 tokens
  const maxTokens = needsHighTokenLimit ? 16384 : undefined;
  const { text, usage } = await callModel(model, resolvedPrompt, maxTokens);
  const endTime = Date.now();
  const durationMs = Math.max(0, endTime - startTime);

  if (needsHighTokenLimit) {
    const responseSize = text?.length || 0;
    console.log(`[runStep]   ✓ Model call completed`);
    console.log(`[runStep]   Duration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`[runStep]   Response size: ${(responseSize / 1024).toFixed(1)} KB`);
    console.log(`[runStep]   Tokens: ${usage.total_tokens || 0} (input: ${usage.prompt_tokens || 0}, output: ${usage.completion_tokens || 0})`);
  }

  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
  const costUsd = estimateCost(model, inputTokens, outputTokens);

  const metrics: StepRunMetrics = {
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
    durationMs,
  };

  const producedVariables: Record<string, string> = step.outputVars.reduce(
    (acc, key: VariableKey) => {
      acc[key] = text;
      return acc;
    },
    {} as Record<string, string>,
  );

  return {
    resolvedPrompt,
    responseText: text,
    metrics,
    producedVariables,
  };
}



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

  const startTime = Date.now();
  const { text, usage } = await callModel(model, resolvedPrompt);
  const endTime = Date.now();
  const durationMs = Math.max(0, endTime - startTime);

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



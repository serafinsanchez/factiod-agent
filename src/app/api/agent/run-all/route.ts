import { NextResponse } from 'next/server';

import { runStep } from '../../../../../lib/agent/runStep';
import { STEP_CONFIGS } from '../../../../../lib/agent/steps';
import { interpolatePrompt } from '../../../../../lib/agent/interpolate';
import type {
  ModelId,
  PipelineState,
  StepConfig,
  StepId,
  StepRunState,
  VariableKey,
} from '../../../../../types/agent';

type RunAllRequestBody = {
  topic: string;
  model: ModelId;
  promptTemplateOverrides?: Partial<Record<StepId, string>>;
};

const MODEL_IDS: ModelId[] = ['gpt5-thinking', 'kimik2-thinking'];
const STEP_IDS: StepId[] = [
  'keyConcepts',
  'hook',
  'quizzes',
  'script',
  'titleDescription',
  'thumbnail',
];

const VARIABLE_TO_PIPELINE_FIELD: Partial<Record<VariableKey, keyof PipelineState>> = {
  KeyConcepts: 'keyConcepts',
  HookScript: 'hookScript',
  QuizInfo: 'quizInfo',
  VideoScript: 'videoScript',
  Title: 'title',
  Description: 'description',
  ThumbnailPrompt: 'thumbnailPrompt',
};

function isModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && MODEL_IDS.includes(value as ModelId);
}

function isStepId(value: unknown): value is StepId {
  return typeof value === 'string' && STEP_IDS.includes(value as StepId);
}

function normalizeOverrides(
  overrides: unknown,
): Partial<Record<StepId, string>> | { error: string } | undefined {
  if (overrides === undefined) {
    return undefined;
  }

  if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) {
    return { error: 'promptTemplateOverrides must be an object map.' };
  }

  const normalized: Partial<Record<StepId, string>> = {};

  for (const [key, value] of Object.entries(overrides)) {
    if (!isStepId(key)) {
      return { error: `Unknown step in promptTemplateOverrides: ${key}` };
    }

    if (typeof value !== 'string') {
      return { error: `Override for step ${key} must be a string.` };
    }

    normalized[key] = value;
  }

  return normalized;
}

function parseRequestBody(body: unknown): RunAllRequestBody | { error: string } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'Invalid JSON body.' };
  }

  const { topic, model, promptTemplateOverrides } = body as Partial<RunAllRequestBody>;

  if (typeof topic !== 'string' || !topic.trim()) {
    return { error: 'Missing or invalid topic.' };
  }

  if (!isModelId(model)) {
    return { error: 'Missing or invalid model.' };
  }

  const normalizedOverrides = normalizeOverrides(promptTemplateOverrides);
  if (normalizedOverrides && 'error' in normalizedOverrides) {
    return normalizedOverrides;
  }

  return {
    topic,
    model,
    promptTemplateOverrides: normalizedOverrides,
  };
}

function createInitialStepsState(): Record<StepId, StepRunState> {
  return STEP_CONFIGS.reduce<Record<StepId, StepRunState>>((acc, step) => {
    acc[step.id] = {
      id: step.id,
      resolvedPrompt: '',
      responseText: '',
      status: 'idle',
    };
    return acc;
  }, {} as Record<StepId, StepRunState>);
}

function applyProducedVariables(
  producedVariables: Record<string, string>,
  variables: Record<string, string>,
  pipeline: PipelineState,
): void {
  for (const [key, value] of Object.entries(producedVariables)) {
    variables[key] = value;

    const field = VARIABLE_TO_PIPELINE_FIELD[key as VariableKey];
    if (field) {
      (pipeline as unknown as Record<string, unknown>)[field] = value;
    }
  }
}

async function runPipelineStep(
  step: StepConfig,
  model: ModelId,
  topic: string,
  variables: Record<string, string>,
  override?: string,
) {
  const result = await runStep({
    step,
    model,
    topic,
    variables,
    promptTemplateOverride: override,
  });

  let producedVariables = { ...result.producedVariables };

  if (step.id === 'titleDescription') {
    const [firstLine = '', ...rest] = result.responseText.split('\n');
    producedVariables = {
      Title: firstLine.trim(),
      Description: rest.join('\n').trim(),
    };
  }

  return {
    resolvedPrompt: result.resolvedPrompt,
    responseText: result.responseText,
    metrics: result.metrics,
    producedVariables,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseRequestBody(body);

    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { topic, model, promptTemplateOverrides } = parsed;

    const steps = createInitialStepsState();
    const pipeline: PipelineState = {
      topic,
      steps,
      model,
      totalTokens: 0,
      totalCostUsd: 0,
    };

    const variables: Record<string, string> = {
      Topic: topic,
    };

    for (const step of STEP_CONFIGS) {
      const override = promptTemplateOverrides?.[step.id];

      let stepResult;

      try {
        stepResult = await runPipelineStep(step, model, topic, variables, override);
      } catch (error) {
        const resolvedPrompt = interpolatePrompt(
          (override ?? step.promptTemplate) ?? '',
          {
            ...variables,
            Topic: topic,
          },
        );

        const message = error instanceof Error ? error.message : 'Step failed.';

        steps[step.id] = {
          id: step.id,
          resolvedPrompt,
          responseText: '',
          status: 'error',
          errorMessage: message,
        };
        return NextResponse.json(pipeline, { status: 500 });
      }

      steps[step.id] = {
        id: step.id,
        resolvedPrompt: stepResult.resolvedPrompt,
        responseText: stepResult.responseText,
        status: 'success',
        metrics: stepResult.metrics,
      };

      pipeline.totalTokens += stepResult.metrics.totalTokens;
      pipeline.totalCostUsd += stepResult.metrics.costUsd;

      applyProducedVariables(stepResult.producedVariables, variables, pipeline);
    }

    return NextResponse.json(pipeline);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


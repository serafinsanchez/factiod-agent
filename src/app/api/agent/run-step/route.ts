import { NextResponse } from 'next/server';

import { runStep } from '../../../../../lib/agent/runStep';
import { getStepConfig } from '../../../../../lib/agent/steps';
import type { ModelId, StepId } from '../../../../../types/agent';

type RunStepRequestBody = {
  stepId: StepId;
  model: ModelId;
  topic: string;
  variables?: Record<string, string>;
  promptTemplateOverride?: string;
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

function isModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && MODEL_IDS.includes(value as ModelId);
}

function isStepId(value: unknown): value is StepId {
  return typeof value === 'string' && STEP_IDS.includes(value as StepId);
}

function normalizeVariables(
  variables: unknown,
): Record<string, string> | undefined {
  if (variables === undefined) {
    return undefined;
  }

  if (typeof variables !== 'object' || variables === null || Array.isArray(variables)) {
    return undefined;
  }

  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'string') {
      normalized[key] = value;
    } else if (value != null) {
      normalized[key] = String(value);
    }
  }

  return normalized;
}

function parseRequestBody(body: unknown): RunStepRequestBody | { error: string } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'Invalid JSON body.' };
  }

  const {
    stepId,
    model,
    topic,
    variables,
    promptTemplateOverride,
  } = body as Partial<RunStepRequestBody>;

  if (!isStepId(stepId)) {
    return { error: 'Missing or invalid stepId.' };
  }

  if (!isModelId(model)) {
    return { error: 'Missing or invalid model.' };
  }

  if (typeof topic !== 'string' || !topic.trim()) {
    return { error: 'Missing or invalid topic.' };
  }

  if (
    promptTemplateOverride !== undefined &&
    typeof promptTemplateOverride !== 'string'
  ) {
    return { error: 'promptTemplateOverride must be a string if provided.' };
  }

  const normalizedVariables = normalizeVariables(variables);

  if (variables !== undefined && normalizedVariables === undefined) {
    return { error: 'variables must be an object map of string values.' };
  }

  return {
    stepId,
    model,
    topic,
    variables: normalizedVariables ?? {},
    promptTemplateOverride,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseRequestBody(body);

    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { stepId, model, topic, variables, promptTemplateOverride } = parsed;

    const step = getStepConfig(stepId);

    const { resolvedPrompt, responseText, metrics, producedVariables: baseProducedVariables } =
      await runStep({
      step,
      model,
      topic,
      variables,
      promptTemplateOverride,
    });

    let producedVariables = { ...baseProducedVariables };

    if (stepId === 'titleDescription') {
      const [firstLine = '', ...rest] = responseText.split('\n');
      const title = firstLine.trim();
      const description = rest.join('\n').trim();
      producedVariables = {
        Title: title,
        Description: description,
      };
    }

    return NextResponse.json({
      resolvedPrompt,
      responseText,
      metrics,
      producedVariables,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('Unknown step') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}


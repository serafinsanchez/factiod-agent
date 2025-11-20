import { NextResponse } from 'next/server';

import { runStep } from '../../../../../lib/agent/runStep';
import { extractFinalScript } from '../../../../../lib/agent/scriptQA';
import { getStepConfig } from '../../../../../lib/agent/steps';
import { normalizeModelId } from '../../../../../lib/llm/models';
import type { ModelId, StepId } from '../../../../../types/agent';

type RunStepRequestBody = {
  stepId: StepId;
  model: ModelId;
  topic: string;
  variables?: Record<string, string>;
  promptTemplateOverride?: string;
};

type ParsedRunStepRequestBody = {
  stepId: StepId;
  model: ModelId;
  topic: string;
  variables: Record<string, string>;
  promptTemplateOverride?: string;
};

const STEP_IDS: StepId[] = [
  'keyConcepts',
  'hook',
  'quizzes',
  'script',
  'scriptQA',
  'narrationClean',
  'narrationAudioTags',
  'titleDescription',
  'thumbnail',
];

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

function parseRequestBody(body: unknown): ParsedRunStepRequestBody | { error: string } {
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

  const normalizedModel = normalizeModelId(model);
  if (!normalizedModel) {
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
    model: normalizedModel,
    topic,
    variables: normalizedVariables ?? ({} as Record<string, string>),
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
    } else if (stepId === 'scriptQA') {
      producedVariables = {
        VideoScript: extractFinalScript(responseText),
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


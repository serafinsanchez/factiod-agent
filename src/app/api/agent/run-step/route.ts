import { NextResponse } from 'next/server';

import { runStep } from '../../../../../lib/agent/runStep';
import { extractFinalScript, runScriptQaWithWordGoal } from '../../../../../lib/agent/scriptQA';
import { getStepConfig, SERVER_EXECUTABLE_STEP_IDS } from '../../../../../lib/agent/steps';
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

const SERVER_STEP_IDS = new Set<StepId>(SERVER_EXECUTABLE_STEP_IDS);

function isStepId(value: unknown): value is StepId {
  return typeof value === 'string' && SERVER_STEP_IDS.has(value as StepId);
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

    // Use step's defaultModel if available, otherwise use the provided model
    const effectiveModel = step.defaultModel ?? model;

    // Enhanced logging for steps that need high token limits
    const isProductionScript = stepId === 'productionScript';
    const isSceneImagePrompts = stepId === 'sceneImagePrompts';
    const isSceneVideoPrompts = stepId === 'sceneVideoPrompts';
    const needsHighTokenLimit = isProductionScript || isSceneImagePrompts || isSceneVideoPrompts;
    
    if (needsHighTokenLimit) {
      const productionScript = variables.ProductionScript;
      const scriptSize = productionScript ? JSON.stringify(productionScript).length : 0;
      let estimatedScenes = 0;
      if (productionScript) {
        try {
          const parsed = JSON.parse(productionScript);
          estimatedScenes = parsed?.scenes?.length || 0;
        } catch {
          // Ignore parse errors for logging
        }
      }
      console.log(`[API] 🎬 ${step.label} Step - Server Side:`);
      console.log(`[API]   Model: ${effectiveModel}`);
      console.log(`[API]   Max tokens: 16384`);
      if (productionScript) {
        console.log(`[API]   Production Script size: ${(scriptSize / 1024).toFixed(1)} KB`);
        console.log(`[API]   Estimated scenes: ${estimatedScenes}`);
      }
      console.log(`[API]   Starting LLM call...`);
    }

    const runner = stepId === 'scriptQA' ? runScriptQaWithWordGoal : runStep;
    const llmStartTime = Date.now();

    const {
      resolvedPrompt,
      responseText,
      metrics,
      producedVariables: baseProducedVariables,
    } = await runner({
      step,
      model: effectiveModel,
      topic,
      variables,
      promptTemplateOverride,
    });

    if (needsHighTokenLimit) {
      const llmDuration = Date.now() - llmStartTime;
      const responseSize = responseText?.length || 0;
      console.log(`[API]   ✓ LLM call completed`);
      console.log(`[API]   Duration: ${(llmDuration / 1000).toFixed(1)}s`);
      console.log(`[API]   Response size: ${(responseSize / 1024).toFixed(1)} KB`);
      console.log(`[API]   Tokens: ${metrics?.totalTokens || 0} (input: ${metrics?.inputTokens || 0}, output: ${metrics?.outputTokens || 0})`);
    }

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


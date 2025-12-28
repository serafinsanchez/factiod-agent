import { NextResponse } from 'next/server';

import { runStep } from '../../../../../lib/agent/runStep';
import { extractFinalScript, runScriptQaWithWordGoal } from '../../../../../lib/agent/scriptQA';
import { STEP_CONFIGS, getStepConfig } from '../../../../../lib/agent/steps';
import { interpolatePrompt } from '../../../../../lib/agent/interpolate';
import { normalizeModelId } from '../../../../../lib/llm/models';
import { toNarrationOnly } from '@/lib/tts/cleanNarration';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getDefaultSettings } from '@/lib/settings/defaults';
import type { ScriptAudioSettings } from '@/lib/settings/types';
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
  defaultWordCount?: number;
};

/**
 * The steps executed by the "Run All" endpoint.
 * This is the video-team workflow: script generation through to metadata.
 * Audio and thumbnail IMAGE generation are triggered client-side after this returns.
 */
const VIDEO_TEAM_STEP_IDS: StepId[] = [
  'keyConcepts',
  'hook',
  'quizzes',
  'script',
  'scriptQA',
  'narrationAudioTags',
  'titleDescription',
  'thumbnail',
];

const VARIABLE_TO_PIPELINE_FIELD: Partial<Record<VariableKey, keyof PipelineState>> = {
  KeyConcepts: 'keyConcepts',
  HookScript: 'hookScript',
  QuizInfo: 'quizInfo',
  VideoScript: 'videoScript',
  NarrationScript: 'narrationScript',
  Title: 'title',
  Description: 'description',
  YoutubeTags: 'youtubeTags',
  Chapters: 'chapters',
  ThumbnailPrompt: 'thumbnailPrompt',
};

type TitleDescriptionSections = {
  title: string;
  description: string;
  youtubeTags: string;
  chapters: string;
};

function normalizeLineEndings(text: string) {
  return text.replace(/\r\n/g, '\n');
}

function coerceYoutubeTagsMaxChars(tags: string, maxChars: number): string {
  const trimmed = tags.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const clipped = trimmed.slice(0, maxChars);
  const lastComma = clipped.lastIndexOf(',');
  if (lastComma > 0) {
    return clipped
      .slice(0, lastComma)
      .replace(/,+\s*$/, '')
      .trim();
  }

  return clipped.trim();
}

function parseTitleDescriptionResponse(text: string): TitleDescriptionSections {
  const normalized = normalizeLineEndings(text ?? '');
  const lines = normalized.split('\n');

  type HeaderKey = 'TITLE' | 'DESCRIPTION' | 'TAGS' | 'CHAPTERS';
  const headerOrder: HeaderKey[] = ['TITLE', 'DESCRIPTION', 'TAGS', 'CHAPTERS'];
  const headerIndices: Record<HeaderKey, number> = {
    TITLE: -1,
    DESCRIPTION: -1,
    TAGS: -1,
    CHAPTERS: -1,
  };
  const inlineFirstLine: Partial<Record<HeaderKey, string>> = {};

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();
    const match = trimmed.match(/^(TITLE|DESCRIPTION|TAGS|CHAPTERS):\s*(.*)$/i);
    if (!match) continue;

    const key = match[1]!.toUpperCase() as HeaderKey;
    if (headerIndices[key] !== -1) continue;

    headerIndices[key] = i;
    const inline = (match[2] ?? '').trim();
    if (inline) inlineFirstLine[key] = inline;
  }

  const sections: TitleDescriptionSections = {
    title: '',
    description: '',
    youtubeTags: '',
    chapters: '',
  };

  const foundHeaders = headerOrder
    .map((key) => ({ key, index: headerIndices[key] }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index);

  if (foundHeaders.length === 0) {
    const [firstLine = '', ...rest] = normalized.split('\n');
    sections.title = firstLine.trim();
    sections.description = rest.join('\n').trim();
  } else {
    for (let i = 0; i < foundHeaders.length; i += 1) {
      const current = foundHeaders[i]!;
      const next = foundHeaders[i + 1];
      const start = current.index + 1;
      const end = next ? next.index : lines.length;
      const bodyLines = lines.slice(start, end);
      const headerInline = inlineFirstLine[current.key];
      const body =
        (headerInline ? [headerInline, ...bodyLines] : bodyLines).join('\n').trim();

      if (current.key === 'TITLE') sections.title = body;
      if (current.key === 'DESCRIPTION') sections.description = body;
      if (current.key === 'TAGS') sections.youtubeTags = body;
      if (current.key === 'CHAPTERS') sections.chapters = body;
    }
  }

  sections.youtubeTags = coerceYoutubeTagsMaxChars(
    sections.youtubeTags
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
    500,
  );
  sections.chapters = sections.chapters
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();

  return sections;
}

async function getSettingsDefaultWordCount(): Promise<number> {
  try {
    const supabase = getSupabaseServerClient();
    const userId = 'default'; // TODO: Replace with actual user ID when auth is implemented

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings_value')
      .eq('user_id', userId)
      .eq('settings_key', 'scriptAudio')
      .single();

    if (!error && data?.settings_value) {
      const saved = data.settings_value as Partial<ScriptAudioSettings>;
      const candidate = saved.defaultWordCount;
      if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
        return Math.round(candidate);
      }
    }
  } catch {
    // Fall back to defaults below.
  }

  const defaults = getDefaultSettings('scriptAudio') as ScriptAudioSettings;
  const fallback = defaults?.defaultWordCount;
  return typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0
    ? Math.round(fallback)
    : 1500;
}

function insertChecklistBudgetLine(responseText: string, budgetLine: string): string {
  if (!responseText || typeof responseText !== 'string') {
    return responseText;
  }
  return responseText.replace(/^Checklist:\s*$/m, (match) => `${match}\n${budgetLine}`);
}

function isVideoTeamStepId(value: unknown): value is StepId {
  return typeof value === 'string' && VIDEO_TEAM_STEP_IDS.includes(value as StepId);
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
    if (!isVideoTeamStepId(key)) {
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

  const { topic, model, promptTemplateOverrides, defaultWordCount } = body as Partial<RunAllRequestBody>;

  if (typeof topic !== 'string' || !topic.trim()) {
    return { error: 'Missing or invalid topic.' };
  }

  const normalizedModel = normalizeModelId(model);
  if (!normalizedModel) {
    return { error: 'Missing or invalid model.' };
  }

  const normalizedOverrides = normalizeOverrides(promptTemplateOverrides);
  if (normalizedOverrides && 'error' in normalizedOverrides) {
    return normalizedOverrides;
  }

  const normalizedDefaultWordCount =
    typeof defaultWordCount === 'number' && Number.isFinite(defaultWordCount) && defaultWordCount > 0
      ? Math.round(defaultWordCount)
      : undefined;

  return {
    topic,
    model: normalizedModel,
    promptTemplateOverrides: normalizedOverrides,
    defaultWordCount: normalizedDefaultWordCount,
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
  const runner = step.id === 'scriptQA' ? runScriptQaWithWordGoal : runStep;

  const result = await runner({
    step,
    model,
    topic,
    variables,
    promptTemplateOverride: override,
  });

  let producedVariables = { ...result.producedVariables };

  if (step.id === 'titleDescription') {
    const { title, description, youtubeTags, chapters } = parseTitleDescriptionResponse(result.responseText);
    producedVariables = {
      Title: title,
      Description: description,
      YoutubeTags: youtubeTags,
      Chapters: chapters,
    };
  } else if (step.id === 'scriptQA') {
    const finalScript = extractFinalScript(result.responseText);
    producedVariables = {
      VideoScript: finalScript,
      NarrationScript: toNarrationOnly(finalScript),
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

    const { topic, model, promptTemplateOverrides, defaultWordCount: requestWordCount } = parsed;

    const steps = createInitialStepsState();
    const pipeline: PipelineState = {
      topic,
      steps,
      model,
      totalTokens: 0,
      totalCostUsd: 0,
      sessionTotalTokens: 0,
      sessionTotalCostUsd: 0,
    };

    const variables: Record<string, string> = {
      Topic: topic,
    };

    // Honor request-provided defaultWordCount if valid, otherwise fall back to settings.
    const effectiveWordCount = requestWordCount ?? (await getSettingsDefaultWordCount());
    variables.DefaultWordCount = String(effectiveWordCount);

    // Execute only the video-team steps (script + metadata pipeline).
    for (const stepId of VIDEO_TEAM_STEP_IDS) {
      const step = getStepConfig(stepId);
      const override = promptTemplateOverrides?.[stepId];

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

        steps[stepId] = {
          id: stepId,
          resolvedPrompt,
          responseText: '',
          status: 'error',
          errorMessage: message,
        };
        return NextResponse.json(pipeline, { status: 500 });
      }

      const hardCap = effectiveWordCount;
      const targetMax = Math.max(1, hardCap - 100);
      const targetMin = Math.min(
        targetMax,
        Math.max(1, Math.round(targetMax * 0.9)),
      );
      const budgetLine = `LENGTH_BUDGET: Target ${targetMin}–${targetMax} words; hard cap ${hardCap} words.`;

      steps[stepId] = {
        id: stepId,
        resolvedPrompt: stepResult.resolvedPrompt,
        responseText:
          stepId === 'scriptQA'
            ? insertChecklistBudgetLine(stepResult.responseText, budgetLine)
            : stepResult.responseText,
        status: 'success',
        metrics: stepResult.metrics,
      };

      pipeline.totalTokens += stepResult.metrics.totalTokens;
      pipeline.totalCostUsd += stepResult.metrics.costUsd;
      pipeline.sessionTotalTokens = (pipeline.sessionTotalTokens ?? 0) + stepResult.metrics.totalTokens;
      pipeline.sessionTotalCostUsd = (pipeline.sessionTotalCostUsd ?? 0) + stepResult.metrics.costUsd;

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


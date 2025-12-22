import { NextResponse } from 'next/server';

import { runStep } from '../../../../../lib/agent/runStep';
import { extractFinalScript, runScriptQaWithWordGoal } from '../../../../../lib/agent/scriptQA';
import { getStepConfigForAudience, SERVER_EXECUTABLE_STEP_IDS } from '../../../../../lib/agent/steps';
import { normalizeModelId } from '../../../../../lib/llm/models';
import type { ModelId, StepId, AudienceMode } from '../../../../../types/agent';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getDefaultSettings } from '@/lib/settings/defaults';
import type { ScriptAudioSettings } from '@/lib/settings/types';

type RunStepRequestBody = {
  stepId: StepId;
  model: ModelId;
  topic: string;
  variables?: Record<string, string>;
  promptTemplateOverride?: string;
  audienceMode?: AudienceMode;
};

type ParsedRunStepRequestBody = {
  stepId: StepId;
  model: ModelId;
  topic: string;
  variables: Record<string, string>;
  promptTemplateOverride?: string;
  audienceMode: AudienceMode;
};

const SERVER_STEP_IDS = new Set<StepId>(SERVER_EXECUTABLE_STEP_IDS);

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

function coercePositiveInt(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
}

function normalizeLineEndings(text: string) {
  return text.replace(/\r\n/g, '\n');
}

function splitLinesForStrictComparison(text: string) {
  // Preserve leading whitespace and internal empty lines; ignore only trailing newlines.
  return normalizeLineEndings(text).trimEnd().split('\n');
}

type TitleDescriptionSections = {
  title: string;
  description: string;
  youtubeTags: string;
  chapters: string;
};

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

function repairNarrationAudioTagsLineStructure({
  inputNarrationScript,
  responseText,
}: {
  inputNarrationScript: string;
  responseText: string;
}): string {
  const inputLines = splitLinesForStrictComparison(inputNarrationScript);
  const outputLines = splitLinesForStrictComparison(responseText);

  if (outputLines.length === inputLines.length) {
    return responseText;
  }

  const tagRegexSingle = /\[[^\[\]]+\]/;
  const tagWordRegex = /^[A-Za-z]+(?:-[A-Za-z]+)*$/;
  const extractedTags: string[] = [];

  for (const line of outputLines) {
    const match = line.match(tagRegexSingle);
    if (!match) continue;
    const tag = match[0] ?? '';
    const raw = tag.slice(1, -1);
    if (!tag || raw.trim() !== raw) continue;
    if (!tagWordRegex.test(raw)) continue;
    extractedTags.push(tag);
  }

  let usedExtracted = 0;
  let generated = 0;
  const repairedLines = inputLines.map((line) => {
    if (!line.trim()) return line;

    // If the input already contains a bracketed tag, preserve it as-is.
    if (tagRegexSingle.test(line)) return line;

    const leading = (line.match(/^\s*/) ?? [''])[0] ?? '';
    const rest = line.slice(leading.length);

    const tag = extractedTags.shift() ?? null;
    const appliedTag = tag ?? getTagForLine(line);
    if (tag) usedExtracted += 1;
    else generated += 1;

    // Place tag after quiz/list labels if present; otherwise at start (after indentation).
    const labelMatch = rest.match(/^(Question\s*\d+\:|[A-D]\))\s*/i);
    if (labelMatch) {
      const labelChunk = labelMatch[0] ?? '';
      const after = rest.slice(labelChunk.length);
      return `${leading}${labelChunk}${appliedTag} ${after}`.replace(/\s{2,}/g, ' ').trimEnd();
    }

    return `${leading}${appliedTag} ${rest}`.replace(/\s{2,}/g, ' ').trimEnd();
  });

  const repairedText = repairedLines.join('\n');

  return repairedText;
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
    if (headerIndices[key] !== -1) continue; // first match wins

    headerIndices[key] = i;
    const inline = (match[2] ?? '').trim();
    if (inline) {
      inlineFirstLine[key] = inline;
    }
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
    // Backwards-compatible fallback: old format was "title on first line, description after".
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

  sections.title = sections.title.trim();
  sections.description = sections.description.trim();
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

function getTagForLine(line: string): string {
  const trimmed = line.trim().toLowerCase();
  if (!trimmed) return '[warmly]';

  // Quiz-related lines
  if (/quiz|ready\?|pause.*video|think about it/i.test(trimmed)) {
    return '[playfully]';
  }
  if (/correct|right|well done|nailed it|you got it/i.test(trimmed)) {
    return '[encouragingly]';
  }

  // Wow facts and surprising info
  if (/did you know|here's something|amazing|incredible|wild|billion|million/i.test(trimmed)) {
    return '[amazed]';
  }

  // Mystery/intrigue
  if (/secret|mystery|hidden|most people don't|overlooked/i.test(trimmed)) {
    return '[conspiratorially]';
  }

  // Questions
  if (trimmed.includes('?')) {
    return '[curiously]';
  }

  // Excitement
  if (trimmed.includes('!')) {
    return '[enthusiastically]';
  }

  // Thoughtful pauses
  if (trimmed.includes('...')) {
    return '[thoughtfully]';
  }

  // Importance/meaning
  if (/important|matters|crucial|essential|key/i.test(trimmed)) {
    return '[earnestly]';
  }

  // Default to warm, engaging delivery
  return '[warmly]';
}

function coerceSingleNarrationAudioTagPerLine(responseText: string): string {
  const lines = splitLinesForStrictComparison(responseText);
  const tagRegex = /\[[^\[\]]+\]/g;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const matches = Array.from(line.matchAll(tagRegex));
    if (matches.length <= 1) continue;

    // Remove all tags after the first one, preserving all spoken words.
    // Remove from the end so indices stay valid.
    let next = line;
    for (let k = matches.length - 1; k >= 1; k -= 1) {
      const m = matches[k];
      const start = m?.index ?? -1;
      const text = m?.[0] ?? '';
      if (start >= 0 && text) {
        next = next.slice(0, start) + next.slice(start + text.length);
      }
    }

    // Collapse accidental double spaces created by tag removal.
    lines[i] = next.replace(/\s{2,}/g, ' ').trimEnd();
  }

  return lines.join('\n');
}

function ensureMinimumNarrationAudioTags({
  inputNarrationScript,
  responseText,
}: {
  inputNarrationScript: string;
  responseText: string;
}): string {
  const inputLines = splitLinesForStrictComparison(inputNarrationScript);
  const outputLines = splitLinesForStrictComparison(responseText);

  // If the model broke the "same number of lines" rule, don't try to repair it here.
  // The validator will return a clear error telling the user/LLM what to fix.
  if (outputLines.length !== inputLines.length) {
    return responseText;
  }

  const tagRegex = /\[[^\[\]]+\]/g;
  const tagRegexSingle = /\[[^\[\]]+\]/;
  const nonEmptyLineIndexes: number[] = [];
  let tagCount = 0;

  for (let i = 0; i < outputLines.length; i += 1) {
    const line = outputLines[i] ?? '';
    if (line.trim().length > 0) nonEmptyLineIndexes.push(i);
    const matches = Array.from(line.matchAll(tagRegex));
    if (matches.length === 1) tagCount += 1;
  }

  const nonEmptyLineCount = nonEmptyLineIndexes.length;
  const minTags = Math.max(1, Math.floor(nonEmptyLineCount * 0.25));
  const missingTags = minTags - tagCount;
  if (missingTags <= 0) {
    return responseText;
  }

  const candidateIndexes = nonEmptyLineIndexes.filter((i) => {
    const line = outputLines[i] ?? '';
    return !tagRegexSingle.test(line);
  });

  if (candidateIndexes.length === 0) {
    return responseText;
  }

  // Pick lines evenly across the script so we don't cluster tags at the top.
  const picked = new Set<number>();
  for (let k = 0; k < missingTags; k += 1) {
    const pos = Math.floor(((k + 0.5) * candidateIndexes.length) / missingTags);
    const idx = candidateIndexes[Math.min(candidateIndexes.length - 1, Math.max(0, pos))];
    if (idx !== undefined) {
      picked.add(idx);
    }
  }

  for (const idx of picked) {
    const current = outputLines[idx] ?? '';
    if (!current.trim()) continue;
    const tag = getTagForLine(current);
    outputLines[idx] = `${current} ${tag}`;
  }

  return outputLines.join('\n');
}

function validateNarrationAudioTagsResponse({
  inputNarrationScript,
  responseText,
}: {
  inputNarrationScript: string;
  responseText: string;
}): { ok: true } | { ok: false; error: string } {
  const inputLines = splitLinesForStrictComparison(inputNarrationScript);
  const outputLines = splitLinesForStrictComparison(responseText);

  if (outputLines.length !== inputLines.length) {
    return {
      ok: false,
      error:
        `Invalid audio tags output: expected exactly ${inputLines.length} lines (same as NarrationScript), ` +
        `but got ${outputLines.length}. Do not merge or split lines.`,
    };
  }

  const tagRegex = /\[[^\[\]]+\]/g;
  const tagWordRegex = /^[A-Za-z]+(?:-[A-Za-z]+)*$/;
  let tagCount = 0;
  let nonEmptyLineCount = 0;

  for (let i = 0; i < outputLines.length; i += 1) {
    const line = outputLines[i] ?? '';
    const inputLine = inputLines[i] ?? '';
    if (line.trim().length > 0) {
      nonEmptyLineCount += 1;
    }
    const matches = Array.from(line.matchAll(tagRegex));
    const inputMatches = Array.from(inputLine.matchAll(tagRegex));

    if (matches.length > 1) {
      return {
        ok: false,
        error:
          `Invalid audio tag format on line ${i + 1}: only one tag is allowed per line. ` +
          `Use a single one-word tag like [cheerful].`,
      };
    }

    if (matches.length === 1) {
      tagCount += 1;
      const raw = (matches[0]?.[0] ?? '').slice(1, -1); // content inside brackets, no trimming

      if (raw.trim() !== raw) {
        return {
          ok: false,
          error:
            `Invalid audio tag format on line ${i + 1}: tag must be exactly one word with no spaces, ` +
            `like [cheerful].`,
        };
      }

      if (!tagWordRegex.test(raw)) {
        return {
          ok: false,
          error:
            `Invalid audio tag format on line ${i + 1}: tag must be exactly one word (letters with optional hyphens), ` +
            `like [cheerful] or [half-whisper].`,
        };
      }
    }
  }

  // Require at least some tags so this step actually does work.
  // With the "one tag per line" rule, the max possible tags equals non-empty lines.
  // We enforce a low, proportional minimum to avoid impossible thresholds on short scripts.
  const minTags = Math.max(1, Math.floor(nonEmptyLineCount * 0.25));
  if (tagCount < minTags) {
    return {
      ok: false,
      error:
        `Invalid audio tags output: expected at least ${minTags} tag(s) across ${nonEmptyLineCount} non-empty line(s), ` +
        `but found ${tagCount}. Add voice tags like [curious] or [neutral] without changing any words.`,
    };
  }

  return { ok: true };
}

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
    audienceMode,
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

  // Default to 'forKids' if not provided for backwards compatibility
  const normalizedAudienceMode: AudienceMode = 
    audienceMode === 'forEveryone' || audienceMode === 'forKids' 
      ? audienceMode 
      : 'forKids';

  return {
    stepId,
    model: normalizedModel,
    topic,
    variables: normalizedVariables ?? ({} as Record<string, string>),
    promptTemplateOverride,
    audienceMode: normalizedAudienceMode,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseRequestBody(body);

    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { stepId, model, topic, promptTemplateOverride, audienceMode } = parsed;
    let { variables } = parsed;

    // Enforce settings-backed script length on the server so all clients/audiences behave consistently.
    if (stepId === 'script' || stepId === 'scriptQA') {
      const effectiveWordCount = await getSettingsDefaultWordCount();
      variables = {
        ...variables,
        DefaultWordCount: String(effectiveWordCount),
      };
    }

    const step = getStepConfigForAudience(stepId, audienceMode);

    // Use the user-selected model (step.defaultModel is only a UI default).
    const effectiveModel = model;

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

    if (stepId === 'thumbnail') {
    }

    let finalResponseText = responseText;

    if (needsHighTokenLimit) {
      const llmDuration = Date.now() - llmStartTime;
      const responseSize = responseText?.length || 0;
      console.log(`[API]   ✓ LLM call completed`);
      console.log(`[API]   Duration: ${(llmDuration / 1000).toFixed(1)}s`);
      console.log(`[API]   Response size: ${(responseSize / 1024).toFixed(1)} KB`);
      console.log(`[API]   Tokens: ${metrics?.totalTokens || 0} (input: ${metrics?.inputTokens || 0}, output: ${metrics?.outputTokens || 0})`);
    }

    if (stepId === 'narrationAudioTags') {
      const inputNarrationScript = variables.NarrationScript ?? '';
      if (!inputNarrationScript.trim()) {
        return NextResponse.json(
          { error: 'NarrationScript is required for narrationAudioTags validation.' },
          { status: 400 },
        );
      }

      // The model sometimes violates the "one tag per line" rule (especially on long lines).
      // Make this step robust by coercing each line down to a single tag.
      finalResponseText = coerceSingleNarrationAudioTagPerLine(finalResponseText);

      // If the model breaks the "same number of lines" rule, rebuild the output from the
      // original NarrationScript and apply tags without changing spoken words.
      finalResponseText = repairNarrationAudioTagsLineStructure({
        inputNarrationScript,
        responseText: finalResponseText,
      });

      // If the model returns too few tags, auto-insert a minimum set of safe tags
      // without changing any words or line structure.
      finalResponseText = ensureMinimumNarrationAudioTags({
        inputNarrationScript,
        responseText: finalResponseText,
      });

      const validation = validateNarrationAudioTagsResponse({
        inputNarrationScript,
        responseText: finalResponseText,
      });

      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 422 });
      }
    }

    let producedVariables = { ...baseProducedVariables };

    if (stepId === 'titleDescription') {
      const { title, description, youtubeTags, chapters } = parseTitleDescriptionResponse(finalResponseText);
      producedVariables = {
        Title: title,
        Description: description,
        YoutubeTags: youtubeTags,
        Chapters: chapters,
      };
    } else if (stepId === 'scriptQA') {
      const hardCap = coercePositiveInt(variables.DefaultWordCount) ?? 1600;
      const targetMax = Math.max(1, hardCap - 100);
      const targetMin = Math.min(
        targetMax,
        Math.max(1, Math.round(targetMax * 0.9)),
      );
      const budgetLine = `LENGTH_BUDGET: Target ${targetMin}–${targetMax} words; hard cap ${hardCap} words.`;

      // Insert budget line immediately after the first Checklist: marker (if present).
      // This keeps the output transparent while ensuring script extraction ignores it.
      finalResponseText = finalResponseText.replace(
        /^Checklist:\s*$/m,
        (match) => `${match}\n${budgetLine}`,
      );
      producedVariables = {
        VideoScript: extractFinalScript(responseText),
      };
    }

    return NextResponse.json({
      resolvedPrompt,
      responseText: finalResponseText,
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


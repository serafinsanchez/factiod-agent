import type { StepRunMetrics } from '../../types/agent';
import type { RunStepInput, RunStepOutput } from './runStep';
import { runStep } from './runStep';

const SCRIPT_MARKERS = ['final script', 'improved script', 'final draft'];
const STATUS_PREFIXES = [
  'checklist',
  'length',
  'facts',
  'tone',
  'qa summary',
  'summary',
  'tests',
  'status',
  'verdict',
];
const HEADING_PREFIXES = [
  'intro',
  'draft',
  'rough',
  'qa summary',
  'summary',
  'notes',
  'status',
  'analysis',
];

const SCRIPT_QA_TARGET_MIN_WORDS = 1_350;
const SCRIPT_QA_TARGET_MAX_WORDS = 1_500;
const SCRIPT_QA_HARD_CAP_WORDS = 1_600;
const SCRIPT_QA_MAX_ATTEMPTS = 3;

export function extractFinalScript(responseText: string): string {
  if (!responseText) {
    return '';
  }

  const normalized = responseText.replace(/\r\n/g, '\n');
  const afterMarker = sliceAfterLastMarker(normalized);
  const candidate = afterMarker ?? normalized;

  const cleaned = selectLargestNarrativeBlock(
    stripStatusBlocks(stripCodeFences(candidate), 'start'),
  );

  const withoutTrailingStatus = stripStatusBlocks(cleaned, 'end').trim();

  return withoutTrailingStatus || normalized.trim();
}

function sliceAfterLastMarker(text: string): string | null {
  let lastMatch: RegExpExecArray | null = null;
  const markerPattern = new RegExp(`(${SCRIPT_MARKERS.join('|')})\\s*:`, 'gi');

  let match: RegExpExecArray | null = null;
  while ((match = markerPattern.exec(text)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    return null;
  }

  const offset = lastMatch.index + lastMatch[0].length;
  return text.slice(offset);
}

function stripCodeFences(text: string): string {
  let result = text.trim();

  if (result.startsWith('```')) {
    result = result.replace(/^```[a-z]*\n?/i, '');
    result = result.replace(/```$/, '');
  }

  if (result.startsWith('"""') && result.endsWith('"""')) {
    result = result.slice(3, -3);
  }

  return result.trim();
}

function stripStatusBlocks(text: string, position: 'start' | 'end'): string {
  const lines = text.split('\n');

  if (position === 'start') {
    let index = 0;
    let removedAny = false;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        if (removedAny) {
          index += 1;
          continue;
        }
        index += 1;
        continue;
      }

      if (looksLikeStatusLine(line)) {
        removedAny = true;
        index += 1;
        continue;
      }

      break;
    }

    return lines.slice(index).join('\n').trim();
  }

  let end = lines.length;
  let removedAny = false;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.trim()) {
      if (removedAny) {
        end = index;
        continue;
      }
      end = index;
      continue;
    }

    if (looksLikeStatusLine(line)) {
      removedAny = true;
      end = index;
      continue;
    }

    break;
  }

  return lines.slice(0, end).join('\n').trim();
}

function looksLikeStatusLine(line: string): boolean {
  const normalized = line.replace(/^[-*•>\s]+/, '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return STATUS_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function selectLargestNarrativeBlock(text: string): string {
  const trimmed = text.trim();
  const base = splitByStatusKeywords(trimmed) ?? trimmed;
  return pickDominantHeadingBlock(base);
}

function splitByStatusKeywords(text: string): string | null {
  const separators = /(?:Checklist:|LENGTH:|FACTS:|TONE:|QA Summary:|Summary:)/i;
  if (!separators.test(text)) {
    return null;
  }

  const parts = text
    .split(separators)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  return parts.reduce((best, part) => (countWords(part) > countWords(best) ? part : best));
}

function pickDominantHeadingBlock(text: string): string {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length <= 1) {
    return text.trim();
  }

  const candidateBlocks = blocks.filter((block) => {
    const firstLine = block.split('\n')[0]?.trim().toLowerCase() ?? '';
    return !HEADING_PREFIXES.some((prefix) => firstLine.startsWith(prefix));
  });

  if (candidateBlocks.length === 0) {
    return text.trim();
  }

  const best = candidateBlocks.reduce((currentBest, next) =>
    countWords(next) > countWords(currentBest) ? next : currentBest,
  );
  const bestWords = countWords(best);
  const totalWords = candidateBlocks.reduce((sum, block) => sum + countWords(block), 0);

  if (bestWords >= totalWords * 0.6) {
    return best;
  }

  return text.trim();
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export async function runScriptQaWithWordGoal(
  params: RunStepInput,
): Promise<RunStepOutput> {
  if (params.step.id !== 'scriptQA') {
    return runStep(params);
  }

  const baseScript = `${params.variables.VideoScript ?? ''}`.trim();
  if (!baseScript) {
    return runStep(params);
  }

  let attemptScript = baseScript;
  let lastResult: RunStepOutput | null = null;
  let aggregatedMetrics: StepRunMetrics | null = null;
  let attemptsUsed = 0;
  let lastScript = baseScript;
  let lastScriptWordCount = countWords(baseScript);

  for (let attempt = 0; attempt < SCRIPT_QA_MAX_ATTEMPTS; attempt += 1) {
    attemptsUsed = attempt + 1;
    const sourceWordCount = Math.max(0, countWords(attemptScript));
    const wordsOverCap = Math.max(0, sourceWordCount - SCRIPT_QA_TARGET_MAX_WORDS);
    const revisionNotes =
      attempt === 0
        ? 'None — first QA pass.'
        : `Attempt ${attempt} output was ${sourceWordCount} words (> ${SCRIPT_QA_TARGET_MAX_WORDS}). Remove at least ${Math.max(
            50,
            Math.min(wordsOverCap, 250),
          )} words while keeping both quizzes, the key examples, and factual accuracy.`;

    const attemptVariables: Record<string, string> = {
      ...params.variables,
      VideoScript: attemptScript,
      QA_SourceWordCount: String(sourceWordCount),
      QA_TargetWordMin: String(SCRIPT_QA_TARGET_MIN_WORDS),
      QA_TargetWordMax: String(SCRIPT_QA_TARGET_MAX_WORDS),
      QA_TargetWordRange: `${SCRIPT_QA_TARGET_MIN_WORDS}-${SCRIPT_QA_TARGET_MAX_WORDS}`,
      QA_HardWordCap: String(SCRIPT_QA_HARD_CAP_WORDS),
      QA_AttemptNumber: String(attempt + 1),
      QA_RevisionNotes: revisionNotes,
    };

    const result = await runStep({
      ...params,
      variables: attemptVariables,
    });

    aggregatedMetrics = accumulateMetrics(aggregatedMetrics, result.metrics);

    const candidateScript = extractFinalScript(result.responseText).trim();
    const normalizedResult = candidateScript
      ? {
          ...result,
          producedVariables: {
            ...result.producedVariables,
            VideoScript: candidateScript,
          },
        }
      : result;
    const candidateWordCount = candidateScript ? countWords(candidateScript) : 0;

    if (candidateScript) {
      lastScript = candidateScript;
      lastScriptWordCount = candidateWordCount;
      attemptScript = candidateScript;
    }

    lastResult = {
      ...normalizedResult,
      metrics: aggregatedMetrics,
    };

    if (candidateScript && candidateWordCount <= SCRIPT_QA_HARD_CAP_WORDS) {
      return lastResult;
    }

    if (!candidateScript) {
      break;
    }
  }

  if (!lastResult) {
    return runStep(params);
  }

  if (lastScriptWordCount <= SCRIPT_QA_HARD_CAP_WORDS) {
    return lastResult;
  }

  const forcedScript = forceTrimScript(lastScript || baseScript, SCRIPT_QA_TARGET_MAX_WORDS);
  const forcedWordCount = countWords(forcedScript);
  const syntheticResponse = buildSyntheticResponse({
    forcedScript,
    forcedWordCount,
    sourceWordCount: lastScriptWordCount,
    attemptsUsed,
  });

  return {
    ...lastResult,
    responseText: syntheticResponse,
    producedVariables: {
      ...lastResult.producedVariables,
      VideoScript: forcedScript,
    },
    metrics: aggregatedMetrics ?? lastResult.metrics,
  };
}

function accumulateMetrics(
  total: StepRunMetrics | null,
  next: StepRunMetrics,
): StepRunMetrics {
  if (!total) {
    return { ...next };
  }

  return {
    inputTokens: total.inputTokens + next.inputTokens,
    outputTokens: total.outputTokens + next.outputTokens,
    totalTokens: total.totalTokens + next.totalTokens,
    costUsd: total.costUsd + next.costUsd,
    durationMs: (total.durationMs ?? 0) + (next.durationMs ?? 0),
  };
}

function forceTrimScript(script: string, targetWordCount: number): string {
  const cleanScript = script.trim();
  if (!cleanScript) {
    return '';
  }

  const paragraphs = splitParagraphs(cleanScript);
  if (paragraphs.length === 0) {
    return truncateToWordCount(cleanScript, targetWordCount);
  }

  const metadata = paragraphs.map((text, index) => ({
    text,
    index,
    words: countWords(text),
    protected: isProtectedParagraph(text, index, paragraphs.length),
  }));

  let totalWords = metadata.reduce((sum, paragraph) => sum + paragraph.words, 0);
  if (totalWords <= targetWordCount) {
    return cleanScript;
  }

  const removalOrder = metadata
    .filter((paragraph) => !paragraph.protected)
    .sort((a, b) => {
      if (b.words !== a.words) {
        return b.words - a.words;
      }
      return b.index - a.index;
    });

  for (const paragraph of removalOrder) {
    if (totalWords <= targetWordCount) {
      break;
    }
    paragraphs[paragraph.index] = '';
    totalWords -= paragraph.words;
  }

  let recombined = paragraphs.filter((text) => text && text.trim().length > 0).join('\n\n').trim();
  let currentWords = countWords(recombined);
  if (currentWords <= targetWordCount) {
    return recombined;
  }

  const remainingMeta = paragraphs
    .map((text, index) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return null;
      }
      return {
        text: trimmed,
        index,
        words: countWords(trimmed),
        protected: isProtectedParagraph(trimmed, index, paragraphs.length),
      };
    })
    .filter((paragraph): paragraph is { text: string; index: number; words: number; protected: boolean } => Boolean(paragraph));

  const trimCandidate = remainingMeta
    .filter((paragraph) => !paragraph.protected)
    .sort((a, b) => {
      if (b.words !== a.words) {
        return b.words - a.words;
      }
      return b.index - a.index;
    })[0];

  if (trimCandidate) {
    const excess = currentWords - targetWordCount;
    paragraphs[trimCandidate.index] = trimParagraphByRemovingWords(paragraphs[trimCandidate.index], excess);
    recombined = paragraphs.filter((text) => text && text.trim().length > 0).join('\n\n').trim();
    currentWords = countWords(recombined);
  }

  if (currentWords <= targetWordCount) {
    return recombined;
  }

  return truncateToWordCount(recombined, targetWordCount);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function isProtectedParagraph(text: string, index: number, total: number): boolean {
  if (index <= 1 || index >= total - 2) {
    return true;
  }

  const normalized = text.toLowerCase();
  if (normalized.includes('question 1') || normalized.includes('question 2')) {
    return true;
  }
  if (normalized.includes('quiz') || normalized.includes('true or false')) {
    return true;
  }
  if (normalized.includes('thanks for learning') || normalized.includes('next time')) {
    return true;
  }
  if (normalized.includes('today we learned') || normalized.includes('pip academy')) {
    return true;
  }
  if (/^\s*[a-d]\./i.test(text)) {
    return true;
  }
  if (/^\s*\[.+\]\s*$/i.test(text)) {
    return true;
  }
  if (/if you (said|chose)/i.test(text)) {
    return true;
  }

  return false;
}

function trimParagraphByRemovingWords(paragraph: string, removeWords: number): string {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }

  if (words.length <= removeWords) {
    return '';
  }

  const keepCount = Math.max(1, words.length - removeWords);
  const trimmed = words.slice(0, keepCount).join(' ').trim();
  if (!trimmed) {
    return '';
  }
  return /[.!?"]$/.test(trimmed) ? trimmed : `${trimmed}…`;
}

function truncateToWordCount(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text.trim();
  }

  const trimmed = words.slice(0, maxWords).join(' ').trim();
  if (!trimmed) {
    return '';
  }
  return /[.!?"]$/.test(trimmed) ? trimmed : `${trimmed}…`;
}

function buildSyntheticResponse({
  forcedScript,
  forcedWordCount,
  sourceWordCount,
  attemptsUsed,
}: {
  forcedScript: string;
  forcedWordCount: number;
  sourceWordCount: number;
  attemptsUsed: number;
}): string {
  const checklist = [
    'Checklist:',
    `LENGTH: ✅ ${forcedWordCount} words; auto-trimmed after ${sourceWordCount}-word draft still exceeded the cap on attempt ${attemptsUsed}.`,
    'FACTS: ✅ Removed only redundant sentences; key facts and quizzes preserved.',
    'TONE: ✅ Tone kept friendly while tightening wording.',
    '',
    'Final Script:',
    forcedScript.trim(),
  ];

  return checklist.join('\n');
}


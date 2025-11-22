import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModelId, StepConfig } from '../../types/agent';
import { extractFinalScript, runScriptQaWithWordGoal } from './scriptQA';
import { runStep } from './runStep';

vi.mock('./runStep', () => ({
  runStep: vi.fn(),
}));

describe('extractFinalScript', () => {
  it('returns only the portion after the final script marker', () => {
    const script = [
      'Checklist:',
      'LENGTH: ✅ 1,420 words (trimmed intro)',
      'FACTS: ✅ verified',
      'TONE: ✅ curious and calm',
      '',
      'Final Script:',
      'Hey explorers! Today we are zooming to the Moon.',
      'First, we talk about phases, then gravity, then how astronauts train.',
    ].join('\n');

    expect(extractFinalScript(script)).toBe(
      'Hey explorers! Today we are zooming to the Moon.\nFirst, we talk about phases, then gravity, then how astronauts train.',
    );
  });

  it('drops any trailing QA summaries that appear after the script block', () => {
    const response = [
      'Final Script:',
      'We hop into our rocket and glide into the night sky.',
      'Down on Earth, kids can spot constellations with a grown-up helper.',
      '',
      'QA Summary:',
      'All checks ✅',
    ].join('\n');

    expect(extractFinalScript(response)).toBe(
      'We hop into our rocket and glide into the night sky.\nDown on Earth, kids can spot constellations with a grown-up helper.',
    );
  });

  it('falls back to removing checklist noise and picking the largest block when no marker exists', () => {
    const response = [
      'Checklist:',
      'LENGTH: ✅ trimmed outro by 80 words',
      'FACTS: ✅ updated the distance to the Sun',
      '',
      'Intro draft (keep for QA only)',
      '',
      'Final adventure paragraph that should be kept.',
      'It spans several sentences so it outweighs the tiny intro block.',
      '',
      'QA Summary: ✅ All good',
    ].join('\n');

    expect(extractFinalScript(response)).toBe(
      'Final adventure paragraph that should be kept.\nIt spans several sentences so it outweighs the tiny intro block.',
    );
  });
});

describe('runScriptQaWithWordGoal', () => {
  const mockRunStep = vi.mocked(runStep);
  const scriptQaStep: StepConfig = {
    id: 'scriptQA',
    label: 'Script QA',
    defaultModel: 'test-model' as ModelId,
    inputVars: ['VideoScript'],
    outputVars: ['VideoScript'],
    promptTemplate: 'Prompt',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores only the cleaned final script in produced variables', async () => {
    const qaResponse = [
      'Checklist:',
      'LENGTH: ✅ 1,492 words; trimmed duplicate example.',
      'FACTS: ✅ All numbers verified.',
      'TONE: ✅ Warm and curious.',
      '',
      'Final Script:',
      'Hello space cadets! Today we are talking about comets.',
      'They are icy space travelers that grow shimmering tails near the Sun.',
    ].join('\n');

    mockRunStep.mockResolvedValueOnce({
      resolvedPrompt: 'prompt',
      responseText: qaResponse,
      metrics: {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costUsd: 0.12,
        durationMs: 1500,
      },
      producedVariables: {
        VideoScript: qaResponse,
      },
    });

    const result = await runScriptQaWithWordGoal({
      step: scriptQaStep,
      model: 'gpt-test' as ModelId,
      topic: 'Space',
      variables: {
        VideoScript: 'Base script content',
      },
    });

    expect(mockRunStep).toHaveBeenCalledTimes(1);
    expect(result.responseText).toBe(qaResponse);
    expect(result.producedVariables.VideoScript).toBe(
      [
        'Hello space cadets! Today we are talking about comets.',
        'They are icy space travelers that grow shimmering tails near the Sun.',
      ].join('\n'),
    );
  });
});


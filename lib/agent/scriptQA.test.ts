import { describe, expect, it } from 'vitest';

import { extractFinalScript } from './scriptQA';

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


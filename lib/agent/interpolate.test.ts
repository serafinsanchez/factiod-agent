import { describe, expect, it } from 'vitest';

import { interpolatePrompt } from './interpolate';
import { QUIZZES_PROMPT_TEMPLATE } from '../../src/prompts/quizzes.prompt';
import { NARRATION_AUDIO_TAGS_PROMPT_TEMPLATE } from '../../src/prompts/narration-audio-tags.prompt';
import { SCRIPT_PROMPT_TEMPLATE } from '../../src/prompts/script.prompt';

describe('interpolatePrompt', () => {
  describe('basic substitution', () => {
    it('replaces known keys with their values', () => {
      const template = 'Hello, [Name]! Welcome to [Place].';
      const vars = { Name: 'Alice', Place: 'Wonderland' };
      expect(interpolatePrompt(template, vars)).toBe(
        'Hello, Alice! Welcome to Wonderland.',
      );
    });

    it('replaces a key with empty string if the value is empty', () => {
      const template = 'Topic: [Topic]';
      const vars = { Topic: '' };
      expect(interpolatePrompt(template, vars)).toBe('Topic: ');
    });

    it('handles multiple occurrences of the same key', () => {
      const template = '[Greeting], [Name]! [Greeting] again, [Name]!';
      const vars = { Greeting: 'Hi', Name: 'Bob' };
      expect(interpolatePrompt(template, vars)).toBe('Hi, Bob! Hi again, Bob!');
    });
  });

  describe('preserving unknown bracket tokens', () => {
    it('leaves unknown bracket tokens intact', () => {
      const template = 'Topic: [Topic], Format: [Option A answer]';
      const vars = { Topic: 'Volcanoes' };
      expect(interpolatePrompt(template, vars)).toBe(
        'Topic: Volcanoes, Format: [Option A answer]',
      );
    });

    it('preserves all unknown tokens when vars is empty', () => {
      const template = '[tag] This is [unchanged] text with [brackets].';
      const vars = {};
      expect(interpolatePrompt(template, vars)).toBe(
        '[tag] This is [unchanged] text with [brackets].',
      );
    });

    it('handles a mix of known and unknown keys', () => {
      const template = `
Question 1: [Your question text]
A) [Option A answer]
B) [Option B answer]
Topic: [Topic]
Concepts: [KeyConcepts]
      `.trim();
      const vars = { Topic: 'Chemistry', KeyConcepts: 'Atoms, Molecules' };
      expect(interpolatePrompt(template, vars)).toBe(
        `
Question 1: [Your question text]
A) [Option A answer]
B) [Option B answer]
Topic: Chemistry
Concepts: Atoms, Molecules
      `.trim(),
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty template', () => {
      expect(interpolatePrompt('', { Topic: 'Test' })).toBe('');
    });

    it('handles template with no placeholders', () => {
      const template = 'No placeholders here.';
      expect(interpolatePrompt(template, { Topic: 'Test' })).toBe(template);
    });

    it('handles nested-looking brackets correctly (only outer match)', () => {
      // The regex matches [content] where content has no ].
      // This template doesn't have true nesting, just adjacent brackets.
      const template = '[A] and [B] and [C]';
      const vars = { A: '1', C: '3' };
      expect(interpolatePrompt(template, vars)).toBe('1 and [B] and 3');
    });
  });
});

describe('prompt template smoke tests', () => {
  /**
   * These tests ensure that critical bracket examples in prompt templates
   * are preserved after interpolation. If any of these fail, it means the
   * interpolation is incorrectly substituting literal examples.
   */

  describe('quizzes prompt', () => {
    it('preserves quiz format examples after interpolation', () => {
      const vars = {
        Topic: 'Volcanoes',
        KeyConcepts: 'Lava, Eruptions, Magma',
        HookScript: 'Have you ever wondered why volcanoes explode?',
      };
      const result = interpolatePrompt(QUIZZES_PROMPT_TEMPLATE, vars);

      // These literal examples MUST remain in the interpolated prompt.
      expect(result).toContain('[Your question text]');
      expect(result).toContain('[Option A answer]');
      expect(result).toContain('[Option B answer]');
      expect(result).toContain('[Option C answer]');
      expect(result).toContain('[Option D answer]');
      expect(result).toContain('[Correct option letter]');

      // The actual variables should be substituted.
      expect(result).toContain('Volcanoes');
      expect(result).toContain('Lava, Eruptions, Magma');
      expect(result).not.toContain('[Topic]');
      expect(result).not.toContain('[KeyConcepts]');
      expect(result).not.toContain('[HookScript]');
    });
  });

  describe('narration audio tags prompt', () => {
    it('preserves [tag] examples after interpolation', () => {
      const vars = {
        NarrationScript: 'Hello everyone! Today we learn about space.',
      };
      const result = interpolatePrompt(NARRATION_AUDIO_TAGS_PROMPT_TEMPLATE, vars);

      // Tag examples MUST remain in the interpolated prompt.
      expect(result).toContain('[tag]');
      expect(result).toContain('[excited]');
      expect(result).toContain('[super-happy]');
      expect(result).toContain('[half-whisper]');
      expect(result).toContain('[curious]');
      expect(result).toContain('[warmly]');

      // The actual variable should be substituted.
      expect(result).toContain('Hello everyone! Today we learn about space.');
      expect(result).not.toContain('[NarrationScript]');
    });
  });

  describe('script prompt', () => {
    it('preserves literal examples while substituting variables', () => {
      const vars = {
        Topic: 'The Moon',
        KeyConcepts: 'Phases, Gravity, Craters',
        HookScript: 'Look up at the night sky...',
        QuizInfo: 'Q1: What causes moon phases?',
        DefaultWordCount: '1500',
      };
      const result = interpolatePrompt(SCRIPT_PROMPT_TEMPLATE, vars);

      // Literal bracket examples in the prompt structure MUST remain.
      // The script prompt contains "[correct answer]" as an example of what to say.
      expect(result).toContain('[correct answer]');

      // Variables should be substituted.
      expect(result).toContain('The Moon');
      expect(result).toContain('Phases, Gravity, Craters');
      expect(result).toContain('1500');
      expect(result).not.toContain('[Topic]');
      expect(result).not.toContain('[KeyConcepts]');
      expect(result).not.toContain('[DefaultWordCount]');
    });
  });
});

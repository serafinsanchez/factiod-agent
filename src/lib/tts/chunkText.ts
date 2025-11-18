import { ELEVEN_V3_SAFE_CHARS } from '@/lib/tts/elevenlabs';

const SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+/;

function splitLongToken(token: string, max: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < token.length; i += max) {
    parts.push(token.slice(i, i + max));
  }
  return parts;
}

function splitSentenceByWords(sentence: string, max: number): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  const segments: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;

    if (candidate.length <= max) {
      current = candidate;
      continue;
    }

    if (current) {
      segments.push(current);
      current = '';
    }

    if (word.length <= max) {
      current = word;
      continue;
    }

    const pieces = splitLongToken(word, max);
    const last = pieces.pop();
    segments.push(...pieces);
    if (last) {
      current = last;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

function splitParagraph(paragraph: string, max: number): string[] {
  if (paragraph.length <= max) {
    return [paragraph];
  }

  const sentences = paragraph
    .split(SENTENCE_SPLIT_REGEX)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return splitSentenceByWords(paragraph, max);
  }

  const segments: string[] = [];
  let buffer = '';

  const flushBuffer = () => {
    if (buffer) {
      segments.push(buffer);
      buffer = '';
    }
  };

  for (const sentence of sentences) {
    if (sentence.length > max) {
      flushBuffer();
      segments.push(...splitSentenceByWords(sentence, max));
      continue;
    }

    const candidate = buffer.length === 0 ? sentence : `${buffer} ${sentence}`;
    if (candidate.length <= max) {
      buffer = candidate;
    } else {
      flushBuffer();
      buffer = sentence;
    }
  }

  flushBuffer();
  return segments;
}

export function chunkForElevenV3(
  text: string,
  maxChars: number = ELEVEN_V3_SAFE_CHARS,
): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/);

  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current);
    }
    current = '';
  };

  const appendSegment = (segment: string) => {
    if (!segment) {
      return;
    }

    const addition = current.length === 0 ? segment : `\n\n${segment}`;
    if (current.length + addition.length <= maxChars) {
      current += addition;
      return;
    }

    pushCurrent();
    if (segment.length <= maxChars) {
      current = segment;
      return;
    }

    const overflowSegments = splitSentenceByWords(
      segment,
      maxChars,
    );
    for (const overflow of overflowSegments) {
      appendSegment(overflow);
    }
  };

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      continue;
    }

    const segments =
      trimmed.length <= maxChars
        ? [trimmed]
        : splitParagraph(trimmed, maxChars);

    for (const segment of segments) {
      appendSegment(segment);
    }
  }

  pushCurrent();

  return chunks.length > 0 ? chunks : [normalized.slice(0, maxChars)];
}


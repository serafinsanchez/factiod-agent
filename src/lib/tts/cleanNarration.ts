const KEYWORD_REGEX = /(music|sfx|sound|pause the video|fade under)/i;

export function toNarrationOnly(input: string): string {
  const normalized = input.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return true;
    }

    const isParenWrapped =
      trimmed.startsWith('(') && trimmed.endsWith(')');

    if (isParenWrapped && KEYWORD_REGEX.test(trimmed)) {
      return false;
    }

    return true;
  });

  return cleaned.join('\n');
}


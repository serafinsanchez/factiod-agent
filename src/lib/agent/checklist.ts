export function extractChecklist(responseText: string): string {
  const normalized = responseText.replace(/\r\n/g, "\n");
  const lower = normalized.toLowerCase();
  const markerIndex = lower.indexOf("final script");
  const before = markerIndex !== -1 ? normalized.slice(0, markerIndex) : normalized;
  const trimmed = before.trim();
  if (!trimmed) {
    return "Awaiting checklist…";
  }

  const checklistIndex = trimmed.toLowerCase().indexOf("checklist:");
  if (checklistIndex !== -1) {
    return trimmed.slice(checklistIndex).trim();
  }

  return trimmed;
}

export function ensureChecklistWordCount(checklist: string, actualWords?: number | null): string {
  if (!actualWords || !Number.isFinite(actualWords)) {
    return checklist;
  }

  const formattedCount = actualWords.toLocaleString();
  const lengthLineRegex = /^([-\s>*•]*LENGTH:\s*(?:[✅❌☑️✔️✖️]\s*)?)(.*)$/im;
  const match = checklist.match(lengthLineRegex);

  if (!match) {
    const prefix = `LENGTH: Final word count: ${formattedCount} words.`;
    return checklist ? `${prefix}\n${checklist}` : prefix;
  }

  return checklist.replace(lengthLineRegex, (_full, prefix: string, rest: string) => {
    const finalWordPattern = /(final word count:\s*)([\d,]+)/i;
    if (finalWordPattern.test(rest)) {
      const updatedRest = rest.replace(finalWordPattern, `$1${formattedCount}`);
      return `${prefix}${updatedRest}`.trimEnd();
    }

    const trimmedRest = rest.trimStart();
    const spacer = trimmedRest ? " " : "";
    return `${prefix}Final word count: ${formattedCount} words.${spacer}${trimmedRest}`.trimEnd();
  });
}


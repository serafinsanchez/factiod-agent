const FINAL_SCRIPT_MARKER = 'final script:';

export function extractFinalScript(responseText: string): string {
  if (!responseText) {
    return '';
  }

  const normalized = responseText.toLowerCase();
  const markerIndex = normalized.lastIndexOf(FINAL_SCRIPT_MARKER);

  if (markerIndex === -1) {
    return responseText.trim();
  }

  const startIndex = markerIndex + FINAL_SCRIPT_MARKER.length;
  const finalScript = responseText.slice(startIndex).trim();

  return finalScript || responseText.trim();
}


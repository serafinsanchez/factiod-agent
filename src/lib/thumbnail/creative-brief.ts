/**
 * Thumbnail creative brief parsing and validation utilities.
 *
 * The thumbnail prompt step produces a 7-line creative brief with specific labels.
 * These utilities validate and extract data from that brief.
 */

// =============================================================================
// Required labels (in order)
// =============================================================================

export const CREATIVE_BRIEF_LABELS = [
  "Subject & Action:",
  "Environment & Props:",
  "Lighting & Mood:",
  "Color Palette & Style:",
  "Camera & Composition:",
  "Text Overlay:",
  "Negative Prompts:",
] as const;

export type CreativeBriefLabel = (typeof CREATIVE_BRIEF_LABELS)[number];

// =============================================================================
// Validation
// =============================================================================

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validates a thumbnail creative brief.
 *
 * Requirements:
 * - Exactly 7 non-empty lines
 * - Each line starts with the correct label (in order)
 * - Text Overlay line contains quoted or unquoted text
 *
 * @param brief - The raw creative brief text from the LLM
 * @param options - Validation options
 * @returns Validation result with error message if invalid
 */
export function validateThumbnailCreativeBrief(
  brief: string,
  options?: { allowRepair?: boolean },
): ValidationResult {
  if (!brief || typeof brief !== "string") {
    return { ok: false, error: "Creative brief is empty or not a string." };
  }

  // Optionally try to repair the brief before validation
  const workingBrief = options?.allowRepair ? repairCreativeBrief(brief) : brief;

  const lines = workingBrief
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Check line count
  if (lines.length !== 7) {
    return {
      ok: false,
      error: `Expected exactly 7 lines, but got ${lines.length}. ` +
        `Each line should start with one of: ${CREATIVE_BRIEF_LABELS.slice(0, 3).join(", ")}, etc.`,
    };
  }

  // Check each label
  for (let i = 0; i < CREATIVE_BRIEF_LABELS.length; i++) {
    const expectedLabel = CREATIVE_BRIEF_LABELS[i];
    const line = lines[i];

    if (!line.startsWith(expectedLabel)) {
      // Check if the label is present but in wrong position
      const foundLabelIndex = CREATIVE_BRIEF_LABELS.findIndex((label) =>
        line.startsWith(label),
      );

      if (foundLabelIndex >= 0) {
        return {
          ok: false,
          error: `Line ${i + 1} should start with "${expectedLabel}", ` +
            `but found "${CREATIVE_BRIEF_LABELS[foundLabelIndex]}" instead. ` +
            `Labels must appear in order.`,
        };
      }

      return {
        ok: false,
        error: `Line ${i + 1} must start with "${expectedLabel}". ` +
          `Got: "${line.slice(0, 40)}${line.length > 40 ? "..." : ""}"`,
      };
    }

    // For Text Overlay, check that there's actual content
    if (expectedLabel === "Text Overlay:") {
      const content = line.slice(expectedLabel.length).trim();
      if (content.length === 0) {
        return {
          ok: false,
          error: `Text Overlay line is empty. It should contain a 3-4 word caption.`,
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Attempts to repair common issues in a creative brief.
 *
 * Repairs:
 * - Removes blank lines
 * - Trims whitespace
 * - Limits to first 7 valid lines
 *
 * @param brief - The raw creative brief text
 * @returns Repaired brief (or original if no repairs needed)
 */
export function repairCreativeBrief(brief: string): string {
  if (!brief || typeof brief !== "string") {
    return brief;
  }

  // Split and clean lines
  const lines = brief
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Keep only lines that start with a known label (in order)
  const validLines: string[] = [];
  let labelIndex = 0;

  for (const line of lines) {
    if (labelIndex >= CREATIVE_BRIEF_LABELS.length) break;

    const expectedLabel = CREATIVE_BRIEF_LABELS[labelIndex];
    if (line.startsWith(expectedLabel)) {
      validLines.push(line);
      labelIndex++;
    }
  }

  return validLines.join("\n");
}

// =============================================================================
// Text Overlay Extraction
// =============================================================================

/**
 * Extracts the text overlay content from a creative brief.
 *
 * Handles various formats:
 * - Quoted: `Text Overlay: "Caption Here" in upper-left...`
 * - Curly quoted: `Text Overlay: "Caption Here" in upper-left...`
 * - Unquoted: `Text Overlay: Caption Here in upper-left corner...`
 *
 * @param creativeBrief - The full creative brief or just the Text Overlay line
 * @returns The extracted overlay text, or null if not found
 */
export function extractTextOverlay(creativeBrief: string | unknown): string | null {
  if (typeof creativeBrief !== "string") return null;

  // Try to find quoted text first (most reliable)
  const quotedMatch = creativeBrief.match(
    /Text Overlay:\s*["""\u201C\u201D]([^"""\u201C\u201D\n]+)["""\u201C\u201D]/i,
  );
  const quoted = quotedMatch?.[1]?.trim();
  if (quoted && quoted.length > 0) {
    return quoted;
  }

  // Fallback: locate the Text Overlay line and apply heuristics
  const lineMatch = creativeBrief.match(/^Text Overlay:\s*(.+)$/im);
  const remainder = lineMatch?.[1]?.trim();
  if (!remainder) return null;

  // Handle quotes at start of remainder
  const quoteLike = remainder[0];
  if (quoteLike === `"` || quoteLike === "\u201C" || quoteLike === "\u201D") {
    const rest = remainder.slice(1);
    const endIdx = rest.search(/["""\u201C\u201D]/);
    const extracted = (endIdx >= 0 ? rest.slice(0, endIdx) : rest).trim();
    return extracted.length > 0 ? extracted : null;
  }

  // Common unquoted format: `Text Overlay: Lunar Rover Secrets in upper-left corner ...`
  // Stop at common position/style descriptors
  const stopMatchers: RegExp[] = [
    /\s+in\s+the\s+upper-left\b/i,
    /\s+in\s+upper-left\b/i,
    /\s+upper-left\b/i,
    /\s+in\s+the\s+top-left\b/i,
    /\s+in\s+top-left\b/i,
    /\s+top-left\b/i,
    /\s+in\s+the\s+corner\b/i,
    /,\s+bold\b/i,
    /,\s+white\b/i,
    /,\s+black\b/i,
  ];

  let candidate = remainder;
  for (const re of stopMatchers) {
    const idx = candidate.search(re);
    if (idx > 0) {
      candidate = candidate.slice(0, idx);
      break;
    }
  }

  // If the remainder still contains long style guidance, trim at common separators
  candidate = candidate.split(/[;,—-]/)[0] ?? candidate;

  // Clean up trailing punctuation
  candidate = candidate.trim().replace(/[.]+$/, "").trim();

  return candidate.length > 0 ? candidate : null;
}

/**
 * Validates that a text overlay is a reasonable 3-4 word caption.
 *
 * @param overlay - The extracted overlay text
 * @returns Validation result
 */
export function validateTextOverlay(overlay: string | null): ValidationResult {
  if (!overlay || overlay.length === 0) {
    return { ok: false, error: "Text overlay is empty." };
  }

  const wordCount = overlay.split(/\s+/).length;

  if (wordCount < 2) {
    return {
      ok: false,
      error: `Text overlay should be 3-4 words, but got ${wordCount} word(s): "${overlay}"`,
    };
  }

  if (wordCount > 6) {
    return {
      ok: false,
      error: `Text overlay should be 3-4 words, but got ${wordCount} words. Consider shortening: "${overlay}"`,
    };
  }

  // Check for common issues
  if (overlay.includes("http") || overlay.includes("www.")) {
    return { ok: false, error: "Text overlay should not contain URLs." };
  }

  return { ok: true };
}

// =============================================================================
// Composite validation
// =============================================================================

export type CreativeBriefValidationResult = {
  valid: boolean;
  brief: string;
  overlay: string | null;
  errors: string[];
  warnings: string[];
};

/**
 * Performs full validation of a thumbnail creative brief.
 *
 * @param brief - The raw creative brief text
 * @param options - Validation options
 * @returns Comprehensive validation result
 */
export function validateCreativeBriefFull(
  brief: string,
  options?: { allowRepair?: boolean },
): CreativeBriefValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Repair if allowed
  const workingBrief = options?.allowRepair ? repairCreativeBrief(brief) : brief;

  // Validate structure
  const structureResult = validateThumbnailCreativeBrief(workingBrief);
  if (!structureResult.ok) {
    errors.push(structureResult.error);
  }

  // Extract and validate overlay
  const overlay = extractTextOverlay(workingBrief);
  const overlayResult = validateTextOverlay(overlay);

  if (!overlayResult.ok) {
    // Overlay issues are warnings, not hard errors (the image can still be generated)
    warnings.push(overlayResult.error);
  }

  return {
    valid: errors.length === 0,
    brief: workingBrief,
    overlay,
    errors,
    warnings,
  };
}

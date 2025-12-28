import { describe, expect, it } from "vitest";

import {
  validateThumbnailCreativeBrief,
  repairCreativeBrief,
  extractTextOverlay,
  validateTextOverlay,
  validateCreativeBriefFull,
  CREATIVE_BRIEF_LABELS,
} from "./creative-brief";

// =============================================================================
// Test fixtures
// =============================================================================

const VALID_BRIEF = `Subject & Action: A gleaming metallic lunar rover with large wire-mesh wheels driving across the Moon.
Environment & Props: Stark lunar landscape with Earth visible as a small blue sphere in the sky.
Lighting & Mood: High-contrast directional sunlight creating sharp shadows and bright metallic highlights.
Color Palette & Style: Metallic silver and gold rover against cool gray regolith and deep black sky; photoreal.
Camera & Composition: Wide-angle low perspective; leave upper-left quadrant clear and unobstructed.
Text Overlay: "Lunar Rover Secrets" in upper-left corner, bold sans-serif, white text with thick black outline.
Negative Prompts: extra text beyond the overlay, watermarks, logos, gore, weapons, creepy vibes, clutter, blur.`;

const VALID_BRIEF_UNQUOTED_OVERLAY = `Subject & Action: A curious penguin sliding on ice.
Environment & Props: Antarctic landscape with icebergs.
Lighting & Mood: Bright, cheerful sunlight.
Color Palette & Style: Cool blues and whites; photoreal.
Camera & Composition: Medium shot, eye level.
Text Overlay: Cool Penguin Facts in upper-left corner, bold sans-serif.
Negative Prompts: gore, weapons, clutter.`;

const BRIEF_WITH_BLANK_LINES = `Subject & Action: A rover on the moon.

Environment & Props: Lunar landscape.

Lighting & Mood: Bright sunlight.
Color Palette & Style: Silver and gray.
Camera & Composition: Wide shot.
Text Overlay: "Moon Mission" in upper-left.
Negative Prompts: gore, clutter.`;

const BRIEF_WRONG_ORDER = `Environment & Props: Lunar landscape.
Subject & Action: A rover on the moon.
Lighting & Mood: Bright sunlight.
Color Palette & Style: Silver and gray.
Camera & Composition: Wide shot.
Text Overlay: "Moon Mission" in upper-left.
Negative Prompts: gore, clutter.`;

const BRIEF_MISSING_LABEL = `Subject & Action: A rover on the moon.
Environment & Props: Lunar landscape.
Lighting & Mood: Bright sunlight.
Color Palette & Style: Silver and gray.
Camera & Composition: Wide shot.
The text should say Moon Mission
Negative Prompts: gore, clutter.`;

const BRIEF_TOO_FEW_LINES = `Subject & Action: A rover on the moon.
Environment & Props: Lunar landscape.
Lighting & Mood: Bright sunlight.`;

// =============================================================================
// validateThumbnailCreativeBrief tests
// =============================================================================

describe("validateThumbnailCreativeBrief", () => {
  it("accepts a valid 7-line brief with correct labels", () => {
    const result = validateThumbnailCreativeBrief(VALID_BRIEF);
    expect(result.ok).toBe(true);
  });

  it("accepts a valid brief with unquoted overlay text", () => {
    const result = validateThumbnailCreativeBrief(VALID_BRIEF_UNQUOTED_OVERLAY);
    expect(result.ok).toBe(true);
  });

  it("rejects empty input", () => {
    const result = validateThumbnailCreativeBrief("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("empty");
    }
  });

  it("rejects brief with too few lines", () => {
    const result = validateThumbnailCreativeBrief(BRIEF_TOO_FEW_LINES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("7 lines");
      expect(result.error).toContain("3");
    }
  });

  it("rejects brief with labels in wrong order", () => {
    const result = validateThumbnailCreativeBrief(BRIEF_WRONG_ORDER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Subject & Action:");
      expect(result.error).toContain("Environment & Props:");
    }
  });

  it("rejects brief with missing label", () => {
    const result = validateThumbnailCreativeBrief(BRIEF_MISSING_LABEL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Text Overlay:");
    }
  });

  it("accepts repaired brief with allowRepair option", () => {
    const result = validateThumbnailCreativeBrief(BRIEF_WITH_BLANK_LINES, {
      allowRepair: true,
    });
    expect(result.ok).toBe(true);
  });
});

// =============================================================================
// repairCreativeBrief tests
// =============================================================================

describe("repairCreativeBrief", () => {
  it("removes blank lines while preserving valid content", () => {
    const repaired = repairCreativeBrief(BRIEF_WITH_BLANK_LINES);
    const lines = repaired.split("\n").filter((l) => l.trim().length > 0);
    expect(lines.length).toBe(7);
    expect(lines[0]).toContain("Subject & Action:");
  });

  it("returns empty string for null/undefined input", () => {
    expect(repairCreativeBrief(null as unknown as string)).toBe(null);
    expect(repairCreativeBrief(undefined as unknown as string)).toBe(undefined);
  });

  it("trims whitespace from lines", () => {
    const brief = `  Subject & Action: Test  
   Environment & Props: Test  
Lighting & Mood: Test
Color Palette & Style: Test
Camera & Composition: Test
Text Overlay: "Test"
Negative Prompts: none`;

    const repaired = repairCreativeBrief(brief);
    const lines = repaired.split("\n");
    expect(lines[0]).toBe("Subject & Action: Test");
  });
});

// =============================================================================
// extractTextOverlay tests
// =============================================================================

describe("extractTextOverlay", () => {
  it("extracts quoted overlay text with straight quotes", () => {
    const result = extractTextOverlay(VALID_BRIEF);
    expect(result).toBe("Lunar Rover Secrets");
  });

  it("extracts overlay text with curly quotes", () => {
    const brief = `Text Overlay: "Moon Facts" in upper-left`;
    const result = extractTextOverlay(brief);
    expect(result).toBe("Moon Facts");
  });

  it("extracts unquoted overlay text, stopping at position descriptor", () => {
    const result = extractTextOverlay(VALID_BRIEF_UNQUOTED_OVERLAY);
    expect(result).toBe("Cool Penguin Facts");
  });

  it("handles overlay text with comma separator", () => {
    const brief = `Text Overlay: Space Exploration, bold sans-serif in upper-left`;
    const result = extractTextOverlay(brief);
    expect(result).toBe("Space Exploration");
  });

  it("returns null for missing overlay line", () => {
    const brief = `Subject & Action: Test\nEnvironment & Props: Test`;
    const result = extractTextOverlay(brief);
    expect(result).toBe(null);
  });

  it("returns null for non-string input", () => {
    expect(extractTextOverlay(null)).toBe(null);
    expect(extractTextOverlay(undefined)).toBe(null);
    expect(extractTextOverlay(123)).toBe(null);
  });

  it("handles various position descriptors", () => {
    const cases = [
      ["Text Overlay: Test Caption in the upper-left corner", "Test Caption"],
      ["Text Overlay: Test Caption in upper-left", "Test Caption"],
      ["Text Overlay: Test Caption upper-left corner", "Test Caption"],
      ["Text Overlay: Test Caption in top-left", "Test Caption"],
    ];

    for (const [input, expected] of cases) {
      expect(extractTextOverlay(input)).toBe(expected);
    }
  });
});

// =============================================================================
// validateTextOverlay tests
// =============================================================================

describe("validateTextOverlay", () => {
  it("accepts valid 3-4 word overlay", () => {
    expect(validateTextOverlay("Lunar Rover Secrets").ok).toBe(true);
    expect(validateTextOverlay("Moon Facts").ok).toBe(true);
    expect(validateTextOverlay("Cool Space Stuff Here").ok).toBe(true);
  });

  it("rejects null/empty overlay", () => {
    const result = validateTextOverlay(null);
    expect(result.ok).toBe(false);
  });

  it("warns about single-word overlay", () => {
    const result = validateTextOverlay("Moon");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("1 word");
    }
  });

  it("warns about very long overlay", () => {
    const result = validateTextOverlay(
      "This Is A Very Long Caption That Should Be Shortened",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("words");
    }
  });

  it("rejects overlay containing URLs", () => {
    const result = validateTextOverlay("Visit https://example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("URL");
    }
  });
});

// =============================================================================
// validateCreativeBriefFull tests
// =============================================================================

describe("validateCreativeBriefFull", () => {
  it("returns valid=true for correct brief with valid overlay", () => {
    const result = validateCreativeBriefFull(VALID_BRIEF);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.overlay).toBe("Lunar Rover Secrets");
  });

  it("returns errors for structural issues", () => {
    const result = validateCreativeBriefFull(BRIEF_TOO_FEW_LINES);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns warnings for overlay issues (not errors)", () => {
    // Create a structurally valid brief with a bad overlay
    const briefWithBadOverlay = VALID_BRIEF.replace(
      `"Lunar Rover Secrets"`,
      `"X"`,
    );
    const result = validateCreativeBriefFull(briefWithBadOverlay);
    // Structure is valid, so no errors
    expect(result.valid).toBe(true);
    // Overlay is too short, so warnings
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("repairs brief when allowRepair=true", () => {
    const result = validateCreativeBriefFull(BRIEF_WITH_BLANK_LINES, {
      allowRepair: true,
    });
    expect(result.valid).toBe(true);
    expect(result.brief).not.toContain("\n\n");
  });
});

// =============================================================================
// CREATIVE_BRIEF_LABELS constant test
// =============================================================================

describe("CREATIVE_BRIEF_LABELS", () => {
  it("contains exactly 7 labels", () => {
    expect(CREATIVE_BRIEF_LABELS).toHaveLength(7);
  });

  it("has labels in expected order", () => {
    expect(CREATIVE_BRIEF_LABELS[0]).toBe("Subject & Action:");
    expect(CREATIVE_BRIEF_LABELS[5]).toBe("Text Overlay:");
    expect(CREATIVE_BRIEF_LABELS[6]).toBe("Negative Prompts:");
  });
});

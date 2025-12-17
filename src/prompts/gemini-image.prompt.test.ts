import { describe, expect, it } from "vitest";

import type { VisualStylePreset } from "./visual-styles";

import { buildGeminiImagePrompt as buildGeminiImagePromptForKids } from "./gemini-image.prompt";
import { buildGeminiImagePrompt as buildGeminiImagePromptForEveryone } from "./everyone/gemini-image.prompt";

const DUMMY_STYLE = {
  imageStylePrompt: "DUMMY_STYLE_PROMPT",
  requiresCharacterReference: false,
} as unknown as VisualStylePreset;

function makeCreativeBriefWithOverlay(overlayText: string) {
  return [
    "Subject & Action: A gleaming metallic lunar rover with large wire-mesh wheels driving across the Moon.",
    "Environment & Props: Stark lunar landscape with Earth visible as a small blue sphere in the sky.",
    "Lighting & Mood: High-contrast directional sunlight creating sharp shadows and bright metallic highlights.",
    "Color Palette & Style: Metallic silver and gold rover against cool gray regolith and deep black sky; photoreal.",
    "Camera & Composition: Wide-angle low perspective; leave upper-left quadrant clear and unobstructed.",
    `Text Overlay: "${overlayText}" in upper-left corner, bold sans-serif, white text with thick black outline.`,
    "Negative Prompts: extra text beyond the overlay, watermarks, logos, gore, weapons, creepy vibes, clutter, blur.",
  ].join("\n");
}

describe("buildGeminiImagePrompt (thumbnail overlay enforcement)", () => {
  it("enforces exact OVERLAY_TEXT and places it before Requirements (forKids)", () => {
    const creativeBrief = makeCreativeBriefWithOverlay("Lunar Rover Explained");

    const { structuredPrompt } = buildGeminiImagePromptForKids({
      creativeBrief,
      skipTextOverlay: false,
      visualStyle: DUMMY_STYLE,
      variationTag: "test",
    });

    expect(structuredPrompt).toContain('OVERLAY_TEXT="Lunar Rover Explained"');
    expect(structuredPrompt).toContain("Render ONLY the exact OVERLAY_TEXT");
    expect(structuredPrompt).toContain("If you cannot render OVERLAY_TEXT exactly, render NO text");
    expect(structuredPrompt).not.toContain("caption derived from the brief");

    const overlayIdx = structuredPrompt.indexOf('OVERLAY_TEXT="Lunar Rover Explained"');
    const requirementsIdx = structuredPrompt.indexOf("Requirements:");
    expect(overlayIdx).toBeGreaterThanOrEqual(0);
    expect(requirementsIdx).toBeGreaterThanOrEqual(0);
    expect(overlayIdx).toBeLessThan(requirementsIdx);
  });

  it("enforces exact OVERLAY_TEXT and places it before Requirements (forEveryone)", () => {
    const creativeBrief = makeCreativeBriefWithOverlay("Lunar Rover Explained");

    const { structuredPrompt } = buildGeminiImagePromptForEveryone({
      creativeBrief,
      skipTextOverlay: false,
      visualStyle: DUMMY_STYLE,
      variationTag: "test",
    });

    expect(structuredPrompt).toContain('OVERLAY_TEXT="Lunar Rover Explained"');
    expect(structuredPrompt).toContain("Render ONLY the exact OVERLAY_TEXT");

    const overlayIdx = structuredPrompt.indexOf('OVERLAY_TEXT="Lunar Rover Explained"');
    const requirementsIdx = structuredPrompt.indexOf("Requirements:");
    expect(overlayIdx).toBeGreaterThanOrEqual(0);
    expect(requirementsIdx).toBeGreaterThanOrEqual(0);
    expect(overlayIdx).toBeLessThan(requirementsIdx);
  });
});

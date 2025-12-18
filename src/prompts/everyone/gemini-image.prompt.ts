import type { VisualStylePreset } from '../visual-styles';

type GeminiContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export function buildGeminiImagePrompt({
  creativeBrief,
  skipTextOverlay,
  visualStyle,
  referenceImage,
  variationTag,
}: {
  creativeBrief: string;
  skipTextOverlay: boolean;
  visualStyle: VisualStylePreset;
  referenceImage?: string;
  variationTag: string;
}): { structuredPrompt: string; contentParts: GeminiContentPart[] } {
  // Match straight quotes, curly quotes, or unquoted text after "Text Overlay:"
  const overlayMatch = typeof creativeBrief === "string"
    ? creativeBrief.match(/Text Overlay:\s*["""\u201C\u201D]?([^"""\u201C\u201D\n]+)["""\u201C\u201D]?/i)
    : null;
  const negativeLineMatch = typeof creativeBrief === "string"
    ? creativeBrief.match(/Negative Prompts:\s*(.+)\s*$/im)
    : null;
  const extractedOverlay = overlayMatch?.[1] ?? null;
  const negativeLine = negativeLineMatch?.[1] ?? null;
  const overlayText = typeof extractedOverlay === "string" ? extractedOverlay.trim() : "";
  const hasOverlayText = overlayText.length > 0;

  // Build the main instruction block.
  const promptLines: string[] = skipTextOverlay
    ? [
        // Use the visual style's image prompt for scene images
        visualStyle.imageStylePrompt,
        ...(referenceImage && visualStyle.requiresCharacterReference
          ? [
              "CRITICAL - Character Consistency: A reference image is provided showing the exact character design. You MUST match this character's face, hair style, hair color, skin tone, outfit, and proportions EXACTLY in the new scene. The character should look identical to the reference.",
            ]
          : []),
      ]
    : [
        // Photoreal style for thumbnails
        "You are Gemini 3 Pro Image Preview generating a cinematic 16:9 YouTube thumbnail for curious viewers of all ages.",
        "Interpret the creative brief below and render a photoreal subject mid-action with expressive emotion.",
        "Requirements:",
        "- Subject & action: follow the brief, make the main character the focal point, capture motion.",
        "- Environment: include context from the topic in the background with depth and storytelling props.",
        "- Lighting & mood: bright, high-key rim light with soft diffusion; no harsh shadows.",
      ];

  // Only add text overlay instruction for thumbnails, not scene images.
  // Insert early (before the general Requirements block) so it carries maximum weight.
  if (!skipTextOverlay) {
    const overlayLines = hasOverlayText
      ? [
          `OVERLAY_TEXT="${overlayText}"`,
          "CRITICAL: Render ONLY the exact OVERLAY_TEXT above in the image, verbatim (same spelling, capitalization, and spacing).",
          "CRITICAL: Do NOT paraphrase, shorten, translate, substitute, or \"improve\" OVERLAY_TEXT.",
          "CRITICAL: If you cannot render OVERLAY_TEXT exactly, render NO text at all (better than wrong text).",
          "- Text overlay placement & style: upper-left, bold sans-serif, thick outline, high contrast; keep fully readable; do not cover faces.",
          "- Text rule: The overlay is the ONLY allowed text; do not add any other words, labels, watermarks, logos, or UI text.",
        ]
      : [
          "CRITICAL: Add a bold, 3-4 word caption derived from the brief in the upper-left, high-contrast, legible.",
          "- Text rule: The overlay is the ONLY allowed text; do not add any other words, labels, watermarks, logos, or UI text.",
        ];

    // If the creative brief's negative list contains "text/captions", clarify it's about EXTRA text only.
    if (typeof negativeLine === "string" && /\b(text|captions?|labels?|words?)\b/i.test(negativeLine)) {
      overlayLines.push(
        "- IMPORTANT: Any 'no text/captions/labels/words' constraints apply only to EXTRA/accidental text; the overlay text is required."
      );
    }

    // For thumbnails, index 2 is just before "Requirements:" in the base prompt array.
    promptLines.splice(2, 0, ...overlayLines);
  }

  promptLines.push(
    "- Camera & composition: cinematic wide shot, shallow depth of field, rule-of-thirds framing, plenty of breathing room.",
    skipTextOverlay
      ? "- Safety & negatives: family-friendly, no gore, no weapons, no logos, no creepy vibes, absolutely NO text, captions, labels, or words anywhere in the image."
      : "- Safety & negatives: family-friendly, no gore, no weapons, no extra logos, no creepy vibes, no additional text beyond the overlay.",
    !skipTextOverlay && hasOverlayText
      ? "- Variation: You may vary camera angle, composition, props, and lighting between renders, but NEVER change OVERLAY_TEXT."
      : "- Variation: Create a unique composition different from previous generations.",
    "Creative brief:",
    `\"\"\"${creativeBrief}\"\"\"`
  );

  const structuredPrompt = promptLines.join("\n");

  const contentParts: GeminiContentPart[] = [{ text: structuredPrompt }];

  if (referenceImage && typeof referenceImage === "string") {
    contentParts.push({
      inlineData: {
        mimeType: "image/png",
        data: referenceImage,
      },
    });
  }

  return { structuredPrompt, contentParts };
}

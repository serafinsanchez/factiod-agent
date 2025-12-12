import type { VisualStylePreset } from './visual-styles';

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
        "You are Gemini 3 Pro Image Preview generating a cinematic 16:9 YouTube thumbnail for curious kids ages 5-9.",
        "Interpret the creative brief below and render a photoreal subject mid-action with expressive emotion.",
        "Requirements:",
        "- Subject & action: follow the brief, make the main character the focal point, capture motion.",
        "- Environment: include context from the topic in the background with depth and storytelling props.",
        "- Lighting & mood: bright, high-key rim light with soft diffusion; no harsh shadows.",
      ];

  // Only add text overlay instruction for thumbnails, not scene images
  if (!skipTextOverlay) {
    promptLines.push(
      "- Text overlay: add a bold, 2-3 word caption derived from the brief in the upper-left, high-contrast, legible."
    );
  }

  promptLines.push(
    "- Camera & composition: cinematic wide shot, shallow depth of field, rule-of-thirds framing, plenty of breathing room.",
    skipTextOverlay
      ? "- Safety & negatives: kid-safe, no gore, no weapons, no logos, no creepy vibes, absolutely NO text, captions, labels, or words anywhere in the image."
      : "- Safety & negatives: kid-safe, no gore, no weapons, no extra logos, no creepy vibes, no additional text beyond the overlay.",
    `- Variation tag: ${variationTag}. Treat this tag as a randomness source so every run looks different, but never draw or print it.`,
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

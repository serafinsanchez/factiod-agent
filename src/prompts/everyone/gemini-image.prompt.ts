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
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'C',location:'src/prompts/everyone/gemini-image.prompt.ts:19',message:'buildGeminiImagePrompt entry',data:{skipTextOverlay,hasReferenceImage:Boolean(referenceImage),variationTagLen:typeof variationTag==='string'?variationTag.length:null,creativeBriefLen:typeof creativeBrief==='string'?creativeBrief.length:null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'A',location:'src/prompts/everyone/gemini-image.prompt.ts:33',message:'Extracted overlay + negative checks',data:{extractedOverlay,negativeHasText:typeof negativeLine==='string'?/\btext\b/i.test(negativeLine):null,negativeHasCaptions:typeof negativeLine==='string'?/\bcaptions?\b/i.test(negativeLine):null,negativeHasWords:typeof negativeLine==='string'?/\bwords?\b/i.test(negativeLine):null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'B',location:'src/prompts/everyone/gemini-image.prompt.ts:66',message:'Overlay instruction currently used',data:{skipTextOverlay,extractedOverlay,overlayInstruction:skipTextOverlay?null:'derived-from-brief'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'post-fix',hypothesisId:'B2',location:'src/prompts/everyone/gemini-image.prompt.ts:91',message:'Structured prompt contains exact-overlay enforcement',data:{hasExtractedOverlay:typeof extractedOverlay==='string'&&extractedOverlay.trim().length>0,includesExactOverlayLine:structuredPrompt.toLowerCase().includes('render the exact text'),includesImportantNegativesOverride:structuredPrompt.includes("Any 'no text/captions/labels/words' constraints")},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'B',location:'src/prompts/everyone/gemini-image.prompt.ts:83',message:'Structured prompt summary',data:{structuredPromptLen:structuredPrompt.length,includesExactOverlay:typeof extractedOverlay==='string'&&extractedOverlay.length>0?structuredPrompt.toLowerCase().includes(extractedOverlay.toLowerCase()):null,includesDerivedOverlayInstruction:structuredPrompt.includes('derived from the brief')},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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

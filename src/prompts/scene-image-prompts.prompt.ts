/**
 * Scene image prompts template.
 * Converts production script scenes into image prompts for video generation.
 * Supports both FLF2V (first+last frame) and first-frame-only modes.
 */
export const SCENE_IMAGE_PROMPTS_TEMPLATE = `Convert each scene's visualDescription into image prompts for WAN 2.2 video generation.

**Video Frame Mode:** [VideoFrameMode]

**Production Script (scenes to process):**
[ProductionScript]

[VisualStyleConsolidatedImageGuidance]

## YOUR TASK

[VideoFrameModeImageTask]

## RULES
1. **VISUAL MUST MATCH NARRATION**: The image prompt must illustrate what the narrationText is describing
2. **Text handling**: If text needed, include EXACT text in prompts
3. **Kid-safe**: Educational, friendly, no scary content
[VideoFrameModeImageRules]

Output ONLY a valid JSON array, no commentary.`;

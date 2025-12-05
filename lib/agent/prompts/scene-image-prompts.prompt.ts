/**
 * Scene image prompts template.
 * Converts production script scenes into first/last frame image prompts for FLF2V animation.
 */
export const SCENE_IMAGE_PROMPTS_TEMPLATE = `Convert each scene's visualDescription into two nearly-identical image prompts for WAN 2.2 FLF2V animation.

**Production Script (scenes to process):**
[ProductionScript]

[VisualStyleConsolidatedImageGuidance]

## YOUR TASK

For each scene, output:
- **sceneNumber**: Match the scene number from input
- **firstFramePrompt**: Complete scene description (25-40 words) - subject, pose, environment, lighting, camera
- **lastFramePrompt**: IDENTICAL to firstFramePrompt except for ONE micro-movement change explicitly stated
- **microMovement**: Label for what changes (from the table above)

## RULES
1. **VISUAL MUST MATCH NARRATION**: The image prompt must illustrate what the narrationText is describing
2. **90% identical prompts**: Camera, lighting, environment, pose must be identical - only the micro-movement differs
3. **Explicit change**: State what changes in lastFramePrompt (e.g., "eyes now glancing left" not just "looks curious")
4. **Text handling**: If text needed, include EXACT text in BOTH prompts identically
5. **Kid-safe**: Educational, friendly, no scary content

Output ONLY a valid JSON array, no commentary.`;

export const SCENE_IMAGES_PROMPT_TEMPLATE = `This is a shell step that triggers batch image generation client-side for WAN 2.2 FLF2V support.

For each scene, TWO images are generated:
1. **First Frame**: The starting pose/state (from firstFramePrompt)
2. **Last Frame**: The end state after micro-movement (from lastFramePrompt)

Both images are sent to Gemini with the character reference image to ensure visual consistency. The first frame is stored as imageUrl and the last frame as lastFrameImageUrl in the scene assets.

This dual-frame approach enables WAN 2.2's FLF2V (First-Last-Frame-to-Video) feature for smoother video transitions.`;

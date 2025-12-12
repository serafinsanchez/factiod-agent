/**
 * Scene video prompts template.
 * Generates motion prompts for WAN 2.2 video generation.
 * Supports both FLF2V (first+last frame) and first-frame-only modes.
 */
export const SCENE_VIDEO_PROMPTS_TEMPLATE = `Generate video motion prompts for WAN 2.2 video generation.

**Video Frame Mode:** [VideoFrameMode]

## INPUT DATA
[SceneImagePrompts]

[VisualStyleConsolidatedVideoGuidance]

## INSTRUCTIONS

[VideoFrameModeVideoTask]

[VideoFrameModeVideoRules]

Output ONLY valid JSON array.`;

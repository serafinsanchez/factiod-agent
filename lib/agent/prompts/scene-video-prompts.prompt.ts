/**
 * Scene video prompts template.
 * Generates motion prompts for WAN 2.2 FLF2V video generation.
 */
export const SCENE_VIDEO_PROMPTS_TEMPLATE = `Generate video motion prompts for WAN 2.2 FLF2V animation.

## INPUT DATA
[SceneImagePrompts]

[VisualStyleConsolidatedVideoGuidance]

## INSTRUCTIONS

For each scene in the input, create a video prompt that animates the micro-movement between the first and last frame.

**Output JSON array with these fields:**
- sceneNumber: Copy from input
- videoPrompt: Motion description under 40 words
- suggestedDurationSec: 5-10 (max 10)
- microMovementAnimated: **COPY the "microMovement" field from the input scene EXACTLY AS-IS**

## MICROMOVEMENT FIELD COPYING RULE

The "microMovementAnimated" output field must contain the EXACT SAME STRING as the "microMovement" input field for that scene.

**This is a LITERAL COPY operation, not interpretation:**

| Input microMovement | Output microMovementAnimated |
|---------------------|------------------------------|
| "shadow_shift" | "shadow_shift" ← COPY THIS EXACT STRING |
| "steam_drift" | "steam_drift" ← COPY THIS EXACT STRING |
| "particle_drift" | "particle_drift" ← COPY THIS EXACT STRING |

**DO NOT:**
- Invent new labels (NO "rust_spread", "bubble_rise", "liquid_swirl")
- Describe what you see (NO "bubbles_rising_through_liquid")
- Combine or modify (NO "shadow_and_light_shift")

**DO:**
- Copy the microMovement string character-for-character

## VIDEO PROMPT CONTENT

The videoPrompt should describe the motion implied by the microMovement label:
- shadow_shift → describe shadows moving
- steam_drift → describe steam drifting  
- particle_drift → describe particles drifting
- water_ripple → describe water rippling

Add 1-2 ambient details. End with camera instruction (usually "Static camera.").

## OUTPUT EXAMPLE

Input: \`{"sceneNumber": 1, "microMovement": "shadow_shift", ...}\`

Output:
\`\`\`json
{
  "sceneNumber": 1,
  "videoPrompt": "Shadows shift slowly across the metal surface. Ambient light holds steady. Dust motes drift gently. Static camera.",
  "suggestedDurationSec": 7,
  "microMovementAnimated": "shadow_shift"
}
\`\`\`

↑ Note: microMovementAnimated = "shadow_shift" because input microMovement = "shadow_shift"

Output ONLY valid JSON array.`;

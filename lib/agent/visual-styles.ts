import type { VisualStyleId } from '../../types/agent';

/**
 * Visual style preset definition for video generation.
 * Each style defines how scenes should look and whether character consistency is needed.
 */
export interface VisualStylePreset {
  id: VisualStyleId;
  label: string;
  shortLabel: string;
  description: string;
  /** Prompt snippet injected into Production Script for globalAtmosphere */
  atmospherePrompt: string;
  /** Prompt prefix for Gemini image generation */
  imageStylePrompt: string;
  /** Whether this style requires the characterReferenceImage step */
  requiresCharacterReference: boolean;
  /** Visual description hints for scene image prompts */
  sceneImageHints: string;
  /** Additional motion hints for video prompts */
  videoMotionHints: string;
  
  // Production Script prompt sections
  /** Full atmosphere section for Production Script prompt */
  productionScriptAtmosphere: string;
  /** JSON output example for Production Script prompt */
  productionScriptOutputExample: string;
  /** Visual description guidelines for Production Script prompt */
  productionScriptDescriptionGuidelines: string;
  
  // Scene Image Prompts sections
  /** Micro-movement table for FLF2V */
  sceneImageMicroMovementTable: string;
  /** Hints for how to write image prompts for this style */
  sceneImagePromptsHints: string;
  /** JSON example for scene image prompts */
  sceneImagePromptsExample: string;
  
  // Scene Video Prompts sections
  /** Breathing photograph example for this style */
  sceneVideoBreathingExample: string;
  /** JSON example for scene video prompts */
  sceneVideoPromptsExample: string;
}

/**
 * Pixar / 3D Animation Style
 * - Character-driven storytelling with a main protagonist
 * - Clean modern 3D animation look
 * - Requires character reference for consistency
 */
const PIXAR_3D_STYLE: VisualStylePreset = {
  id: 'pixar-3d',
  label: 'Pixar / 3D Animation',
  shortLabel: '3D Animation',
  description: 'Character-driven storytelling with a friendly kid protagonist. Clean, modern 3D animation similar to Pixar or Illumination studios.',
  atmospherePrompt: `Style: Clean, modern 3D animation similar to Pixar or Illumination studios.
- Rounded, friendly character shapes with soft lighting
- Vibrant, saturated colors with clean highlights
- Main character: A curious, diverse kid aged 7-10 who guides viewers through the topic
- Characters have smooth 3D-rendered appearance, slightly exaggerated proportions, large expressive eyes
- Environments: stylized 3D backgrounds with depth, soft shadows, no harsh edges
- Lighting: bright, high-key with soft diffusion and rim lighting for depth`,
  imageStylePrompt: `You are an expert 3D animation image generator creating frames for a kids educational YouTube channel.
Style: Clean, modern 3D animation similar to Pixar or Illumination studios - rounded friendly shapes, soft lighting, vibrant saturated colors.
Requirements:
- Subject & action: follow the brief exactly, maintain character consistency across frames.
- Characters: Use smooth 3D-rendered appearance with slightly exaggerated proportions, large expressive eyes, soft skin shading.
- Environment: stylized 3D backgrounds with depth, soft shadows, no harsh edges.
- Lighting: bright, high-key with soft diffusion and rim lighting for depth.
- Color palette: saturated, complementary colors with clean highlights.`,
  requiresCharacterReference: true,
  sceneImageHints: `- Feature the main character prominently in most scenes
- Show character reactions and emotions to educational content
- Character should interact with educational props and diagrams
- Maintain consistent character appearance throughout`,
  videoMotionHints: `- Focus on character expressions and gestures
- Character reactions drive emotional engagement
- Use character pointing/gesturing to direct attention to concepts`,
  
  // Production Script prompt sections
  productionScriptAtmosphere: `Create a consistent visual style for the entire video that matches PIP Academy's kid-friendly educational brand:
- Style: Clean, modern 3D animation similar to Pixar or Illumination studios
- Lighting: Bright, high-key with soft diffusion and rim lighting
- Color palette: Vibrant, saturated colors (primary blues, yellows, greens)
- Visual tone: Friendly, inviting, educational
- Characters: Rounded shapes, exaggerated proportions, large expressive eyes

**Character Sheet (CRITICAL for visual consistency):**
Define a recurring main child character who appears throughout the video. This character must be described in FULL DETAIL so that every scene featuring them looks like the SAME child. Include:
- Name (a simple, friendly name)
- Age (7-9 years old)
- Ethnicity/skin tone (be specific for consistent rendering)
- Hair: color, style, length
- Eyes: color
- Outfit: specific clothing with colors and patterns
- Expression baseline: friendly, curious`,

  productionScriptOutputExample: `\`\`\`json
{
  "globalAtmosphere": "Bright, cheerful educational setting with warm lighting. Color palette: primary blues, yellows, and greens. Style: Clean, modern 3D animation with soft edges. Mood: Curious, inviting, safe for kids.",
  "characterSheet": {
    "mainChild": "Maya, an 8-year-old African-American girl with curly brown hair in two puffs, warm brown eyes, wearing a navy blue hoodie with small white constellation patterns and light gray joggers. Friendly, curious expression with a slight smile."
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "narrationText": "The exact narration text for this scene",
      "visualDescription": "Maya examines a colorful model, eyes focused forward, hands resting near the base. Bright classroom setting with educational posters on the wall. Medium close-up at eye level.",
      "transitionHint": "same-framing",
      "sceneGroup": "hook",
      "startSec": null,
      "endSec": null,
      "estimatedDurationSec": 7.5
    }
  ],
  "totalEstimatedDurationSec": 480
}
\`\`\``,

  productionScriptDescriptionGuidelines: `- Be SPECIFIC: "Maya examining a volcano model with wide eyes" not "a kid learning"
- Anchor each scene on a single pose or diagram frame so the animation only needs a micro-movement between the first and last frame.
- When the main child appears, refer to them as "the child" or by name - the characterSheet will be used to ensure consistency
- Include environment: classroom, outdoor park, science lab, etc.
- Describe key props that illustrate the concept
- **Spell out EXACT text**: If text should appear (titles, labels, quiz options), write the exact words: "title card reading 'Moon Adventure'" NOT "title card with text". Video models cannot create readable text from vague descriptions.
- **SCENE CONTINUITY**: For consecutive scenes with "same-framing", describe NEARLY IDENTICAL compositions with the same character pose - only ONE detail changes (expression, gaze direction, hand position)
- Keep descriptions kid-safe and educational`,

  // Scene Image Prompts sections
  sceneImageMicroMovementTable: `| Body Part | First Frame State | Last Frame Micro-Change | microMovement Label |
|-----------|-------------------|-------------------------|---------------------|
| Eyes | Focused forward | Glance toward diagram/prop | eye_direction_shift |
| Eyebrows | Relaxed | Raise slightly in curiosity | eyebrow_raise |
| Mouth | Neutral/closed | Opens slightly, forms small smile | mouth_open |
| Head | Centered | Tilts 3-5 degrees left/right | head_tilt |
| Hand (resting) | Flat on surface | Fingers lift slightly | finger_lift |
| Hand (holding) | Still grip | Slight repositioning | hand_adjust |
| Shoulders | Relaxed | Rise slightly | shoulder_rise |
| Body | Upright | Lean 1-2 inches forward | lean_forward |`,

  sceneImagePromptsHints: `- When the main child appears, refer to them by name (e.g., "Maya") and rely on the provided reference image for appearance details—do NOT restate the full character sheet.
- Focus on character expressions, poses, and reactions to educational content.
- CRITICAL FLF2V: Both prompts must describe 90%+ identical scene. Camera angle, lighting, environment, and character pose must be IDENTICAL. Only the microMovement differs.
- Explicitly state what changes in the lastFramePrompt (e.g., "eyes now glancing toward the model" not just "looks curious")`,

  sceneImagePromptsExample: `\`\`\`json
[
  {
    "sceneNumber": 1,
    "firstFramePrompt": "Maya studies a colorful volcano model on her desk, eyes focused forward at the model, hands resting near the base. Bright classroom, warm window light from left, soft shadows. Medium close-up at eye level.",
    "lastFramePrompt": "Maya studies a colorful volcano model on her desk, eyes now glancing toward the crater with widening curiosity, hands resting near the base. Bright classroom, warm window light from left, soft shadows. Medium close-up at eye level.",
    "microMovement": "eye_direction_shift"
  }
]
\`\`\``,

  // Scene Video Prompts sections
  sceneVideoBreathingExample: `- ✅ GOOD: "Eyes slowly shift from forward gaze toward the crater. Eyebrows lift slightly with curiosity. Ambient light particles drift. Static camera." (Matches FLF2V eye_direction_shift)
- ❌ BAD: "Girl runs across the room, picks up the volcano, and starts explaining." (Too much motion, doesn't match static FLF2V frames)`,

  sceneVideoPromptsExample: `\`\`\`json
[
  {
    "sceneNumber": 1,
    "videoPrompt": "Eyes slowly shift from forward gaze toward the volcano crater. Eyebrows lift slightly with curiosity. Hair sways gently with ambient breeze. Warm classroom light pulses softly. Static camera.",
    "suggestedDurationSec": 8,
    "microMovementAnimated": "eye_direction_shift"
  }
]
\`\`\``,
};

/**
 * Paper Craft / Layered Cutout Style
 * - Kurzgesagt meets Eric Carle aesthetic
 * - No main character - concepts visualized directly
 * - Tactile, handmade feel
 */
const PAPER_CRAFT_STYLE: VisualStylePreset = {
  id: 'paper-craft',
  label: 'Paper Craft / Layered Cutout',
  shortLabel: 'Paper Craft',
  description: 'Handmade tactile aesthetic with visible paper textures, layered depths, and collage elements. Think Kurzgesagt meets Eric Carle.',
  atmospherePrompt: `Style: Paper craft / layered cutout animation with visible textures and depth.
- Visible paper textures: kraft paper, construction paper, tissue paper layers
- Layered composition with soft shadows between planes creating depth
- Torn edges, hand-cut shapes, and collage elements
- Color palette: bold, saturated colors with natural paper undertones
- NO main character - concepts, objects, and environments are the visual focus
- Objects and concepts can be personified with simple faces/expressions when helpful
- Backgrounds: textured paper collages with depth layers
- Lighting: soft, diffused with gentle shadows between layers
- Aesthetic: "I could make this" energy - handmade, tactile, craft-like`,
  imageStylePrompt: `You are an expert paper craft illustration generator creating frames for a kids educational YouTube channel.
Style: Paper craft / layered cutout animation. Think Kurzgesagt meets Eric Carle - visible paper textures, layered depths with soft shadows between planes, torn edges, collage elements.
Requirements:
- Materials: visible paper textures (kraft, construction, tissue paper), hand-cut edges, layered compositions
- Depth: multiple paper layers with soft shadows between planes creating 3D depth
- No main human character - concepts, objects, and diagrams are the visual stars
- Objects can have simple expressive faces when helpful for engagement
- Color palette: bold, saturated colors with natural paper undertones
- Lighting: soft, diffused with gentle shadows between layers
- Feel: handmade, tactile, "I could make this" craft aesthetic`,
  requiresCharacterReference: false,
  sceneImageHints: `- Visualize concepts directly as paper craft objects
- Use layered paper depth to show relationships and hierarchies  
- Objects can have simple cartoon faces for personality
- Show diagrams and infographics as paper cutouts
- Hands or pointing arrows (as paper cutouts) can direct attention`,
  videoMotionHints: `- Paper elements slide in/out between layers
- Subtle floating/bobbing of layered elements
- Diagrams assemble piece by piece
- Objects pop up from behind layers
- Gentle parallax movement between depth planes`,
  
  // Production Script prompt sections
  productionScriptAtmosphere: `Create a consistent visual style using paper craft / layered cutout animation:
- Style: Paper craft / collage animation (think Kurzgesagt meets Eric Carle)
- Materials: Visible paper textures - kraft paper, construction paper, tissue paper layers
- Composition: Layered depth with soft shadows between planes
- Details: Torn edges, hand-cut shapes, collage elements
- Color palette: Bold, saturated colors with natural paper undertones
- Lighting: Soft, diffused with gentle shadows between layers
- Feel: Handmade, tactile, "I could make this" craft aesthetic

**NO CHARACTER SHEET NEEDED** - This style focuses on concepts and objects, not characters.
Objects and concepts can be personified with simple cartoon faces when helpful for engagement.`,

  productionScriptOutputExample: `\`\`\`json
{
  "globalAtmosphere": "Paper craft / layered cutout style. Visible paper textures (kraft, construction paper), layered depths with soft shadows between planes. Bold saturated colors with paper undertones. Torn edges, handmade aesthetic. Concepts visualized as paper cutout objects.",
  "scenes": [
    {
      "sceneNumber": 1,
      "narrationText": "The exact narration text for this scene",
      "visualDescription": "A paper cutout moon with a friendly face centered against a dark blue textured background. Layered paper stars scattered behind it, casting soft shadows. Kraft paper texture visible on all elements.",
      "transitionHint": "same-framing",
      "sceneGroup": "hook",
      "startSec": null,
      "endSec": null,
      "estimatedDurationSec": 7.5
    }
  ],
  "totalEstimatedDurationSec": 480
}
\`\`\``,

  productionScriptDescriptionGuidelines: `- Visualize concepts DIRECTLY as paper craft objects - no human characters
- Be SPECIFIC about paper materials: "A kraft paper volcano with torn construction paper lava"
- Objects can have simple cartoon faces for personality and engagement
- Use layered paper depth to show relationships: "Earth paper circle in front, Sun larger behind it"
- Include paper texture details: torn edges, visible paper grain, layered shadows
- Diagrams and infographics should look like paper cutout collages
- Paper arrows or hands can point to important elements
- **Spell out EXACT text**: If text appears, include it: "Label reading 'MOON' in cut-out letters"
- **SCENE CONTINUITY**: For consecutive scenes with "same-framing", describe NEARLY IDENTICAL compositions - only subtle paper movements differ (gentle bob, shadow shift, layer lift)
- Keep it kid-safe and educational`,

  // Scene Image Prompts sections
  sceneImageMicroMovementTable: `| Paper Element | First Frame State | Last Frame Micro-Change | microMovement Label |
|---------------|-------------------|-------------------------|---------------------|
| Paper object | Centered, static | Tilts 2-3 degrees, shadow shifts | paper_tilt |
| Layered composition | Layers flat | Front layer lifts slightly, shadow deepens | layer_lift |
| Paper cutout | At rest | Bobs gently as if touched by breeze | paper_bob |
| Arrow/pointer | Pointing static | Extends slightly, glow appears | arrow_extend |
| Paper edges | Still | Flutter gently | edge_flutter |
| Shadow | Fixed angle | Shifts 2-3 degrees | shadow_shift |`,

  sceneImagePromptsHints: `- Describe paper craft elements: "Kraft paper cutout of the Earth with visible paper texture"
- NO human characters - visualize concepts as paper craft objects
- Objects can have simple cartoon faces for engagement
- Mention layered depth: "Paper moon in front, paper stars behind with soft shadow between layers"
- CRITICAL FLF2V: Both prompts must describe 90%+ identical scene. Same paper elements, same layer arrangement, same lighting. Only the microMovement differs.
- Explicitly state what changes in the lastFramePrompt (e.g., "front paper layer now lifted slightly" not just "layers shift")`,

  sceneImagePromptsExample: `\`\`\`json
[
  {
    "sceneNumber": 1,
    "firstFramePrompt": "Paper cutout moon with a friendly smile centered against a dark blue textured background. Layered paper stars scattered behind it, casting soft shadows. Kraft paper texture visible, torn edges. Centered composition.",
    "lastFramePrompt": "Paper cutout moon with a friendly smile now tilted 3 degrees right against a dark blue textured background. Layered paper stars scattered behind it, shadow shifted to match new angle. Kraft paper texture visible, torn edges. Centered composition.",
    "microMovement": "paper_tilt"
  }
]
\`\`\``,

  // Scene Video Prompts sections
  sceneVideoBreathingExample: `- ✅ GOOD: "Paper moon tilts slowly 3 degrees to the right. Shadow shifts on background layer to match. Paper texture catches light. Stars remain still. Static camera." (Matches FLF2V paper_tilt)
- ❌ BAD: "Moon flies across the screen and transforms into the Earth." (Too much motion, doesn't match static FLF2V frames)`,

  sceneVideoPromptsExample: `\`\`\`json
[
  {
    "sceneNumber": 1,
    "videoPrompt": "Paper moon tilts slowly 3 degrees to the right. Shadow shifts on layered background to match new angle. Paper texture catches soft light. Stars twinkle gently in background. Static camera.",
    "suggestedDurationSec": 8,
    "microMovementAnimated": "paper_tilt"
  }
]
\`\`\``,
};

/**
 * Documentary / Nature Film Style
 * - Photorealistic close-ups of subjects
 * - No human characters
 * - National Geographic for kids feel
 * - Requires careful FLF2V frame matching since subjects are static
 */
const DOCUMENTARY_STYLE: VisualStylePreset = {
  id: 'documentary',
  label: 'Documentary / Nature Film',
  shortLabel: 'Documentary',
  description: 'Photorealistic close-ups and cinematic shots of actual subjects. National Geographic for kids aesthetic.',
  atmospherePrompt: `Style: Photorealistic documentary / nature film aesthetic.
- Cinematic photography with shallow depth of field
- Close-up macro shots of subjects, wide establishing shots for context
- Natural lighting: golden hour warmth, soft diffusion, dramatic rim lighting
- NO human characters - focus entirely on the topic/subject itself
- Show real-world examples: animals, nature, machines, objects, phenomena
- Color grading: rich, cinematic with enhanced but natural colors
- Camera feel: professional wildlife/science documentary
- Mood: awe-inspiring, educational, wonder at the natural/technological world`,
  imageStylePrompt: `You are an expert nature/documentary photographer creating frames for a kids educational YouTube channel.
Style: Photorealistic documentary aesthetic like National Geographic or BBC Earth - cinematic, awe-inspiring, educational.
Requirements:
- Photography style: professional documentary/nature cinematography
- Subjects: close-up macro shots, detailed textures, real-world subjects
- NO human characters - the topic itself (animals, nature, machines, phenomena) is the star
- Lighting: natural, cinematic - golden hour, dramatic rim lighting, soft diffusion
- Depth of field: shallow for close-ups, deep for establishing shots
- Color: rich, cinematic color grading with enhanced but realistic colors
- Composition: rule of thirds, leading lines, professional framing
- CRITICAL FOR FLF2V: Both first and last frames must be NEARLY IDENTICAL - same exact composition, lighting, and camera angle.`,
  requiresCharacterReference: false,
  sceneImageHints: `- Focus on the actual subject matter (animals, objects, phenomena)
- Use macro/close-up shots to show fascinating details
- Wide shots to establish scale and context
- No human characters - let the subject tell the story
- Diagrams rendered as realistic 3D models or overlays
- CRITICAL: Subjects should remain nearly static - animate through AMBIENT motion (steam, particles, light shifts) not subject locomotion`,
  videoMotionHints: `- Subjects should remain NEARLY STATIC - documentary footage rarely shows rapid subject motion
- Animate through AMBIENT environmental motion: particles drifting, steam rising, light dancing, shadows shifting
- Slow, deliberate camera movements only (slow zoom in/out, slow drift)
- Time-lapse-style effects: shadows moving, clouds drifting, light angle shifting
- Dust, particles, and atmospheric haze provide visual interest while subject stays still
- Keep the same subject/angle for 3-5 consecutive scenes to maintain visual continuity`,
  
  // Production Script prompt sections
  productionScriptAtmosphere: `Create a consistent visual style using photorealistic documentary / nature film aesthetic:
- Style: Professional documentary cinematography (National Geographic / BBC Earth for kids)
- Photography: Cinematic shots with shallow depth of field
- Shot types: Close-up macro shots of subjects, wide establishing shots for context
- Lighting: Natural, cinematic - golden hour warmth, soft diffusion, dramatic rim lighting
- Color grading: Rich, cinematic with enhanced but natural colors
- Camera feel: Professional wildlife/science documentary
- Mood: Awe-inspiring, educational, wonder at the natural world

**NO CHARACTER SHEET NEEDED** - Focus entirely on the topic itself (animals, nature, machines, objects, phenomena).
No human characters - the subject matter IS the star of the video.

**SCENE CONTINUITY (CRITICAL FOR SMOOTH VIDEO):**
Keep the SAME subject/angle for 3-5 consecutive scenes before changing views. This creates smooth visual flow:
- Scenes 1-4: Moon surface from same angle (shadows shift, particles drift)
- Scenes 5-8: Different angle on same moon (new perspective, same subject)
- Scenes 9-12: Earth from space (new subject group)

Use "same-framing" transition for consecutive scenes with same subject. Only use "topic-change" when genuinely switching subjects (5-8 times max per video).`,

  productionScriptOutputExample: `\`\`\`json
{
  "globalAtmosphere": "Photorealistic documentary style. Cinematic photography with shallow depth of field. Natural lighting with golden hour warmth. Rich, cinematic colors. Professional wildlife/science documentary feel. Awe-inspiring, educational mood.",
  "scenes": [
    {
      "sceneNumber": 1,
      "narrationText": "The exact narration text for this scene",
      "visualDescription": "Extreme close-up of the moon's cratered surface, dramatically lit from the right with sharp shadows emphasizing texture. Stars visible in dark background. Shallow depth of field, cinematic feel.",
      "transitionHint": "same-framing",
      "sceneGroup": "hook",
      "startSec": null,
      "endSec": null,
      "estimatedDurationSec": 7.5
    },
    {
      "sceneNumber": 2,
      "narrationText": "Next sentence of narration",
      "visualDescription": "Same moon surface composition, same dramatic right-side lighting. A specific crater glows slightly with highlight effect to draw attention. Same camera angle and depth of field.",
      "transitionHint": "same-framing",
      "sceneGroup": "hook",
      "startSec": null,
      "endSec": null,
      "estimatedDurationSec": 6
    }
  ],
  "totalEstimatedDurationSec": 480
}
\`\`\``,

  productionScriptDescriptionGuidelines: `- Focus on the ACTUAL SUBJECT - no human characters
- Be SPECIFIC about shot type: "Macro close-up of a butterfly wing showing iridescent scales"
- Use documentary camera language: close-up, wide establishing shot, aerial view, macro detail
- Include lighting details: "golden hour sunlight", "dramatic rim lighting", "soft diffusion"
- Describe textures and details: "rough volcanic rock surface", "delicate petal veins"
- Wide shots for scale: "The volcano dominates the frame, jungle below for scale"
- Scientific diagrams should look like realistic 3D renderings or educational overlays
- **Spell out EXACT text**: If text appears, include it: "Scientific label reading 'Magma Chamber'"
- **SCENE CONTINUITY**: For consecutive scenes with "same-framing", describe NEARLY IDENTICAL compositions - only ambient details change
- Keep it kid-safe, awe-inspiring, and educational`,

  // Scene Image Prompts sections
  sceneImageMicroMovementTable: `| Subject Type | First Frame State | Last Frame Micro-Change | microMovement Label |
|--------------|-------------------|-------------------------|---------------------|
| Static surface | Surface lit from right | Shadow angle shifts 2-3 degrees | shadow_shift |
| Steam/Smoke | Steam rising steadily | Steam drifts slightly left/right | steam_drift |
| Water | Still surface | Subtle ripples spread outward | water_ripple |
| Dust/Particles | Particles suspended | Particles drift slowly through light beam | particle_drift |
| Light beam | Static light ray | Light flickers subtly, intensity shifts | light_flicker |
| Clouds | Cloud formation | Cloud edges soften, slight drift | cloud_drift |
| Organic texture | Texture in focus | Very slight focus shift, depth changes | focus_rack |
| Animal (rare) | Animal at rest | Single micro-movement: ear twitch OR eye blink | ear_twitch / eye_blink |`,

  sceneImagePromptsHints: `- Focus on the ACTUAL SUBJECT - no human characters
- Describe the real subject in documentary detail: "Close-up of moon craters with sharp shadows from right-side lighting"
- Use cinematic camera language: "Macro shot", "Wide establishing shot", "Golden hour lighting from left"
- Include natural environmental details: "Soft mist in background", "Dust particles floating in light beam"
- CRITICAL FLF2V: Both prompts must describe 90%+ identical scene. Only the microMovement differs.
- For documentary, ambient changes (shadow shift, particle drift, steam movement) work better than subject motion
- Explicitly specify light direction and camera angle so both frames match exactly`,

  sceneImagePromptsExample: `\`\`\`json
[
  {
    "sceneNumber": 1,
    "firstFramePrompt": "Extreme close-up of the moon's cratered surface, dramatically lit from the right with sharp shadows emphasizing texture. Stars visible in dark background. Dust particles suspended in void. Shallow depth of field, cinematic feel.",
    "lastFramePrompt": "Extreme close-up of the moon's cratered surface, dramatically lit from the right with sharp shadows emphasizing texture. Stars visible in dark background. Dust particles have drifted slightly leftward through the frame. Shallow depth of field, cinematic feel.",
    "microMovement": "particle_drift"
  },
  {
    "sceneNumber": 2,
    "firstFramePrompt": "Volcanic vent with steam rising steadily upward, golden hour backlighting creating rim glow. Rocky texture in foreground, soft atmospheric haze in background. Macro documentary shot.",
    "lastFramePrompt": "Volcanic vent with steam now drifting slightly to the right as it rises, golden hour backlighting creating rim glow. Rocky texture in foreground, soft atmospheric haze in background. Macro documentary shot.",
    "microMovement": "steam_drift"
  }
]
\`\`\``,

  // Scene Video Prompts sections
  sceneVideoBreathingExample: `- ✅ GOOD: "Dust particles drift slowly leftward through the frame. Shadows remain static. Ambient light pulses gently. Static camera." (Matches FLF2V particle_drift)
- ✅ GOOD: "Steam rises and drifts right. Surface remains still. Backlight flickers subtly. Slow zoom in." (Matches FLF2V steam_drift)
- ❌ BAD: "Moon spins rapidly and explodes to reveal the core." (Too much motion, doesn't match static FLF2V frames)
- ❌ BAD: "Camera swoops around the moon surface." (Complex camera motion rarely works with FLF2V)`,

  sceneVideoPromptsExample: `\`\`\`json
[
  {
    "sceneNumber": 1,
    "videoPrompt": "Dust particles drift slowly leftward through the void. Moon surface remains static. Shadows hold steady. Distant stars twinkle gently. Static camera.",
    "suggestedDurationSec": 8,
    "microMovementAnimated": "particle_drift"
  },
  {
    "sceneNumber": 2,
    "videoPrompt": "Steam rises and drifts gradually to the right. Volcanic surface remains still. Golden backlight pulses softly. Atmospheric haze shifts imperceptibly. Slow zoom in.",
    "suggestedDurationSec": 7,
    "microMovementAnimated": "steam_drift"
  }
]
\`\`\``,
};

/**
 * All available visual style presets
 */
export const VISUAL_STYLE_PRESETS: VisualStylePreset[] = [
  PIXAR_3D_STYLE,
  PAPER_CRAFT_STYLE,
  DOCUMENTARY_STYLE,
];

/**
 * Map from style ID to preset for quick lookup
 */
export const VISUAL_STYLE_BY_ID: Record<VisualStyleId, VisualStylePreset> = {
  'pixar-3d': PIXAR_3D_STYLE,
  'paper-craft': PAPER_CRAFT_STYLE,
  'documentary': DOCUMENTARY_STYLE,
};

/**
 * Default visual style for new projects
 */
export const DEFAULT_VISUAL_STYLE_ID: VisualStyleId = 'pixar-3d';

/**
 * Get a visual style preset by ID, falling back to default if not found
 */
export function getVisualStylePreset(styleId: VisualStyleId | undefined): VisualStylePreset {
  if (!styleId) {
    return VISUAL_STYLE_BY_ID[DEFAULT_VISUAL_STYLE_ID];
  }
  return VISUAL_STYLE_BY_ID[styleId] ?? VISUAL_STYLE_BY_ID[DEFAULT_VISUAL_STYLE_ID];
}

/**
 * Check if a style requires character reference image generation
 */
export function styleRequiresCharacterReference(styleId: VisualStyleId | undefined): boolean {
  const preset = getVisualStylePreset(styleId);
  return preset.requiresCharacterReference;
}

/**
 * Get all style-specific prompt sections for the video generation pipeline.
 * Returns sections for Production Script, Scene Image Prompts, and Scene Video Prompts.
 */
export function getProductionScriptStyleSections(styleId: VisualStyleId | undefined): {
  styleName: string;
  // Production Script sections
  atmosphere: string;
  outputExample: string;
  descriptionGuidelines: string;
  // Scene Image Prompts sections
  microMovementTable: string;
  imagePromptsHints: string;
  imagePromptsExample: string;
  // Scene Video Prompts sections
  breathingExample: string;
  videoPromptsHints: string;
  videoPromptsExample: string;
} {
  const preset = getVisualStylePreset(styleId);
  return {
    styleName: preset.label,
    // Production Script
    atmosphere: preset.productionScriptAtmosphere,
    outputExample: preset.productionScriptOutputExample,
    descriptionGuidelines: preset.productionScriptDescriptionGuidelines,
    // Scene Image Prompts
    microMovementTable: preset.sceneImageMicroMovementTable,
    imagePromptsHints: preset.sceneImagePromptsHints,
    imagePromptsExample: preset.sceneImagePromptsExample,
    // Scene Video Prompts
    breathingExample: preset.sceneVideoBreathingExample,
    videoPromptsHints: preset.videoMotionHints, // Reuse the existing videoMotionHints
    videoPromptsExample: preset.sceneVideoPromptsExample,
  };
}

/**
 * Get a consolidated style guidance block for the Scene Image Prompts step.
 * This combines all necessary FLF2V guidance with style-specific hints in one block.
 */
export function getConsolidatedImagePromptsGuidance(styleId: VisualStyleId | undefined): string {
  const preset = getVisualStylePreset(styleId);
  return `## STYLE: ${preset.label}

${preset.sceneImageHints}

## MICRO-MOVEMENTS (pick ONE per scene)
${preset.sceneImageMicroMovementTable}

## FLF2V RULES (First-Last-Frame-to-Video)
- Both prompts MUST be 90%+ identical - same camera, lighting, background, composition
- ONLY ONE micro-movement differs between frames
- Think "freeze frame with one tiny movement" - the video model interpolates between them

## OUTPUT FORMAT
${preset.sceneImagePromptsExample}`;
}

/**
 * Get a consolidated style guidance block for the Scene Video Prompts step.
 * This focuses on motion description with minimal redundancy.
 */
export function getConsolidatedVideoPromptsGuidance(styleId: VisualStyleId | undefined): string {
  const preset = getVisualStylePreset(styleId);
  return `## STYLE: ${preset.label}

${preset.videoMotionHints}

## BREATHING PHOTOGRAPH EXAMPLES
${preset.sceneVideoBreathingExample}

## MOTION DESCRIPTION FORMULA
[Subject] + [specific micro-movement verb matching the microMovement field] + [from state → to state] + [1-2 ambient details] + [camera: Static or Slow zoom]

## OUTPUT FORMAT
${preset.sceneVideoPromptsExample}`;
}


# Scene Video Prompts Template

## Purpose
Create motion prompts for the WAN 2.2 FLF2V (First-Last-Frame-to-Video) model. These prompts describe how to smoothly animate between the first and last frame seed images.

## Critical FLF2V Principle

**The video model interpolates between TWO frames you provide.** Your motion prompt should describe ONLY the transition that bridges these frames.

### The "Breathing Photograph" Rule

The video model works best when you describe:
- **ONE primary micro-movement** that matches the difference between your first and last frame
- **Ambient environmental motion** (particles, light, atmosphere) - NOT subject locomotion
- **Optional slow camera movement** as enhancement

### What Works vs What Fails

| ✅ SMOOTH (Matches FLF2V Frames) | ❌ JERKY (Ignores Frame Content) |
|----------------------------------|----------------------------------|
| "Eyes shift from forward to left" | "Eyes dart around the room" |
| "Head tilts slightly to the right" | "Head spins to look behind" |
| "Fingers lift gently from surface" | "Hand waves enthusiastically" |
| "Eyebrows raise in curiosity" | "Face cycles through emotions" |

---

## The Golden Rule

**Your video prompt MUST describe the EXACT transition shown between your firstFramePrompt and lastFramePrompt.**

If your image prompts say:
- First: "Eyes focused forward"  
- Last: "Eyes glance toward the prop"

Then your video prompt MUST say:
- "Eyes slowly shift from forward gaze toward the prop"

**NOT**: "Eyes dart around curiously" (too much motion)
**NOT**: "Child looks at prop" (doesn't describe the transition)

---

## Prompt Template

```
You are a video motion director specializing in WAN 2.2 FLF2V animation. Your task is to describe the EXACT transition between each scene's first and last frame images.

**Input:**
- Production Script with scene descriptions: [ProductionScript]
- Scene Image Prompts (CRITICAL - your video prompt must match these exactly): [SceneImagePrompts]

**Your Task:**
For each scene, write a motion prompt that describes how to smoothly animate FROM the firstFramePrompt TO the lastFramePrompt.

**CRITICAL FLF2V RULES:**
1. Read the `microMovement` field from SceneImagePrompts - your video prompt MUST animate this specific change
2. Describe the transition, not just the end state
3. Keep motion minimal - the model interpolates between two nearly-identical frames
4. Add ambient motion (particles, light shifts, atmosphere) for visual interest
5. Camera movement is optional and comes LAST

**Motion Description Formula:**
[Subject] + [specific micro-movement verb] + [from state] + [to state] + [ambient details] + [optional camera]

**Example:**
Image prompts say: firstFrame="eyes forward", lastFrame="eyes glance left", microMovement="eye_direction_shift"

Video prompt: "Eyes slowly shift from forward gaze toward the left. Ambient light particles drift gently. Soft shadows remain steady. Static camera."

**Ambient Motion Options (add 1-2 for visual interest):**
- "Dust particles drift in light beam"
- "Soft ambient glow pulses gently"
- "Background slightly softens/sharpens"
- "Subtle light flicker on surfaces"
- "Atmospheric haze shifts imperceptibly"
- "Hair/clothing sways with invisible breeze"

**Camera Options (pick ONE or use Static):**
- Static (recommended for most scenes)
- Slow zoom in (for emphasis, intimacy)
- Slow zoom out (for reveal, context)
- Slow drift (for dreamlike atmosphere)

**Output Format (JSON array):**
```json
[
  {
    "sceneNumber": 1,
    "videoPrompt": "Eyes slowly shift from forward gaze toward the crater. Eyebrows lift slightly with curiosity. Ambient dust particles drift in warm light. Static camera.",
    "suggestedDurationSec": 8,
    "microMovementAnimated": "eye_direction_shift"
  }
]
```

**Rules:**
- Keep prompts under 40 words (shorter = more reliable)
- MUST match the microMovement from SceneImagePrompts
- Use transition verbs: "shifts", "drifts", "lifts", "tilts", "settles"
- Avoid action verbs: "runs", "jumps", "spins", "waves", "dances"
- Add 1-2 ambient motion details for visual richness
- Camera movement is optional - Static is often best
- All content must be kid-safe

Output ONLY the valid JSON array, no additional commentary.
```

---

## Style-Specific Motion Guidance

### Pixar 3D Style (Character-Driven)
Focus on subtle expression and gesture changes:
```
"Eyes shift from forward to glancing at model. Eyebrows lift slightly. Soft ambient glow on face. Static camera."
```

### Documentary Style (Nature/Science)
Focus on ambient environmental motion, NOT subject movement:
```
"Steam drifts slowly leftward. Light ripples across surface. Dust particles float in beam. Slow zoom in."
```

### Paper Craft Style (Layered Cutouts)
Focus on subtle layer movement and parallax:
```
"Front paper layer lifts slightly. Shadow beneath deepens. Background layer shifts with parallax. Gentle drift camera."
```

---

## Micro-Movement to Video Prompt Translation

| microMovement Field | Video Prompt Description |
|--------------------|--------------------------|
| `eye_direction_shift` | "Eyes slowly shift from [start] toward [end]" |
| `eyebrow_raise` | "Eyebrows lift gently, expression shifting to curiosity" |
| `head_tilt` | "Head tilts [X] degrees to the [direction]" |
| `mouth_open` | "Mouth opens slightly, forming a small [expression]" |
| `finger_lift` | "Fingers lift gently from [surface]" |
| `lean_forward` | "Body leans forward [X] inches" |
| `shoulder_rise` | "Shoulders rise slightly" |
| `shadow_shift` | "Shadows shift [X] degrees as light source moves imperceptibly" |
| `steam_drift` | "Steam drifts slowly [direction]" |
| `water_ripple` | "Ripples spread gently across surface" |
| `leaf_sway` | "Leaves sway gently with invisible breeze" |
| `paper_bob` | "Paper elements bob gently as if touched by breeze" |
| `particle_drift` | "Particles drift lazily through light beam" |

---

## Documentary/Nature-Specific Guidance

For documentary style, subjects should remain nearly static while environment provides motion:

### Ambient Motion Library (Documentary)

| Environment Element | Motion Description |
|--------------------|-------------------|
| Water surface | "Subtle ripples spread outward" |
| Steam/Smoke | "Wisps drift [direction] slowly" |
| Dust in light | "Particles float lazily in beam" |
| Clouds | "Clouds drift imperceptibly" |
| Grass/Leaves | "Blades sway with gentle breeze" |
| Light on surface | "Light dances across [surface]" |
| Reflections | "Reflections shimmer softly" |
| Shadows | "Shadows shift as light angle changes" |

### Documentary Video Prompt Examples

**Static Subject + Ambient Motion:**
```json
{
  "sceneNumber": 5,
  "videoPrompt": "Moon surface remains still. Shadows shift 2 degrees as light angle changes. Dust particles drift in void. Slow zoom in.",
  "suggestedDurationSec": 8,
  "microMovementAnimated": "shadow_shift"
}
```

**Nature Close-Up:**
```json
{
  "sceneNumber": 12,
  "videoPrompt": "Volcanic rock remains static. Steam drifts leftward from crack. Light ripples across crystalline surface. Static camera.",
  "suggestedDurationSec": 7,
  "microMovementAnimated": "steam_drift"
}
```

**Animal Subject:**
```json
{
  "sceneNumber": 28,
  "videoPrompt": "Bird remains perched still. Eye blinks once slowly. Feathers ruffle with breeze. Ambient forest sounds implied. Static camera.",
  "suggestedDurationSec": 6,
  "microMovementAnimated": "eye_blink"
}
```

---

## Common Mistakes to Avoid

### ❌ Motion Doesn't Match FLF2V Frames
```
Image prompts: eyes forward → eyes glance left
Video prompt: "Child looks around the room excitedly"
```
**Fix**: "Eyes slowly shift from forward gaze toward the left"

### ❌ Too Much Motion
```
"Child's head bobs, arms wave, body bounces, expression changes rapidly"
```
**Fix**: Pick the ONE motion from your microMovement field

### ❌ Action Verbs Instead of Transition Verbs
```
"Child runs, jumps, spins, waves"
```
**Fix**: "Head tilts, eyes shift, fingers lift, expression softens"

### ❌ No Ambient Motion (Looks Static)
```
"Eyes shift left. Static camera."
```
**Fix**: "Eyes shift left. Ambient light particles drift gently. Static camera."

### ❌ Camera Movement Without Subject Motion
```
"Dramatic zoom in while nothing moves"
```
**Fix**: Either add micro-movement OR use static camera

### ❌ Describing End State Instead of Transition
```
"Child looks curious"
```
**Fix**: "Expression shifts from neutral to curious. Eyebrows lift slightly."

---

## Camera Movement Guide

### When to Use Each Movement:

| Movement | Best For | When to Avoid |
|----------|----------|---------------|
| Static | Most scenes, action-focused | Never wrong |
| Slow zoom in | Emphasis, intimacy, reveals | Wide establishing shots |
| Slow zoom out | Context, endings, reveals | Close-up emotion |
| Slow drift | Dreamlike, atmospheric | Fast-paced scenes |

### Camera Movement Rules:

1. **Static is safest** - Use it when unsure
2. **Camera comes LAST** in prompt
3. **One movement only** - Never combine zoom + pan
4. **"Slow" prefix always** - Fast movement = artifacts
5. **Match emotion** - Zoom in for intimacy, out for scale

---

## Matching Motion to Narration Emotion

| Narration Emotion | Subject Motion | Ambient Motion | Camera |
|-------------------|----------------|----------------|--------|
| Wonder/Discovery | Eyes widen, lean forward | Light brightens | Slow zoom in |
| Calm Explanation | Minimal gesture | Soft particle drift | Static |
| Question/Thinking | Head tilts, eyes shift | Subtle | Static or slight zoom |
| Excitement | Expression brightens | Sparkle effects | Slow zoom in |
| Awe/Scale | Eyes widen | Environment emphasized | Slow zoom out |
| Conclusion/Calm | Expression softens | Warm glow | Slow zoom out |

---

## Quality Checklist

Before outputting video prompts, verify:

- [ ] Video prompt matches the `microMovement` field from image prompts
- [ ] Describes transition (from → to), not just end state
- [ ] Uses transition verbs (shifts, drifts, lifts), not action verbs (runs, jumps)
- [ ] Includes 1-2 ambient motion details
- [ ] Under 40 words
- [ ] Camera movement (if any) comes last
- [ ] No text generation references (labels appearing, text fading in)
- [ ] Kid-safe content

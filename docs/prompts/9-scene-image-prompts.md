# Scene Image Prompts Template

## Purpose
Convert scene visual descriptions from the Production Script into detailed image generation prompts. These prompts will be sent to Gemini or FLUX to generate seed images for WAN 2.2 FLF2V (First-Last-Frame-to-Video) animation.

## Key Principles
1. **Frame-to-Frame Consistency**: First and last frame prompts must be NEARLY IDENTICAL - same composition, camera, lighting, background
2. **Single Micro-Movement**: Only ONE specific detail changes between frames (eye direction, hand position, head tilt)
3. **Static Poses**: Images should be holdable poses (video model interpolates the motion)
4. **Kid-Safe**: Educational, friendly, no scary or inappropriate content
5. **YouTube Ready**: 1920x1080, 16:9 aspect ratio

---

## Critical FLF2V Principle

**The video model interpolates between two frames.** If the frames are too different, the video will be jerky and unnatural. For smooth video:

- First frame and last frame must show the **EXACT SAME scene** with **ONE micro-change**
- Camera position, framing, lighting, environment, and background must be **IDENTICAL**
- Subject pose should be nearly the same, with only a subtle shift in expression, gaze, or gesture

### What Works vs What Fails

| ✅ SMOOTH (Nearly Identical) | ❌ JERKY (Too Different) |
|------------------------------|-------------------------|
| Eyes forward → Eyes glance left | Standing → Sitting |
| Hand at rest → Fingers lift slightly | Close-up → Wide shot |
| Neutral expression → Slight smile | Indoors → Outdoors |
| Head centered → Head tilts 5° | Day lighting → Night lighting |

---

## Prompt Template

```
You are an AI image prompt engineer specializing in educational kids content. Convert each scene description into a base prompt and a micro-movement delta for FLF2V (First-Last-Frame-to-Video) generation.

**Input Production Script:**
[ProductionScript]

**Your Task:**
For every scene, write:
1. **firstFramePrompt** — The complete scene description (subject, pose, environment, lighting, camera).
2. **lastFramePrompt** — The EXACT SAME prompt with ONE micro-movement change.

**CRITICAL FLF2V RULES:**
- Both prompts must describe the IDENTICAL scene (same camera, lighting, background, composition)
- ONLY change ONE specific detail: eye direction, slight head tilt, finger movement, or expression shift
- The video model will interpolate between frames - big differences = jerky video
- Think "freeze frame with one tiny movement" not "two different moments"

**Allowed Micro-Movements (pick ONE per scene):**
| Body Part | First Frame State | Last Frame Change |
|-----------|-------------------|-------------------|
| Eyes | Looking forward | Glance toward prop/camera |
| Eyebrows | Relaxed | Raise slightly in curiosity |
| Mouth | Neutral/closed | Opens slightly, forms small smile |
| Head | Centered | Tilts 3-5 degrees left/right |
| Hand (at rest) | Flat on surface | Fingers lift slightly |
| Hand (holding) | Still grip | Slight repositioning |
| Shoulders | Relaxed | Rise slightly |
| Body | Upright | Lean 1-2 inches forward |

**For Documentary/Nature Subjects (no characters):**
| Subject | First Frame State | Last Frame Change |
|---------|-------------------|-------------------|
| Water | Still surface | Subtle ripples spreading |
| Leaves | Motionless | Gentle sway, edge flutter |
| Clouds | Static | Slight drift/shape shift |
| Smoke/Steam | Rising | Direction shifts slightly |
| Light beam | Static glow | Dust particles drift |
| Animal | Still pose | Ear twitch, eye blink |

**Prompt Structure (both frames identical except micro-change):**
- Subject & pose (25-30 words)
- Environment anchors (location + 1-2 props)
- Lighting mood (warm/cool, source direction)
- Camera & composition (shot type, angle, framing)

**Output Format (JSON array):**
```json
[
  {
    "sceneNumber": 1,
    "firstFramePrompt": "Close-up of moon's cratered surface, dramatically lit from the right, sharp shadows emphasizing texture. Stars visible in black background. Shallow depth of field, cinematic documentary framing.",
    "lastFramePrompt": "Close-up of moon's cratered surface, dramatically lit from the right, sharp shadows emphasizing texture. Stars visible in black background. Shallow depth of field, cinematic documentary framing. Shadow angle shifts 2 degrees as light source moves imperceptibly.",
    "microMovement": "shadow_shift"
  }
]
```

**Rules:**
- Prompts stay within 25–40 words each.
- Both prompts MUST share 90%+ identical text.
- Only the micro-movement detail differs.
- Explicitly state the micro-movement in the lastFramePrompt (don't assume the model will infer it).
- Include `microMovement` field as documentation of what changes.
- All content must remain kid-safe and educational.
- **If text/labels are needed in the video**, include the EXACT text in BOTH prompts identically.

Output ONLY the valid JSON array, no additional commentary.
```

---

## Image Prompt Components

### 1. Subject & Pose (Primary)
State who/what the viewer sees and the EXACT pose. Be specific about:
- Facial expression (neutral, slight smile, eyes wide)
- Hand/limb positions (resting, raised, pointing)
- Body orientation (facing camera, 3/4 angle, profile)
- Interaction with props (touching, holding, near)

### 2. Environment Anchors (Secondary)
Name the location plus 1‑2 props or background elements. Keep this IDENTICAL between frames:
- Location type (classroom, lab, outdoors, abstract space)
- Key props (volcano model, moon diagram, beakers)
- Background elements (posters, windows, horizon)

### 3. Lighting & Mood (Identical Between Frames)
Specify light source and feeling - this MUST NOT change:
- Light direction (from left, from window, overhead)
- Light quality (warm golden, cool blue, soft diffused)
- Mood (bright cheerful, dramatic cinematic, gentle peaceful)

### 4. Camera & Composition (Identical Between Frames)
Lock down the shot - this MUST NOT change:
- Shot type (close-up, medium shot, wide establishing)
- Camera angle (eye level, slightly low, overhead)
- Framing (rule of thirds, centered, off-center)
- Depth of field (shallow blur, deep focus)

---

## Style-Specific Examples

### Pixar 3D Style (Character-Driven)

```json
{
  "sceneNumber": 5,
  "firstFramePrompt": "Maya studies the colorful volcano model on her desk, eyes focused forward at the model, hands resting on the table near the base. Bright classroom with educational posters, warm window light from left, soft shadows. Medium close-up at eye level, shallow depth of field.",
  "lastFramePrompt": "Maya studies the colorful volcano model on her desk, eyes now glancing toward the model's crater with widening curiosity, hands resting on the table near the base. Bright classroom with educational posters, warm window light from left, soft shadows. Medium close-up at eye level, shallow depth of field.",
  "microMovement": "eye_direction_shift"
}
```

### Documentary Style (No Characters)

```json
{
  "sceneNumber": 12,
  "firstFramePrompt": "Extreme close-up of volcanic rock surface with crystalline formations catching golden sunlight. Steam rises steadily from a crack. Rich cinematic color grading, shallow depth of field, documentary macro photography style.",
  "lastFramePrompt": "Extreme close-up of volcanic rock surface with crystalline formations catching golden sunlight. Steam drifts slightly to the left as it rises from the crack. Rich cinematic color grading, shallow depth of field, documentary macro photography style.",
  "microMovement": "steam_drift"
}
```

### Paper Craft Style (Concept-Focused)

```json
{
  "sceneNumber": 8,
  "firstFramePrompt": "Paper cutout volcano with torn kraft paper texture, layered construction paper lava streams. Soft shadows between paper layers creating depth. Bright saturated colors, handmade craft aesthetic, centered composition.",
  "lastFramePrompt": "Paper cutout volcano with torn kraft paper texture, layered construction paper lava streams gently bobbing as if touched by a breeze. Soft shadows between paper layers creating depth. Bright saturated colors, handmade craft aesthetic, centered composition.",
  "microMovement": "paper_bob"
}
```

---

## Common Mistakes to Avoid

### ❌ Frames Too Different
```json
{
  "firstFramePrompt": "Wide shot of classroom with students at desks.",
  "lastFramePrompt": "Close-up of student's excited face."
}
```
**Problem**: Different shot types = jerky jump cut in video

### ❌ Too Many Changes
```json
{
  "firstFramePrompt": "Child looking at book, sitting still.",
  "lastFramePrompt": "Child pointing at book, leaning forward, eyes wide, mouth open, head turned."
}
```
**Problem**: 5 changes = chaotic interpolation

### ❌ Implicit Micro-Movement
```json
{
  "firstFramePrompt": "Moon surface with craters.",
  "lastFramePrompt": "Moon surface with craters."
}
```
**Problem**: No explicit change = static video or unpredictable motion

### ✅ Correct: Single Explicit Change
```json
{
  "firstFramePrompt": "Child looking at book on desk, neutral expression, sitting upright. Classroom background, warm lighting, medium shot.",
  "lastFramePrompt": "Child looking at book on desk, eyebrows raised slightly in curiosity, sitting upright. Classroom background, warm lighting, medium shot.",
  "microMovement": "eyebrow_raise"
}
```

---

## Text and Labels in Images (CRITICAL)

**Video models CANNOT generate readable text.** Any text that needs to appear in the final video MUST be baked into BOTH seed images identically.

### When to Include Text in Image Prompts:
1. **Title cards** - Spell out the exact title: "Title card reading 'Moon Adventure' in playful colorful letters"
2. **Educational labels** - Specify exact words: "Diagram of moon phases with labels reading 'Full Moon', 'Half Moon', 'Crescent'"
3. **Quiz options** - Include the text: "Quiz screen showing options A) Sunlight B) Moonlight C) Starlight"

### When NOT to Include Text:
- Generic scene shots (classroom, outdoors, etc.)
- Character close-ups
- Action sequences
- Atmospheric/mood shots

### Text in FLF2V (Important)
When text is included, it must appear **IDENTICALLY** in both firstFramePrompt and lastFramePrompt. The micro-movement should NOT involve the text changing.

✅ **GOOD**: Text stays static, character's expression changes
❌ **BAD**: Different text in each frame

---

## Negative Prompts (What to Avoid)

Always implicitly avoid:
- Violence, weapons, scary imagery
- Logos, branded content
- Inappropriate content for children
- Overly complex scenes that won't animate well
- Characters in extreme motion (save motion for video)
- Multiple subjects doing different things (pick ONE focal point)
- Dramatic lighting changes between frames
- Camera movement described in prompts (video model adds this)

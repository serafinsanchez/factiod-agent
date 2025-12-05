# Production Script Prompt Template

## Purpose
This prompt breaks down the video script into a detailed **Production Script** with timed scenes. Each scene becomes one video clip (5-10 seconds) that will be:
1. Converted to an image prompt
2. Generated as a seed image
3. Animated into a video clip
4. Assembled into the final video

## Inspired By
Based on the Pokemon AI Video Generator's "Scripting for AI" approach:
- 10-second video clips (trimmed to match audio)
- "Breathing photograph" concept - one static scene with micro-movement
- 8-second audio rule adapted for kids educational content

---

## Scene Continuity (CRITICAL for Smooth Video)

**Problem**: When scenes are generated independently, the final video has jarring visual jumps between clips.

**Solution**: Group related scenes together and plan smooth visual transitions.

### Scene Grouping Strategy

Group 3-5 consecutive scenes around the same:
- **Subject/Location**: Same character in same environment
- **Camera Distance**: All medium shots, or all close-ups
- **Visual Theme**: Same diagram, same concept illustration

### Transition Types

| Transition Type | When to Use | Visual Guidance |
|-----------------|-------------|-----------------|
| `same-framing` | Continuing same thought | IDENTICAL camera position, same subject pose, only micro-change |
| `same-subject` | New angle on same thing | Same subject/location, different camera angle |
| `related-cut` | Moving to related topic | Similar environment, different subject |
| `topic-change` | New section of video | New environment/subject - viewer expects a cut |

### Scene Continuity Rules

1. **Same Subject Runs**: When narration continues about the same topic, keep the same subject/location for 3-5 scenes
2. **Gradual Transitions**: When changing subjects, use 1 transitional scene with elements from both
3. **Match Exit-to-Entry**: Scene N's end state should relate to Scene N+1's start state when possible
4. **Camera Consistency**: Within a scene group, use similar shot types and angles

---

## Prompt Template

```
You are a production director for PIP Academy, an educational kids YouTube channel. Your task is to break down the video script into a detailed **Production Script** with timed scenes for video generation.

**Input:**
- Topic: [Topic]
- Key Concepts: [KeyConcepts]
- Video Script: [VideoScript]

**Your Task:**
Break the script into 60-80 individual scenes, where each scene is 5-10 seconds of narration. Each scene will become one video clip.

**CRITICAL - Scene Continuity for Smooth Video:**
Group related scenes together to avoid jarring visual jumps. Consecutive scenes should share:
- Same subject/location (3-5 scenes before major change)
- Similar camera distance and angle
- Connected visual elements

Use the `transitionHint` field to indicate how each scene connects to the next:
- `same-framing`: Identical composition, micro-movement only (smoothest)
- `same-subject`: Same subject, different angle (smooth)
- `related-cut`: Related visual, different subject (acceptable)
- `topic-change`: New section, viewer expects a cut (use sparingly)

**Rules for Scene Breakdown:**
1. Each scene should contain ONE visual moment (a "breathing photograph" that can be animated with subtle motion). Avoid montages, multiple poses, or time-lapses in a single scene—the WAN 2.2 FLF2V pipeline needs one crisp moment per clip.
2. Target 5-10 seconds of spoken narration per scene (~10-20 words)
3. Natural pause points (periods, topic transitions) are ideal scene breaks
4. Keep quiz moments as their own scenes
5. Maintain narrative flow - scenes should connect smoothly
6. Plan scene groups: keep same subject/location for 3-5 consecutive scenes before major visual change
7. If the narration references on-screen text, describe that text in the scene—Gemini 3 Image Preview reliably renders clean overlays, so feel free to specify labels, captions, or quiz options when it helps learning.

**Global Atmosphere (define once):**
Create a consistent visual style for the entire video that matches PIP Academy's kid-friendly educational brand:
- Lighting style
- Color palette  
- Visual tone (bright, friendly, educational)
- Art style guidance for consistency

**Output Format (JSON):**
```json
{
  "globalAtmosphere": "Bright, cheerful educational setting with warm lighting. Color palette: primary blues, yellows, and greens. Style: Clean, modern 3D animation or photorealistic with soft edges. Mood: Curious, inviting, safe for kids.",
  "scenes": [
    {
      "sceneNumber": 1,
      "narrationText": "The exact narration text for this scene",
      "visualDescription": "A clear, specific description of what should be shown visually. Be concrete: who/what is the subject, what are they doing, where are they, what props are visible.",
      "transitionHint": "same-framing",
      "sceneGroup": "hook",
      "estimatedDurationSec": 8
    }
  ],
  "totalEstimatedDurationSec": 480
}
```

**Scene Group Labels:**
- `hook`: Opening attention-grabber (scenes 1-3)
- `definition`: Explaining what the topic is (scenes 4-8)
- `concept-1`, `concept-2`, `concept-3`: Key concept explanations
- `quiz-1`, `quiz-2`: Quiz segments
- `wow-fact`: Surprising/exciting information
- `recap`: Summary and review
- `closing`: Ending and call-to-action

**Visual Description Guidelines:**
- Be SPECIFIC: "A curious 8-year-old girl examining a volcano model" not "a kid learning"
- Anchor each scene on a single pose or diagram frame so the animation only needs a micro-movement between the first and last frame.
- For consecutive scenes with `same-framing`, describe nearly identical visuals with only subtle differences.
- Include environment: classroom, outdoor park, science lab, etc.
- Describe key props that illustrate the concept
- Spell out any on-screen text exactly as it should appear (Gemini 3 Image Preview handles titles, labels, quiz options, etc. accurately).
- Keep descriptions kid-safe and educational

Output ONLY the valid JSON, no additional commentary.
```

---

## Scene Breakdown Strategy

### Ideal Scene Length
- **5-6 seconds**: Quick transition shots, reactions, simple statements
- **7-8 seconds**: Standard explanation moments
- **9-10 seconds**: Complex explanations, quiz reveals

### Scene Group Planning

Plan your scenes in groups for visual continuity:

| Group | Scenes | Transition Strategy |
|-------|--------|---------------------|
| Hook | 1-3 | `same-framing` between 1-2, `topic-change` to definition |
| Definition | 4-8 | `same-subject` throughout, same location/diagram |
| Concept 1 | 9-20 | `same-framing` for explanations, `same-subject` for examples |
| Quiz 1 | 21-24 | `same-framing` question-answer, `topic-change` after |
| Concept 2 | 25-40 | Similar pattern to Concept 1 |
| Wow Fact | 41-45 | `same-subject` for dramatic reveal |
| Quiz 2 | 46-49 | Same pattern as Quiz 1 |
| Concept 3 | 50-60 | Similar pattern |
| Recap | 61-68 | `same-framing` for summary points |
| Closing | 69-72 | `same-subject` through farewell |

### Scene Types to Include

1. **Hook Scene** (1-3 scenes)
   - The opening grab
   - Should be visually striking
   - Use `same-framing` to keep attention

2. **Definition Scenes** (4-6 scenes)
   - Explaining what the topic is
   - Visual aids/diagrams
   - Keep same diagram/subject throughout group

3. **Key Concept Scenes** (15-20 scenes per concept)
   - Breaking down each concept
   - Examples and illustrations
   - Group related explanations with `same-framing`

4. **Quiz Scenes** (4-6 scenes)
   - Question reveal → Thinking moment → Answer reveal → Explanation
   - Use `same-framing` throughout quiz sequence
   - `topic-change` only after quiz complete

5. **Wow Fact Scenes** (3-5 scenes)
   - Surprising information
   - Dramatic visuals
   - `same-subject` to build to reveal

6. **Recap Scenes** (3-5 scenes)
   - Summary moments
   - Key takeaways
   - `same-framing` for consistency

7. **Closing Scene** (1-2 scenes)
   - Encouraging message
   - PIP Academy branding

---

## Example Output with Scene Continuity

```json
{
  "globalAtmosphere": "Bright, modern educational environment. Lighting: Warm, natural daylight with soft shadows. Colors: Primary palette of sky blue, sunshine yellow, and grass green. Style: Clean 3D animation with friendly, rounded shapes. Mood: Curious, energetic, safe. Characters: Diverse kids aged 7-10 with expressive faces.",
  "scenes": [
    {
      "sceneNumber": 1,
      "narrationText": "Did you know that volcanoes can shoot lava faster than a race car?",
      "visualDescription": "Wide shot of a dramatic volcano erupting with bright orange lava streams against a blue sky. Fluffy white clouds for contrast. The volcano is stylized and kid-friendly, not scary.",
      "transitionHint": "same-framing",
      "sceneGroup": "hook",
      "estimatedDurationSec": 6
    },
    {
      "sceneNumber": 2,
      "narrationText": "Today, we're going on an adventure deep inside the Earth to discover how volcanoes work.",
      "visualDescription": "Same volcano shot, but now showing a colorful cutaway revealing the layers inside. Lava chamber glowing orange at the base. Same blue sky and clouds in background.",
      "transitionHint": "same-subject",
      "sceneGroup": "hook",
      "estimatedDurationSec": 8
    },
    {
      "sceneNumber": 3,
      "narrationText": "By the end of this video, you'll know exactly what makes these amazing mountains explode.",
      "visualDescription": "Same cutaway volcano diagram, camera now slightly closer on the lava chamber. Arrows or glow effects highlighting the internal pressure. Same background elements.",
      "transitionHint": "topic-change",
      "sceneGroup": "hook",
      "estimatedDurationSec": 7
    },
    {
      "sceneNumber": 4,
      "narrationText": "First, let's understand what a volcano actually is.",
      "visualDescription": "A curious 8-year-old explorer kid with a hard hat in a bright classroom, standing next to a large volcano poster on the wall. Educational setting with lab tables visible.",
      "transitionHint": "same-framing",
      "sceneGroup": "definition",
      "estimatedDurationSec": 5
    },
    {
      "sceneNumber": 5,
      "narrationText": "A volcano is like a giant chimney that goes deep into the Earth.",
      "visualDescription": "Same classroom, same kid, now pointing at the volcano poster. The poster shows a cross-section diagram. Same lighting and camera angle as scene 4.",
      "transitionHint": "same-framing",
      "sceneGroup": "definition",
      "estimatedDurationSec": 6
    }
  ],
  "totalEstimatedDurationSec": 32
}
```

**Notice how:**
- Scenes 1-3 share the same volcano subject, allowing smooth transitions
- Scene 2 uses `same-framing` because it's the same volcano, just with cutaway added
- Scene 3 uses `topic-change` to signal the upcoming shift to classroom
- Scenes 4-5 use `same-framing` with identical setting, just different gestures

---

## Documentary Style Continuity

For documentary/nature style (no characters), continuity is especially important:

### Subject Runs for Documentary

| Subject | Suggested Scene Run |
|---------|---------------------|
| Planet/Moon exterior | 3-4 scenes from different angles |
| Cross-section diagram | 2-3 scenes zooming into different parts |
| Natural phenomenon | 3-5 scenes of same event from same angle |
| Microscopic view | 2-3 scenes, same magnification |

### Documentary Transition Strategy

```json
{
  "sceneNumber": 10,
  "narrationText": "The moon's surface is covered in craters from billions of years of meteor impacts.",
  "visualDescription": "Wide establishing shot of the moon's cratered surface, dramatically lit from the right side. Sharp shadows emphasize crater depth. Stars visible in black background.",
  "transitionHint": "same-framing",
  "sceneGroup": "concept-1"
},
{
  "sceneNumber": 11,
  "narrationText": "Some craters are tiny, and some are huge - bigger than whole countries on Earth.",
  "visualDescription": "Same moon surface shot, same lighting angle. Camera position identical. A subtle glow highlights one large crater and one small crater for comparison.",
  "transitionHint": "same-subject",
  "sceneGroup": "concept-1"
},
{
  "sceneNumber": 12,
  "narrationText": "The largest one, called the South Pole-Aitken basin, is over 1,500 miles wide.",
  "visualDescription": "Same moon surface, camera slowly zoomed in on a massive crater. Same dramatic lighting. Scale reference (small Earth outline) appears in corner.",
  "transitionHint": "topic-change",
  "sceneGroup": "concept-1"
}
```

---

## Notes for Implementation

1. **Word Count to Duration**: ~2-3 words per second for kids narration pace
2. **Quiz Pause**: Don't include "pause the video" in duration - that happens in editing
3. **Consistency**: Use the globalAtmosphere for all scene descriptions
4. **JSON Validation**: Output must be valid JSON that can be parsed
5. **Scene Groups**: Use the `sceneGroup` field to organize scenes and plan transitions
6. **Transition Planning**: Use `same-framing` as default; only use `topic-change` when truly changing subjects

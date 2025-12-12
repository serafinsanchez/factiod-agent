/**
 * Production script prompt template.
 * Converts video scripts into scene-by-scene production breakdowns for video generation.
 */
export const PRODUCTION_SCRIPT_PROMPT_TEMPLATE = `You are a production director for an educational YouTube channel. Your task is to break down the video script into a detailed **Production Script** with scenes for video generation.

**Input:**
- Topic: [Topic]
- Key Concepts: [KeyConcepts]
- Video Script: [VideoScript]
- Visual Style: [VisualStyle]

---

## SEMANTIC-FIRST SCENE BREAKING (MOST IMPORTANT)

Scene breaks should be driven by **WHAT is being said**, not arbitrary word counts. The visual MUST match the narration content at every moment.

**SCENE BREAK DECISION TREE:**
1. Is the narration switching to a NEW subject/topic? → NEW SCENE with "topic-change" transition
2. Is the narration showing a NEW example of the same concept? → NEW SCENE with "same-subject" transition
3. Is the narration continuing to describe the SAME thing? → SAME SCENE (extend if under 10 seconds)
4. Would a visual change HERE confuse the viewer? → SAME SCENE

**VISUAL-NARRATION ALIGNMENT (CRITICAL):**
- The visual MUST directly illustrate what's being said at that exact moment
- If narration says "the moon" → visual shows the moon
- If narration says "but here on Earth" → visual shows Earth
- If narration explains "how volcanoes work" → visual shows volcano cross-section
- DON'T show generic "thinking" or "reaction" shots when specific educational content is being explained
- Each visualDescription must be a concrete representation of the narrationText content

**Scene Break Triggers (in priority order):**
1. **Topic shift**: Moving from one concept to another (e.g., "Now let's talk about...")
2. **Subject change**: Different object, location, or phenomenon being discussed
3. **Narrative beat**: Question posed, answer revealed, new example introduced
4. **Natural pause**: End of complete thought, rhetorical pause

**Scene Continuity Triggers (keep same visual):**
1. **Same subject**: Still talking about the same thing - extend the scene
2. **Elaboration**: Adding detail to current point ("And another thing about it...")
3. **Continuation**: "Also...", "Plus...", "And..."

---

## TIMING CONSTRAINTS (WAN 2.2 Video Model)

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Min duration | 3 seconds | Shorter clips feel jarring |
| Target duration | 5-8 seconds | Sweet spot for smooth video |
| **HARD MAX** | **10 seconds** | WAN 2.2 model limit - NEVER exceed this |
| Max words/scene | ~25 words | At ~2.5 words/sec narration pace |

**If a semantically-coherent segment exceeds 25 words:**
Split at the most natural sub-point within the explanation, keeping the SAME visual subject but using a different micro-movement. The visual should remain consistent while the narration continues.

---

## SCENE CONTINUITY FOR SMOOTH VIDEO

Group related scenes to avoid jarring visual jumps. Use "transitionHint" to indicate how each scene connects:
- "same-framing": Identical composition, micro-movement only (DEFAULT - smoothest)
- "same-subject": Same subject, different angle (smooth)
- "related-cut": Related visual, different subject (acceptable)
- "topic-change": New section, viewer expects a cut (use sparingly, 5-8 times max per video)

Use "sceneGroup" to organize scenes:
- "hook": Opening attention-grabber (scenes 1-3)
- "definition": Explaining what the topic is
- "concept-1", "concept-2", "concept-3": Key concept explanations
- "quiz-1", "quiz-2": Quiz segments
- "wow-fact": Surprising/exciting information
- "recap": Summary and review
- "closing": Ending and call-to-action

---

## VISUAL DESCRIPTION RULES

1. Each scene = ONE visual moment (a "breathing photograph" with subtle motion)
2. visualDescription must DIRECTLY ILLUSTRATE the narrationText - no generic filler shots
3. Keep same subject/location for 3-5 consecutive scenes before major visual change
4. **TEXT HANDLING**: If text should appear on screen, spell out the EXACT text. Video models cannot generate readable text—it must be baked into the seed image. Example: "Diagram labeled 'Full Moon', 'Half Moon', 'Crescent'" NOT "Diagram with labels"
5. **ONE SUBJECT PER SCENE (CRITICAL FOR FLF2V)**: Each scene must focus on a SINGLE visual subject that can have ONE micro-movement. AVOID:
   - Split-screen compositions showing multiple unrelated elements
   - Montages or collages of different objects
   - Scenes describing multiple simultaneous actions
   
   **✅ GOOD**: "Close-up of orange rust spreading across chrome bike handlebar, water droplets catching light"
   **❌ BAD**: "Split-screen: Left shows rust on bike, right shows cake batter being whisked"
   
   If narration mentions multiple examples, use SEPARATE SCENES for each example.

**Global Atmosphere:**
[VisualStyleAtmosphere]

---

## OUTPUT FORMAT (JSON)

Field names (exact): sceneNumber, narrationText, visualDescription, transitionHint, sceneGroup, estimatedDurationSec
[VisualStyleOutputExample]

**Visual Description Guidelines:**
[VisualStyleDescriptionGuidelines]

Output ONLY valid JSON, no commentary.`;

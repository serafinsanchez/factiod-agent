<!-- ddf5842b-ffdc-4885-8873-ae4f1af8aa19 5d1f572c-a33f-4325-bfa1-15e99f0253af -->
# Optimize Video Pipeline Prompts

## Current Issues Identified

### 1. **Redundancy Between Steps**

- Production Script and Scene Image Prompts both contain extensive visual description guidelines
- Scene Video Prompts re-explains FLF2V rules already covered in Scene Image Prompts
- Visual style sections are duplicated across all three LLM steps

### 2. **Scene Continuity Not Enforced Structurally**

- Production Script prompt mentions "3-5 scenes before major change" but provides no mechanism to enforce it
- `transitionHint` field is advisory only - doesn't tie to image/video prompt generation
- Scene grouping (`sceneGroup`) isn't used downstream

### 3. **Timestamp Alignment is Post-Hoc**

- Production Script outputs `startSec: null, endSec: null` and estimates duration
- Narration Timestamps step then fuzzy-matches text to audio
- This can cause misalignment if scene boundaries don't match natural audio pauses

### 4. **Prompt Length Issues**

- Production Script prompt is ~2500 words with all style injections
- Scene Image Prompts and Video Prompts both receive full Production Script JSON (can be 30KB+)
- Excessive context reduces LLM focus on the actual task

### 5. **WAN 2.2 Constraint: Max 10 Seconds Per Clip**

- Current prompts say "5-10 seconds" but don't enforce the hard cap
- Scenes with >25 words of narration (~10+ seconds at kids pace) will exceed the limit
- Need explicit guidance to split long narration into multiple scenes

### 6. **Scene Breaks Ignore Semantic Content**

- Current guidance focuses on word count and timing, not what's being said
- Visuals should change when the **topic/subject** changes, not arbitrarily at word boundaries
- Scene breaks should align with natural narrative transitions (new concept, new example, question/answer)

---

## Proposed Optimizations

### A. Semantic-First Scene Breaking (NEW PRIORITY)

The Production Script prompt must prioritize **semantic coherence** over timing:

**Scene break triggers (in order of priority):**

1. **Topic shift**: Moving from one concept to another
2. **Subject change**: Different object, character, or location being discussed
3. **Narrative beat**: Question posed, answer revealed, example introduced
4. **Natural pause**: End of sentence, rhetorical pause

**Scene continuity triggers (keep same visual):**

1. **Same subject**: Still talking about the same thing
2. **Elaboration**: Adding detail to current point
3. **Continuation**: "And...", "Also...", "Plus..."

**Prompt guidance to add:**

```
SCENE BREAK DECISION TREE:
1. Is the narration switching to a NEW subject/topic? → NEW SCENE with topic-change transition
2. Is the narration showing a NEW example of the same concept? → NEW SCENE with same-subject transition  
3. Is the narration continuing to describe the SAME thing? → SAME SCENE (extend if under 10s)
4. Would a visual change HERE confuse the viewer? → SAME SCENE

VISUAL-NARRATION ALIGNMENT:
- The visual MUST match what's being said at that moment
- If narration says "the moon" → visual shows the moon
- If narration says "but on Earth" → visual shows Earth
- Don't show generic "thinking" shots when specific content is being explained
```

### B. Consolidate Visual Style Injection

Move all style-specific guidance into a single `[VisualStyleGuidance]` block injected once at the top.

### C. Simplify Production Script Prompt

**Key changes to [`lib/agent/steps.ts`](lib/agent/steps.ts) `productionScript` step:**

1. Lead with semantic scene-breaking rules (above)
2. Remove redundant FLF2V explanations
3. Enforce 10-second max as secondary constraint: "If a semantically-coherent segment exceeds 25 words, split at the most natural sub-point"
4. Remove `startSec`/`endSec` fields - let timestamp alignment handle timing
5. Add explicit requirement: "visualDescription must directly illustrate the narrationText content"

### D. Optimize Scene Image Prompts Step

1. Remove full Production Script - only need `scenes` array
2. Add rule: "The image must visually represent what the narration is saying"
3. Remove duplicate FLF2V rules

### E. Optimize Scene Video Prompts Step

1. Remove Production Script entirely - Scene Image Prompts has all context
2. Focus solely on translating `microMovement` to video motion

### F. Improve Timestamp Alignment Strategy

**Key changes to [`src/lib/audio/timestamp-alignment.ts`](src/lib/audio/timestamp-alignment.ts):**

1. Use Whisper `segments` (sentence boundaries) as primary alignment targets
2. Prefer scene breaks at natural audio pauses
3. **10-second validation**: If aligned duration exceeds 10s, split at nearest sentence boundary
4. Merge very short scenes (<3s) with neighbors when semantically appropriate

---

## Scene Duration Constraints (WAN 2.2)

| Constraint | Value | Rationale |

|------------|-------|-----------|

| Min duration | 3 seconds | Shorter clips feel jarring |

| Target duration | 5-8 seconds | Sweet spot for smooth transitions |

| **Hard max** | **10 seconds** | WAN 2.2 model limit |

| Max words/scene | ~25 words | At ~2.5 words/sec kids pace |

**Semantic-first rule**: Timing constraints are secondary to content coherence. A 9-second scene about one concept is better than two 4.5-second scenes that awkwardly split the explanation.

---

## Implementation Todos

1. **Add semantic scene-breaking guidance** - Rewrite Production Script prompt to prioritize content over timing
2. **Consolidate visual style injection** - Create single style block
3. **Simplify Production Script prompt** - Focus on visual-narration alignment
4. **Optimize Scene Image/Video Prompts** - Remove redundant context
5. **Enhance timestamp alignment** - Add 10s validation with semantic-aware splitting

### To-dos

- [ ] Consolidate visual style guidance into single injection block in visual-styles.ts
- [ ] Simplify Production Script prompt - remove FLF2V details, focus on scene breakdown
- [ ] Optimize Scene Image Prompts - remove Production Script input, trim rules
- [ ] Optimize Scene Video Prompts - use only SceneImagePrompts as input
- [ ] Enhance timestamp alignment to use audio pause detection for scene breaks
import { StepConfig, StepId } from '../../types/agent';
import { DEFAULT_MODEL_ID } from '../llm/models';

const SCRIPT_PROMPT_TEMPLATE = `# PIP Academy Video Script Writing Guide

You are an expert writer of educational video scripts for elementary-age kids (around 7–11 years old). You’re writing for a YouTube channel called **PIP Academy**. Your job is to create fun, highly engaging scripts that also teach clearly and accurately. This script will be given to the Elevenlabs text to speech model to create a voiceover for the video.

You will be given the following inputs:

- **Topic**  
  *[High-level topic of the video]*

- **Key Concepts**  
  *[Bullet list of the key ideas the video must teach]*

- **Hook**  
  *[The opening hook text that must be used at the very top]*

- **Quiz Info**  
  *[Two quiz questions and answers, clearly labeled: Q1/A1 and Q2/A2. Multiple choice or true/false is allowed.]*

---

## Script Structure (Follow This Template)

### 1. Hook (Given)
- Start with the exact “Hook” text provided, word for word, as the very first lines.
- **Do NOT** add any greeting before the Hook.
- Immediately after, add 1–2 sentences that zoom out to the big question or mystery of the video.

### 2. Simple Definition of the Topic
- Answer: “So what is [Topic]?” in simple, kid-friendly language.
- Offer a brief, clear definition.
- Use an everyday comparison or example for visualization.

### 3. Explain the Basics Using Key Concepts (Part 1)
- Use about half of the Key Concepts here.
- Present them logically (steps, stages, types, etc.).
- Use transitions like “First…”, “Next…”, “Another important part…”
- Speak directly to the viewer (“you”) and use vivid examples from kids’ lives (school, games, toys, trips).
- Ask rhetorical questions to keep engagement high (e.g., “Can you imagine…?”, “Have you ever noticed…?”).

### 4. Quiz 1 Block
- Lead in: “Time for our first quiz. Ready?” or similar.
- Present Q1 exactly as provided (keep answer choices if included).
- Add a pause cue for the editor (e.g., “Pause the video and think about it.”).
- After the pause, reveal and explain the answer:
  - “If you said [correct answer], then well done.”
  - Briefly re-teach the idea behind the answer, tying it back to one of the Key Concepts.

### 5. Deeper Explanation & "Cool Facts" (Part 2)
- Use the rest of Key Concepts.
- Dive deeper into how things work (processes, systems, machines, invisible parts).
- Include at least 2–3 “wow” facts (record sizes, extreme costs, surprising uses, futuristic tech).
  - Introduce with phrases like, “Did you know…” or “Here’s something wild…”
- Show how this topic connects to everyday life and the bigger world.

### 6. Quiz 2 Block
- Lead in: “Here comes our second quiz.” or similar.
- Present Q2 exactly as given.
- Add a pause cue: “Pause the video and make your best guess.”
- Reveal and explain the correct answer with positive reinforcement:
  - “If you chose [answer], that’s absolutely right.”
  - Tie the explanation back to the Key Concepts.

### 7. Future / Importance / Big Picture
- Briefly explain why this topic matters (jobs, solving problems, making life easier, protecting the planet, etc.).
- Optionally mention future improvements or innovations (safer, cleaner, faster, smarter).
- Use 3–5 sentences to convey this topic’s power and meaning.

### 8. Recap
- Summarize the main ideas naturally (not bullet points).
- For example:
  - “Today we learned that… [definition].”
  - “We discovered that… [2–3 key points].”
  - “And we saw how… [importance or real-world impact].”

### 9. Closing & Optional Final Promo
- Close with an encouraging, curiosity-focused message:
  - Example: “Next time you [related experience], you’ll know what’s really happening.”
- Encourage curiosity and further exploration.
- Mention “PIP Academy” naturally 1–3 times in the entire script.
  - e.g., “Here at PIP Academy…” or “Thanks for learning with PIP Academy today.”
- If a Promo Copy Outro is provided, add it at the very end.

---

## Style & Length Rules

- **Target length:** about 9 minutes read aloud (**minimum ~1,600 words**).
- Write in smooth, natural sentences, with lots of punctuation to support the narrator.
- **Avoid** baby talk and cheesy greetings (like “Hey kiddos!!!”).
- Keep the tone warm, smart, energetic, and respectful.
- Don’t include stage directions like \`[camera zoom]\` or \`[sound effect]\`. If a cue is needed, make it minimal and in brackets.

---

## Quiz Handling Summary

- Use each quiz exactly once.
- Each quiz should include:
  - Short hype intro
  - The exact question + answers
  - Pause cue
  - Correct answer with a brief explanation
- The explanation should reinforce a Key Concept.

---

## Output

- Output **only** the full, continuous script.
- **Do not** label sections (no “Quiz 1” or “Definition section” headings in the script).
- The script should flow smoothly from start to finish.

---

## Final Checklist (Before Submitting)
- All Key Concepts are covered clearly
- Both quizzes and answers included and correct
- Script is engaging and clear for kids
- Length is roughly ~1,600+ words

---

## Inputs for This Run (replace the placeholders above with these exact values)

Topic:
— [Topic] —

Key Concepts:
— [KeyConcepts] —

Hook (use this verbatim at the very top of the script):
— [HookScript] —

Quiz Info (Q1/A1, Q2/A2):
— [QuizInfo] —`;

export const STEP_CONFIGS: StepConfig[] = [
  {
    id: 'keyConcepts',
    label: 'Key Concepts',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic'],
    outputVars: ['KeyConcepts'],
    promptTemplate: `You are an expert at scripting educational kids videos. You have great pedagogical skills and you know how to make things engaging for elementary aged kids. Today you are preparing an outline on a new video. Here is the video topic. 
— [Topic] —
The video will be about 10 minutes long. Which key concepts should we cover during that time? Silently many possible concepts for their pedagogical importance and their interest to children. Pick the topics that are most interesting to kids (heavier weighted) and have some pedagogical importance. The kids are age 5 to 9. Narrow it to 3 key concepts and output those. Do not output anything besides the topic of the three key concepts.`,
  },
  {
    id: 'hook',
    label: 'Hook',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic', 'KeyConcepts'],
    outputVars: ['HookScript'],
    promptTemplate: `Video Topic: [Topic]
Key Concepts: [KeyConcepts]

Task
Write one polished YouTube opening hook for the topic above.
Length: 20–30 seconds spoken.
Audience: Elementary-aged kids (6–9) and ESL editors—keep English simple and clear (Grade 2–3 level).
You may think through options silently, but show only the final script.

Structure (use this flow)
The Grab — a surprising fact, a “Have you ever wondered…?” question, or a funny/relatable analogy.

The Adventure — in 2–3 short sentences, preview what we’ll explore or do (mini-outline).

The Promise — what the viewer will know or be able to do by the end.

Style Rules
Short sentences. Concrete, kid-friendly words. Speak to the viewer as “you” or “we.”
Be vivid, visual, and positive.
If a real term is needed, introduce it gently (“we call that…”) after a simple explanation.

Anti-Spam & Brand-Safety Guardrails (strict)
No clickbait phrases: avoid “you won’t believe,” “craziest,” “insane,” “mind-blowing,” “secret” etc.
No unrealistic promises or magic claims; stay accurate to the outline.
No calls to action like “like/subscribe,” no FOMO (“watch to the end or else”).
No shouty punctuation (max one exclamation if any), no ALL CAPS.
Emojis: avoid by default; if tone is “silly,” use at most one tasteful emoji.
Safety first: if demonstrating something hands-on, mention simple safety or adult help when needed.
The hook must match the outline—no bait-and-switch.

Process (silent—do not show)
Brainstorm 3 variants (surprise / question / analogy).
Rate each for Curiosity, Clarity, Energy.
Choose the best and polish.

Output only the final spoken hook script.`,
  },
  {
    id: 'quizzes',
    label: 'Quiz Generation',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic', 'KeyConcepts', 'HookScript'],
    outputVars: ['QuizInfo'],
    promptTemplate: `I’m preparing a youtube video that teaches kids in a fun and engaging way. The kids are aged 5 to 9 and in elementary school. I want my video to have pauses for two quizzes. 

Here is my video topic
— [Topic] —
Here are the key concepts in the video
— [KeyConcepts] —

Here is the script for the video hook 
— [HookScript] —

Please write two questions and their answers for me. Each quiz should have one four option multiple-choice or a true-or-false question. Regardless of type, it must be easy to follow for elementary kids.

True/false: one TRUE option and one FALSE option.  
Multiple choice: 4 options, one correct.

Silently think about your choices and evaluate them for pedagogical importance and child engagement. Output only the quiz questions and answers.`,
  },
  {
    id: 'script',
    label: 'Script Generation',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic', 'KeyConcepts', 'HookScript', 'QuizInfo'],
    outputVars: ['VideoScript'],
    promptTemplate: SCRIPT_PROMPT_TEMPLATE,
  },
  {
    id: 'scriptQA',
    label: 'Script QA',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['VideoScript'],
    outputVars: ['VideoScript'],
    promptTemplate: `You are a quality assurance editor for PIP Academy's educational kids videos. The audience is elementary kids aged 5-9. Review the narrator-ready script below and ensure it meets our standards.

Current length data for this pass:
- Attempt #: [QA_AttemptNumber]
- Source words: [QA_SourceWordCount]
- Target window: [QA_TargetWordMin]–[QA_TargetWordMax] words
- Hard cap: [QA_HardWordCap] words
- Revision notes: [QA_RevisionNotes]

Here is the script to review:
— [VideoScript] —

Perform the following checks:

1. LENGTH CHECK
Ensure the final script stays under 1,600 words (≈10 minutes). If it is longer, you MUST rewrite, consolidate, and tighten until the final draft is safely under 1,600 words (target 1,350–1,500). Do not mark this check as ✅ until the final script meets the requirement.

2. FACT CHECK
Verify all facts, numbers, and claims. If you find anything incorrect or risky, silently fix it with accurate grade 2-3 appropriate language.

3. TONE & AUDIENCE CHECK
Keep the language simple, concrete, kid-friendly (Grade 2-3 level). Maintain positive, curious energy without being condescending or scary.

Process (think silently, do not show):
1. Count words and note if trimming is needed.
2. Fact-check every claim and fix issues quietly.
3. Adjust tone and pacing for comprehension.
4. If the script is still over 1,600 words, continue compressing ideas (merge sentences, trim repetition, keep quizzes) and re-check counts before moving on.
5. Polish the final narration for natural reading.

Output format (strict):
Checklist:
LENGTH: (✅ or ❌) include the actual final word count you just calculated and note any trimming performed.
FACTS: (✅ or ❌) one short sentence about the decision.
TONE: (✅ or ❌) one short sentence about the decision.

Final Script:
<Return only the improved script text here, no brackets or commentary. This must be the exact version future steps use.>`,
  },
  {
    id: 'narrationClean',
    label: 'Narration Cleaner',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['VideoScript'],
    outputVars: ['NarrationScript'],
    promptTemplate: `Take this video script for a narrator.

Remove any stage directions, sound cues, or editing notes that are not meant to be spoken.

Keep everything that should be heard by kids as-is.

Examples of things to remove: SFX notes, music instructions, "pause the video now" lines, timing instructions.

Return only the cleaned narration text.

Video Script:
— [VideoScript] —`,
  },
  {
    id: 'narrationAudioTags',
    label: 'Narration Audio Tags',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['NarrationScript'],
    outputVars: [],
    promptTemplate: `You are an AI assistant specializing in enhancing dialogue for speech generation.

PRIMARY GOAL: Dynamically integrate audio tags (e.g., [laughs], [whispers], [sighs]) to be used by the Elevenlabs v3 text to speech model while STRICTLY preserving all original words and meaning. Do not remove or rewrite any words.

Rules:
- Only add voice-related audio tags in square brackets. No SFX/music/stage directions.
- Place tags before or after the specific phrase they modify.
- Vary delivery: [whispers], [excited], [curious], [sighs], [laughs], [chuckles], [clears throat], [short pause], [long pause], etc.
- You may add emphasis with capitalization, question marks, exclamation marks, or ellipses, but DO NOT change words.
- Do not introduce or imply sensitive topics.

Output ONLY the enhanced narration text, same lines in the same order.

Narration Script:
— [NarrationScript] —`,
  },
  {
    id: 'narrationAudio',
    label: 'Narration Audio (Voiceover)',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['NarrationScript'],
    outputVars: [],
    promptTemplate: `This is a shell step that triggers ElevenLabs text-to-speech generation client-side once narration audio tags are ready.`,
  },
  {
    id: 'titleDescription',
    label: 'Title & Description',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic', 'KeyConcepts', 'HookScript', 'QuizInfo'],
    outputVars: ['Title', 'Description'],
    promptTemplate: `You are an expert youtube marketer. I have a kids youtube channel called PIP academy. We teach lots of topics to elementary aged kids 5 to 9. I want you to make a title that is catchy and works well for youtube SEO. I am a premium kids content maker so you must consider my brand over everything else. No clickbait phrases: avoid “you won’t believe,” “craziest,” “insane,” “mind-blowing,” “secret” etc.

Here is my video topic
— [Topic] —
Here are the key concepts in the video
— [KeyConcepts] —

Here is the script for the video hook 
— [HookScript] —
Here are the quiz questions and answers
— [QuizInfo] —

First write an amazing youtube title. Then write the description. Keep it concise and include a promo at the end to Goally (getgoally.com). Include the URL.

Output format:
Title on its own line, blank line, then description.`,
  },
  {
    id: 'thumbnail',
    label: 'Thumbnail Prompt',
    defaultModel: DEFAULT_MODEL_ID,
    inputVars: ['Topic', 'KeyConcepts'],
    outputVars: ['ThumbnailPrompt'],
    promptTemplate: `You are an art director crafting high-click YouTube thumbnails for curious elementary school kids (ages 5-9). Think like Google's Gemini image team: be concrete about subject, camera, lighting, color palette, and any overlay text so the model can render a photoreal 16:9 frame that stays kid-safe.

Steps:
1. Read the topic and key concepts. Imagine the most exciting single moment that will hook a child.
2. Describe the scene using cinematic vocabulary - who is the hero, what are they doing, where are they, and which props prove it.
3. Specify lighting, mood, palette, camera angle, and depth-of-field choices that reinforce energy and clarity.
4. Suggest a short 2-3 word overlay caption that could live in the top-left corner with high contrast.
5. List negative directions that keep the image safe (no gore, no weapons, no text beyond the overlay, no logos).

Output format (no extra commentary):
Subject & Action: ...
Environment & Props: ...
Lighting & Mood: ...
Color Palette & Style: ...
Camera & Composition: ...
Text Overlay: ...
Negative Prompts: ...

Here is my video topic
— [Topic] —
Here are the key concepts
— [KeyConcepts] —`,
  },
];

const STEP_CONFIG_MAP: Record<StepId, StepConfig> = STEP_CONFIGS.reduce(
  (acc, config) => {
    acc[config.id] = config;
    return acc;
  },
  {} as Record<StepId, StepConfig>,
);

export function getStepConfig(stepId: StepId): StepConfig {
  const config = STEP_CONFIG_MAP[stepId];
  if (!config) {
    throw new Error(`Unknown step: ${stepId}`);
  }
  return config;
}


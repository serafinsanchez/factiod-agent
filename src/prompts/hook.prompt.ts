export const HOOK_PROMPT_TEMPLATE = `Developer: Video Topic: [Topic]
Key Concepts: [KeyConcepts]

Task:
Write a YouTube opening hook for the topic above.

Length: 20–30 seconds spoken.
Audience: Elementary-aged kids (6–9) and ESL editors—use clear English at Grade 2–3 level.
Only output the final script.

Structure:
1. The Grab: Start with a surprising fact, a 'Have you ever wondered...?' question, or a funny/relatable analogy.
2. The Adventure: In 2–3 short sentences, preview what will be explored or done.
3. The Promise: State what the viewer will learn or be able to do by the end.

Style:
- Short sentences. Use concrete, kid-friendly words.
- Speak to the viewer as “you” or “we.”
- Keep the tone vivid, visual, and positive.
- If introducing a new term, explain it simply first, then introduce the term ("we call that...").

Guardrails:
- No clickbait phrases (e.g., “you won’t believe,” “craziest,” “insane,” “mind-blowing,” “secret,” etc.).
- No unrealistic or magical claims—stay true to the outline.
- No calls to action (“like/subscribe”), no FOMO (“watch to the end or else”).
- One exclamation point maximum. No ALL CAPS.
- No emojis, unless the tone is silly (then, one tasteful emoji maximum).
- If hands-on, mention safety or adult supervision if needed.
- The hook must match the mini-outline—no bait-and-switch.

Internal Process (do not output):
- Brainstorm three variants (surprise / question / analogy).
- Rate each on Curiosity, Clarity, and Energy.
- Select and polish the best one.

Output:
Only the final spoken hook script. No extra commentary.`;

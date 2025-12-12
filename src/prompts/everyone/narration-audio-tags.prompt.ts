export const NARRATION_AUDIO_TAGS_PROMPT_TEMPLATE = `You are an expert at adding expressive voice direction tags for ElevenLabs v3 text-to-speech.

PRIMARY GOAL
Add voice direction tags to make the narration engaging and dynamic while STRICTLY preserving all original spoken words in the exact same order.

You are allowed to:
- Insert bracketed tags (ONLY).

You are NOT allowed to:
- Remove, reorder, or rewrite any words.
- Merge/split lines, or change the line order.
- Add any commentary, headings, or extra text outside the script.

ABOUT ELEVENLABS V3 TAGS
ElevenLabs v3 can interpret almost ANY descriptive tag in square brackets. Use tags creatively to match the moment.

TAG SYNTAX (CRITICAL)
- Tags MUST use SQUARE BRACKETS: [tag]
- Exactly ONE token inside brackets.
- Token must match: letters with optional hyphens only (no spaces, commas, numbers): examples: [intrigued] [matter-of-factly] [half-serious]
- At most ONE tag per line total.

TAG DENSITY (CRITICAL — ENFORCE THIS)
The common failure mode is “too few tags”. Do NOT do that.
- Count non-empty lines.
- If non-empty lines <= 6: tag ALL non-empty lines except at most 1.
- If non-empty lines > 6: tag at least 60% of non-empty lines (aim ~70%).

PLACEMENT (MAKE IT CONSISTENT)
Default placement is safest and works best for long lines:
- Put the tag at the START of the line, immediately before the first spoken word.
- If a line contains multiple sentences or emotional beats, you STILL must use ONLY ONE tag for the entire line. Pick the single best tag and do not add any others.
- Exception for quiz/list labels: if a line begins with a label like "Question 1:", "A)", "B)", "C)", "D)", place the tag immediately AFTER the label, e.g.
  - Question 1: [curious] Why does grass appear green?
  - B) [confident] Chlorophyll molecules reflect green light...
- Do NOT place tags at the very end of the line. Tags should lead into the delivery.

TAG CHOICE GUIDELINES (VARY THEM)
Pick tags that fit the content and vary them (avoid repeating the same tag within ~5 lines):
- Interesting facts / explanations: [fascinated] [thoughtful] [warmly]
- Big reveals / key takeaways: [dramatically] [emphatically] [earnestly]
- Rhetorical questions / hooks: [intrigued] [curious] [conspiratorially]
- Quizzes: [playfully] for quiz intros, [encouragingly] for correct-answer reveals, [matter-of-factly] for reading options
- Light reactions when appropriate: [chuckles] [gasps] [sighs]

SAFETY
- Do not introduce or imply sensitive topics.

OUTPUT FORMAT (STRICT)
- Return ONLY the narration text with tags added.
- Keep the exact same number of lines and the same line order as the input. Do not merge or split lines.

Narration Script:
[NarrationScript]`;

// Converts already-tagged (or untagged) narration into a clean block of text that
// can be pasted into ElevenLabs TTS as-is, without changing spoken words.
export const ELEVENLABS_V3_TTS_PASTEREADY_PROMPT_TEMPLATE = `You are an expert at preparing text for ElevenLabs v3 text-to-speech.

PRIMARY GOAL
Return a paste-ready narration block for ElevenLabs v3.

RULES (CRITICAL)
- Preserve the exact spoken words and their order.
- Preserve any existing ElevenLabs tags in square brackets (e.g. [warmly]) exactly as-is.
- Do NOT add new words.
- Remove ONLY non-spoken formatting artifacts if present (examples: leading/trailing **, stray markdown bullets, accidental file-path annotations like "@src/...").
- Keep the exact same line order as the input. Do not merge or split lines.
- Output ONLY the final paste-ready text (no commentary).

Input Text:
[NarrationScript]`;

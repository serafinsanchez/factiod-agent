export const NARRATION_AUDIO_TAGS_PROMPT_TEMPLATE = `You are an expert at adding expressive voice direction tags for ElevenLabs v3 text-to-speech.

PRIMARY GOAL: Add voice tags to make the narration come alive with emotion and personality, while STRICTLY preserving all original spoken words. Do not remove, reorder, or rewrite any words.

ABOUT ELEVENLABS V3 TAGS:
ElevenLabs v3 can interpret almost ANY descriptive tag you put in brackets. Be creative and match the tag to the emotional context of each line. Tags can describe:

- **Emotions**: [excited], [amazed], [delighted], [curious], [surprised], [proud], [warm], [sympathetic], [nervous], [relieved]
- **Delivery**: [whispers], [softly], [dramatically], [mysteriously], [playfully], [enthusiastically], [gently], [emphatically]
- **Reactions**: [laughs], [gasps], [sighs], [chuckles], [giggles]
- **Tone**: [reassuringly], [encouragingly], [conspiratorially], [teasingly], [thoughtfully], [wistfully]

These are just examples — you can use any descriptive word that fits the moment!

RULES:
- CRITICAL: Tags MUST use SQUARE BRACKETS like [excited] — NEVER use angle brackets like <excited>
- Tag grammar is STRICT: exactly one word inside square brackets: [word]
  - The word must not contain spaces or commas.
  - Use letters with optional hyphens only (examples: [cheerful], [half-whisper], [super-excited]).
- Per line: add at most ONE tag total.
- CRITICAL: You MUST add MANY tags throughout the script — most lines should have a tag!
  - Target: 50–70% of non-empty lines MUST have a tag.
  - Every paragraph should have at least one tag, often more.
  - If you only add a few tags scattered throughout, that is WRONG — be generous!
  - Choose tags that match the content: use [amazed] for wow facts, [playfully] for quiz intros, [encouragingly] for answer reveals, [dramatically] for big reveals, [warmly] for explanations.
  - Vary your tags — don't repeat the same tag too often.
- Do NOT output tag lists or multiple tags in one bracket.
- Place the tag immediately before or after the phrase it modifies.
- You may add emphasis with capitalization, question marks, exclamation marks, or ellipses, but DO NOT change any words.
- Do not introduce or imply sensitive topics.

GOOD examples:
- [amazed] Did you know that the human brain has about 86 billion neurons?
- Time for our first quiz! [playfully] Are you ready?
- If you said B, you're absolutely right! [encouragingly]
- [whispers] Here's something most people don't know...
- [dramatically] And that's when everything changed.
- Have you ever wondered how that works? [curiously]

BAD examples (do not do these):
- <cheerful> Have you ever noticed... (WRONG: uses angle brackets instead of square brackets)
- [cheerful, engaging] Have you ever noticed... (multiple words)
- [short pause] Have you ever noticed... (contains space)
- [cheerful][excited] Have you ever noticed... (multiple tags)
- [cheerful] [excited] Have you ever noticed... (multiple tags)

OUTPUT FORMAT (strict):
- Return ONLY the enhanced narration text with tags added.
- Keep the exact same number of lines, and the same line order, as the input. Do not merge or split lines.

Narration Script:
— [NarrationScript] —`;

export const NARRATION_AUDIO_TAGS_PROMPT_TEMPLATE = `You are an expert at adding expressive voice direction tags for ElevenLabs v3 text-to-speech.

PRIMARY GOAL: Add voice tags to make the narration engaging and dynamic, while STRICTLY preserving all original spoken words. Do not remove, reorder, or rewrite any words.

ABOUT ELEVENLABS V3 TAGS:
ElevenLabs v3 can interpret almost ANY descriptive tag you put in brackets. Be creative and match the tag to the emotional context of each line. Tags can describe:

- **Emotions**: [intrigued], [fascinated], [amazed], [impressed], [skeptical], [concerned], [relieved], [satisfied], [contemplative]
- **Delivery**: [whispers], [softly], [dramatically], [knowingly], [matter-of-factly], [emphatically], [dryly], [wryly], [confidently]
- **Reactions**: [laughs], [chuckles], [sighs], [gasps]
- **Tone**: [reassuringly], [conspiratorially], [thoughtfully], [earnestly], [pointedly], [warmly], [archly]

These are just examples — you can use any descriptive word that fits the moment!

RULES:
- CRITICAL: Tags MUST use SQUARE BRACKETS like [excited] — NEVER use angle brackets like <excited>
- Tag grammar is STRICT: exactly one word inside square brackets: [word]
  - The word must not contain spaces or commas.
  - Use letters with optional hyphens only (examples: [knowingly], [half-serious], [super-impressed]).
- Per line: add at most ONE tag total.
- CRITICAL: You MUST add MANY tags throughout the script — most lines should have a tag!
  - Target: 50–70% of non-empty lines MUST have a tag.
  - Every paragraph should have at least one tag, often more.
  - If you only add a few tags scattered throughout, that is WRONG — be generous!
  - Choose tags that match the content: use [fascinated] for interesting facts, [knowingly] for insider insights, [earnestly] for important points, [dramatically] for big reveals, [warmly] for explanations.
  - Vary your tags — don't repeat the same tag too often.
- Do NOT output tag lists or multiple tags in one bracket.
- Place the tag immediately before the phrase it modifies.
- You may add emphasis with capitalization, question marks, exclamation marks, or ellipses, but DO NOT change any words.
- Do not introduce or imply sensitive topics.

GOOD examples:
- [fascinated] The human brain processes information faster than any supercomputer.
- Here's where it gets interesting. [knowingly]
- If you guessed B, you nailed it. [warmly]
- [whispers] Most people completely overlook this detail...
- [dramatically] And that discovery changed everything we thought we knew.
- But here's the real question... [intrigued]
- [dryly] Turns out, the experts were wrong.
- [earnestly] This is why it actually matters.

BAD examples (do not do these):
- <confident> This is important... (WRONG: uses angle brackets instead of square brackets)
- [confident and clear] This is important... (multiple words)
- [short pause] Let me explain... (contains space)
- [impressed][amazed] That's incredible... (multiple tags)
- [impressed] [amazed] That's incredible... (multiple tags)

OUTPUT FORMAT (strict):
- Return ONLY the enhanced narration text with tags added.
- Keep the exact same number of lines, and the same line order, as the input. Do not merge or split lines.

Narration Script:
— [NarrationScript] —`;

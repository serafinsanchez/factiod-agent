export const NARRATION_TIMESTAMPS_PROMPT_TEMPLATE = `This is a shell step that extracts word-level timestamps from the narration audio and aligns them to production script scenes.

**Process:**
1. Takes the generated narration audio URL as input
2. Sends audio to fal.ai's Whisper endpoint for transcription
3. Extracts word-level timestamps (start/end time for each word)
4. Groups words into segments (sentences)
5. Aligns each scene's narrationText from the ProductionScript to the audio timestamps using fuzzy text matching
6. Returns NarrationTimestamps JSON with:
   - words: Array of {word, start, end}
   - segments: Array of {text, start, end, words}
   - totalDurationSec: Total audio duration
   - sceneTimestamps: Array of {sceneNumber, narrationText, startSec, endSec, confidence} for each aligned scene

**Purpose:**
These timestamps enable precise audio-video synchronization by:
- Providing exact start/end times for each production script scene's narration
- Enabling video clips to match the exact audio duration for each scene
- Ensuring accurate timing in the final video assembly

This step runs client-side via the /api/audio/timestamps endpoint and automatically aligns scenes after extraction.`;

export const VIDEO_ASSEMBLY_PROMPT_TEMPLATE = `This is a shell step that triggers FFmpeg video assembly client-side. It will:
1. Trim each video clip to match the corresponding audio segment duration
2. Concatenate all clips in sequence
3. Mix in the narration audio track
4. Output the final 1080p MP4 video`;

export const CHARACTER_REFERENCE_IMAGE_PROMPT_TEMPLATE = `This is a shell step that generates a character reference image for visual consistency.

The production script contains a characterSheet with detailed character descriptions. This step extracts the mainChild description and generates a clean, front-facing "hero portrait" of the character.

This reference image will be passed to all subsequent scene image generations to ensure the character looks identical across all scenes.

**Process:**
1. Extract characterSheet.mainChild from ProductionScript
2. Generate a clean front-facing portrait using Gemini with the 3D animation style
3. Store the result as CharacterReferenceImage (base64)

This step runs client-side via the Gemini image generation API.`;

export const KEY_CONCEPTS_PROMPT_TEMPLATE = `# Role and Objective
- Script writer for 10-minute educational videos aimed at children ages 5–9, with focus on content selection and pedagogy.
# Instructions
- Video Topic: [Topic]
- Outline a video on the topic above.
- Consider multiple possible concepts; evaluate each for pedagogical value and appeal to children.
- Prioritize concepts that are both engaging and educationally valuable.
- Select three key concepts for the video's structure.
# Output Format
- List only the titles or short descriptions of the three chosen key concepts.
# Stop Conditions
- Stop after listing the three concepts. Output nothing else.`;

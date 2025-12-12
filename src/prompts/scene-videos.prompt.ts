export const SCENE_VIDEOS_PROMPT_TEMPLATE = `This is a shell step that triggers batch video generation client-side using fal.ai WAN 2.2 FLF2V model.

For each scene, the following is sent to WAN 2.2:
- **image_url**: First frame image (starting pose)
- **end_image_url**: Last frame image (end state after micro-movement)
- **prompt**: Motion prompt describing the animation

The FLF2V (First-Last-Frame-to-Video) approach provides the model with clear start and end states to interpolate between, resulting in smoother and more controlled video generation.`;

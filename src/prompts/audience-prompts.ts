import type { AudienceMode, StepId } from "@/types/agent";

import { CHARACTER_REFERENCE_IMAGE_PROMPT_TEMPLATE } from "./character-reference-image.prompt";
import { HOOK_PROMPT_TEMPLATE } from "./hook.prompt";
import { KEY_CONCEPTS_PROMPT_TEMPLATE } from "./key-concepts.prompt";
import { NARRATION_AUDIO_PROMPT_TEMPLATE } from "./narration-audio.prompt";
import { NARRATION_AUDIO_TAGS_PROMPT_TEMPLATE } from "./narration-audio-tags.prompt";
import { NARRATION_TIMESTAMPS_PROMPT_TEMPLATE } from "./narration-timestamps.prompt";
import { PRODUCTION_SCRIPT_PROMPT_TEMPLATE } from "./production-script.prompt";
import { QUIZZES_PROMPT_TEMPLATE } from "./quizzes.prompt";
import { SCENE_IMAGE_PROMPTS_TEMPLATE } from "./scene-image-prompts.prompt";
import { SCENE_IMAGES_PROMPT_TEMPLATE } from "./scene-images.prompt";
import { SCENE_VIDEO_PROMPTS_TEMPLATE } from "./scene-video-prompts.prompt";
import { SCENE_VIDEOS_PROMPT_TEMPLATE } from "./scene-videos.prompt";
import { SCRIPT_PROMPT_TEMPLATE } from "./script.prompt";
import { SCRIPT_QA_PROMPT_TEMPLATE } from "./script-qa.prompt";
import { THUMBNAIL_GENERATE_PROMPT_TEMPLATE } from "./thumbnail-generate.prompt";
import { THUMBNAIL_PROMPT_TEMPLATE } from "./thumbnail.prompt";
import { TITLE_DESCRIPTION_PROMPT_TEMPLATE } from "./title-description.prompt";
import { VIDEO_ASSEMBLY_PROMPT_TEMPLATE } from "./video-assembly.prompt";

import {
  HOOK_PROMPT_TEMPLATE as HOOK_PROMPT_TEMPLATE_EVERYONE,
} from "./everyone/hook.prompt";
import {
  KEY_CONCEPTS_PROMPT_TEMPLATE as KEY_CONCEPTS_PROMPT_TEMPLATE_EVERYONE,
} from "./everyone/key-concepts.prompt";
import {
  QUIZZES_PROMPT_TEMPLATE as QUIZZES_PROMPT_TEMPLATE_EVERYONE,
} from "./everyone/quizzes.prompt";
import {
  SCRIPT_PROMPT_TEMPLATE as SCRIPT_PROMPT_TEMPLATE_EVERYONE,
} from "./everyone/script.prompt";
import {
  SCRIPT_QA_PROMPT_TEMPLATE as SCRIPT_QA_PROMPT_TEMPLATE_EVERYONE,
} from "./everyone/script-qa.prompt";
import {
  TITLE_DESCRIPTION_PROMPT_TEMPLATE as TITLE_DESCRIPTION_PROMPT_TEMPLATE_EVERYONE,
} from "./everyone/title-description.prompt";
import {
  THUMBNAIL_PROMPT_TEMPLATE as THUMBNAIL_PROMPT_TEMPLATE_EVERYONE,
} from "./everyone/thumbnail.prompt";
import {
  SCENE_IMAGE_PROMPTS_TEMPLATE as SCENE_IMAGE_PROMPTS_TEMPLATE_EVERYONE,
} from "./everyone/scene-image-prompts.prompt";
import {
  PRODUCTION_SCRIPT_PROMPT_TEMPLATE as PRODUCTION_SCRIPT_PROMPT_TEMPLATE_EVERYONE,
} from "./everyone/production-script.prompt";
import {
  NARRATION_AUDIO_TAGS_PROMPT_TEMPLATE as NARRATION_AUDIO_TAGS_PROMPT_TEMPLATE_EVERYONE,
} from "./everyone/narration-audio-tags.prompt";

const PROMPTS_FOR_KIDS: Record<StepId, string> = {
  keyConcepts: KEY_CONCEPTS_PROMPT_TEMPLATE,
  hook: HOOK_PROMPT_TEMPLATE,
  quizzes: QUIZZES_PROMPT_TEMPLATE,
  script: SCRIPT_PROMPT_TEMPLATE,
  scriptQA: SCRIPT_QA_PROMPT_TEMPLATE,
  narrationAudioTags: NARRATION_AUDIO_TAGS_PROMPT_TEMPLATE,
  narrationAudio: NARRATION_AUDIO_PROMPT_TEMPLATE,
  narrationTimestamps: NARRATION_TIMESTAMPS_PROMPT_TEMPLATE,
  productionScript: PRODUCTION_SCRIPT_PROMPT_TEMPLATE,
  characterReferenceImage: CHARACTER_REFERENCE_IMAGE_PROMPT_TEMPLATE,
  sceneImagePrompts: SCENE_IMAGE_PROMPTS_TEMPLATE,
  sceneImages: SCENE_IMAGES_PROMPT_TEMPLATE,
  sceneVideoPrompts: SCENE_VIDEO_PROMPTS_TEMPLATE,
  sceneVideos: SCENE_VIDEOS_PROMPT_TEMPLATE,
  videoAssembly: VIDEO_ASSEMBLY_PROMPT_TEMPLATE,
  titleDescription: TITLE_DESCRIPTION_PROMPT_TEMPLATE,
  thumbnail: THUMBNAIL_PROMPT_TEMPLATE,
  thumbnailGenerate: THUMBNAIL_GENERATE_PROMPT_TEMPLATE,
};

const PROMPTS_FOR_EVERYONE: Partial<Record<StepId, string>> = {
  keyConcepts: KEY_CONCEPTS_PROMPT_TEMPLATE_EVERYONE,
  hook: HOOK_PROMPT_TEMPLATE_EVERYONE,
  quizzes: QUIZZES_PROMPT_TEMPLATE_EVERYONE,
  script: SCRIPT_PROMPT_TEMPLATE_EVERYONE,
  scriptQA: SCRIPT_QA_PROMPT_TEMPLATE_EVERYONE,
  narrationAudioTags: NARRATION_AUDIO_TAGS_PROMPT_TEMPLATE_EVERYONE,
  productionScript: PRODUCTION_SCRIPT_PROMPT_TEMPLATE_EVERYONE,
  sceneImagePrompts: SCENE_IMAGE_PROMPTS_TEMPLATE_EVERYONE,
  titleDescription: TITLE_DESCRIPTION_PROMPT_TEMPLATE_EVERYONE,
  thumbnail: THUMBNAIL_PROMPT_TEMPLATE_EVERYONE,
};

export function getPromptByAudience(stepId: StepId, audienceMode: AudienceMode): string {
  if (audienceMode === "forEveryone") {
    return PROMPTS_FOR_EVERYONE[stepId] ?? PROMPTS_FOR_KIDS[stepId];
  }

  return PROMPTS_FOR_KIDS[stepId];
}

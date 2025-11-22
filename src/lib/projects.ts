import { slugifyTopic } from "@/lib/slug";

export const PROJECTS_BUCKET = "projects";

export function buildProjectScriptPath(projectSlug: string): string {
  return `${projectSlug}/${projectSlug}.md`;
}

export function buildProjectAudioPath(projectSlug: string): string {
  return `${projectSlug}/${projectSlug}-audio.mp3`;
}

export function buildProjectThumbnailPath(
  projectSlug: string,
  options?: { unique?: boolean },
): string {
  if (options?.unique) {
    return `${projectSlug}/${projectSlug}-thumbnail-${Date.now()}.png`;
  }
  return `${projectSlug}/${projectSlug}-thumbnail.png`;
}

export function getOrCreateProjectSlug(
  existingSlug: string | undefined,
  topic: string,
): string {
  if (existingSlug && existingSlug.trim().length > 0) {
    return existingSlug;
  }
  return slugifyTopic(topic || "untitled");
}

const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function getPublicProjectFileUrl(
  path: string | null | undefined,
): string | null {
  if (!path || !PUBLIC_SUPABASE_URL) {
    return null;
  }

  const encodedPath = encodeURI(path);
  return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PROJECTS_BUCKET}/${encodedPath}`;
}



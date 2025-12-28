import { slugifyTopic } from "@/lib/slug";

export const PROJECTS_BUCKET = "projects";

export function buildProjectScriptPath(projectSlug: string): string {
  return `${projectSlug}/${projectSlug}.md`;
}

export function buildProjectAudioPath(projectSlug: string): string {
  return `${projectSlug}/${projectSlug}-audio.mp3`;
}

/**
 * Generates a short random ID for unique file paths.
 * Uses crypto.randomUUID() when available, falls back to timestamp + random.
 */
function generateUniqueId(): string {
  // Use crypto.randomUUID() if available (Node.js 19+, modern browsers)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    // Use first 8 chars of UUID for brevity (still ~4 billion combinations)
    return crypto.randomUUID().slice(0, 8);
  }
  // Fallback: timestamp + random chars
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `${timestamp}-${random}`;
}

export function buildProjectThumbnailPath(
  projectSlug: string,
  options?: { unique?: boolean },
): string {
  if (options?.unique) {
    const uniqueId = generateUniqueId();
    return `${projectSlug}/${projectSlug}-thumbnail-${uniqueId}.png`;
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

/**
 * Get a server-reachable, cache-busted audio URL from an audioPath.
 * This is the preferred way to get an audio URL for backend consumers
 * (Whisper, FFmpeg, etc.) that need to fetch the audio over HTTP.
 * 
 * @param audioPath - The storage path (e.g., "project-slug/project-slug-audio.mp3")
 * @returns A cache-busted public URL, or null if audioPath is invalid
 */
export function getServerAudioUrl(
  audioPath: string | null | undefined,
): string | null {
  const publicUrl = getPublicProjectFileUrl(audioPath);
  if (!publicUrl) {
    return null;
  }
  
  // Validate it's not a blob: URL (should never happen, but guard just in case)
  if (publicUrl.startsWith("blob:")) {
    console.warn("[getServerAudioUrl] Received blob: URL, which is invalid for server use");
    return null;
  }
  
  // Add cache-busting query param
  const separator = publicUrl.includes("?") ? "&" : "?";
  return `${publicUrl}${separator}v=${Date.now()}`;
}

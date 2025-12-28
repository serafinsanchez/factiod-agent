/**
 * Shared Supabase storage upload helper for thumbnail images.
 *
 * Provides consistent error handling and warning generation for both
 * Gemini and SeeDream thumbnail generation routes.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PROJECTS_BUCKET } from "@/lib/projects";
import type { ThumbnailWarning, ThumbnailWarningCode } from "./types";

export type UploadThumbnailResult = {
  /** Whether the upload succeeded */
  persisted: boolean;
  /** Storage path (only set when persisted) */
  thumbnailPath?: string;
  /** Non-fatal warnings encountered during upload */
  warnings: ThumbnailWarning[];
};

type UploadThumbnailOptions = {
  /** Binary image data to upload */
  binary: Buffer;
  /** Target path within the projects bucket */
  path: string;
  /** MIME type of the image */
  contentType: string;
};

/**
 * Attempts to upload a thumbnail image to Supabase storage.
 *
 * On failure, returns `persisted: false` with descriptive warnings
 * instead of throwing, allowing the caller to continue with a fallback
 * (e.g., returning the provider's temporary URL).
 */
export async function uploadThumbnailToStorage({
  binary,
  path,
  contentType,
}: UploadThumbnailOptions): Promise<UploadThumbnailResult> {
  const warnings: ThumbnailWarning[] = [];

  try {
    const supabase = getSupabaseServerClient();

    const { error: uploadError } = await supabase.storage
      .from(PROJECTS_BUCKET)
      .upload(path, binary, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      const warning = mapSupabaseUploadError(uploadError);
      warnings.push(warning);

      // Log detailed error server-side
      console.error("Supabase thumbnail upload error:", uploadError);
      logStorageSetupHint(uploadError);

      return { persisted: false, warnings };
    }

    return { persisted: true, thumbnailPath: path, warnings };
  } catch (error) {
    // Handle configuration errors (missing env vars) or unexpected failures
    const warning = mapConfigurationError(error);
    warnings.push(warning);

    console.error(
      "Supabase configuration/storage error while uploading thumbnail:",
      error,
    );

    return { persisted: false, warnings };
  }
}

/**
 * Maps a Supabase storage upload error to a stable warning.
 */
function mapSupabaseUploadError(uploadError: {
  message?: string;
  statusCode?: string | number;
}): ThumbnailWarning {
  const statusCode =
    typeof uploadError.statusCode === "number"
      ? String(uploadError.statusCode)
      : typeof uploadError.statusCode === "string"
        ? uploadError.statusCode
        : undefined;

  // Bucket not found
  if (
    statusCode === "404" ||
    uploadError.message?.includes("Bucket not found")
  ) {
    return {
      code: "STORAGE_BUCKET_MISSING",
      message:
        "Storage bucket 'projects' not found. Run migration 002_create_storage_bucket.sql or create it manually in Supabase Dashboard.",
    };
  }

  // Permission denied
  if (
    statusCode === "403" ||
    uploadError.message?.toLowerCase().includes("permission") ||
    uploadError.message?.toLowerCase().includes("policy")
  ) {
    return {
      code: "STORAGE_PERMISSION_DENIED",
      message:
        "Storage permission denied. Check RLS policies for the 'projects' bucket in Supabase.",
    };
  }

  // Generic upload failure
  return {
    code: "STORAGE_UPLOAD_FAILED",
    message: uploadError.message || "Failed to upload thumbnail to storage.",
  };
}

/**
 * Maps configuration/initialization errors to a stable warning.
 */
function mapConfigurationError(error: unknown): ThumbnailWarning {
  const message =
    error instanceof Error ? error.message : "Unknown configuration error";

  // Missing environment variables
  if (
    message.includes("SUPABASE_SERVICE_ROLE_KEY") ||
    message.includes("NEXT_PUBLIC_SUPABASE_URL") ||
    message.includes("environment variables are not configured")
  ) {
    return {
      code: "SUPABASE_NOT_CONFIGURED",
      message:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  return {
    code: "STORAGE_UPLOAD_FAILED",
    message,
  };
}

/**
 * Logs a helpful setup hint for common storage configuration issues.
 */
function logStorageSetupHint(uploadError: {
  message?: string;
  statusCode?: string | number;
}): void {
  const statusCode =
    typeof uploadError.statusCode === "number"
      ? String(uploadError.statusCode)
      : typeof uploadError.statusCode === "string"
        ? uploadError.statusCode
        : undefined;

  if (
    statusCode === "404" ||
    uploadError.message?.includes("Bucket not found")
  ) {
    console.error(
      "\n⚠️  STORAGE SETUP REQUIRED:\n" +
        "The 'projects' storage bucket doesn't exist in Supabase.\n" +
        "Please run the migration: supabase/migrations/002_create_storage_bucket.sql\n" +
        "OR manually create the bucket in Supabase Dashboard → Storage → New bucket → Name: 'projects' (public)\n" +
        "See README.md for detailed setup instructions.\n",
    );
  }
}

/**
 * Checks if a public URL can be constructed for a storage path.
 * Returns false if NEXT_PUBLIC_SUPABASE_URL is not set.
 */
export function canConstructPublicUrl(): boolean {
  return typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0;
}

/**
 * Creates a warning for when a public URL cannot be constructed.
 */
export function createPublicUrlUnavailableWarning(): ThumbnailWarning {
  return {
    code: "PUBLIC_URL_UNAVAILABLE",
    message:
      "NEXT_PUBLIC_SUPABASE_URL is not set. Thumbnail URL cannot be constructed.",
  };
}

/**
 * Creates a warning for when base64 data was omitted due to size.
 */
export function createInlineTooLargeWarning(sizeBytes: number): ThumbnailWarning {
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
  return {
    code: "INLINE_TOO_LARGE",
    message: `Image too large for inline preview (${sizeMb} MB). Using URL instead.`,
  };
}

// Maximum size for inline base64 (5 MB)
export const MAX_INLINE_THUMBNAIL_BYTES = 5 * 1024 * 1024;

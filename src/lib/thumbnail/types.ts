/**
 * Shared types for thumbnail generation API responses.
 *
 * Both Gemini and SeeDream routes should return responses that conform to
 * ThumbnailGenerationSuccess or ThumbnailGenerationError.
 */

// =============================================================================
// Warning codes (stable identifiers for client-side handling)
// =============================================================================

export type ThumbnailWarningCode =
  | "STORAGE_BUCKET_MISSING"
  | "STORAGE_UPLOAD_FAILED"
  | "STORAGE_PERMISSION_DENIED"
  | "PUBLIC_URL_UNAVAILABLE"
  | "INLINE_TOO_LARGE"
  | "SUPABASE_NOT_CONFIGURED";

export type ThumbnailWarning = {
  code: ThumbnailWarningCode;
  message: string;
};

// =============================================================================
// Debug metadata (safe to send to client; no secrets)
// =============================================================================

export type ThumbnailDebugInfo = {
  /** Provider-specific request ID for tracing (e.g. fal requestId) */
  requestId?: string | null;
  /** Upstream HTTP status code when applicable */
  upstreamStatus?: number | null;
  /** Variation tag used for cache-busting / logging */
  variationTag?: string;
};

// =============================================================================
// Success response
// =============================================================================

export type ThumbnailGenerationSuccess = {
  /** Which provider generated the image */
  provider: "gemini" | "fal";

  /** Base64-encoded image data (for immediate preview) */
  imageBase64?: string;
  /** MIME type of the image (e.g. "image/png", "image/jpeg") */
  mimeType?: string;

  /** Supabase storage path (only set when persisted) */
  thumbnailPath?: string;
  /**
   * Public URL for the thumbnail.
   * - When persisted: Supabase public URL
   * - When not persisted: provider's temporary URL (fallback)
   */
  thumbnailUrl?: string;

  /** Whether the image was successfully persisted to Supabase storage */
  persisted: boolean;

  /** Non-fatal issues encountered during generation/upload */
  warnings?: ThumbnailWarning[];

  /** Debug/tracing metadata */
  debug?: ThumbnailDebugInfo;

  // ---------------------------
  // Provider-specific extras
  // ---------------------------

  /** Token usage (Gemini only) */
  usage?: {
    promptTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  };
  /** Estimated cost in USD (Gemini only) */
  costUsd?: number | null;
  /** Seed used for generation (SeeDream only) */
  seed?: number | null;
};

// =============================================================================
// Error response
// =============================================================================

export type ThumbnailGenerationError = {
  /** Human-readable error message */
  error: string;
  /** Stable error code (optional, for programmatic handling) */
  code?: string;
  /** Which provider encountered the error */
  provider?: "gemini" | "fal";
  /** Debug/tracing metadata */
  debug?: ThumbnailDebugInfo;
};

// =============================================================================
// Union type for API responses
// =============================================================================

export type ThumbnailGenerationResponse =
  | ThumbnailGenerationSuccess
  | ThumbnailGenerationError;

// =============================================================================
// Type guards
// =============================================================================

export function isThumbnailSuccess(
  response: ThumbnailGenerationResponse,
): response is ThumbnailGenerationSuccess {
  return "persisted" in response && !("error" in response);
}

export function isThumbnailError(
  response: ThumbnailGenerationResponse,
): response is ThumbnailGenerationError {
  return "error" in response;
}

// =============================================================================
// Client-side parsing helpers
// =============================================================================

/**
 * Determines if a successful response contains renderable output.
 * The client should only mark the step as "success" if this returns true.
 */
export function hasRenderableOutput(response: ThumbnailGenerationSuccess): boolean {
  const hasBase64 =
    typeof response.imageBase64 === "string" &&
    response.imageBase64.length > 0 &&
    typeof response.mimeType === "string" &&
    response.mimeType.length > 0;

  const hasUrl =
    typeof response.thumbnailUrl === "string" && response.thumbnailUrl.length > 0;

  const hasPath =
    typeof response.thumbnailPath === "string" && response.thumbnailPath.length > 0;

  return hasBase64 || hasUrl || hasPath;
}

/**
 * Parse a JSON response from the thumbnail generation API.
 * Handles both new (unified) and legacy response shapes.
 *
 * Returns a normalized ThumbnailGenerationSuccess or throws an error.
 */
export function parseThumbnailResponse(
  data: Record<string, unknown>,
  provider: "gemini" | "fal",
): ThumbnailGenerationSuccess {
  // Check for error responses first
  if (typeof data.error === "string") {
    throw new Error(data.error);
  }

  // Build normalized success response
  const response: ThumbnailGenerationSuccess = {
    provider,
    persisted: data.persisted === true,
    warnings: Array.isArray(data.warnings) ? data.warnings : undefined,
    debug:
      typeof data.debug === "object" && data.debug !== null
        ? (data.debug as ThumbnailDebugInfo)
        : undefined,
  };

  // Image data (base64)
  if (typeof data.imageBase64 === "string") {
    response.imageBase64 = data.imageBase64;
  }
  if (typeof data.mimeType === "string") {
    response.mimeType = data.mimeType;
  }

  // Storage path
  if (typeof data.thumbnailPath === "string" && data.thumbnailPath.trim().length > 0) {
    response.thumbnailPath = data.thumbnailPath.trim();
    // If persisted flag wasn't explicitly set, infer from thumbnailPath presence
    if (typeof data.persisted !== "boolean") {
      response.persisted = true;
    }
  }

  // URL (explicit or legacy)
  if (typeof data.thumbnailUrl === "string" && data.thumbnailUrl.length > 0) {
    response.thumbnailUrl = data.thumbnailUrl;
  }

  // Provider-specific: Gemini usage/cost
  if (typeof data.usage === "object" && data.usage !== null) {
    const usage = data.usage as Record<string, unknown>;
    response.usage = {
      promptTokens:
        typeof usage.promptTokens === "number" ? usage.promptTokens : null,
      outputTokens:
        typeof usage.outputTokens === "number"
          ? usage.outputTokens
          : typeof usage.candidatesTokenCount === "number"
            ? usage.candidatesTokenCount
            : null,
      totalTokens:
        typeof usage.totalTokens === "number" ? usage.totalTokens : null,
    };
  }
  if (typeof data.costUsd === "number") {
    response.costUsd = data.costUsd;
  }

  // Provider-specific: SeeDream seed
  if (typeof data.seed === "number") {
    response.seed = data.seed;
  }

  return response;
}

/**
 * Safely parse a fetch Response as JSON, falling back to text on parse failure.
 * Returns { data, textFallback } where exactly one is set.
 */
export async function safeParseJsonResponse(
  res: Response,
): Promise<{ data: Record<string, unknown> } | { textFallback: string }> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    return { data };
  } catch {
    return { textFallback: text || `HTTP ${res.status} ${res.statusText}` };
  }
}

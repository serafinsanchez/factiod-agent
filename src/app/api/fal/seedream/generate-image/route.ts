import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

import { buildProjectThumbnailPath, getPublicProjectFileUrl } from "@/lib/projects";
import {
  uploadThumbnailToStorage,
  canConstructPublicUrl,
  createPublicUrlUnavailableWarning,
  createInlineTooLargeWarning,
  MAX_INLINE_THUMBNAIL_BYTES,
} from "@/lib/thumbnail/upload";
import type {
  ThumbnailGenerationSuccess,
  ThumbnailGenerationError,
  ThumbnailWarning,
} from "@/lib/thumbnail/types";

const SEEDREAM_MODEL_ID = "fal-ai/bytedance/seedream/v4/text-to-image" as const;

type SeedreamImage = {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
};

type SeedreamResponse = {
  images: SeedreamImage[];
  seed: number;
};

function stripNegativePromptsLine(input: string): {
  output: string;
  removed: boolean;
} {
  const lines = input.split(/\r?\n/);
  let removed = false;
  const kept = lines.filter((line) => {
    if (/^\s*Negative Prompts:\s*/i.test(line)) {
      removed = true;
      return false;
    }
    return true;
  });
  return { output: kept.join("\n").trim(), removed };
}

export async function POST(request: Request) {
  let requestId: string | null = null;

  try {
    const { prompt, projectSlug, thumbnailPath: providedThumbnailPath } =
      (await request.json()) as {
        prompt?: unknown;
        projectSlug?: unknown;
        thumbnailPath?: unknown;
      };

    if (!prompt || typeof prompt !== "string") {
      const errorResponse: ThumbnailGenerationError = {
        error: "Prompt is required",
        provider: "fal",
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      const errorResponse: ThumbnailGenerationError = {
        error: "FAL_KEY is not set",
        code: "MISSING_API_KEY",
        provider: "fal",
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const seedreamPrompt = stripNegativePromptsLine(prompt).output;

    fal.config({ credentials: falKey });

    const falInput = {
      prompt: seedreamPrompt,
      image_size: { width: 3840, height: 2160 },
      num_images: 1,
      max_images: 1,
      enable_safety_checker: true,
    };

    const result = await fal.subscribe(SEEDREAM_MODEL_ID, { input: falInput });

    const raw = (result.data || result) as unknown as SeedreamResponse;
    const firstImage = raw.images?.[0];
    const firstImageUrl = firstImage?.url;
    const providerContentType = firstImage?.content_type;

    if (!firstImageUrl || typeof firstImageUrl !== "string") {
      const errorResponse: ThumbnailGenerationError = {
        error: "No image URL returned from SeeDream v4",
        code: "NO_IMAGE_URL",
        provider: "fal",
        debug: { requestId },
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // =========================================================================
    // Download the image from fal's CDN
    // =========================================================================
    const imageRes = await fetch(firstImageUrl);
    if (!imageRes.ok) {
      const errorResponse: ThumbnailGenerationError = {
        error: `Failed to download generated image: ${imageRes.status} ${imageRes.statusText}`,
        code: "DOWNLOAD_FAILED",
        provider: "fal",
        debug: { requestId, upstreamStatus: imageRes.status },
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const contentType =
      imageRes.headers.get("content-type") || providerContentType || "image/png";
    const arrayBuffer = await imageRes.arrayBuffer();
    const binary = Buffer.from(arrayBuffer);
    const imageSize = binary.length;

    // =========================================================================
    // Prepare base64 (with size guard)
    // =========================================================================
    const warnings: ThumbnailWarning[] = [];
    let imageBase64: string | undefined;
    let mimeType: string | undefined;

    if (imageSize <= MAX_INLINE_THUMBNAIL_BYTES) {
      imageBase64 = binary.toString("base64");
      mimeType = contentType;
    } else {
      warnings.push(createInlineTooLargeWarning(imageSize));
    }

    // =========================================================================
    // Upload to Supabase storage (best-effort)
    // =========================================================================
    let persisted = false;
    let thumbnailPath: string | undefined;
    let thumbnailUrl: string | undefined;

    if (typeof projectSlug === "string" && projectSlug.trim().length > 0) {
      const slug = projectSlug.trim();
      const path =
        typeof providedThumbnailPath === "string" &&
        providedThumbnailPath.trim().length > 0
          ? providedThumbnailPath.trim()
          : buildProjectThumbnailPath(slug, { unique: true });

      const uploadResult = await uploadThumbnailToStorage({
        binary,
        path,
        contentType,
      });

      persisted = uploadResult.persisted;
      thumbnailPath = uploadResult.thumbnailPath;
      warnings.push(...uploadResult.warnings);

      // Construct public URL if persisted
      if (persisted && thumbnailPath) {
        if (canConstructPublicUrl()) {
          thumbnailUrl = getPublicProjectFileUrl(thumbnailPath) ?? undefined;
        } else {
          warnings.push(createPublicUrlUnavailableWarning());
        }
      }
    }

    // =========================================================================
    // Fallback: if not persisted, use the provider's temporary URL
    // =========================================================================
    if (!thumbnailUrl) {
      thumbnailUrl = firstImageUrl;
    }

    // =========================================================================
    // Build unified success response
    // =========================================================================
    const successResponse: ThumbnailGenerationSuccess = {
      provider: "fal",
      imageBase64,
      mimeType,
      thumbnailPath,
      thumbnailUrl,
      persisted,
      warnings: warnings.length > 0 ? warnings : undefined,
      debug: { requestId },
      seed: typeof raw.seed === "number" ? raw.seed : null,
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    const err = error as unknown as {
      status?: unknown;
      body?: unknown;
      requestId?: unknown;
      message?: unknown;
      name?: unknown;
    };

    // Extract requestId if available
    if (typeof err?.requestId === "string") {
      requestId = err.requestId;
    }

    console.error("SeeDream v4 image generation error:", error);

    const bodyDetail =
      err?.body && typeof err.body === "object" && "detail" in err.body
        ? (err.body as Record<string, unknown>).detail
        : null;

    // Preserve upstream HTTP status codes when available (e.g. 422 validation).
    const status =
      typeof err?.status === "number" && Number.isFinite(err.status)
        ? err.status
        : 500;

    const upstreamDetailMessage =
      typeof bodyDetail === "string"
        ? bodyDetail
        : bodyDetail &&
            typeof bodyDetail === "object" &&
            "message" in bodyDetail &&
            typeof (bodyDetail as { message?: unknown }).message === "string"
          ? (bodyDetail as { message: string }).message
          : null;

    const baseMessage =
      upstreamDetailMessage ??
      (error instanceof Error ? error.message : "Failed to generate image");

    // Add helpful guidance for common errors
    const clientMessage =
      status === 403 &&
      typeof upstreamDetailMessage === "string" &&
      /exhausted balance|top up/i.test(upstreamDetailMessage)
        ? `${upstreamDetailMessage} (Or switch the thumbnail model to Nano Banana Pro (Gemini) in Settings → Publishing.)`
        : baseMessage;

    const errorResponse: ThumbnailGenerationError = {
      error: clientMessage,
      code: status === 403 ? "QUOTA_EXCEEDED" : undefined,
      provider: "fal",
      debug: {
        requestId,
        upstreamStatus: status,
      },
    };

    return NextResponse.json(errorResponse, { status });
  }
}


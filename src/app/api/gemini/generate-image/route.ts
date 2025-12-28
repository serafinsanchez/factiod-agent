import { randomUUID } from "crypto";

import { GoogleGenAI } from "@google/genai";

import { buildProjectThumbnailPath, getPublicProjectFileUrl } from "@/lib/projects";
import { TOKENS_PER_MILLION } from "@/lib/llm/costs";
import {
  buildGeminiImagePrompt as buildGeminiImagePromptForKids,
  getVisualStylePreset,
} from "@/prompts";
import { buildGeminiImagePrompt as buildGeminiImagePromptForEveryone } from "@/prompts/everyone/gemini-image.prompt";
import type { AudienceMode, VisualStyleId } from "@/types/agent";
import {
  uploadThumbnailToStorage,
  canConstructPublicUrl,
  createPublicUrlUnavailableWarning,
} from "@/lib/thumbnail/upload";
import type {
  ThumbnailGenerationSuccess,
  ThumbnailGenerationError,
  ThumbnailWarning,
} from "@/lib/thumbnail/types";

const GEMINI_IMAGE_PRICE_PER_MILLION = 20;

export async function POST(request: Request) {
  const variationTag = randomUUID();

  try {
    const {
      prompt,
      projectSlug,
      thumbnailPath: providedThumbnailPath,
      skipTextOverlay,
      referenceImage, // Optional base64 character reference image for consistency
      styleId, // Optional visual style ID for style-specific image generation
      audienceMode, // Optional: 'forKids' | 'forEveryone' (affects thumbnail instructions)
    } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      const errorResponse: ThumbnailGenerationError = {
        error: "Prompt is required",
        provider: "gemini",
        debug: { variationTag },
      };
      return Response.json(errorResponse, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const errorResponse: ThumbnailGenerationError = {
        error: "GEMINI_API_KEY is not set",
        code: "MISSING_API_KEY",
        provider: "gemini",
        debug: { variationTag },
      };
      return Response.json(errorResponse, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Get visual style preset for scene images
    const visualStyle = getVisualStylePreset(styleId as VisualStyleId | undefined);

    const resolvedAudienceMode: AudienceMode =
      audienceMode === "forEveryone" ? "forEveryone" : "forKids";
    const buildGeminiImagePrompt =
      resolvedAudienceMode === "forEveryone"
        ? buildGeminiImagePromptForEveryone
        : buildGeminiImagePromptForKids;

    // Defensive: Only treat literal `true` as "skip overlay".
    // Prevents accidental truthy values (e.g. "false"/"true") from flipping modes.
    const normalizedSkipTextOverlay = skipTextOverlay === true;

    const { structuredPrompt, contentParts } = buildGeminiImagePrompt({
      creativeBrief: prompt,
      skipTextOverlay: normalizedSkipTextOverlay,
      visualStyle,
      referenceImage,
      variationTag,
    });

    const promptContent = [
      {
        role: "user",
        parts: contentParts,
      },
    ];

    let promptTokenCount: number | null = null;
    try {
      const tokenEstimate = await ai.models.countTokens({
        model: "gemini-3-pro-image-preview",
        contents: promptContent,
      });
      if (typeof tokenEstimate.totalTokens === "number") {
        promptTokenCount = tokenEstimate.totalTokens;
      }
    } catch (tokenError) {
      console.warn("Gemini image countTokens failed:", tokenError);
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: promptContent,
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "4K",
        },
        responseModalities: ["image"],
      },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;

    // Find the part that contains the image data
    const imagePart = parts?.find((p) => p.inlineData);

    if (!imagePart?.inlineData) {
      console.error(
        "Gemini Image Generation Failed. Full Response:",
        JSON.stringify(response, null, 2),
      );

      // Check for error finish reasons (SAFETY, RECITATION, etc.)
      // STOP is the normal completion status, not an error
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        const errorResponse: ThumbnailGenerationError = {
          error: `Generation blocked with reason: ${candidate.finishReason}`,
          code: `BLOCKED_${candidate.finishReason}`,
          provider: "gemini",
          debug: { variationTag },
        };
        return Response.json(errorResponse, { status: 500 });
      }

      const errorResponse: ThumbnailGenerationError = {
        error:
          "No image data found in response. The model may have returned only text.",
        code: "NO_IMAGE_DATA",
        provider: "gemini",
        debug: { variationTag },
      };
      return Response.json(errorResponse, { status: 500 });
    }

    const imageBase64 = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";

    // Type guard: ensure imageBase64 is a string
    if (!imageBase64 || typeof imageBase64 !== "string") {
      const errorResponse: ThumbnailGenerationError = {
        error: "Invalid image data received from Gemini",
        code: "INVALID_IMAGE_DATA",
        provider: "gemini",
        debug: { variationTag },
      };
      return Response.json(errorResponse, { status: 500 });
    }

    // =========================================================================
    // Upload to Supabase storage (best-effort)
    // =========================================================================
    const warnings: ThumbnailWarning[] = [];
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

      const binary = Buffer.from(imageBase64, "base64");
      const uploadResult = await uploadThumbnailToStorage({
        binary,
        path,
        contentType: mimeType,
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
    } else {
      console.warn(
        "No projectSlug provided to /api/gemini/generate-image; skipping Supabase upload.",
      );
    }

    // =========================================================================
    // Compute usage and cost
    // =========================================================================
    const usageMetadata = response.usageMetadata;
    const usage = {
      promptTokens:
        typeof promptTokenCount === "number"
          ? promptTokenCount
          : typeof usageMetadata?.promptTokenCount === "number"
            ? usageMetadata.promptTokenCount
            : null,
      outputTokens:
        typeof usageMetadata?.candidatesTokenCount === "number"
          ? usageMetadata.candidatesTokenCount
          : null,
      totalTokens:
        typeof promptTokenCount === "number"
          ? promptTokenCount
          : typeof usageMetadata?.totalTokenCount === "number"
            ? usageMetadata.totalTokenCount
            : null,
    };
    const totalTokens = usage?.totalTokens ?? null;
    const costUsd =
      typeof totalTokens === "number"
        ? Number(
            ((totalTokens / TOKENS_PER_MILLION) * GEMINI_IMAGE_PRICE_PER_MILLION).toFixed(
              6,
            ),
          )
        : null;

    // =========================================================================
    // Build unified success response
    // =========================================================================
    const successResponse: ThumbnailGenerationSuccess = {
      provider: "gemini",
      imageBase64,
      mimeType,
      thumbnailPath,
      thumbnailUrl,
      persisted,
      warnings: warnings.length > 0 ? warnings : undefined,
      debug: { variationTag },
      usage,
      costUsd,
    };

    return Response.json(successResponse);
  } catch (error) {
    console.error("Gemini image generation error:", error);

    const errorResponse: ThumbnailGenerationError = {
      error: error instanceof Error ? error.message : "Failed to generate image",
      provider: "gemini",
      debug: { variationTag },
    };

    return Response.json(errorResponse, { status: 500 });
  }
}

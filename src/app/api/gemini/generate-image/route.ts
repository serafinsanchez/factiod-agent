import { randomUUID } from "crypto";

import { GoogleGenAI } from "@google/genai";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROJECTS_BUCKET,
  buildProjectThumbnailPath,
} from "@/lib/projects";
import { TOKENS_PER_MILLION } from "@/lib/llm/costs";
import { buildGeminiImagePrompt as buildGeminiImagePromptForKids, getVisualStylePreset } from "@/prompts";
import { buildGeminiImagePrompt as buildGeminiImagePromptForEveryone } from "@/prompts/everyone/gemini-image.prompt";
import type { AudienceMode, VisualStyleId } from "@/types/agent";

const GEMINI_IMAGE_PRICE_PER_MILLION = 20;

function extractTextOverlayFromCreativeBrief(creativeBrief: unknown): string | null {
  if (typeof creativeBrief !== "string") return null;

  // Prefer quoted text (straight quotes or curly quotes).
  const quotedMatch = creativeBrief.match(
    /Text Overlay:\s*["\u201C\u201D]([^"\u201C\u201D\n]+)["\u201C\u201D]/i,
  );
  const quoted = quotedMatch?.[1]?.trim();
  if (quoted) return quoted;

  // Fallback: locate the Text Overlay line and apply a few safe heuristics.
  const lineMatch = creativeBrief.match(/^Text Overlay:\s*(.+)$/im);
  const remainder = lineMatch?.[1]?.trim();
  if (!remainder) return null;

  const quoteLike = remainder[0];
  if (quoteLike === `"` || quoteLike === "\u201C" || quoteLike === "\u201D") {
    const rest = remainder.slice(1);
    const endIdx = rest.search(/["\u201C\u201D]/);
    const extracted = (endIdx >= 0 ? rest.slice(0, endIdx) : rest).trim();
    return extracted.length > 0 ? extracted : null;
  }

  // Common unquoted format: `Text Overlay: Lunar Rover Secrets in upper-left corner ...`
  const stopMatchers: RegExp[] = [
    /\s+in\s+the\s+upper-left\b/i,
    /\s+in\s+upper-left\b/i,
    /\s+upper-left\b/i,
    /\s+in\s+the\s+top-left\b/i,
    /\s+in\s+top-left\b/i,
    /\s+top-left\b/i,
  ];
  let candidate = remainder;
  for (const re of stopMatchers) {
    const idx = candidate.search(re);
    if (idx > 0) {
      candidate = candidate.slice(0, idx);
      break;
    }
  }

  // If the remainder still contains long style guidance, trim at common separators.
  candidate = candidate.split(/[;,—-]/)[0] ?? candidate;

  candidate = candidate.trim().replace(/[.]+$/, "").trim();
  return candidate.length > 0 ? candidate : null;
}

export async function POST(request: Request) {
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

    // #region agent log
    {
      const extractedOverlay = extractTextOverlayFromCreativeBrief(prompt);
      const negativeLineMatch =
        typeof prompt === "string"
          ? prompt.match(/Negative Prompts:\s*(.+)\s*$/im)
          : null;
      const negativeLine = negativeLineMatch?.[1] ?? null;
      fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'C',location:'src/app/api/gemini/generate-image/route.ts:29',message:'generate-image received request',data:{audienceMode:typeof audienceMode==='string'?audienceMode:null,skipTextOverlay:typeof skipTextOverlay==='boolean'?skipTextOverlay:null,styleId:typeof styleId==='string'?styleId:null,projectSlug:typeof projectSlug==='string'?projectSlug:null,promptLen:typeof prompt==='string'?prompt.length:null,extractedOverlay,negativeHasText:typeof negativeLine==='string'?/\btext\b/i.test(negativeLine):null,negativeHasCaptions:typeof negativeLine==='string'?/\bcaptions?\b/i.test(negativeLine):null},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion

    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY is not set" },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const variationTag = randomUUID();

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

    // #region agent log
    {
      const extractedOverlay = extractTextOverlayFromCreativeBrief(prompt);
      fetch('http://127.0.0.1:7243/ingest/9fb4bdb4-06c7-4894-bef1-76b41a5a87a9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'B',location:'src/app/api/gemini/generate-image/route.ts:73',message:'generate-image built structured prompt',data:{structuredPromptLen:structuredPrompt.length,includesDerivedOverlayInstruction:structuredPrompt.includes('derived from the brief'),includesExactOverlay:typeof extractedOverlay==='string'&&extractedOverlay.length>0?structuredPrompt.toLowerCase().includes(extractedOverlay.toLowerCase()):null},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion

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
        return Response.json(
          {
            error: `Generation blocked with reason: ${candidate.finishReason}`,
            details: response,
          },
          { status: 500 },
        );
      }

      return Response.json(
        {
          error:
            "No image data found in response. The model may have returned only text.",
          details: response,
        },
        { status: 500 },
      );
    }

    const imageBase64 = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || "image/png";

    // Type guard: ensure imageBase64 is a string
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return Response.json(
        {
          error: "Invalid image data received from Gemini",
        },
        { status: 500 },
      );
    }

    let thumbnailPath: string | undefined;

    if (typeof projectSlug === "string" && projectSlug.trim().length > 0) {
      const slug = projectSlug.trim();
      const path =
        typeof providedThumbnailPath === "string" && providedThumbnailPath.trim().length > 0
          ? providedThumbnailPath.trim()
          : buildProjectThumbnailPath(slug, { unique: true });

      try {
        const supabase = getSupabaseServerClient();
        const binary = Buffer.from(imageBase64, "base64");
        const { error: uploadError } = await supabase.storage
          .from(PROJECTS_BUCKET)
          .upload(path, binary, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          console.error("Supabase thumbnail upload error:", uploadError);

          // Provide helpful guidance for common storage errors
          const statusCode =
            typeof uploadError === "object" &&
            uploadError !== null &&
            "statusCode" in uploadError
              ? String(
                  (uploadError as { statusCode?: string | number })?.statusCode,
                )
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
        } else {
          thumbnailPath = path;
        }
      } catch (storageError) {
        console.error(
          "Supabase configuration/storage error while uploading thumbnail:",
          storageError,
        );
      }
    } else {
      console.warn(
        "No projectSlug provided to /api/gemini/generate-image; skipping Supabase upload.",
      );
    }

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
        ? Number(((totalTokens / TOKENS_PER_MILLION) * GEMINI_IMAGE_PRICE_PER_MILLION).toFixed(6))
        : null;

    return Response.json({
      imageBase64,
      mimeType,
      thumbnailPath,
      usage,
      costUsd,
    });
  } catch (error) {
    console.error("Gemini image generation error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate image",
        details: error,
      },
      { status: 500 },
    );
  }
}

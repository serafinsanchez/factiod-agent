import { randomUUID } from "crypto";

import { GoogleGenAI } from "@google/genai";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROJECTS_BUCKET,
  buildProjectThumbnailPath,
} from "@/lib/projects";
import { TOKENS_PER_MILLION } from "@/lib/llm/costs";
import { getVisualStylePreset } from "@/lib/agent/visual-styles";
import type { VisualStyleId } from "@/types/agent";

const GEMINI_IMAGE_PRICE_PER_MILLION = 20;

export async function POST(request: Request) {
  try {
    const { 
      prompt, 
      projectSlug, 
      thumbnailPath: providedThumbnailPath, 
      skipTextOverlay,
      referenceImage, // Optional base64 character reference image for consistency
      styleId, // Optional visual style ID for style-specific image generation
    } = await request.json();

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

    // Build prompt lines conditionally based on whether text overlay is needed
    // For scene images (skipTextOverlay=true), use the visual style's image prompt
    // For thumbnails, use photoreal style
    const promptLines = skipTextOverlay
      ? [
          // Use the visual style's image prompt for scene images
          visualStyle.imageStylePrompt,
          ...(referenceImage && visualStyle.requiresCharacterReference ? [
            "CRITICAL - Character Consistency: A reference image is provided showing the exact character design. You MUST match this character's face, hair style, hair color, skin tone, outfit, and proportions EXACTLY in the new scene. The character should look identical to the reference."
          ] : []),
        ]
      : [
          // Photoreal style for thumbnails
          "You are Gemini 3 Pro Image Preview generating a cinematic 16:9 YouTube thumbnail for curious kids ages 5-9.",
          "Interpret the creative brief below and render a photoreal subject mid-action with expressive emotion.",
          "Requirements:",
          "- Subject & action: follow the brief, make the main character the focal point, capture motion.",
          "- Environment: include context from the topic in the background with depth and storytelling props.",
          "- Lighting & mood: bright, high-key rim light with soft diffusion; no harsh shadows.",
          "- Color palette: saturated, complementary colors with clean whites and accurate skin tones.",
        ];

    // Only add text overlay instruction for thumbnails, not scene images
    if (!skipTextOverlay) {
      promptLines.push(
        "- Text overlay: add a bold, 2-3 word caption derived from the brief in the upper-left, high-contrast, legible."
      );
    }

    promptLines.push(
      "- Camera & composition: cinematic wide shot, shallow depth of field, rule-of-thirds framing, plenty of breathing room.",
      skipTextOverlay
        ? "- Safety & negatives: kid-safe, no gore, no weapons, no logos, no creepy vibes, absolutely NO text, captions, labels, or words anywhere in the image."
        : "- Safety & negatives: kid-safe, no gore, no weapons, no extra logos, no creepy vibes, no additional text beyond the overlay.",
      `- Variation tag: ${variationTag}. Treat this tag as a randomness source so every run looks different, but never draw or print it.`,
      "Creative brief:",
      `\"\"\"${prompt}\"\"\"`
    );

    const structuredPrompt = promptLines.join("\n");
    
    // Build content parts - include reference image if provided
    const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: structuredPrompt },
    ];
    
    // Add reference image for character consistency if provided
    if (referenceImage && typeof referenceImage === "string") {
      contentParts.push({
        inlineData: {
          mimeType: "image/png",
          data: referenceImage,
        },
      });
    }
    
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

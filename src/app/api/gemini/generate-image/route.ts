import { GoogleGenAI } from "@google/genai";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROJECTS_BUCKET,
  buildProjectThumbnailPath,
} from "@/lib/projects";

export async function POST(request: Request) {
  try {
    const { prompt, projectSlug } = await request.json();

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

    // Explicitly instruct the model to generate an image
    const imagePrompt = `Generate an image: ${prompt}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: imagePrompt,
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

    let thumbnailPath: string | undefined;

    if (typeof projectSlug === "string" && projectSlug.trim().length > 0) {
      const slug = projectSlug.trim();
      const path = buildProjectThumbnailPath(slug);

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
          if (uploadError.statusCode === "404" || uploadError.message?.includes("Bucket not found")) {
            console.error(
              "\n⚠️  STORAGE SETUP REQUIRED:\n" +
              "The 'projects' storage bucket doesn't exist in Supabase.\n" +
              "Please run the migration: supabase/migrations/002_create_storage_bucket.sql\n" +
              "OR manually create the bucket in Supabase Dashboard → Storage → New bucket → Name: 'projects' (public)\n" +
              "See README.md for detailed setup instructions.\n"
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

    return Response.json({
      imageBase64,
      mimeType,
      thumbnailPath,
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

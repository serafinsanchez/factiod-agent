import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PROJECTS_BUCKET, buildProjectThumbnailPath } from "@/lib/projects";

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

export async function POST(request: Request) {
  try {
    const { prompt, projectSlug, thumbnailPath: providedThumbnailPath } =
      (await request.json()) as {
        prompt?: unknown;
        projectSlug?: unknown;
        thumbnailPath?: unknown;
      };

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({ error: "FAL_KEY is not set" }, { status: 500 });
    }

    fal.config({ credentials: falKey });

    const result = await fal.subscribe(SEEDREAM_MODEL_ID, {
      input: {
        prompt,
        image_size: { width: 3840, height: 2160 },
        num_images: 1,
        max_images: 1,
        enable_safety_checker: true,
      },
    });

    const raw = (result.data || result) as unknown as SeedreamResponse;
    const firstImageUrl = raw.images?.[0]?.url;

    if (!firstImageUrl || typeof firstImageUrl !== "string") {
      return NextResponse.json(
        { error: "No image URL returned from SeeDream v4", details: raw },
        { status: 500 },
      );
    }

    const imageRes = await fetch(firstImageUrl);
    if (!imageRes.ok) {
      return NextResponse.json(
        {
          error: `Failed to download generated image: ${imageRes.status} ${imageRes.statusText}`,
        },
        { status: 500 },
      );
    }

    const contentType = imageRes.headers.get("content-type") || "image/png";
    const arrayBuffer = await imageRes.arrayBuffer();
    const binary = Buffer.from(arrayBuffer);

    let thumbnailPath: string | undefined;

    if (typeof projectSlug === "string" && projectSlug.trim().length > 0) {
      const slug = projectSlug.trim();
      const path =
        typeof providedThumbnailPath === "string" &&
        providedThumbnailPath.trim().length > 0
          ? providedThumbnailPath.trim()
          : buildProjectThumbnailPath(slug, { unique: true });

      try {
        const supabase = getSupabaseServerClient();
        const { error: uploadError } = await supabase.storage
          .from(PROJECTS_BUCKET)
          .upload(path, binary, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error("Supabase thumbnail upload error:", uploadError);
        } else {
          thumbnailPath = path;
        }
      } catch (storageError) {
        console.error(
          "Supabase configuration/storage error while uploading thumbnail:",
          storageError,
        );
      }
    }

    return NextResponse.json({
      thumbnailPath,
      mimeType: contentType,
      seed: typeof raw.seed === "number" ? raw.seed : null,
    });
  } catch (error) {
    console.error("SeeDream v4 image generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate image",
        details: error,
      },
      { status: 500 },
    );
  }
}


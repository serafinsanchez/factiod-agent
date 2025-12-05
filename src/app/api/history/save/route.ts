import { NextResponse } from "next/server";

import {
  getSupabaseServerClient,
  getSchemaCacheErrorMessage,
} from "@/lib/supabase/server";
import {
  PROJECTS_BUCKET,
  buildProjectScriptPath,
  getOrCreateProjectSlug,
} from "@/lib/projects";
import type { PipelineState } from "@/types/agent";

function isPipelineState(value: unknown): value is PipelineState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.topic === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.steps === "object" &&
    candidate.steps !== null
  );
}

type SaveRequestBody = {
  pipeline?: PipelineState;
};

export async function POST(request: Request) {
  let body: SaveRequestBody;

  try {
    body = (await request.json()) as SaveRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isPipelineState(body.pipeline)) {
    return NextResponse.json(
      { error: "Missing or invalid pipeline payload." },
      { status: 400 },
    );
  }

  const incomingPipeline = body.pipeline;

  const topic = incomingPipeline.topic.trim();
  if (!topic) {
    return NextResponse.json(
      { error: "Topic is required to save a project." },
      { status: 400 },
    );
  }

  const projectSlug = getOrCreateProjectSlug(
    incomingPipeline.projectSlug,
    incomingPipeline.topic,
  );
  const creatorName =
    typeof incomingPipeline.creatorName === "string" &&
    incomingPipeline.creatorName.trim().length > 0
      ? incomingPipeline.creatorName.trim()
      : null;

  const baseScript =
    incomingPipeline.videoScript?.trim() ||
    incomingPipeline.narrationScript?.trim();

  let scriptPath: string | undefined =
    incomingPipeline.scriptPath || undefined;

  const pipelineId =
    typeof incomingPipeline.id === "string" &&
    incomingPipeline.id.trim().length > 0
      ? incomingPipeline.id
      : undefined;

  try {
    const supabase = getSupabaseServerClient();

    if (baseScript) {
      const path = buildProjectScriptPath(projectSlug);
      const { error: uploadError } = await supabase.storage
        .from(PROJECTS_BUCKET)
        .upload(path, new TextEncoder().encode(baseScript), {
          contentType: "text/markdown; charset=utf-8",
          upsert: true,
        });

      if (uploadError) {
        // Log but do not fail the whole save if script upload fails.
        console.error("Failed to upload project script to Supabase:", {
          error: uploadError,
        });
        
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
        scriptPath = path;
      }
    }

    const audioPath = incomingPipeline.audioPath ?? null;
    const thumbnailPath = incomingPipeline.thumbnailPath ?? null;

    const resolvedScriptPathForPayload =
      scriptPath ?? incomingPipeline.scriptPath ?? null;

    const upsertPayload: Record<string, unknown> = {
      topic: incomingPipeline.topic,
      creator_name: creatorName,
      model: incomingPipeline.model,
      title: incomingPipeline.title ?? null,
      description: incomingPipeline.description ?? null,
      project_slug: projectSlug,
      script_path: resolvedScriptPathForPayload,
      audio_path: audioPath,
      thumbnail_path: thumbnailPath,
      updated_at: new Date().toISOString(),
      pipeline: {
        ...incomingPipeline,
        id: pipelineId ?? incomingPipeline.id,
        projectSlug,
        scriptPath: resolvedScriptPathForPayload ?? undefined,
        audioPath: audioPath ?? undefined,
        thumbnailPath: thumbnailPath ?? undefined,
        creatorName: creatorName ?? undefined,
      },
    };

    if (pipelineId) {
      upsertPayload.id = pipelineId;
    }

    const { data, error } = await supabase
      .from("projects")
      .upsert(upsertPayload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("Supabase upsert error while saving project:", error);
      const schemaCacheError = getSchemaCacheErrorMessage(error);
      return NextResponse.json(
        {
          error: schemaCacheError || "Failed to save project.",
          details: schemaCacheError ? undefined : error.message,
        },
        { status: 500 },
      );
    }

    const resolvedScriptPath =
      (data.script_path as string | null) ??
      scriptPath ??
      incomingPipeline.scriptPath;

    const persistedPipeline: PipelineState = {
      ...incomingPipeline,
      id: String(data.id),
      projectSlug,
      scriptPath: resolvedScriptPath ?? undefined,
      audioPath: (data.audio_path as string | null) ?? audioPath ?? undefined,
      thumbnailPath:
        (data.thumbnail_path as string | null) ?? thumbnailPath ?? undefined,
      creatorName: (data.creator_name as string | null) ?? creatorName ?? undefined,
    };

    return NextResponse.json(persistedPipeline);
  } catch (error) {
    console.error("Error while saving project:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



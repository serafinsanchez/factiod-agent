import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
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

  const baseScript =
    incomingPipeline.videoScript?.trim() ||
    incomingPipeline.narrationScript?.trim();

  let scriptPath: string | undefined =
    incomingPipeline.scriptPath || undefined;

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
      } else {
        scriptPath = path;
      }
    }

    const audioPath = incomingPipeline.audioPath ?? null;
    const thumbnailPath = incomingPipeline.thumbnailPath ?? null;

    const upsertPayload: Record<string, unknown> = {
      id: incomingPipeline.id ?? undefined,
      topic: incomingPipeline.topic,
      model: incomingPipeline.model,
      title: incomingPipeline.title ?? null,
      description: incomingPipeline.description ?? null,
      project_slug: projectSlug,
      script_path: scriptPath ?? null,
      audio_path: audioPath,
      thumbnail_path: thumbnailPath,
      pipeline: {
        ...incomingPipeline,
        projectSlug,
        scriptPath: scriptPath ?? incomingPipeline.scriptPath,
        audioPath,
        thumbnailPath,
      },
    };

    const { data, error } = await supabase
      .from("projects")
      .upsert(upsertPayload)
      .select()
      .single();

    if (error) {
      console.error("Supabase upsert error while saving project:", error);
      return NextResponse.json(
        { error: "Failed to save project." },
        { status: 500 },
      );
    }

    const persistedPipeline: PipelineState = {
      ...incomingPipeline,
      id: String(data.id),
      projectSlug,
      scriptPath: (data.script_path as string | null) ?? scriptPath,
      audioPath: (data.audio_path as string | null) ?? audioPath ?? undefined,
      thumbnailPath:
        (data.thumbnail_path as string | null) ?? thumbnailPath ?? undefined,
    };

    return NextResponse.json(persistedPipeline);
  } catch (error) {
    console.error("Error while saving project:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



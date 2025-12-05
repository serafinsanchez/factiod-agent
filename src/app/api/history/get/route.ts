import { NextResponse } from "next/server";

import {
  getSupabaseServerClient,
  getSchemaCacheErrorMessage,
} from "@/lib/supabase/server";
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

type ProjectRow = {
  id: string;
  project_slug: string | null;
  script_path: string | null;
  audio_path: string | null;
  thumbnail_path: string | null;
  pipeline: PipelineState | null;
  creator_name: string | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing project id in query string." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("projects")
      .select("id, project_slug, script_path, audio_path, thumbnail_path, pipeline, creator_name")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Supabase error while loading project:", error);
      const schemaCacheError = getSchemaCacheErrorMessage(error);
      return NextResponse.json(
        {
          error: schemaCacheError || "Failed to load project.",
          details: schemaCacheError ? undefined : error.message,
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    const row = data as ProjectRow;

    if (!isPipelineState(row.pipeline)) {
      return NextResponse.json(
        { error: "Stored project data is invalid." },
        { status: 500 },
      );
    }

    const pipeline: PipelineState = {
      ...row.pipeline,
      id: String(row.id),
      projectSlug: row.project_slug ?? row.pipeline.projectSlug,
      scriptPath: row.script_path ?? row.pipeline.scriptPath,
      audioPath: row.audio_path ?? row.pipeline.audioPath,
      thumbnailPath: row.thumbnail_path ?? row.pipeline.thumbnailPath,
      creatorName: row.creator_name ?? row.pipeline.creatorName,
    };

    return NextResponse.json(pipeline);
  } catch (error) {
    console.error("Error while loading project:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



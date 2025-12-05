import { NextResponse } from "next/server";

import {
  getSupabaseServerClient,
  getSchemaCacheErrorMessage,
} from "@/lib/supabase/server";
import type { ModelId, PipelineState } from "@/types/agent";

type ProjectRow = {
  id: string;
  topic: string;
  title: string | null;
  project_slug: string | null;
  model: ModelId;
  created_at: string | null;
  pipeline: PipelineState | null;
  creator_name: string | null;
};

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("projects")
      .select("id, topic, title, project_slug, model, created_at, pipeline, creator_name")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Supabase error while listing projects:", error);
      const schemaCacheError = getSchemaCacheErrorMessage(error);
      return NextResponse.json(
        {
          error: schemaCacheError || "Failed to load projects.",
          details: schemaCacheError ? undefined : error.message,
        },
        { status: 500 },
      );
    }

    const projects =
      (data as ProjectRow[] | null | undefined)?.map((row) => ({
        id: String(row.id),
        topic: row.topic,
        title: row.title,
        projectSlug: row.project_slug,
        model: row.model,
        createdAt: row.created_at,
        creatorName: row.creator_name ?? row.pipeline?.creatorName ?? null,
        pipeline: row.pipeline ?? null,
      })) ?? [];

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error while loading project list:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



import { NextResponse } from "next/server";

import {
  getSupabaseServerClient,
  getSchemaCacheErrorMessage,
} from "@/lib/supabase/server";
import { PROJECTS_BUCKET } from "@/lib/projects";

type DeleteRequestBody = {
  id?: string;
};

export async function POST(request: Request) {
  let body: DeleteRequestBody;

  try {
    body = (await request.json()) as DeleteRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const projectId =
    typeof body.id === "string" && body.id.trim().length > 0
      ? body.id.trim()
      : null;

  if (!projectId) {
    return NextResponse.json(
      { error: "Project id is required." },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("projects")
      .select("id, script_path, audio_path, thumbnail_path")
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      console.error("Supabase error while loading project for deletion:", error);
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
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const pathsToDelete = [
      data.script_path,
      data.audio_path,
      data.thumbnail_path,
    ].filter(
      (path): path is string => typeof path === "string" && path.trim().length > 0,
    );

    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(PROJECTS_BUCKET)
        .remove(pathsToDelete);

      if (storageError) {
        console.error("Failed to delete project assets from Supabase storage:", {
          error: storageError,
          paths: pathsToDelete,
        });
        // Continue deletion even if storage cleanup fails.
      }
    }

    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (deleteError) {
      console.error("Supabase error while deleting project:", deleteError);
      const schemaCacheError = getSchemaCacheErrorMessage(deleteError);
      return NextResponse.json(
        {
          error: schemaCacheError || "Failed to delete project.",
          details: schemaCacheError ? undefined : deleteError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error while deleting project:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



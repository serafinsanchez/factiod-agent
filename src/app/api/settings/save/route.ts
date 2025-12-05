import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/settings/save
 * Upserts settings for a specific key
 * Body: { key: string, value: object }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'key' field" },
        { status: 400 }
      );
    }

    if (value === undefined) {
      return NextResponse.json(
        { error: "Missing 'value' field" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const userId = "default"; // TODO: Replace with actual user ID when auth is implemented

    const { data, error } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: userId,
          settings_key: key,
          settings_value: value,
        },
        {
          onConflict: "user_id,settings_key",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error saving settings:", error);
      return NextResponse.json(
        { error: "Failed to save settings", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Unexpected error in POST /api/settings/save:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultSettings } from "@/lib/settings/defaults";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * GET /api/settings/get?key=scriptAudio
 * Retrieves settings for a specific key
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const settingsKey = searchParams.get("key");

    if (!settingsKey) {
      return NextResponse.json(
        { error: "Missing 'key' parameter" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const userId = "default"; // TODO: Replace with actual user ID when auth is implemented

    const { data, error } = await supabase
      .from("user_settings")
      .select("settings_value")
      .eq("user_id", userId)
      .eq("settings_key", settingsKey)
      .single();

    if (error) {
      // Not found is OK - return defaults
      if (error.code === "PGRST116") {
        const defaults = getDefaultSettings(settingsKey);
        return NextResponse.json({ data: defaults });
      }
      console.error("Error fetching settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch settings", details: error.message },
        { status: 500 }
      );
    }

    const defaults = getDefaultSettings(settingsKey);
    const saved = data?.settings_value ?? null;

    const merged =
      isPlainObject(defaults) && isPlainObject(saved)
        ? { ...defaults, ...saved }
        : saved ?? defaults;

    return NextResponse.json({ data: merged });
  } catch (error) {
    console.error("Unexpected error in GET /api/settings/get:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

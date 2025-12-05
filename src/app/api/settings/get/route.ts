import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultSettings } from "@/lib/settings/defaults";
import type { ScriptAudioSettings } from "@/lib/settings/types";

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
      // Not found is OK - return defaults merged with env vars
      if (error.code === "PGRST116") {
        const defaults = getDefaultSettings(settingsKey);
        
        // Merge environment variable defaults for scriptAudio settings
        if (settingsKey === "scriptAudio" && typeof defaults === "object" && defaults !== null) {
          const envVoiceId = process.env.ELEVENLABS_VOICE_ID;
          if (envVoiceId) {
            const mergedDefaults = {
              ...defaults as ScriptAudioSettings,
              audioVoice: envVoiceId,
            };
            return NextResponse.json({ data: mergedDefaults });
          }
        }
        
        return NextResponse.json({ data: defaults });
      }
      console.error("Error fetching settings:", error);
      return NextResponse.json(
        { error: "Failed to fetch settings", details: error.message },
        { status: 500 }
      );
    }

    // If saved settings exist, merge env vars for scriptAudio if audioVoice is empty
    if (settingsKey === "scriptAudio" && data?.settings_value) {
      const savedSettings = data.settings_value as ScriptAudioSettings;
      const envVoiceId = process.env.ELEVENLABS_VOICE_ID;
      
      if (!savedSettings.audioVoice && envVoiceId) {
        const mergedSettings = {
          ...savedSettings,
          audioVoice: envVoiceId,
        };
        return NextResponse.json({ data: mergedSettings });
      }
    }

    return NextResponse.json({ data: data?.settings_value || null });
  } catch (error) {
    console.error("Unexpected error in GET /api/settings/get:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

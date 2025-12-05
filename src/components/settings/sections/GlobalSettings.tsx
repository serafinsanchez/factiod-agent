"use client";

import { useState, useEffect } from "react";
import { SettingsForm } from "../SettingsForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/use-settings";
import type { GlobalSettings as GlobalSettingsType } from "@/lib/settings/types";

export function GlobalSettings() {
  const { data, isLoading, isSaving, save, reset } = useSettings("global");
  const [localSettings, setLocalSettings] = useState<GlobalSettingsType | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data) {
      setLocalSettings(data);
      setHasChanges(false);
    }
  }, [data]);

  const updateField = <K extends keyof GlobalSettingsType>(
    field: K,
    value: GlobalSettingsType[K]
  ) => {
    if (localSettings) {
      setLocalSettings({ ...localSettings, [field]: value });
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    if (localSettings) {
      await save(localSettings);
      setHasChanges(false);
    }
  };

  const handleReset = () => {
    reset();
    setHasChanges(false);
  };

  if (isLoading || !localSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading settings...</div>
      </div>
    );
  }

  // Check API key status from environment
  const apiKeyStatus = {
    gemini: !!process.env.NEXT_PUBLIC_GEMINI_API_KEY || !!process.env.GEMINI_API_KEY,
    fal: !!process.env.NEXT_PUBLIC_FAL_KEY || !!process.env.FAL_KEY,
    elevenlabs: !!process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || !!process.env.ELEVENLABS_VOICE_ID,
  };

  return (
    <SettingsForm
      title="Global Settings"
      description="API keys, project defaults, and general preferences"
      onSave={handleSave}
      onReset={handleReset}
      isSaving={isSaving}
      hasChanges={hasChanges}
    >
      {/* API Keys Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">API Keys Status</h3>
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <span className="text-sm text-zinc-300">Gemini API</span>
            <span
              className={`px-2 py-1 text-xs rounded ${
                apiKeyStatus.gemini
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {apiKeyStatus.gemini ? "Configured" : "Missing"}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <span className="text-sm text-zinc-300">FAL (Video Generation)</span>
            <span
              className={`px-2 py-1 text-xs rounded ${
                apiKeyStatus.fal
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {apiKeyStatus.fal ? "Configured" : "Missing"}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <span className="text-sm text-zinc-300">ElevenLabs (TTS)</span>
            <span
              className={`px-2 py-1 text-xs rounded ${
                apiKeyStatus.elevenlabs
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {apiKeyStatus.elevenlabs ? "Configured" : "Missing"}
            </span>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          API keys are configured in your environment variables (.env.local)
        </p>
      </div>

      {/* Project Defaults */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Project Defaults</h3>
        <div className="space-y-2">
          <Label htmlFor="defaultProjectCreator">Default Project Creator</Label>
          <Input
            id="defaultProjectCreator"
            value={localSettings.defaultProjectCreator}
            onChange={(e) => updateField("defaultProjectCreator", e.target.value)}
            placeholder="Your name or team name"
          />
          <p className="text-xs text-zinc-500">
            This name will be shown as the creator in project lists
          </p>
        </div>
      </div>

      {/* Preferences */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Preferences</h3>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoSaveDrafts"
              checked={localSettings.autoSaveDrafts}
              onChange={(e) => updateField("autoSaveDrafts", e.target.checked)}
              className="w-4 h-4 rounded bg-zinc-800 border-zinc-700"
            />
            <Label htmlFor="autoSaveDrafts" className="cursor-pointer">
              Auto-save drafts while working
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="costTrackingDisplay"
              checked={localSettings.costTrackingDisplay}
              onChange={(e) => updateField("costTrackingDisplay", e.target.checked)}
              className="w-4 h-4 rounded bg-zinc-800 border-zinc-700"
            />
            <Label htmlFor="costTrackingDisplay" className="cursor-pointer">
              Show cost tracking in UI
            </Label>
          </div>
        </div>
      </div>
    </SettingsForm>
  );
}

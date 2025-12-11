"use client";

import { useMemo, useState } from "react";
import { SettingsForm } from "../SettingsForm";
import { PromptAccordion } from "../PromptAccordion";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/hooks/use-settings";
import type { ImagerySettings as ImagerySettingsType } from "@/lib/settings/types";

export function ImagerySettings() {
  const { data, isLoading, isSaving, save, reset } = useSettings("imagery");
  const [draft, setDraft] = useState<Partial<ImagerySettingsType>>({});

  const settings = useMemo(() => {
    if (!data) {
      return null;
    }
    return { ...data, ...draft } as ImagerySettingsType;
  }, [data, draft]);

  const hasChanges = useMemo(() => {
    if (!data) {
      return false;
    }

    return (Object.keys(draft) as Array<keyof ImagerySettingsType>).some((key) => {
      const value = draft[key];
      return value !== undefined && value !== data[key];
    });
  }, [data, draft]);

  const updateField = <K extends keyof ImagerySettingsType>(
    field: K,
    value: ImagerySettingsType[K]
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!data) {
      return;
    }
    await save({ ...data, ...draft } as ImagerySettingsType);
    setDraft({});
  };

  const handleReset = () => {
    reset();
    setDraft({});
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <SettingsForm
      title="Imagery Settings"
      description="Configure visual styles and image generation settings"
      onSave={handleSave}
      onReset={handleReset}
      isSaving={isSaving}
      hasChanges={hasChanges}
    >
      {/* Visual Style */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Visual Style & Mode</h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="defaultVisualStyle">Default Visual Style</Label>
            <Select
              id="defaultVisualStyle"
              value={settings.defaultVisualStyle}
              onChange={(e) =>
                updateField(
                  "defaultVisualStyle",
                  e.target.value as ImagerySettingsType["defaultVisualStyle"]
                )
              }
              options={[
                { value: "pixar-3d", label: "Pixar / 3D Animation" },
                { value: "paper-craft", label: "Paper Craft / Layered Cutout" },
                { value: "documentary", label: "Documentary / Nature Film" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoFrameMode">Video Frame Mode</Label>
            <Select
              id="videoFrameMode"
              value={settings.videoFrameMode}
              onChange={(e) =>
                updateField("videoFrameMode", e.target.value as ImagerySettingsType["videoFrameMode"])
              }
              options={[
                { value: "flf2v", label: "FLF2V (First-Last-Frame)" },
                { value: "first-frame-only", label: "First Frame Only" },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="characterReferenceEnabled"
            checked={settings.characterReferenceEnabled}
            onChange={(e) => updateField("characterReferenceEnabled", e.target.checked)}
            className="w-4 h-4 rounded bg-zinc-800 border-zinc-700"
          />
          <Label htmlFor="characterReferenceEnabled" className="cursor-pointer">
            Enable Character Reference (for Pixar-3D style)
          </Label>
        </div>

        <div className="space-y-2">
          <Label>Gemini Model</Label>
          <Input
            value="gemini-3-pro-image-preview"
            disabled
            className="bg-zinc-900/50 text-zinc-500"
          />
          <p className="text-xs text-zinc-500">This model is used for image generation</p>
        </div>
      </div>

      {/* Prompts */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Prompt Templates</h3>
        <PromptAccordion
          prompts={[
            {
              id: "sceneImagePrompts",
              title: "Scene Image Prompts",
              description: "Convert scenes into image generation prompts",
              value: settings.promptSceneImagePrompts,
              onChange: (value) => updateField("promptSceneImagePrompts", value),
            },
          ]}
        />
      </div>
    </SettingsForm>
  );
}

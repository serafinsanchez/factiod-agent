"use client";

import { useMemo, useState } from "react";
import { SettingsForm } from "../SettingsForm";
import { PromptAccordion } from "../PromptAccordion";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/use-settings";
import type { PublishingSettings as PublishingSettingsType } from "@/lib/settings/types";

export function PublishingSettings() {
  const { data, isLoading, isSaving, save, reset } = useSettings("publishing");
  const [draft, setDraft] = useState<Partial<PublishingSettingsType>>({});

  const settings = useMemo(() => {
    if (!data) {
      return null;
    }
    return { ...data, ...draft } as PublishingSettingsType;
  }, [data, draft]);

  const hasChanges = useMemo(() => {
    if (!data) {
      return false;
    }

    return (Object.keys(draft) as Array<keyof PublishingSettingsType>).some((key) => {
      const value = draft[key];
      return value !== undefined && value !== data[key];
    });
  }, [data, draft]);

  const updateField = <K extends keyof PublishingSettingsType>(
    field: K,
    value: PublishingSettingsType[K]
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!data) {
      return;
    }
    await save({ ...data, ...draft } as PublishingSettingsType);
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
      title="Publishing Settings"
      description="Configure title, description, and thumbnail settings"
      onSave={handleSave}
      onReset={handleReset}
      isSaving={isSaving}
      hasChanges={hasChanges}
    >
      {/* Default Promo Copy */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Default Promo Copy</h3>
        <div className="space-y-2">
          <Label htmlFor="defaultPromoCopy">Promo Copy Outro</Label>
          <Textarea
            id="defaultPromoCopy"
            value={settings.defaultPromoCopy}
            onChange={(e) => updateField("defaultPromoCopy", e.target.value)}
            rows={4}
            placeholder="Optional promo copy to add at the end of videos..."
          />
          <p className="text-xs text-zinc-500">
            This text will be appended to video descriptions if provided
          </p>
        </div>
      </div>

      {/* Thumbnail */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Thumbnail</h3>

        <div className="space-y-2">
          <Label htmlFor="thumbnailModel">Thumbnail model</Label>
          <Select
            id="thumbnailModel"
            value={settings.thumbnailModel}
            onChange={(e) =>
              updateField(
                "thumbnailModel",
                e.target.value as PublishingSettingsType["thumbnailModel"],
              )
            }
            options={[
              { value: "nano_banana_pro", label: "Nano Banana Pro (Gemini)" },
              { value: "seedream_v4", label: "SeeDream v4 (FAL.ai)" },
            ]}
          />
          <p className="text-xs text-zinc-500">
            Nano Banana Pro requires <code className="text-zinc-300">GEMINI_API_KEY</code>; SeeDream v4 requires{" "}
            <code className="text-zinc-300">FAL_KEY</code>.
          </p>
        </div>
      </div>

      {/* Prompts */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Prompt Templates</h3>
        <PromptAccordion
          prompts={[
            {
              id: "titleDescription",
              title: "Title & Description",
              description: "Generate YouTube title and description",
              value: settings.promptTitleDescription,
              onChange: (value) => updateField("promptTitleDescription", value),
            },
            {
              id: "thumbnail",
              title: "Thumbnail Prompt",
              description: "Generate thumbnail creative brief",
              value: settings.promptThumbnail,
              onChange: (value) => updateField("promptThumbnail", value),
            },
          ]}
        />
      </div>
    </SettingsForm>
  );
}

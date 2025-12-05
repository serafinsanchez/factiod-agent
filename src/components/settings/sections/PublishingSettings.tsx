"use client";

import { useState, useEffect } from "react";
import { SettingsForm } from "../SettingsForm";
import { PromptAccordion } from "../PromptAccordion";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/use-settings";
import type { PublishingSettings as PublishingSettingsType } from "@/lib/settings/types";

export function PublishingSettings() {
  const { data, isLoading, isSaving, save, reset } = useSettings("publishing");
  const [localSettings, setLocalSettings] = useState<PublishingSettingsType | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data) {
      setLocalSettings(data);
      setHasChanges(false);
    }
  }, [data]);

  const updateField = <K extends keyof PublishingSettingsType>(
    field: K,
    value: PublishingSettingsType[K]
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
            value={localSettings.defaultPromoCopy}
            onChange={(e) => updateField("defaultPromoCopy", e.target.value)}
            rows={4}
            placeholder="Optional promo copy to add at the end of videos..."
          />
          <p className="text-xs text-zinc-500">
            This text will be appended to video descriptions if provided
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
              value: localSettings.promptTitleDescription,
              onChange: (value) => updateField("promptTitleDescription", value),
            },
            {
              id: "thumbnail",
              title: "Thumbnail Prompt",
              description: "Generate thumbnail creative brief",
              value: localSettings.promptThumbnail,
              onChange: (value) => updateField("promptThumbnail", value),
            },
          ]}
        />
      </div>
    </SettingsForm>
  );
}

"use client";

import { useState, useEffect } from "react";
import { SettingsForm } from "../SettingsForm";
import { PromptAccordion } from "../PromptAccordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/use-settings";
import type { TimingStoryboardSettings as TimingStoryboardSettingsType } from "@/lib/settings/types";

export function TimingStoryboardSettings() {
  const { data, isLoading, isSaving, save, reset } = useSettings("timingStoryboard");
  const [localSettings, setLocalSettings] = useState<TimingStoryboardSettingsType | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data) {
      setLocalSettings(data);
      setHasChanges(false);
    }
  }, [data]);

  const updateField = <K extends keyof TimingStoryboardSettingsType>(
    field: K,
    value: TimingStoryboardSettingsType[K]
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
      title="Timing + Storyboard Settings"
      description="Configure production script and scene duration constraints"
      onSave={handleSave}
      onReset={handleReset}
      isSaving={isSaving}
      hasChanges={hasChanges}
    >
      {/* Duration Constraints */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Scene Duration</h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sceneDurationMin">Minimum Duration (seconds)</Label>
            <Input
              id="sceneDurationMin"
              type="number"
              value={localSettings.sceneDurationMin}
              onChange={(e) => updateField("sceneDurationMin", parseInt(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sceneDurationMax">Maximum Duration (seconds)</Label>
            <Input
              id="sceneDurationMax"
              type="number"
              value={localSettings.sceneDurationMax}
              onChange={(e) => updateField("sceneDurationMax", parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Prompts */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Prompt Templates</h3>
        <PromptAccordion
          prompts={[
            {
              id: "productionScript",
              title: "Production Script",
              description: "Convert video script into scene-by-scene breakdown",
              value: localSettings.promptProductionScript,
              onChange: (value) => updateField("promptProductionScript", value),
            },
          ]}
        />
      </div>
    </SettingsForm>
  );
}

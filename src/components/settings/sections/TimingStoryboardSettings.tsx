"use client";

import { useMemo, useState } from "react";
import { SettingsForm } from "../SettingsForm";
import { PromptAccordion } from "../PromptAccordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/use-settings";
import type { TimingStoryboardSettings as TimingStoryboardSettingsType } from "@/lib/settings/types";

export function TimingStoryboardSettings() {
  const { data, isLoading, isSaving, save, reset } = useSettings("timingStoryboard");
  const [draft, setDraft] = useState<Partial<TimingStoryboardSettingsType>>({});

  const settings = useMemo(() => {
    if (!data) {
      return null;
    }
    return { ...data, ...draft } as TimingStoryboardSettingsType;
  }, [data, draft]);

  const hasChanges = useMemo(() => {
    if (!data) {
      return false;
    }

    return (Object.keys(draft) as Array<keyof TimingStoryboardSettingsType>).some((key) => {
      const value = draft[key];
      return value !== undefined && value !== data[key];
    });
  }, [data, draft]);

  const updateField = <K extends keyof TimingStoryboardSettingsType>(
    field: K,
    value: TimingStoryboardSettingsType[K]
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!data) {
      return;
    }
    await save({ ...data, ...draft } as TimingStoryboardSettingsType);
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
              value={settings.sceneDurationMin}
              onChange={(e) => updateField("sceneDurationMin", parseInt(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sceneDurationMax">Maximum Duration (seconds)</Label>
            <Input
              id="sceneDurationMax"
              type="number"
              value={settings.sceneDurationMax}
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
              value: settings.promptProductionScript,
              onChange: (value) => updateField("promptProductionScript", value),
            },
          ]}
        />
      </div>
    </SettingsForm>
  );
}

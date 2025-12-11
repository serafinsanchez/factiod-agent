"use client";

import { useMemo, useState } from "react";
import { SettingsForm } from "../SettingsForm";
import { PromptAccordion } from "../PromptAccordion";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/hooks/use-settings";
import type { VideoGenSettings as VideoGenSettingsType } from "@/lib/settings/types";

export function VideoGenSettings() {
  const { data, isLoading, isSaving, save, reset } = useSettings("videoGen");
  const [draft, setDraft] = useState<Partial<VideoGenSettingsType>>({});

  const settings = useMemo(() => {
    if (!data) {
      return null;
    }
    return { ...data, ...draft } as VideoGenSettingsType;
  }, [data, draft]);

  const hasChanges = useMemo(() => {
    if (!data) {
      return false;
    }

    return (Object.keys(draft) as Array<keyof VideoGenSettingsType>).some((key) => {
      const value = draft[key];
      return value !== undefined && value !== data[key];
    });
  }, [data, draft]);

  const updateField = <K extends keyof VideoGenSettingsType>(
    field: K,
    value: VideoGenSettingsType[K]
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!data) {
      return;
    }
    await save({ ...data, ...draft } as VideoGenSettingsType);
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
      title="Video Generation Settings"
      description="Configure WAN 2.2 model and video generation parameters"
      onSave={handleSave}
      onReset={handleReset}
      isSaving={isSaving}
      hasChanges={hasChanges}
    >
      {/* Model Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Model & Preset</h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="videoModel">Video Model</Label>
            <Select
              id="videoModel"
              value={settings.videoModel}
              onChange={(e) =>
                updateField("videoModel", e.target.value as VideoGenSettingsType["videoModel"])
              }
              options={[
                { value: "WAN_2_2", label: "WAN 2.2 (14B)" },
                { value: "WAN_2_2_SMALL", label: "WAN 2.2 Small (1.3B)" },
                { value: "WAN_2_1", label: "WAN 2.1 (1.3B)" },
                { value: "MINIMAX", label: "MiniMax" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preset">Preset</Label>
            <Select
              id="preset"
              value={settings.preset}
              onChange={(e) => updateField("preset", e.target.value as VideoGenSettingsType["preset"])}
              options={[
                { value: "quality", label: "Quality (Slow, High Quality)" },
                { value: "smooth", label: "Smooth (Recommended for FLF2V)" },
                { value: "balanced", label: "Balanced (Good Quality, Moderate Speed)" },
                { value: "fast", label: "Fast (Quick Preview)" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Quality Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Quality Settings</h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="resolution">Resolution</Label>
            <Select
              id="resolution"
              value={settings.resolution}
              onChange={(e) =>
                updateField("resolution", e.target.value as VideoGenSettingsType["resolution"])
              }
              options={[
                { value: "480p", label: "480p" },
                { value: "580p", label: "580p" },
                { value: "720p", label: "720p (HD)" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aspectRatio">Aspect Ratio</Label>
            <Select
              id="aspectRatio"
              value={settings.aspectRatio}
              onChange={(e) =>
                updateField("aspectRatio", e.target.value as VideoGenSettingsType["aspectRatio"])
              }
              options={[
                { value: "auto", label: "Auto" },
                { value: "16:9", label: "16:9 (YouTube Standard)" },
                { value: "9:16", label: "9:16 (Vertical)" },
                { value: "1:1", label: "1:1 (Square)" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Generation Parameters */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Generation Parameters</h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="numInferenceSteps">Inference Steps</Label>
            <Input
              id="numInferenceSteps"
              type="number"
              min={2}
              max={40}
              value={settings.numInferenceSteps}
              onChange={(e) => updateField("numInferenceSteps", parseInt(e.target.value))}
            />
            <p className="text-xs text-zinc-500">Higher = better quality, slower (2-40)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guidanceScale">Guidance Scale</Label>
            <Input
              id="guidanceScale"
              type="number"
              min={1}
              max={10}
              step={0.1}
              value={settings.guidanceScale}
              onChange={(e) => updateField("guidanceScale", parseFloat(e.target.value))}
            />
            <p className="text-xs text-zinc-500">Higher = better prompt adherence (1-10)</p>
          </div>
        </div>
      </div>

      {/* Interpolation */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Frame Interpolation</h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="interpolatorModel">Interpolator Model</Label>
            <Select
              id="interpolatorModel"
              value={settings.interpolatorModel}
              onChange={(e) =>
                updateField(
                  "interpolatorModel",
                  e.target.value as VideoGenSettingsType["interpolatorModel"]
                )
              }
              options={[
                { value: "none", label: "None" },
                { value: "film", label: "FILM (Recommended)" },
                { value: "rife", label: "RIFE" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="numInterpolatedFrames">Interpolated Frames</Label>
            <Input
              id="numInterpolatedFrames"
              type="number"
              min={0}
              max={4}
              value={settings.numInterpolatedFrames}
              onChange={(e) => updateField("numInterpolatedFrames", parseInt(e.target.value))}
            />
            <p className="text-xs text-zinc-500">Between each pair (0-4)</p>
          </div>
        </div>
      </div>

      {/* Negative Prompt */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Negative Prompt</h3>
        <div className="space-y-2">
          <Label htmlFor="negativePrompt">Elements to Avoid</Label>
          <Textarea
            id="negativePrompt"
            value={settings.negativePrompt}
            onChange={(e) => updateField("negativePrompt", e.target.value)}
            rows={3}
            placeholder="blur, distort, low quality..."
          />
        </div>
      </div>

      {/* Prompts */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Prompt Templates</h3>
        <PromptAccordion
          prompts={[
            {
              id: "sceneVideoPrompts",
              title: "Scene Video Prompts",
              description: "Generate motion prompts for video generation",
              value: settings.promptSceneVideoPrompts,
              onChange: (value) => updateField("promptSceneVideoPrompts", value),
            },
          ]}
        />
      </div>
    </SettingsForm>
  );
}

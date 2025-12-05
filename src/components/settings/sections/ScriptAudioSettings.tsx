"use client";

import { useState, useEffect } from "react";
import { SettingsForm } from "../SettingsForm";
import { PromptAccordion } from "../PromptAccordion";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useSettings } from "@/hooks/use-settings";
import type { ScriptAudioSettings as ScriptAudioSettingsType } from "@/lib/settings/types";

export function ScriptAudioSettings() {
  const { data, isLoading, isSaving, save, reset } = useSettings("scriptAudio");
  const [localSettings, setLocalSettings] = useState<ScriptAudioSettingsType | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data) {
      setLocalSettings(data);
      setHasChanges(false);
    }
  }, [data]);

  const updateField = <K extends keyof ScriptAudioSettingsType>(
    field: K,
    value: ScriptAudioSettingsType[K]
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
      title="Script + Audio Settings"
      description="Configure LLM model, prompts, and text-to-speech settings"
      onSave={handleSave}
      onReset={handleReset}
      isSaving={isSaving}
      hasChanges={hasChanges}
    >
      {/* Model & Defaults */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Model & Defaults</h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="llmModel">LLM Model</Label>
            <Select
              id="llmModel"
              value={localSettings.llmModel}
              onChange={(e) => updateField("llmModel", e.target.value as any)}
              options={[
                { value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
                { value: "gpt-5.1-2025-11-13", label: "GPT-5.1" },
                { value: "kimik2-thinking", label: "Kimik2 Thinking" },
                { value: "gemini-3-pro", label: "Gemini 3 Pro" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultWordCount">Default Word Count</Label>
            <Input
              id="defaultWordCount"
              type="number"
              value={localSettings.defaultWordCount}
              onChange={(e) => updateField("defaultWordCount", parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Audio Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Audio Settings</h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="audioVoice">Audio Voice ID</Label>
            <Input
              id="audioVoice"
              value={localSettings.audioVoice}
              onChange={(e) => updateField("audioVoice", e.target.value)}
              placeholder="ElevenLabs voice ID"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="narrationModel">Narration Model</Label>
            <Select
              id="narrationModel"
              value={localSettings.narrationModel}
              onChange={(e) => updateField("narrationModel", e.target.value as any)}
              options={[
                { value: "eleven_v3", label: "ElevenLabs V3" },
                { value: "eleven_multilingual_v2", label: "ElevenLabs Multilingual V2" },
              ]}
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
              id: "keyConcepts",
              title: "Key Concepts",
              description: "Extract main concepts from the topic",
              value: localSettings.promptKeyConcepts,
              onChange: (value) => updateField("promptKeyConcepts", value),
            },
            {
              id: "hook",
              title: "Hook Generation",
              description: "Create engaging opening hook",
              value: localSettings.promptHook,
              onChange: (value) => updateField("promptHook", value),
            },
            {
              id: "quizzes",
              title: "Quiz Generation",
              description: "Generate quiz questions and answers",
              value: localSettings.promptQuizzes,
              onChange: (value) => updateField("promptQuizzes", value),
            },
            {
              id: "script",
              title: "Script Generation",
              description: "Main video script creation",
              value: localSettings.promptScript,
              onChange: (value) => updateField("promptScript", value),
            },
            {
              id: "scriptQA",
              title: "Script QA",
              description: "Quality assurance for script",
              value: localSettings.promptScriptQA,
              onChange: (value) => updateField("promptScriptQA", value),
            },
            {
              id: "narrationClean",
              title: "Narration Cleaner",
              description: "Remove stage directions from script",
              value: localSettings.promptNarrationClean,
              onChange: (value) => updateField("promptNarrationClean", value),
            },
            {
              id: "narrationAudioTags",
              title: "Narration Audio Tags",
              description: "Add ElevenLabs voice tags",
              value: localSettings.promptNarrationAudioTags,
              onChange: (value) => updateField("promptNarrationAudioTags", value),
            },
          ]}
        />
      </div>
    </SettingsForm>
  );
}

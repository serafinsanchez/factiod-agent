"use client";

import { useMemo, useState } from "react";
import { SettingsForm } from "../SettingsForm";
import { PromptAccordion } from "../PromptAccordion";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/hooks/use-settings";
import type { ScriptAudioSettings as ScriptAudioSettingsType } from "@/lib/settings/types";
import {
  getScriptPromptTemplate,
  SCRIPT_PROMPT_VERSION_LABELS,
  type ScriptPromptVersion,
} from "@/prompts/script-variants";

export function ScriptAudioSettings() {
  const { data, isLoading, isSaving, save, reset } = useSettings("scriptAudio");
  const [draft, setDraft] = useState<Partial<ScriptAudioSettingsType>>({});

  const settings = useMemo(() => {
    if (!data) {
      return null;
    }
    return { ...data, ...draft } as ScriptAudioSettingsType;
  }, [data, draft]);

  const hasChanges = useMemo(() => {
    if (!data) {
      return false;
    }

    return (Object.keys(draft) as Array<keyof ScriptAudioSettingsType>).some((key) => {
      const value = draft[key];
      return value !== undefined && value !== data[key];
    });
  }, [data, draft]);

  const updateField = <K extends keyof ScriptAudioSettingsType>(
    field: K,
    value: ScriptAudioSettingsType[K]
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!data) {
      return;
    }
    await save({ ...data, ...draft } as ScriptAudioSettingsType);
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
              value={settings.llmModel}
              onChange={(e) =>
                updateField("llmModel", e.target.value as ScriptAudioSettingsType["llmModel"])
              }
              options={[
                { value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
                { value: "claude-opus-4.5", label: "Claude Opus 4.5" },
                { value: "gpt-5.1-2025-11-13", label: "GPT-5.1" },
                { value: "gpt-5.2", label: "GPT-5.2" },
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
              value={settings.defaultWordCount}
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
            <Label htmlFor="audioVoice">Audio Voice</Label>
            <Select
              id="audioVoice"
              value={settings.audioVoice}
              onChange={(e) => updateField("audioVoice", e.target.value)}
              options={[
                { value: "dXtC3XhB9GtPusIpNtQx", label: "Pip the Penguin" },
                { value: "aMSt68OGf4xUZAnLpTU8", label: "Juniper" },
                ...(settings.audioVoice && 
                   settings.audioVoice !== "dXtC3XhB9GtPusIpNtQx" && 
                   settings.audioVoice !== "aMSt68OGf4xUZAnLpTU8"
                  ? [{ value: settings.audioVoice, label: `Custom (${settings.audioVoice.slice(0, 8)}...)` }]
                  : [])
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="narrationModel">Narration Model</Label>
            <Select
              id="narrationModel"
              value={settings.narrationModel}
              onChange={(e) =>
                updateField(
                  "narrationModel",
                  e.target.value as ScriptAudioSettingsType["narrationModel"]
                )
              }
              options={[
                { value: "eleven_v3", label: "ElevenLabs V3" },
                { value: "eleven_multilingual_v2", label: "ElevenLabs Multilingual V2" },
              ]}
            />
          </div>
        </div>

      </div>

      {/* Script Prompt Version Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Script Prompt Version</h3>
        <p className="text-sm text-zinc-400">
          Choose the script generation prompt version for each audience. Use v2 (retention-optimized) to A/B test new prompts.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="scriptPromptVersionKids">Kids Audience</Label>
            <Select
              id="scriptPromptVersionKids"
              value={settings.scriptPromptVersionKids ?? "v1"}
              onChange={(e) =>
                updateField("scriptPromptVersionKids", e.target.value as ScriptPromptVersion)
              }
              options={[
                { value: "v1", label: SCRIPT_PROMPT_VERSION_LABELS.v1 },
                { value: "v2", label: SCRIPT_PROMPT_VERSION_LABELS.v2 },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scriptPromptVersionEveryone">Everyone Audience</Label>
            <Select
              id="scriptPromptVersionEveryone"
              value={settings.scriptPromptVersionEveryone ?? "v1"}
              onChange={(e) =>
                updateField("scriptPromptVersionEveryone", e.target.value as ScriptPromptVersion)
              }
              options={[
                { value: "v1", label: SCRIPT_PROMPT_VERSION_LABELS.v1 },
                { value: "v2", label: SCRIPT_PROMPT_VERSION_LABELS.v2 },
              ]}
            />
          </div>
        </div>

        {/* Preview of selected prompts */}
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">
              Kids Script Prompt Preview ({SCRIPT_PROMPT_VERSION_LABELS[settings.scriptPromptVersionKids ?? "v1"]})
            </Label>
            <Textarea
              value={getScriptPromptTemplate("forKids", settings.scriptPromptVersionKids ?? "v1")}
              readOnly
              rows={8}
              className="font-mono text-xs bg-zinc-900/50 text-zinc-400 cursor-default"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">
              Everyone Script Prompt Preview ({SCRIPT_PROMPT_VERSION_LABELS[settings.scriptPromptVersionEveryone ?? "v1"]})
            </Label>
            <Textarea
              value={getScriptPromptTemplate("forEveryone", settings.scriptPromptVersionEveryone ?? "v1")}
              readOnly
              rows={8}
              className="font-mono text-xs bg-zinc-900/50 text-zinc-400 cursor-default"
            />
          </div>
        </div>
      </div>

      {/* Other Prompts */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Other Prompt Templates</h3>
        <PromptAccordion
          prompts={[
            {
              id: "keyConcepts",
              title: "Key Concepts",
              description: "Extract main concepts from the topic",
              value: settings.promptKeyConcepts,
              onChange: (value) => updateField("promptKeyConcepts", value),
            },
            {
              id: "hook",
              title: "Hook Generation",
              description: "Create engaging opening hook",
              value: settings.promptHook,
              onChange: (value) => updateField("promptHook", value),
            },
            {
              id: "quizzes",
              title: "Quiz Generation",
              description: "Generate quiz questions and answers",
              value: settings.promptQuizzes,
              onChange: (value) => updateField("promptQuizzes", value),
            },
            {
              id: "scriptQA",
              title: "Script QA",
              description: "Quality assurance for script",
              value: settings.promptScriptQA,
              onChange: (value) => updateField("promptScriptQA", value),
            },
            {
              id: "narrationAudioTags",
              title: "Narration Audio Tags",
              description: "Add ElevenLabs voice tags",
              value: settings.promptNarrationAudioTags,
              onChange: (value) => updateField("promptNarrationAudioTags", value),
            },
          ]}
        />
      </div>
    </SettingsForm>
  );
}

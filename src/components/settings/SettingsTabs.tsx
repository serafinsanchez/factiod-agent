"use client";

import { cn } from "@/lib/utils";

export type SettingsTabId =
  | "scriptAudio"
  | "timingStoryboard"
  | "imagery"
  | "videoGen"
  | "publishing"
  | "global"
  | "admin";

interface Tab {
  id: SettingsTabId;
  label: string;
  description: string;
}

const TABS: Tab[] = [
  {
    id: "scriptAudio",
    label: "Script + Audio",
    description: "LLM model, prompts, TTS settings",
  },
  {
    id: "timingStoryboard",
    label: "Timing + Storyboard",
    description: "Production script, scene duration",
  },
  {
    id: "imagery",
    label: "Imagery",
    description: "Visual styles, image generation",
  },
  {
    id: "videoGen",
    label: "Video Gen",
    description: "WAN 2.2, video model settings",
  },
  {
    id: "publishing",
    label: "Publishing",
    description: "Title, description, thumbnails",
  },
  {
    id: "global",
    label: "Global",
    description: "API keys, project defaults",
  },
  {
    id: "admin",
    label: "Admin",
    description: "Session analytics & costs",
  },
];

interface SettingsTabsProps {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
}

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <nav className="flex flex-col gap-1 min-w-[240px]">
      <div className="px-3 mb-2">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
          Settings
        </p>
      </div>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-3 py-2.5 rounded-lg text-left transition-colors",
            activeTab === tab.id
              ? "bg-blue-500/10 text-blue-400"
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
          )}
        >
          <div className="font-medium text-sm">{tab.label}</div>
          <div className="text-xs opacity-80 mt-0.5">{tab.description}</div>
        </button>
      ))}
    </nav>
  );
}

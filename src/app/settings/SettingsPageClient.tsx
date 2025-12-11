"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Home, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { SettingsTabs, type SettingsTabId } from "@/components/settings/SettingsTabs";
import { ScriptAudioSettings } from "@/components/settings/sections/ScriptAudioSettings";
import { TimingStoryboardSettings } from "@/components/settings/sections/TimingStoryboardSettings";
import { ImagerySettings } from "@/components/settings/sections/ImagerySettings";
import { VideoGenSettings } from "@/components/settings/sections/VideoGenSettings";
import { PublishingSettings } from "@/components/settings/sections/PublishingSettings";
import { GlobalSettings } from "@/components/settings/sections/GlobalSettings";
import { AdminPanel } from "@/components/settings/sections/AdminPanel";
import type { StageDefinition } from "@/components/agent/stage-config";
import type { PipelineState } from "@/types/agent";
import {
  PIPELINE_STORAGE_KEY,
  ensureCumulativeTotals,
  ensureSessionTotals,
  isPipelineState,
} from "@/hooks/pipeline/pipeline-types";

const VIDEO_TEAM_HIDDEN_TABS = new Set<SettingsTabId>([
  "timingStoryboard",
  "imagery",
  "videoGen",
  "admin",
]);

type SettingsPageClientProps = {
  role?: string;
  stages: StageDefinition[];
};

export default function SettingsPageClient({ role, stages }: SettingsPageClientProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("scriptAudio");
  const [pipelineSnapshot, setPipelineSnapshot] = useState<PipelineState | null>(null);
  const [isPipelineLoading, setIsPipelineLoading] = useState(true);

  const loadPipelineFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PIPELINE_STORAGE_KEY);
      if (!raw) {
        setPipelineSnapshot(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (isPipelineState(parsed)) {
        const normalized = ensureCumulativeTotals(ensureSessionTotals(parsed));
        setPipelineSnapshot(normalized);
      } else {
        setPipelineSnapshot(null);
      }
    } catch (error) {
      console.error("Failed to read pipeline snapshot:", error);
      setPipelineSnapshot(null);
    } finally {
      setIsPipelineLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPipelineFromStorage();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PIPELINE_STORAGE_KEY) {
        loadPipelineFromStorage();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [loadPipelineFromStorage]);

  useEffect(() => {
    if (role === "videoteam" && VIDEO_TEAM_HIDDEN_TABS.has(activeTab)) {
      setActiveTab("scriptAudio");
    }
  }, [activeTab, role]);

  const isVideoTeam = role === "videoteam";

  return (
    <div className="min-h-screen bg-zinc-950/98 text-white">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-zinc-800/50 bg-zinc-900 px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center justify-center rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            aria-label="Back to home"
          >
            <Home className="h-5 w-5" />
          </Link>

          <div className="flex items-center gap-1">
            {stages.map((stage, index) => {
              const isLast = index === stages.length - 1;

              return (
                <div key={stage.id} className="flex items-center">
                  <Link
                    href="/"
                    className={cn(
                      "relative px-3 py-4 text-sm font-medium transition-colors",
                      "text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    {stage.label}
                  </Link>
                  {!isLast && (
                    <span className="mx-1 text-zinc-600" aria-hidden="true">
                      |
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-zinc-400" />
          <span className="text-sm font-medium text-white">Settings</span>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Left sidebar navigation */}
          <aside className="sticky top-8 h-fit">
            <SettingsTabs role={role} activeTab={activeTab} onTabChange={setActiveTab} />
          </aside>

          {/* Main content area */}
          <main className="flex-1 min-w-0">
            {activeTab === "scriptAudio" && <ScriptAudioSettings />}

            {!isVideoTeam && activeTab === "timingStoryboard" && <TimingStoryboardSettings />}
            {!isVideoTeam && activeTab === "imagery" && <ImagerySettings />}
            {!isVideoTeam && activeTab === "videoGen" && <VideoGenSettings />}

            {activeTab === "publishing" && <PublishingSettings />}
            {activeTab === "global" && <GlobalSettings />}

            {!isVideoTeam && activeTab === "admin" && (
              <AdminPanel pipeline={pipelineSnapshot} isLoading={isPipelineLoading} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

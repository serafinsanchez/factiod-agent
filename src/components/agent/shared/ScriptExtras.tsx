"use client";

import type { UseAgentPipelineReturn } from "@/hooks/use-agent-pipeline";

interface ScriptExtrasProps {
  derived: UseAgentPipelineReturn["derived"];
}

export function ScriptExtras({ derived }: ScriptExtrasProps) {
  const draftStats = derived.scriptDraftStats;

  if (!draftStats) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4">
      <div>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
          Initial script stats
        </p>
        <p className="text-xs text-zinc-500">Captured right after Script Generation.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/80 p-4">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Word count
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {draftStats.words.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-500">Before QA tightening.</p>
        </div>
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/80 p-4">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Character count
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {draftStats.characters.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-500">Includes spaces & punctuation.</p>
        </div>
      </div>
    </div>
  );
}

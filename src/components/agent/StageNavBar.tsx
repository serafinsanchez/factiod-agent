import Link from "next/link";
import { Home, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { type StageDefinition, type StageId } from "./stage-config";

interface StageNavBarProps {
  stages: StageDefinition[];
  activeStageId: StageId;
  onSelectStage: (stageId: StageId) => void;
}

export function StageNavBar({
  stages,
  activeStageId,
  onSelectStage,
}: StageNavBarProps) {
  return (
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
            const isActive = stage.id === activeStageId;
            const isLast = index === stages.length - 1;

            return (
              <div key={stage.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onSelectStage(stage.id)}
                  className={cn(
                    "relative px-3 py-4 text-sm font-medium transition-colors",
                    isActive
                      ? "text-white"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {stage.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"
                      aria-hidden="true"
                    />
                  )}
                </button>
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

      <Link
        href="/settings"
        className="flex items-center justify-center rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        aria-label="Settings"
      >
        <Settings className="h-5 w-5" />
      </Link>
    </nav>
  );
}

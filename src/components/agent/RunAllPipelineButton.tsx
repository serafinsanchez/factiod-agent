"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import type { RunAllState } from "@/types/agent";
import { getStepLabel } from "@/lib/pipeline/error-classifier";
import { cn } from "@/lib/utils";

interface RunAllPipelineButtonProps {
  runAllState: RunAllState | undefined;
  isRunning: boolean;
  canResume: boolean;
  hasCompleted: boolean;
  hasFailed: boolean;
  onStart: () => void;
  onResume: () => void;
  onCancel: () => void;
  getProgress: () => {
    current: number;
    total: number;
    completed: number;
    percentage: number;
    currentStepLabel: string | null;
  };
  className?: string;
}

export function RunAllPipelineButton({
  runAllState,
  isRunning,
  canResume,
  hasCompleted,
  hasFailed,
  onStart,
  onResume,
  onCancel,
  getProgress,
  className,
}: RunAllPipelineButtonProps) {
  const progress = getProgress();

  const handleClick = useCallback(() => {
    if (isRunning) {
      onCancel();
    } else if (canResume) {
      onResume();
    } else {
      onStart();
    }
  }, [isRunning, canResume, onStart, onResume, onCancel]);

  const getButtonContent = () => {
    if (isRunning) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Running: {progress.currentStepLabel || "..."}</span>
        </>
      );
    }

    if (canResume && hasFailed) {
      return (
        <>
          <RotateCcw className="h-4 w-4" />
          <span>Resume from Failed Step</span>
        </>
      );
    }

    if (hasCompleted) {
      return (
        <>
          <CheckCircle2 className="h-4 w-4" />
          <span>All Steps Complete</span>
        </>
      );
    }

    return (
      <>
        <Play className="h-4 w-4" />
        <span>Run All Steps</span>
      </>
    );
  };

  const getButtonVariant = () => {
    if (hasCompleted) return "outline";
    if (hasFailed) return "destructive";
    return "default";
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Button
          onClick={handleClick}
          variant={getButtonVariant()}
          size="lg"
          className="flex items-center gap-2"
          disabled={hasCompleted && !hasFailed}
        >
          {getButtonContent()}
        </Button>

        {isRunning && (
          <Button
            onClick={onCancel}
            variant="outline"
            size="lg"
            className="flex items-center gap-2"
          >
            <XCircle className="h-4 w-4" />
            Cancel
          </Button>
        )}
      </div>

      {/* Progress bar when running */}
      {isRunning && (
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-white transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-sm text-zinc-400">
            Step {progress.current} of {progress.total} ({progress.completed} completed)
          </p>
        </div>
      )}

      {/* Error message when failed */}
      {hasFailed && runAllState?.error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-300">
                Failed at: {runAllState.failedStepId ? getStepLabel(runAllState.failedStepId) : "Unknown"}
              </p>
              <p className="text-sm text-red-400/80">{runAllState.error.message}</p>
              {runAllState.error.guidance && (
                <p className="text-sm text-zinc-400">{runAllState.error.guidance}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success message when completed */}
      {hasCompleted && (
        <div className="rounded-lg border border-green-900/50 bg-green-950/30 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <p className="text-sm text-green-300">
              All {progress.total} steps completed successfully!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import type { PipelineState } from "@/types/agent";

export type ProjectStatus = "draft" | "in-progress" | "review" | "complete";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  "draft": "Draft",
  "in-progress": "In Progress",
  "review": "Review",
  "complete": "Complete",
};

type StatusBadgeProps = {
  pipeline?: PipelineState | null;
  className?: string;
};

export function deriveProjectStatus(pipeline?: PipelineState | null): ProjectStatus {
  if (!pipeline) return "draft";

  const { topic, finalVideoPath, thumbnailPath, narrationScript, sceneAssets, steps } = pipeline;
  const hasTopic = Boolean(topic?.trim());
  const hasNarration = Boolean(narrationScript);
  const hasImagesOrVideos =
    Array.isArray(sceneAssets) && sceneAssets.some((asset) => asset.videoUrl || asset.imageUrl);
  const hasVideoStepSuccess =
    steps?.sceneVideos?.status === "success" || steps?.videoAssembly?.status === "success";

  if (finalVideoPath) return "complete";
  if (hasImagesOrVideos || hasVideoStepSuccess) return "in-progress";
  if (thumbnailPath || hasNarration) return "review";
  if (hasTopic) return "draft";
  return "draft";
}

export function StatusBadge({ pipeline, className }: StatusBadgeProps) {
  const status = deriveProjectStatus(pipeline);

  const styles: Record<ProjectStatus, string> = {
    "in-progress": "border-blue-500/30 bg-blue-500/10 text-blue-100",
    "complete": "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
    "review": "border-amber-400/40 bg-amber-500/15 text-amber-100",
    "draft": "border-zinc-700 bg-zinc-800 text-zinc-200",
  };

  return (
    <Badge
      className={styles[status] + (className ? ` ${className}` : "")}
      variant="outline"
      aria-label={`Status: ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

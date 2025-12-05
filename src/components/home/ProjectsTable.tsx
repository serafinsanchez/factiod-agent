import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { PipelineState } from "@/types/agent";
import { StatusBadge, deriveProjectStatus, type ProjectStatus } from "./StatusBadge";

export type ProjectListItem = {
  id: string;
  topic: string;
  creatorName?: string | null;
  createdAt?: string | null;
  pipeline?: PipelineState | null;
};

type ProjectsTableProps = {
  projects: ProjectListItem[];
  className?: string;
};

function getStageLabel(status: ProjectStatus): string {
  switch (status) {
    case "complete":
      return "Stage: Publishing";
    case "review":
      return "Stage: Review";
    case "in-progress":
      return "Stage: Video Gen";
    case "draft":
    default:
      return "Stage: Planning";
  }
}

export function ProjectsTable({ projects, className }: ProjectsTableProps) {
  return (
    <div className={className}>
      <div className="overflow-hidden rounded-3xl border border-zinc-900/50 bg-white/5 shadow-[0_25px_80px_-50px_rgba(0,0,0,0.75)] backdrop-blur">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-white/5 px-6 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
          <span>Topic</span>
          <span className="text-right">Creator</span>
          <span className="text-right">Date</span>
          <span className="text-right">Status</span>
          <span className="text-right">Actions</span>
        </div>

        {projects.length === 0 ? (
          <div className="px-6 py-6 text-sm text-zinc-400">No projects yet.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {projects.map((project) => {
              const status = deriveProjectStatus(project.pipeline);
              const stageLabel = getStageLabel(status);
              const createdLabel = project.createdAt
                ? new Date(project.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—";

              return (
                <li
                  key={project.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 px-6 py-4 text-sm text-zinc-100"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-white">{project.topic}</span>
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {stageLabel}
                    </span>
                  </div>
                  <div className="text-right text-sm text-zinc-200">
                    {project.creatorName || "—"}
                  </div>
                  <div className="text-right text-sm text-zinc-200">{createdLabel}</div>
                  <div className="text-right">
                    <StatusBadge pipeline={project.pipeline} className="ml-auto" />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="rounded-full border-white/40 bg-white/5 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:bg-white/10"
                    >
                      <Link href={`/project/${project.id}`}>Open</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

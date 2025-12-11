"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PipelineState } from "@/types/agent";
import { StatusBadge } from "./StatusBadge";

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
  onDeleteProject?: (id: string) => Promise<boolean>;
};

export function ProjectsTable({ projects, className, onDeleteProject }: ProjectsTableProps) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isRowNavigationDisabled = Boolean(confirmingId || deletingId);

  const handleRequestDelete = (projectId: string) => {
    if (!onDeleteProject) return;
    if (deletingId) return;
    setConfirmingId(projectId);
  };

  const handleCancelDelete = () => {
    if (deletingId) return;
    setConfirmingId(null);
  };

  const handleConfirmDelete = async (projectId: string) => {
    if (!onDeleteProject) return;
    if (deletingId) return;

    setDeletingId(projectId);
    try {
      const ok = await onDeleteProject(projectId);
      if (ok) {
        setConfirmingId(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenProject = (projectId: string) => {
    if (isRowNavigationDisabled) return;
    router.push(`/project/${projectId}`);
  };

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-3xl border border-zinc-900/50 bg-white/5 shadow-[0_25px_80px_-50px_rgba(0,0,0,0.75)] backdrop-blur">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-white/5 px-6 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
          <span>Topic</span>
          <span className="text-right">Creator</span>
          <span className="text-right">Date</span>
          <span className="text-right">Status</span>
        </div>

        {projects.length === 0 ? (
          <div className="px-6 py-6 text-sm text-zinc-400">No projects yet.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {projects.map((project) => {
              const createdLabel = project.createdAt
                ? new Date(project.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—";

              const isConfirming = confirmingId === project.id;
              const isDeleting = deletingId === project.id;

              return (
                <li
                  key={project.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open project ${project.topic}`}
                  onClick={() => handleOpenProject(project.id)}
                  onKeyDown={(event) => {
                    if (isRowNavigationDisabled) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOpenProject(project.id);
                    }
                  }}
                  className={`group relative grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-4 px-6 py-4 pr-14 text-sm text-zinc-100 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                    isRowNavigationDisabled ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  <div className="relative z-10 flex flex-col gap-1">
                    <Link
                      href={`/project/${project.id}`}
                      onClick={(event) => {
                        if (isRowNavigationDisabled) {
                          event.preventDefault();
                          return;
                        }
                        event.stopPropagation();
                      }}
                      className="inline-flex items-center gap-2 font-medium text-white decoration-white/20 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 group-hover:underline group-hover:decoration-white/30"
                      aria-label={`Open project ${project.topic}`}
                    >
                      <span>{project.topic}</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        Open <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </span>
                    </Link>
                  </div>
                  <div className="relative z-10 text-right text-sm text-zinc-200">
                    {project.creatorName || "—"}
                  </div>
                  <div className="relative z-10 text-right text-sm text-zinc-200">{createdLabel}</div>
                  <div className="relative z-10 text-right">
                    <StatusBadge pipeline={project.pipeline} className="ml-auto" />
                  </div>

                  {onDeleteProject ? (
                    <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2">
                      {isConfirming ? (
                        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-zinc-950 p-1 shadow-xl">
                          <span className="px-2 text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-zinc-300">
                            Confirm delete
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-full bg-zinc-900 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-zinc-100 hover:bg-zinc-800 hover:text-white"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCancelDelete();
                            }}
                            disabled={isDeleting}
                            aria-label={`No, keep project ${project.topic}`}
                          >
                            No
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-full bg-rose-600 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white hover:bg-rose-500"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleConfirmDelete(project.id);
                            }}
                            disabled={isDeleting}
                            aria-label={`Yes, delete project ${project.topic}`}
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="animate-spin" />
                                <span>Deleting</span>
                              </>
                            ) : (
                              "Yes"
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="rounded-full text-zinc-400 hover:bg-rose-500/12 hover:text-rose-100 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRequestDelete(project.id);
                          }}
                          disabled={Boolean(deletingId)}
                          aria-label={`Delete project ${project.topic}`}
                        >
                          <X />
                        </Button>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

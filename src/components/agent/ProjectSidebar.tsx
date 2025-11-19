"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HistoryProject } from "@/types/agent";

interface ProjectSidebarProps {
  projects: HistoryProject[];
  selectedProjectId: string | null;
  isLoading: boolean;
  isDeletingProjectId: string | null;
  historyError: string | null;
  deleteError: string | null;
  onNewProject: () => void;
  onRefresh: () => void;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  className?: string;
}

export function ProjectSidebar({
  projects,
  selectedProjectId,
  isLoading,
  isDeletingProjectId,
  historyError,
  deleteError,
  onNewProject,
  onRefresh,
  onSelectProject,
  onDeleteProject,
  className,
}: ProjectSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-4 rounded-3xl border border-zinc-900/70 bg-zinc-950/90 p-4 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.75)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Projects
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Saved runs live here. Select one to reload instantly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="rounded-full bg-zinc-100 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-900 hover:bg-white"
            onClick={onNewProject}
          >
            New
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Refresh projects"
            className="h-8 w-8 rounded-full border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? <span className="text-sm">…</span> : <span aria-hidden="true">↻</span>}
          </Button>
        </div>
      </div>
      {historyError && (
        <p className="text-xs text-rose-300" role="alert">
          {historyError}
        </p>
      )}
      {deleteError && (
        <p className="text-xs text-rose-300" role="alert">
          {deleteError}
        </p>
      )}
      <div className="flex-1 overflow-y-auto pr-1">
        {projects.length === 0 ? (
          <p className="text-xs text-zinc-600">
            No saved projects yet. Run the pipeline, then hit save.
          </p>
        ) : (
          <ul className="space-y-2">
            {projects.map((project) => {
              const isActive = project.id === selectedProjectId;
              const title =
                project.title && project.title.trim().length > 0
                  ? project.title
                  : project.topic;
              const subtitle = project.projectSlug ?? project.model;
              const isDeleting = isDeletingProjectId === project.id;
              return (
                <li key={project.id}>
                  <div
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-2xl border border-zinc-900/80 bg-zinc-950/40 px-3 py-2 transition-colors",
                      "hover:border-zinc-700 hover:bg-zinc-900/60",
                      isActive && "border-zinc-100/80 bg-zinc-100/10 text-zinc-100",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className="flex flex-1 flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-200"
                    >
                      <span className="line-clamp-2 text-sm font-medium text-zinc-100">
                        {title}
                      </span>
                      <span className="text-[0.7rem] text-zinc-500">{subtitle}</span>
                      {project.createdAt && (
                        <span className="text-[0.65rem] text-zinc-600">
                          {new Date(project.createdAt).toLocaleString()}
                        </span>
                      )}
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete project ${title}`}
                      className={cn(
                        "h-7 w-7 rounded-full text-zinc-500 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100",
                        isActive && "text-zinc-200",
                      )}
                      disabled={isDeleting}
                      onClick={() => onDeleteProject(project.id)}
                    >
                      {isDeleting ? "…" : "×"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}


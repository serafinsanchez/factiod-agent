"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HistoryProject } from "@/types/agent";

interface ProjectSidebarProps {
  projects: HistoryProject[];
  selectedProjectId: string | null;
  currentPipelineId: string | null;
  currentTopic: string;
  isSavingCurrentProject: boolean;
  isLoading: boolean;
  isDeletingProjectId: string | null;
  historyError: string | null;
  deleteError: string | null;
  saveError: string | null;
  onNewProject: () => void;
  onRefresh: () => void;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onSaveProject: () => void;
  className?: string;
}

export function ProjectSidebar({
  projects,
  selectedProjectId,
  currentPipelineId,
  currentTopic,
  isSavingCurrentProject,
  isLoading,
  isDeletingProjectId,
  historyError,
  deleteError,
  saveError,
  onNewProject,
  onRefresh,
  onSelectProject,
  onDeleteProject,
  onSaveProject,
  className,
}: ProjectSidebarProps) {
  const status = isSavingCurrentProject
    ? { label: "Saving…", dot: "bg-amber-300" }
    : currentPipelineId
      ? { label: "Saved", dot: "bg-emerald-300" }
      : { label: "Draft", dot: "bg-zinc-500" };

  const topicLabel = currentTopic.trim().length > 0 ? currentTopic : "Untitled project";
  const canSaveCurrentProject = currentTopic.trim().length > 0;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col gap-5 overflow-hidden rounded-3xl border border-zinc-900/70 bg-zinc-950/90 p-5 shadow-[0_25px_80px_-40px_rgba(0,0,0,0.75)]",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          size="sm"
          className="w-full rounded-full bg-white/90 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-900 hover:bg-white sm:flex-1"
          onClick={onNewProject}
        >
          New project
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Refresh projects"
          className="h-10 w-10 rounded-full border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100 sm:h-9 sm:w-9 sm:flex-none"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? <span className="text-sm">…</span> : <span aria-hidden="true">↻</span>}
        </Button>
      </div>
      <div className="rounded-2xl border border-zinc-900/80 bg-zinc-950/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.55rem] font-semibold uppercase tracking-[0.4em] text-zinc-500">
            Active project
          </p>
          <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-zinc-500">
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} aria-hidden="true" />
            <span aria-live="polite">{status.label.toUpperCase()}</span>
          </div>
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-100 line-clamp-2">{topicLabel}</p>
        {saveError && (
          <p className="mt-2 text-xs text-rose-300" role="alert">
            {saveError}
          </p>
        )}
        <Button
          type="button"
          onClick={onSaveProject}
          disabled={isSavingCurrentProject || !canSaveCurrentProject}
          className="mt-4 flex w-full justify-center rounded-2xl border border-white/20 bg-transparent text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          variant="outline"
        >
          {isSavingCurrentProject ? "Saving…" : "Save project"}
        </Button>
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
          <ul className="space-y-3">
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
                      "group flex w-full items-center gap-3 rounded-2xl border border-zinc-900/80 bg-zinc-950/40 px-4 py-3 transition-colors",
                      "hover:border-zinc-700 hover:bg-zinc-900/60",
                      isActive && "border-zinc-100/80 bg-zinc-100/10 text-zinc-100",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className="flex min-w-0 flex-1 flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-200"
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


"use client";

import { useCallback, useState } from "react";
import type { HistoryProject, PipelineState, VisualStyleId } from "@/types/agent";
import { getOrCreateProjectSlug, getPublicProjectFileUrl } from "@/lib/projects";
import {
  createInitialPipeline,
  createCacheBustedUrl,
  ensureSessionTotals,
  ensureCumulativeTotals,
  isPipelineState,
  normalizeNarrationModelId,
  type ThumbnailImage,
} from "./pipeline-types";

const resetRunningSteps = (steps: PipelineState["steps"]) => {
  const result = { ...steps };
  for (const stepId of Object.keys(result)) {
    const step = result[stepId as keyof PipelineState["steps"]];
    if (step?.status === "running") {
      result[stepId as keyof PipelineState["steps"]] = {
        ...step,
        status: "idle",
        errorMessage: undefined,
      };
    }
  }
  return result;
};

type UseProjectHistoryOptions = {
  pipeline: PipelineState;
  setPipeline: React.Dispatch<React.SetStateAction<PipelineState>>;
  setPromptOverrides: React.Dispatch<React.SetStateAction<Partial<Record<string, string>>>>;
  setScriptAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setScriptAudioError: React.Dispatch<React.SetStateAction<string | null>>;
  setScriptAudioGenerationTimeMs: React.Dispatch<React.SetStateAction<number | null>>;
  setThumbnailImage: React.Dispatch<React.SetStateAction<ThumbnailImage>>;
  setThumbnailGenerationTime: React.Dispatch<React.SetStateAction<number | null>>;
  setThumbnailError: React.Dispatch<React.SetStateAction<string | null>>;
  setThumbnailMetrics: React.Dispatch<React.SetStateAction<null>>;
  /** Preferred visual style for new projects when none is provided */
  defaultVisualStyleId?: VisualStyleId;
};

export function useProjectHistory({
  pipeline,
  setPipeline,
  setPromptOverrides,
  setScriptAudioUrl,
  setScriptAudioError,
  setScriptAudioGenerationTimeMs,
  setThumbnailImage,
  setThumbnailGenerationTime,
  setThumbnailError,
  setThumbnailMetrics,
  defaultVisualStyleId,
}: UseProjectHistoryOptions) {
  const [historyProjects, setHistoryProjects] = useState<HistoryProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeletingProjectId, setIsDeletingProjectId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    setDeleteError(null);
    try {
      const response = await fetch("/api/history/list");
      const data = await response.json();
      if (!response.ok || data?.error) {
        const message =
          (typeof data?.error === "string" && data.error) || "Failed to load projects.";
        throw new Error(message);
      }
      const projects = (data.projects ?? []) as HistoryProject[];
      setHistoryProjects(projects);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load projects.";
      setHistoryError(message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const newProject = useCallback((visualStyleId?: VisualStyleId) => {
    setPipeline(() => createInitialPipeline(visualStyleId ?? defaultVisualStyleId));
    setPromptOverrides({});
    setSelectedProjectId(null);
    setSaveError(null);
    setHistoryError(null);
    setDeleteError(null);
    setScriptAudioError(null);
    setScriptAudioGenerationTimeMs(null);
    setScriptAudioUrl((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setThumbnailImage(null);
    setThumbnailGenerationTime(null);
    setThumbnailError(null);
    setThumbnailMetrics(null);
  }, [
    defaultVisualStyleId,
    setPipeline,
    setPromptOverrides,
    setScriptAudioUrl,
    setScriptAudioError,
    setScriptAudioGenerationTimeMs,
    setThumbnailImage,
    setThumbnailGenerationTime,
    setThumbnailError,
    setThumbnailMetrics,
  ]);

  const saveProject = useCallback(async () => {
    const trimmedTopic = pipeline.topic.trim();
    if (!trimmedTopic) {
      setSaveError("Please enter a topic before saving.");
      return;
    }

    const projectSlug = getOrCreateProjectSlug(pipeline.projectSlug, pipeline.topic);

    setIsSavingProject(true);
    setSaveError(null);

    const body: Record<string, unknown> = {
      pipeline: {
        ...pipeline,
        projectSlug,
      },
    };

    try {
      const response = await fetch("/api/history/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok || data?.error) {
        const message =
          (typeof data?.error === "string" && data.error) ||
          `Failed to save project (status ${response.status}).`;
        throw new Error(message);
      }

      if (isPipelineState(data)) {
        setPipeline((prev) =>
          ensureSessionTotals({
            ...prev,
            ...data,
            characterReferenceImage: prev.characterReferenceImage || data.characterReferenceImage,
            narrationModelId: normalizeNarrationModelId(
              data.narrationModelId ?? prev.narrationModelId,
            ),
          }),
        );
        const nextSelectedId =
          typeof data.id === "string" ? data.id : (pipeline.id ?? null);
        setSelectedProjectId(nextSelectedId);
      }

      await refreshHistory();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save project.";
      setSaveError(message);
    } finally {
      setIsSavingProject(false);
    }
  }, [pipeline, setPipeline, refreshHistory]);

  const selectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId);
    setHistoryError(null);
    try {
      const response = await fetch(`/api/history/get?id=${encodeURIComponent(projectId)}`);
      const data = await response.json();
      if (!response.ok || data?.error) {
        const message =
          (typeof data?.error === "string" && data.error) ||
          `Failed to load project (status ${response.status}).`;
        throw new Error(message);
      }
      if (!isPipelineState(data)) {
        throw new Error("Server returned invalid project data.");
      }
      const loadedPipeline = data as PipelineState;
      const resetSteps = resetRunningSteps(loadedPipeline.steps);
      setPipeline((prev) =>
        ensureCumulativeTotals(
          ensureSessionTotals({
            ...prev,
            ...loadedPipeline,
            steps: resetSteps,
            narrationModelId: normalizeNarrationModelId(
              loadedPipeline.narrationModelId ?? prev.narrationModelId,
            ),
          }),
        ),
      );
      const audioUrl = getPublicProjectFileUrl(loadedPipeline.audioPath);
      const versionedAudioUrl = createCacheBustedUrl(audioUrl);
      setScriptAudioUrl((prevUrl) => {
        if (prevUrl && prevUrl.startsWith("blob:")) {
          URL.revokeObjectURL(prevUrl);
        }
        return versionedAudioUrl ?? null;
      });
      setScriptAudioError(null);

      const thumbnailUrl = getPublicProjectFileUrl(loadedPipeline.thumbnailPath);
      setThumbnailImage(
        thumbnailUrl
          ? {
              url: thumbnailUrl,
            }
          : null,
      );
      setThumbnailGenerationTime(null);
      setThumbnailError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load project.";
      setHistoryError(message);
    }
  }, [setPipeline, setScriptAudioUrl, setScriptAudioError, setThumbnailImage, setThumbnailGenerationTime, setThumbnailError]);

  const deleteProject = useCallback(async (projectId: string) => {
    if (!projectId) {
      return;
    }

    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            "Delete this project and its generated assets? This cannot be undone.",
          );
    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setIsDeletingProjectId(projectId);

    try {
      const response = await fetch("/api/history/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: projectId }),
      });

      let responseData: Record<string, unknown> | null = null;
      try {
        responseData = (await response.json()) as Record<string, unknown>;
      } catch {
        responseData = null;
      }

      if (!response.ok) {
        const message =
          (responseData && typeof responseData.error === "string" && responseData.error) ||
          (responseData &&
            typeof responseData.details === "string" &&
            responseData.details) ||
          `Failed to delete project (status ${response.status}).`;
        throw new Error(message);
      }

      if (
        responseData &&
        typeof responseData.error === "string" &&
        responseData.error.trim().length > 0
      ) {
        throw new Error(responseData.error);
      }

      setHistoryProjects((prev) => prev.filter((project) => project.id !== projectId));
      setSelectedProjectId((prev) => (prev === projectId ? null : prev));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete project.";
      setDeleteError(message);
    } finally {
      setIsDeletingProjectId((current) => (current === projectId ? null : current));
    }
  }, []);

  return {
    // State
    historyProjects,
    selectedProjectId,
    isLoadingHistory,
    historyError,
    isSavingProject,
    saveError,
    isDeletingProjectId,
    deleteError,
    // Setters for external use
    setSelectedProjectId,
    setSaveError,
    setHistoryError,
    setDeleteError,
    // Actions
    refreshHistory,
    newProject,
    saveProject,
    selectProject,
    deleteProject,
  };
}

"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugifyTopic } from "@/lib/slug";

import type { UseAgentPipelineReturn } from "@/hooks/use-agent-pipeline";

interface OutputPreviewProps {
  state: UseAgentPipelineReturn["state"];
  derived: UseAgentPipelineReturn["derived"];
  actions: UseAgentPipelineReturn["actions"];
}

export function OutputPreview({ state, actions }: OutputPreviewProps) {
  const script = state.pipeline.videoScript?.trim();
  const title = state.pipeline.title?.trim();
  const description = state.pipeline.description?.trim();
  const youtubeTags = state.pipeline.youtubeTags?.trim();
  const chapters = state.pipeline.chapters?.trim();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const contentRegionId = "final-outputs-content";
  const thumbnailSrc =
    state.thumbnailImage?.url ??
    (state.thumbnailImage?.mimeType && state.thumbnailImage?.data
      ? `data:${state.thumbnailImage.mimeType};base64,${state.thumbnailImage.data}`
      : undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Final outputs
          </p>
          <p className="text-sm text-zinc-400">
            Review everything the agent has produced so far.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-950/40 px-3 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-zinc-200 hover:border-white/40 hover:bg-white/10 hover:text-white"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-expanded={!isCollapsed}
          aria-controls={contentRegionId}
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", isCollapsed ? "-rotate-90" : "rotate-0")}
          />
          {isCollapsed ? "Expand" : "Collapse"}
        </Button>
      </div>

      <div
        id={contentRegionId}
        aria-hidden={isCollapsed}
        className={cn("space-y-4", isCollapsed && "hidden")}
      >
        <AssetCard title="Video script">
          {script ? (
            <div className="max-h-[320px] overflow-y-auto whitespace-pre-wrap font-mono text-sm text-zinc-100">
              {script}
            </div>
          ) : (
            <EmptyPlaceholder message="Run the script step to see the long-form output." />
          )}
        </AssetCard>

        <AssetCard title="Title & description">
          {title || description || youtubeTags || chapters ? (
            <div className="space-y-4 text-sm text-zinc-100">
              <div className="space-y-2">
                {title && <p className="text-lg font-semibold text-white">{title}</p>}
                {description && (
                  <p className="whitespace-pre-wrap text-zinc-300">{description}</p>
                )}
              </div>

              <div className="grid gap-3">
                <CopyableTextBlock
                  label="YouTube tags"
                  value={youtubeTags}
                  copyButtonLabel="Copy tags"
                  emptyText="Generate the publish stage to get YouTube upload tags."
                />
                <CopyableTextBlock
                  label="Video chapters"
                  value={chapters}
                  copyButtonLabel="Copy chapters"
                  emptyText="Generate the publish stage to get estimated video chapters."
                />
              </div>
            </div>
          ) : (
            <EmptyPlaceholder message="Generate the publish stage to get a title, description, tags, and chapters." />
          )}
        </AssetCard>

        <AssetCard title="Narration audio">
          {state.scriptAudioError && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
            >
              {state.scriptAudioError}
            </div>
          )}
          {state.scriptAudioUrl ? (
            <div className="space-y-2">
              <audio controls src={state.scriptAudioUrl} className="w-full" />
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                {state.scriptAudioGenerationTimeMs !== null && (
                  <span>
                    Generated in {(state.scriptAudioGenerationTimeMs / 1000).toFixed(1)}s
                  </span>
                )}
                <a
                  href={state.scriptAudioUrl}
                  download={`${slugifyTopic(state.pipeline.topic)}-script.mp3`}
                  className="text-white underline-offset-4 hover:underline"
                >
                  Download audio
                </a>
              </div>
            </div>
          ) : (
            <EmptyPlaceholder message="Use the Script stage to generate narration audio." />
          )}
        </AssetCard>

        <AssetCard title="Thumbnail">
          {thumbnailSrc ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnailSrc} alt="Generated thumbnail" className="w-full" />
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                {state.thumbnailGenerationTime !== null && (
                  <span>
                    Generated in {(state.thumbnailGenerationTime / 1000).toFixed(1)}s
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full px-4 text-sm text-white hover:bg-white/10 hover:text-white"
                  onClick={actions.downloadThumbnail}
                >
                  Download image
                </Button>
              </div>
            </div>
          ) : (
            <EmptyPlaceholder message="Run the thumbnail step to view image outputs." />
          )}
        </AssetCard>
      </div>
    </div>
  );
}

function CopyableTextBlock({
  label,
  value,
  emptyText,
  copyButtonLabel = "Copy",
}: {
  label: string;
  value?: string | null;
  emptyText: string;
  copyButtonLabel?: string;
}) {
  const prepared = (value ?? "").trim();
  const hasValue = prepared.length > 0;
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!hasValue) return;
    try {
      await navigator.clipboard.writeText(prepared);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-900/60 bg-zinc-900/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
          {label}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-full border border-white/20 bg-transparent px-4 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white hover:border-white/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
          onClick={handleCopy}
          disabled={!hasValue}
        >
          {isCopied ? "Copied" : copyButtonLabel}
        </Button>
        <span className="sr-only" aria-live="polite" role="status">
          {isCopied ? `${label} copied to clipboard` : ""}
        </span>
      </div>
      <div className="mt-2">
        {hasValue ? (
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-100">
            {prepared}
          </pre>
        ) : (
          <p className="text-sm text-zinc-500">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

function AssetCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-900/70 bg-zinc-950/70 p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
        {title}
      </p>
      {children}
    </section>
  );
}

function EmptyPlaceholder({ message }: { message: string }) {
  return (
    <p className="text-sm text-zinc-500">
      {message}
    </p>
  );
}


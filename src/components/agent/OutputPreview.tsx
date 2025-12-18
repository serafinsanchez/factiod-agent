"use client";

import { useState, useMemo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugifyTopic } from "@/lib/slug";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { buildEditorScript } from "@/lib/script/formatEditorScript";

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
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadAllError, setDownloadAllError] = useState<string | null>(null);
  const [scriptViewMode, setScriptViewMode] = useState<"editor" | "narration">("editor");

  const editorScript = useMemo(() => {
    if (!script) return "";
    return buildEditorScript(state.pipeline.topic, script);
  }, [script, state.pipeline.topic]);

  const narrationScript = state.pipeline.narrationScript?.trim();

  const activeScript = useMemo(() => {
    return (scriptViewMode === "editor" ? (editorScript || script) : (narrationScript || script)) || "";
  }, [scriptViewMode, editorScript, script, narrationScript]);

  const contentRegionId = "final-outputs-content";
  const thumbnailSrc =
    state.thumbnailImage?.url ??
    (state.thumbnailImage?.mimeType && state.thumbnailImage?.data
      ? `data:${state.thumbnailImage.mimeType};base64,${state.thumbnailImage.data}`
      : undefined);

  const hasAnyDeliverables = Boolean(
    (script && script.length > 0) ||
      thumbnailSrc ||
      state.scriptAudioUrl ||
      title ||
      description ||
      youtubeTags ||
      chapters,
  );

  const downloadFilenameBase = slugifyTopic(state.pipeline.topic) || "final-deliverables";

  const handleDownloadAllAssets = async () => {
    if (isDownloadingAll) return;
    setIsDownloadingAll(true);
    setDownloadAllError(null);

    try {
      const zip = new JSZip();
      const root = zip.folder("Final Deliverables") ?? zip;
      const scriptFolder = root.folder("Script Folder") ?? root;
      const thumbnailFolder = root.folder("Thumbnail Folder") ?? root;
      const voiceoverFolder = root.folder("Voice-over Folder") ?? root;
      const publishingFolder = root.folder("Publishing Folder") ?? root;

      // Script (PDF preferred)
      if (script && script.length > 0) {
        const pdfBytes = generateScriptPdfBytes({
          topic: state.pipeline.topic,
          creatorName: state.pipeline.creatorName,
          script: activeScript,
        });
        scriptFolder.file(`${downloadFilenameBase}-script.pdf`, pdfBytes);
      }

      // Thumbnail
      if (thumbnailSrc) {
        const { bytes, mimeType } = await fetchBytesFromAnySource(thumbnailSrc);
        const ext = mimeTypeToExtension(mimeType) ?? "png";
        thumbnailFolder.file(`${downloadFilenameBase}-thumbnail.${ext}`, bytes);
      }

      // Voice-over
      if (state.scriptAudioUrl) {
        const { bytes, mimeType } = await fetchBytesFromAnySource(state.scriptAudioUrl);
        const ext = mimeTypeToExtension(mimeType) ?? "mp3";
        voiceoverFolder.file(`${downloadFilenameBase}-voiceover.${ext}`, bytes);
      }

      // Publishing (title/description/tags/chapters)
      if (title || description || youtubeTags || chapters) {
        const pdfBytes = generatePublishingPdfBytes({
          topic: state.pipeline.topic,
          creatorName: state.pipeline.creatorName,
          title,
          description,
          youtubeTags,
          chapters,
        });
        publishingFolder.file(`${downloadFilenameBase}-publishing.pdf`, pdfBytes);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlobFile(`${downloadFilenameBase}-assets.zip`, blob);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download assets.";
      setDownloadAllError(message);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleDownloadScriptPdf = () => {
    if (!activeScript) return;
    const pdfBytes = generateScriptPdfBytes({
      topic: state.pipeline.topic,
      creatorName: state.pipeline.creatorName,
      script: activeScript,
    });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    downloadBlobFile(`${downloadFilenameBase}-script.pdf`, blob);
  };

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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-white hover:border-white/40 hover:bg-white/10 hover:text-white disabled:opacity-60"
            onClick={handleDownloadAllAssets}
            disabled={!hasAnyDeliverables || isDownloadingAll}
            title={!hasAnyDeliverables ? "Generate at least one deliverable (script, thumbnail, or audio) first." : undefined}
          >
            {isDownloadingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isDownloadingAll ? "Preparing ZIP…" : "Download all assets"}
          </Button>
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
      </div>

      {downloadAllError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          {downloadAllError}
        </div>
      )}

      <div
        id={contentRegionId}
        aria-hidden={isCollapsed}
        className={cn("space-y-4", isCollapsed && "hidden")}
      >
        <AssetCard title="Video script">
          {script ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900/50 pb-3">
                <div className="flex gap-1 rounded-full bg-zinc-900/50 p-1">
                  <button
                    type="button"
                    onClick={() => setScriptViewMode("editor")}
                    className={cn(
                      "rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wider transition",
                      scriptViewMode === "editor"
                        ? "bg-white text-zinc-900"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    Editor script
                  </button>
                  <button
                    type="button"
                    onClick={() => setScriptViewMode("narration")}
                    className={cn(
                      "rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wider transition",
                      scriptViewMode === "narration"
                        ? "bg-white text-zinc-900"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    Narration only
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <p className="hidden text-[0.6rem] text-zinc-500 sm:block">
                    {scriptViewMode === "editor"
                      ? "Includes production headings for editors."
                      : "Clean text for ElevenLabs voiceover."}
                  </p>
                  <div className="flex gap-2">
                    <CopyButton
                      value={activeScript}
                      label={scriptViewMode === "editor" ? "Copy editor script" : "Copy narration"}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-full border border-white/20 bg-transparent px-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white hover:border-white/40 hover:bg-white/10 hover:text-white"
                      onClick={handleDownloadScriptPdf}
                      disabled={!activeScript}
                    >
                      PDF
                    </Button>
                  </div>
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-100">
                {activeScript}
              </div>
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

function CopyButton({ value, label }: { value: string; label: string }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 rounded-full border border-white/20 bg-transparent px-3 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white hover:border-white/40 hover:bg-white/10 hover:text-white"
      onClick={handleCopy}
      disabled={!value}
    >
      {isCopied ? "Copied!" : label}
    </Button>
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

function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body?.appendChild(link);
  link.click();
  document.body?.removeChild(link);
  // Download initiation is async in browsers; revoking immediately can race and cancel the download.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return null;
  return { mimeType: match[1] ?? "application/octet-stream", base64Data: match[2] ?? "" };
}

async function fetchBytesFromAnySource(source: string): Promise<{ bytes: Uint8Array; mimeType: string | null }> {
  if (source.startsWith("data:")) {
    const parsed = parseDataUrl(source);
    if (!parsed) {
      return { bytes: new Uint8Array(), mimeType: null };
    }
    return { bytes: base64ToUint8Array(parsed.base64Data), mimeType: parsed.mimeType };
  }

  const res = await fetch(source);
  if (!res.ok) {
    throw new Error(`Failed to fetch asset: ${res.status} ${res.statusText}`);
  }
  const mimeType = res.headers.get("content-type");
  const buffer = await res.arrayBuffer();
  return { bytes: new Uint8Array(buffer), mimeType };
}

function mimeTypeToExtension(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null;
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase();
  switch (normalized) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "audio/mpeg":
      return "mp3";
    case "audio/mp3":
      return "mp3";
    case "audio/wav":
      return "wav";
    case "audio/x-wav":
      return "wav";
    case "audio/mp4":
      return "m4a";
    case "application/pdf":
      return "pdf";
    default:
      return null;
  }
}

function generateScriptPdfBytes({
  topic,
  creatorName,
  script,
}: {
  topic: string;
  creatorName?: string | null;
  script: string;
}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const marginTop = 54;
  const marginBottom = 54;
  const contentWidth = pageWidth - marginX * 2;

  const safeTopic = (topic ?? "").trim();
  const safeCreator = (creatorName ?? "").trim();

  doc.setTextColor(20, 20, 20);

  // Header
  let y = marginTop;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Script", marginX, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (safeTopic) {
    doc.text(`Topic: ${safeTopic}`, marginX, y);
    y += 14;
  }
  if (safeCreator) {
    doc.text(`Creator: ${safeCreator}`, marginX, y);
    y += 14;
  }
  y += 8;

  // Body
  doc.setFontSize(11);
  const lineHeight = 14;
  const paragraphs = script.replace(/\r\n/g, "\n").split("\n");

  for (const rawParagraph of paragraphs) {
    const paragraph = rawParagraph ?? "";
    const lines =
      paragraph.trim().length === 0
        ? [""]
        : doc.splitTextToSize(paragraph, contentWidth) as string[];

    for (const line of lines) {
      if (y + lineHeight > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
      }
      doc.text(line, marginX, y);
      y += lineHeight;
    }
  }

  return doc.output("arraybuffer");
}

function generatePublishingPdfBytes({
  topic,
  creatorName,
  title,
  description,
  youtubeTags,
  chapters,
}: {
  topic: string;
  creatorName?: string | null;
  title?: string | null;
  description?: string | null;
  youtubeTags?: string | null;
  chapters?: string | null;
}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const marginTop = 54;
  const marginBottom = 54;
  const contentWidth = pageWidth - marginX * 2;
  const lineHeight = 14;

  const safeTopic = (topic ?? "").trim();
  const safeCreator = (creatorName ?? "").trim();
  const safeTitle = (title ?? "").trim();
  const safeDescription = (description ?? "").trim();
  const safeTags = (youtubeTags ?? "").trim();
  const safeChapters = (chapters ?? "").trim();

  doc.setTextColor(20, 20, 20);

  let y = marginTop;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Publishing", marginX, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (safeTopic) {
    doc.text(`Topic: ${safeTopic}`, marginX, y);
    y += 14;
  }
  if (safeCreator) {
    doc.text(`Creator: ${safeCreator}`, marginX, y);
    y += 14;
  }
  y += 10;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  const writeSection = (label: string, body: string, useMono = false) => {
    if (!body) return;
    ensureSpace(lineHeight * 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, marginX, y);
    y += 16;

    doc.setFont(useMono ? "courier" : "helvetica", "normal");
    doc.setFontSize(11);
    const paragraphs = body.replace(/\r\n/g, "\n").split("\n");
    for (const rawParagraph of paragraphs) {
      const paragraph = rawParagraph ?? "";
      const lines =
        paragraph.trim().length === 0
          ? [""]
          : (doc.splitTextToSize(paragraph, contentWidth) as string[]);
      for (const line of lines) {
        ensureSpace(lineHeight);
        doc.text(line, marginX, y);
        y += lineHeight;
      }
    }
    y += 12;
  };

  writeSection("Title", safeTitle);
  writeSection("Description", safeDescription);
  writeSection("YouTube tags", safeTags, true);
  writeSection("Video chapters", safeChapters, true);

  return doc.output("arraybuffer");
}


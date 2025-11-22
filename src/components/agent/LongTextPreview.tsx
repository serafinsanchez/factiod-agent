 "use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LongTextPreviewProps {
  text?: string | null;
  emptyText?: string;
  modalTitle: string;
  viewButtonLabel?: string;
  copyButtonLabel?: string;
  className?: string;
  previewClassName?: string;
  previewContainerClassName?: string;
  alignActions?: "start" | "end";
}

export function LongTextPreview({
  text,
  emptyText = "No content yet.",
  modalTitle,
  viewButtonLabel = "View full text",
  copyButtonLabel = "Copy text",
  className,
  previewClassName,
  previewContainerClassName,
  alignActions = "start",
}: LongTextPreviewProps) {
  const preparedText = useMemo(() => text?.trim() ?? "", [text]);
  const hasText = preparedText.length > 0;
  const [isCopied, setIsCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleCopy = async () => {
    if (!hasText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(preparedText);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setIsCopied(false);
    }
  };

  const actionAlignmentClass = alignActions === "end" ? "justify-end" : "justify-start";

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) {
          setIsCopied(false);
        }
      }}
    >
      <div className={cn("space-y-3", className)}>
        <div className="relative">
          <div
            className={cn(
              "rounded-2xl border border-dashed border-zinc-900/60 bg-zinc-900/30 p-3 text-sm text-zinc-200",
              previewContainerClassName,
              !hasText && "text-zinc-500",
            )}
          >
            {hasText ? (
              <pre
                className={cn(
                  "max-h-48 overflow-hidden whitespace-pre-wrap text-sm leading-relaxed text-zinc-100",
                  previewClassName,
                )}
              >
                {preparedText}
              </pre>
            ) : (
              emptyText
            )}
          </div>
          {hasText && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-2xl bg-gradient-to-t from-zinc-950/90 to-transparent" />
          )}
        </div>
        <div className={cn("flex flex-wrap gap-2", actionAlignmentClass)}>
          <Dialog.Trigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full border border-white/20 bg-transparent text-xs font-semibold uppercase tracking-[0.3em] text-white hover:border-white/40 hover:bg-white/10"
              disabled={!hasText}
              aria-label={`Open ${modalTitle}`}
            >
              {viewButtonLabel}
            </Button>
          </Dialog.Trigger>
        </div>
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-white">{modalTitle}</Dialog.Title>
                <Dialog.Description className="text-xs text-zinc-400">
                  Read-only preview. Use copy or close controls to exit.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="rounded-full border border-white/10 p-2 text-white transition hover:border-white/40 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </header>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">{hasText ? preparedText : emptyText}</pre>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border border-white/20 bg-transparent text-sm font-semibold text-white hover:border-white/40 hover:bg-white/10 disabled:opacity-60"
                onClick={handleCopy}
                disabled={!hasText}
              >
                {isCopied ? "Copied" : copyButtonLabel}
              </Button>
              <span className="sr-only" aria-live="polite" role="status">
                {isCopied ? "Text copied to clipboard" : ""}
              </span>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  className="rounded-full bg-white px-6 font-semibold text-zinc-900 hover:bg-zinc-200"
                >
                  Close
                </Button>
              </Dialog.Close>
            </footer>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


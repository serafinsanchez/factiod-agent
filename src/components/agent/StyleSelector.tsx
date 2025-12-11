"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Film, Layers, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VisualStyleId } from "@/types/agent";
import {
  VISUAL_STYLE_PRESETS,
  DEFAULT_VISUAL_STYLE_ID,
  type VisualStylePreset,
} from "@/lib/agent/visual-styles";

interface StyleSelectorProps {
  isOpen: boolean;
  onSelect: (styleId: VisualStyleId) => void;
  onClose: () => void;
  /** When opening, preselect this style (defaults to app default). */
  initialStyleId?: VisualStyleId;
  /** Small uppercase label shown above the title (defaults to \"New Project\"). */
  contextLabel?: string;
  /** Modal title (defaults to \"Choose a Visual Style\"). */
  title?: string;
  /** Modal description (defaults to existing text). */
  description?: string;
  /** Confirm button label (defaults to \"Create Project\"). */
  confirmLabel?: string;
  /** Footer hint text (defaults to existing text). */
  footerText?: string;
}

const STYLE_ICONS: Record<VisualStyleId, React.ReactNode> = {
  "pixar-3d": <Sparkles className="h-6 w-6" />,
  "paper-craft": <Layers className="h-6 w-6" />,
  documentary: <Film className="h-6 w-6" />,
};

const STYLE_COLORS: Record<VisualStyleId, { bg: string; border: string; text: string; glow: string }> = {
  "pixar-3d": {
    bg: "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20",
    border: "border-violet-500/40",
    text: "text-violet-300",
    glow: "shadow-violet-500/20",
  },
  "paper-craft": {
    bg: "bg-gradient-to-br from-amber-500/20 to-orange-500/20",
    border: "border-amber-500/40",
    text: "text-amber-300",
    glow: "shadow-amber-500/20",
  },
  documentary: {
    bg: "bg-gradient-to-br from-emerald-500/20 to-teal-500/20",
    border: "border-emerald-500/40",
    text: "text-emerald-300",
    glow: "shadow-emerald-500/20",
  },
};

function StyleCard({
  preset,
  isSelected,
  onSelect,
}: {
  preset: VisualStylePreset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const colors = STYLE_COLORS[preset.id];
  const icon = STYLE_ICONS[preset.id];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col items-start rounded-2xl border-2 p-5 text-left transition-all duration-200",
        "hover:scale-[1.02] hover:shadow-lg",
        isSelected
          ? cn(colors.bg, colors.border, "shadow-lg", colors.glow)
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80"
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full transition-all",
          isSelected
            ? cn("bg-white text-zinc-900")
            : "border border-zinc-700 bg-zinc-800/50"
        )}
      >
        {isSelected && <Check className="h-4 w-4" strokeWidth={3} />}
      </div>

      {/* Icon */}
      <div
        className={cn(
          "mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
          isSelected ? cn(colors.bg, colors.text) : "bg-zinc-800 text-zinc-400"
        )}
      >
        {icon}
      </div>

      {/* Title */}
      <h3
        className={cn(
          "text-lg font-semibold transition-colors",
          isSelected ? "text-white" : "text-zinc-200"
        )}
      >
        {preset.label}
      </h3>

      {/* Description */}
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {preset.description}
      </p>

      {/* Character badge */}
      <div className="mt-4 flex flex-wrap gap-2">
        {preset.requiresCharacterReference ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            Character-driven
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Concept-focused
          </span>
        )}
      </div>
    </button>
  );
}

export function StyleSelector({
  isOpen,
  onSelect,
  onClose,
  initialStyleId,
  contextLabel = "New Project",
  title = "Choose a Visual Style",
  description = "Select the visual aesthetic for your video. This affects how scenes are generated throughout the pipeline.",
  confirmLabel = "Create Project",
  footerText = "You can change this later in project settings.",
}: StyleSelectorProps) {
  const [selectedStyle, setSelectedStyle] = useState<VisualStyleId>(
    initialStyleId ?? DEFAULT_VISUAL_STYLE_ID,
  );
  const isBrowser = typeof document !== "undefined";

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isBrowser || !isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onSelect(selectedStyle);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="flex min-h-full w-full items-center justify-center overflow-y-auto px-4 py-10">
        <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/95 shadow-2xl">
          {/* Header */}
          <div className="border-b border-white/5 px-8 py-6">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
              {contextLabel}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              {title}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {description}
            </p>
          </div>

          {/* Style Cards */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {VISUAL_STYLE_PRESETS.map((preset) => (
                <StyleCard
                  key={preset.id}
                  preset={preset}
                  isSelected={selectedStyle === preset.id}
                  onSelect={() => setSelectedStyle(preset.id)}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 px-8 py-5">
            <p className="text-xs text-zinc-500">
              {footerText}
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-zinc-800 px-4 text-sm text-zinc-300 hover:bg-zinc-900"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full bg-white px-6 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
                onClick={handleConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


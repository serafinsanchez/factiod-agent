"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { VariableKey } from "@/types/agent";
import { VARIABLE_DEFINITIONS, VARIABLE_LABELS } from "@/lib/agent/variable-metadata";

type VariableEditorProps = {
  isOpen: boolean;
  variableKey: VariableKey | null;
  initialValue?: string;
  onSave: (variable: VariableKey, value: string) => void;
  onClose: () => void;
};

const DEFINITION_MAP = VARIABLE_DEFINITIONS.reduce<Record<VariableKey, (typeof VARIABLE_DEFINITIONS)[number]>>(
  (acc, definition) => {
    acc[definition.key] = definition;
    return acc;
  },
  {} as Record<VariableKey, (typeof VARIABLE_DEFINITIONS)[number]>,
);

export function VariableEditor({
  isOpen,
  variableKey,
  initialValue = "",
  onSave,
  onClose,
}: VariableEditorProps) {
  const [value, setValue] = useState(initialValue);
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

  const stats = useMemo(() => {
    const trimmed = value.trim();
    const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    return {
      characters: value.length,
      words: wordCount,
    };
  }, [value]);

  const definition = variableKey ? DEFINITION_MAP[variableKey] : undefined;
  const label = variableKey ? VARIABLE_LABELS[variableKey] : "Variable";
  const isReadOnly = definition?.isReadOnly ?? false;
  const valueType = definition?.valueType ?? "text";
  const isJsonValue = valueType === "json";

  if (!isBrowser || !isOpen || !variableKey) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
      <div className="flex min-h-full w-full items-start justify-center overflow-y-auto px-4 py-10">
        <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/95 shadow-2xl max-h-[90vh]">
          <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-5">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                Edit variable
              </p>
              <h2 className="text-2xl font-semibold text-white">{label}</h2>
              {definition?.description && (
                <p className="mt-1 text-sm text-zinc-400">{definition.description}</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-900"
              onClick={onClose}
            >
              Close
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-2 rounded-2xl border border-zinc-900 bg-zinc-950/80 p-4">
              <Textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                readOnly={isReadOnly}
                className={cn(
                  "min-h-[220px] resize-none rounded-2xl border-zinc-800 bg-zinc-900/60 text-sm text-white",
                  isReadOnly && "cursor-not-allowed opacity-80",
                  isJsonValue && "font-mono text-xs",
                )}
              />
              <p className="text-xs text-zinc-500">
                {stats.words.toLocaleString()} words · {stats.characters.toLocaleString()} characters
              </p>
              {isReadOnly && (
                <p className="text-xs text-zinc-400">
                  This variable is generated automatically and can&apos;t be edited manually.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-white/5 px-6 py-5">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full border border-zinc-800 px-4 text-sm text-zinc-300 hover:bg-zinc-900"
              onClick={onClose}
            >
              Cancel
            </Button>
            {!isReadOnly && (
              <Button
                type="button"
                className="rounded-full bg-white px-6 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
                onClick={() => onSave(variableKey, value)}
              >
                Save variable
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}



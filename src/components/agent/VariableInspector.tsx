"use client";

import { useMemo, useState } from "react";

import { VariableStatusBadge } from "./VariableStatusBadge";
import { Button } from "@/components/ui/button";
import type { PipelineState, VariableKey } from "@/types/agent";
import {
  VARIABLE_DEFINITIONS,
  VARIABLE_KEY_TO_PIPELINE_FIELD,
  hasVariableValue,
  getVariableDisplayValue,
} from "@/lib/agent/variable-metadata";
import { cn } from "@/lib/utils";

type VariableInspectorProps = {
  pipeline: PipelineState;
  onEditVariable?: (variable: VariableKey) => void;
  className?: string;
};

export function VariableInspector({
  pipeline,
  onEditVariable,
  className,
}: VariableInspectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const readyCount = useMemo(() => {
    return VARIABLE_DEFINITIONS.reduce(
      (count, def) => {
        if (hasVariableValue(pipeline, def.key)) {
          return count + 1;
        }
        return count;
      },
      0,
    );
  }, [pipeline]);

  return (
    <section
      className={cn(
        "rounded-3xl border border-zinc-900/70 bg-zinc-950/70 p-6 shadow-[0_25px_80px_-60px_rgba(0,0,0,0.85)]",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-zinc-500">
            Variables
          </p>
          <p className="text-sm text-zinc-400">
            {readyCount}/{VARIABLE_DEFINITIONS.length} ready
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-full border border-zinc-800 px-4 text-xs uppercase tracking-[0.25em] text-zinc-300 hover:bg-zinc-900"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? "Hide" : "Show"}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5 space-y-4">
          {VARIABLE_DEFINITIONS.map((definition) => {
            // Get display value (handles both string and JSON variables)
            const displayValue = getVariableDisplayValue(pipeline, definition.key);
            // For string variables, get the full value for snippet display
            const field = VARIABLE_KEY_TO_PIPELINE_FIELD[definition.key];
            const stringValue = field ? pipeline[field] : undefined;
            const fullValue = typeof stringValue === "string" ? stringValue : displayValue ?? "";
            const trimmed = fullValue.trim();
            const snippet =
              trimmed.length > 0
                ? trimmed.length > 260
                  ? `${trimmed.slice(0, 260)}…`
                  : trimmed
                : null;
            const handleEdit = onEditVariable
              ? () => onEditVariable(definition.key)
              : undefined;

            return (
              <div
                key={definition.key}
                className="rounded-2xl border border-zinc-900/70 bg-zinc-950/60 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{definition.label}</p>
                    <p className="text-xs text-zinc-400">{definition.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <VariableStatusBadge
                      name={definition.label}
                      value={displayValue}
                      size="md"
                      title={trimmed || "No value yet"}
                      onClick={undefined}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {trimmed.length > 0
                      ? `${trimmed.length.toLocaleString()} characters`
                      : "No value yet"}
                  </span>
                </div>
                {handleEdit ? (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="mt-3 min-h-[60px] w-full rounded-2xl border border-dashed border-zinc-900/60 bg-zinc-900/30 p-3 text-left text-sm text-zinc-200 transition hover:bg-zinc-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    {snippet ?? "—"}
                  </button>
                ) : (
                  <div className="mt-3 min-h-[60px] rounded-2xl border border-dashed border-zinc-900/60 bg-zinc-900/30 p-3 text-sm text-zinc-200">
                    {snippet ?? "—"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}



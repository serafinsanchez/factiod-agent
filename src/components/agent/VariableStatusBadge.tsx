"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type VariableStatus = "ready" | "empty" | "missing";

function getStatusFromValue(value?: string | null): VariableStatus {
  if (typeof value !== "string") {
    return "missing";
  }
  return value.trim().length > 0 ? "ready" : "empty";
}

const STATUS_META: Record<
  VariableStatus,
  { label: string; tone: string; badge: string; border: string }
> = {
  ready: {
    label: "Ready",
    tone: "text-emerald-100 bg-emerald-500/10",
    badge: "✅",
    border: "border-emerald-500/30",
  },
  empty: {
    label: "Empty",
    tone: "text-amber-100 bg-amber-500/10",
    badge: "📝",
    border: "border-amber-400/30",
  },
  missing: {
    label: "Missing",
    tone: "text-rose-100 bg-rose-500/10",
    badge: "⚠️",
    border: "border-rose-500/30",
  },
};

export interface VariableStatusBadgeProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  name: string;
  value?: string | null;
  size?: "sm" | "md";
}

export const VariableStatusBadge = forwardRef<HTMLButtonElement, VariableStatusBadgeProps>(
  ({ name, value, className, size = "sm", ...props }, ref) => {
    const status = getStatusFromValue(value);
    const meta = STATUS_META[status];
    const isInteractive = typeof props.onClick === "function";

    return (
      <button
        ref={ref}
        type={props.type ?? (isInteractive ? "button" : "button")}
        {...props}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-left font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
          size === "md" ? "text-sm" : "text-xs",
          meta.tone,
          meta.border,
          isInteractive ? "hover:bg-white/10" : "cursor-default",
          className,
        )}
        aria-label={`${name}: ${meta.label}`}
      >
        <span aria-hidden="true">{meta.badge}</span>
        <span className="truncate">{name}</span>
        {status !== "ready" && (
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-white/60">
            {meta.label}
          </span>
        )}
      </button>
    );
  },
);

VariableStatusBadge.displayName = "VariableStatusBadge";

export function getVariableStatus(value?: string | null): VariableStatus {
  return getStatusFromValue(value);
}



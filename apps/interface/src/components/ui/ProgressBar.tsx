"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number; // 0–100
  animated?: boolean;
}

function ProgressBarComponent({
  progress,
  animated = false,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const isFunded = clamped >= 100;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 relative">
        <div
          role="progressbar"
          aria-valuenow={Math.round(clamped)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Funding progress: ${Math.round(clamped)}%`}
          className="w-full bg-[var(--color-surface-elevated)] rounded-full h-2 relative overflow-hidden"
        >
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              animated && "animate-shimmer",
            )}
            style={{
              width: `${clamped}%`,
              background: isFunded
                ? "var(--color-success)"
                : "var(--color-brand)",
            }}
          />
          <div className="absolute right-0 top-0 h-full w-0.5 bg-[var(--color-border-subtle)] opacity-50" />
        </div>
      </div>
      <span
        className="text-sm font-medium min-w-[3rem] text-right"
        style={{
          color: isFunded ? "var(--color-success)" : "var(--color-brand)",
        }}
        aria-hidden="true"
      >
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

export const ProgressBar = React.memo(ProgressBarComponent);

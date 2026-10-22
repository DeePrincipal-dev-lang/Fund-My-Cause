"use client";

import React from "react";
import { cn } from "./lib/utils";
import { clampProgress, isProgressFunded } from "./utils/progress";

export interface ProgressBarProps {
  progress: number; // 0–100
  animated?: boolean;
  showLabel?: boolean;
  color?: "indigo" | "green" | "blue" | "red";
}

/**
 * Progress bar component
 * @example
 * <ProgressBar progress={65} animated showLabel />
 */
function ProgressBarComponent({
  progress,
  animated = false,
  showLabel = true,
  color = "indigo",
}: ProgressBarProps) {
  const clamped = clampProgress(progress);
  const isFunded = isProgressFunded(clamped);

  const colorClasses = {
    indigo: "bg-indigo-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
    red: "bg-red-500",
  };

  const labelColorClasses = {
    indigo: "text-indigo-400",
    green: "text-green-400",
    blue: "text-blue-400",
    red: "text-red-400",
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 relative">
        <div
          role="progressbar"
          aria-valuenow={Math.round(clamped)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress: ${Math.round(clamped)}%`}
          className="w-full bg-gray-800 rounded-full h-2 relative overflow-hidden"
        >
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              isFunded ? "bg-green-500" : colorClasses[color],
              animated && "animate-shimmer",
            )}
            style={{ width: `${clamped}%` }}
          />
          <div className="absolute right-0 top-0 h-full w-0.5 bg-gray-600 opacity-50" />
        </div>
      </div>
      {showLabel && (
        <span
          className={cn(
            "text-sm font-medium min-w-[3rem] text-right",
            isFunded ? "text-green-400" : labelColorClasses[color],
          )}
          aria-hidden="true"
        >
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}

export const ProgressBar = React.memo(ProgressBarComponent);

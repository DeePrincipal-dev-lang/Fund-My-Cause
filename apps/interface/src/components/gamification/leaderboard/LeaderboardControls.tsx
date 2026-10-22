"use client";

import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardControlsProps {
  timeframe: "all-time" | "this-month" | "this-week";
  type: "points" | "contributions" | "achievements" | "referrals";
  showAddresses: boolean;
  onTimeframeChange?: (tf: "all-time" | "this-month" | "this-week") => void;
  onTypeChange?: (t: "points" | "contributions" | "achievements" | "referrals") => void;
  onToggleAddresses: () => void;
}

export function LeaderboardControls({
  timeframe,
  type,
  showAddresses,
  onTimeframeChange,
  onTypeChange,
  onToggleAddresses,
}: LeaderboardControlsProps) {
  const timeframeOptions: Array<
    "all-time" | "this-month" | "this-week"
  > = ["all-time", "this-month", "this-week"];
  const typeOptions: Array<
    "points" | "contributions" | "achievements" | "referrals"
  > = ["points", "contributions", "achievements", "referrals"];

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      {/* Timeframe tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {timeframeOptions.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange?.(tf)}
            className={cn(
              "px-4 py-2 font-medium text-sm transition-colors capitalize",
              timeframe === tf
                ? "text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
            )}
          >
            {tf.replace(/-/g, " ")}
          </button>
        ))}
      </div>

      {/* Type buttons */}
      <div className="flex gap-2 flex-wrap">
        {typeOptions.map((t) => (
          <button
            key={t}
            onClick={() => onTypeChange?.(t)}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize",
              type === t
                ? "bg-yellow-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Toggle address visibility */}
      <button
        onClick={onToggleAddresses}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
        aria-label={showAddresses ? "Hide addresses" : "Show addresses"}
      >
        {showAddresses ? (
          <>
            <Eye size={16} />
            <span>Hide</span>
          </>
        ) : (
          <>
            <EyeOff size={16} />
            <span>Show</span>
          </>
        )}
      </button>
    </div>
  );
}

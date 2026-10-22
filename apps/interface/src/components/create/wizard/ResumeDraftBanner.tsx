"use client";

import React from "react";
import { FileText, X } from "lucide-react";

interface ResumeDraftBannerProps {
  onResume: () => void;
  onDismiss: () => void;
}

export function ResumeDraftBanner({
  onResume,
  onDismiss,
}: ResumeDraftBannerProps) {
  return (
    <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
      <FileText
        size={16}
        className="text-indigo-500 dark:text-indigo-400 shrink-0"
      />
      <p className="flex-1 text-sm text-indigo-700 dark:text-indigo-300">
        You have an unsaved draft. Want to pick up where you left off?
      </p>
      <button
        onClick={onResume}
        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition whitespace-nowrap"
      >
        Resume Draft
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss draft"
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
      >
        <X size={16} />
      </button>
    </div>
  );
}

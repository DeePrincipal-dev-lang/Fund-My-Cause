"use client";

import React from "react";
import { Eye } from "lucide-react";
import { STEPS, PREVIEW_STEP } from "./types";

interface WizardProgressHeaderProps {
  step: number;
}

export function WizardProgressHeader({ step }: WizardProgressHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition ${
                i < step
                  ? "bg-indigo-600 text-white"
                  : i === step
                    ? "bg-indigo-500 text-white ring-2 ring-indigo-300"
                    : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-500"
              }`}
            >
              {i < step ? (
                "✓"
              ) : i === PREVIEW_STEP ? (
                <Eye size={14} />
              ) : (
                i + 1
              )}
            </div>
            <span className="text-xs text-gray-500 hidden sm:block">
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-1 h-px ${i < step ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-700"}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

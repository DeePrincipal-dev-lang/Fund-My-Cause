"use client";

import React from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { formatXLM } from "@/lib/format";

export interface FundingProgressProps {
  /** Percentage 0-100 */
  progress: number;
  totalRaised: bigint;
  goal: bigint;
  contributorCount: bigint | number;
  averageContribution: bigint;
  /** ISO deadline string */
  deadline: string;
}

/**
 * Displays the funding progress bar, raised/goal amounts, contributor count,
 * average contribution, and countdown timer for a campaign detail page.
 */
export function FundingProgress({
  progress,
  totalRaised,
  goal,
  contributorCount,
  averageContribution,
  deadline,
}: FundingProgressProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <ProgressBar progress={progress} />
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{formatXLM(totalRaised)} raised</span>
          <span>{formatXLM(goal)} goal</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
        <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
          <p className="text-xl font-semibold">{String(contributorCount)}</p>
          <p className="mt-1 text-xs text-gray-500">Contributors</p>
        </div>
        <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
          <p className="text-xl font-semibold">
            {formatXLM(averageContribution)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Avg. contribution</p>
        </div>
        <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
          <CountdownTimer deadline={deadline} />
          <p className="mt-1 text-xs text-gray-500">Remaining</p>
        </div>
      </div>
    </div>
  );
}

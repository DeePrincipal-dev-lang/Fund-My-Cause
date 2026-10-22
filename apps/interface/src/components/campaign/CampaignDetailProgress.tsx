import React from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { XlmAmount } from "@/components/ui/XlmAmount";

export interface CampaignDetailProgressProps {
  progress: number;
  raised: number;
  goal: number;
  xlmPrice?: number | null;
}

export function CampaignDetailProgress({
  progress,
  raised,
  goal,
  xlmPrice = null,
}: CampaignDetailProgressProps) {
  return (
    <div className="space-y-2">
      <ProgressBar progress={progress} />
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          <XlmAmount xlm={raised} price={xlmPrice} /> raised
        </span>
        <span>
          <XlmAmount xlm={goal} price={xlmPrice} /> goal
        </span>
      </div>
    </div>
  );
}

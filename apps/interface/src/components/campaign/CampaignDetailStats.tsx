import React from "react";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { XlmAmount } from "@/components/ui/XlmAmount";

export interface CampaignDetailStatsProps {
  contributorCount: number;
  averageContribution: number;
  deadline: string | Date;
  xlmPrice?: number | null;
}

export function CampaignDetailStats({
  contributorCount,
  averageContribution,
  deadline,
  xlmPrice = null,
}: CampaignDetailStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
      <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
        <p className="text-xl font-semibold">{contributorCount}</p>
        <p className="mt-1 text-xs text-gray-500">Contributors</p>
      </div>
      <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
        <p className="text-xl font-semibold">
          <XlmAmount xlm={averageContribution} price={xlmPrice} />
        </p>
        <p className="mt-1 text-xs text-gray-500">Avg. contribution</p>
      </div>
      <div className="rounded-xl bg-gray-100 p-4 dark:bg-gray-900">
        <CountdownTimer deadline={deadline} />
        <p className="mt-1 text-xs text-gray-500">Remaining</p>
      </div>
    </div>
  );
}

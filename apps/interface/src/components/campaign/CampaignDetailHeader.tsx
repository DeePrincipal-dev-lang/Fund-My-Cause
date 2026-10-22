import React from "react";
import { truncateAddress } from "@/lib/campaignDetailFormat";

export interface CampaignDetailHeaderProps {
  title: string;
  creator: string;
}

export function CampaignDetailHeader({
  title,
  creator,
}: CampaignDetailHeaderProps) {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">{title}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-500">
        by{" "}
        <span
          className="font-mono text-gray-500 dark:text-gray-400"
          title={creator}
        >
          {truncateAddress(creator)}
        </span>
      </p>
    </div>
  );
}

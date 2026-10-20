"use client";

import React from "react";
import { CampaignProgress } from "@fund-my-cause/components";
import { formatXlmWithUsd } from "@fund-my-cause/shared-utils";
import { useTranslations } from "next-intl";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import type { Campaign } from "@/types/campaign";

export interface CampaignCardProgressProps {
  campaign: Campaign;
  /** Percentage of goal raised, already computed by the parent */
  progress: number;
  xlmPrice: number | null;
}

/** Funding bar, raised/goal amounts and time remaining. */
export function CampaignCardProgress({
  campaign,
  progress,
  xlmPrice,
}: CampaignCardProgressProps) {
  const t = useTranslations("campaignCard");

  return (
    <CampaignProgress
      percent={progress}
      renderBar={({ percent }) => <ProgressBar progress={percent} />}
      raisedText={`${formatXlmWithUsd(campaign.raised, xlmPrice)} ${t("raised")}`}
      goalText={`${formatXlmWithUsd(campaign.goal, xlmPrice)} ${t("goal")}`}
      timeRemaining={<CountdownTimer deadline={campaign.deadline} />}
      classNames={{
        root: "space-y-3",
        amounts: "flex justify-between text-sm text-[var(--color-text-secondary)]",
      }}
    />
  );
}

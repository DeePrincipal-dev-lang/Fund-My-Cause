"use client";

import { useMemo } from "react";
import type { ContributionEntry } from "@/hooks/useContributions";
import type { CampaignData } from "@fund-my-cause/types";

interface ProfileStats {
  totalRaised: number;
  totalContributed: number;
  campaignCount: number;
  contributionCount: number;
}

/**
 * Computes aggregate statistics from a creator's campaigns and contributions.
 * Treats missing/undefined values as zero.
 */
export function useProfileStats(
  campaigns: Pick<CampaignData, "raised">[],
  contributions: ContributionEntry[],
): ProfileStats {
  return useMemo(() => {
    const totalRaised = campaigns.reduce(
      (sum, c) =>
        sum + (typeof c.raised === "number" && c.raised >= 0 ? c.raised : 0),
      0,
    );

    const totalContributed = contributions.reduce(
      (sum, c) =>
        sum + (typeof c.amount === "number" && c.amount >= 0 ? c.amount : 0),
      0,
    );

    return {
      totalRaised,
      totalContributed,
      campaignCount: campaigns.length,
      contributionCount: contributions.length,
    };
  }, [campaigns, contributions]);
}

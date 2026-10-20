import type { Campaign } from "@/types/campaign";

/** The numeric measures shown when comparing campaigns side by side. */
export type ComparisonMetric = "raised" | "goal" | "progress" | "contributors";

/**
 * The value of one measure for one campaign. The comparison table and the comparison chart both
 * read values through this function, so the two views always show the same numbers.
 * Progress is a whole percentage, rounded down, and is 0 for campaigns with no goal.
 */
export function getComparisonValue(campaign: Campaign, metric: ComparisonMetric): number {
  switch (metric) {
    case "raised":
      return campaign.raised;
    case "goal":
      return campaign.goal;
    case "progress":
      return campaign.goal > 0 ? Math.round((campaign.raised / campaign.goal) * 100) : 0;
    case "contributors":
      return campaign.contributorCount ?? 0;
    default:
      return 0;
  }
}

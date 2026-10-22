/**
 * Raw return shapes of the crowdfund contract's view functions.
 *
 * These mirror what `scValToNative` produces for each Soroban view call:
 * snake_case field names, `bigint` for i128/u64 values.  They were previously
 * hand-maintained inside `services/graphql-api/src/types.ts`; they live here
 * so every service that reads the contract directly decodes it the same way.
 *
 * `status` is typed as the canonical {@link CampaignStatus} rather than a
 * second, locally-declared union — a value added to the contract's `Status`
 * enum only has to be added to `CAMPAIGN_STATUS_VALUES`.
 */

import type { CampaignStatus } from "./soroban";

/** Mirrors the crowdfund contract's `Category` enum. */
export type ContractCategory =
  | "Charity"
  | "Technology"
  | "Creative"
  | "Event"
  | "Personal"
  | "Other";

/** Raw return type of the contract's `get_campaign_info` view. */
export interface RawCampaignInfo {
  creator: string;
  token: string;
  goal: bigint;
  deadline: bigint;
  min_contribution: bigint;
  max_contribution: bigint;
  title: string;
  description: string;
  status: CampaignStatus;
  category: ContractCategory;
  has_platform_config: boolean;
  platform_fee_bps: number;
  platform_address: string;
}

/** Raw return type of the contract's `get_stats` view. */
export interface RawCampaignStats {
  total_raised: bigint;
  gross_raised: bigint;
  goal: bigint;
  soft_cap: bigint;
  stretch_goal: bigint;
  progress_bps: number;
  contributor_count: number;
  average_contribution: bigint;
  largest_contribution: bigint;
}

/** Raw return type of the contract's `get_performance_metrics` view. */
export interface RawPerformanceMetrics {
  success_rate_bps: number;
  contribution_velocity: bigint;
  trending: number;
  milestones_reached: number;
  total_milestones: number;
  time_elapsed: bigint;
  estimated_time_to_goal: bigint;
  average_daily_contribution: bigint;
}

/** Raw return type of the registry's `list` / `list_by_status` views. */
export type RawCampaignIdList = string[];

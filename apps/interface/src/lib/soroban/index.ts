/**
 * Public entry point for client-side Soroban campaign-contract interaction.
 *
 * Chain reads live in `@/lib/graphql/client` (see PR #1053). This module
 * covers what's left of the on-chain write path: connection singletons
 * (`./client`), transaction building (`./tx-builders`), and
 * simulation/submission (`./submit`).
 */

// Re-export types for backward compatibility
export type {
  CampaignStatus,
  CampaignInfo,
  CampaignStats,
  CampaignData,
  InitializeParams,
  PlatformConfig,
  StatusVariant,
  ContributionRecord,
} from "@/types/soroban";

export { getStaticCampaignIds } from "./client";
export * from "./tx-builders";
export * from "./submit";

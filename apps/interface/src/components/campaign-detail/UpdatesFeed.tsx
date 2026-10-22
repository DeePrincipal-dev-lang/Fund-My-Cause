"use client";

/**
 * UpdatesFeed — campaign-detail section that shows campaign creator updates.
 *
 * Thin wrapper that re-exports UpdateFeed from the shared UI component with
 * the campaign-detail-specific interface. Placed here so CampaignDetailContent
 * can lazy-load this section with next/dynamic without pulling in the full
 * UpdateFeed module on initial paint.
 */

export { UpdateFeed as UpdatesFeed } from "@/components/ui/UpdateFeed";
export type { UpdateFeedProps as UpdatesFeedProps } from "@/components/ui/UpdateFeed";

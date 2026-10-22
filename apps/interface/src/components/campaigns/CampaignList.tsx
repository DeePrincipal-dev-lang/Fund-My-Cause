"use client";

import React from "react";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { CampaignCard } from "@/components/ui/CampaignCard";
import {
  EmptyState,
  NoCampaignsIllustration,
} from "@/components/ui/EmptyState";
import { Campaign } from "@/types/campaign";

export interface CampaignListProps {
  campaigns: Campaign[];
  onPledge: (campaignId: string) => void;
  onShare?: (campaignId: string, title: string) => void;
  isEmpty?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateAction?: { label: string; onClick: () => void };
  query?: string;
}

export function CampaignList({
  campaigns,
  onPledge,
  onShare,
  isEmpty = false,
  emptyStateTitle = "No campaigns found",
  emptyStateDescription = "Be the first to launch a campaign.",
  emptyStateAction,
  query,
}: CampaignListProps) {
  if (isEmpty || campaigns.length === 0) {
    return (
      <EmptyState
        illustration={<NoCampaignsIllustration />}
        title={emptyStateTitle}
        description={emptyStateDescription}
        action={emptyStateAction}
      />
    );
  }

  return (
    <VirtualizedGrid
      items={campaigns}
      getKey={(campaign: Campaign) => campaign.id}
      rowHeight={480}
      gap={24}
      minColumnWidth={340}
      renderItem={(campaign: Campaign, index: number) => (
        <CampaignCard
          campaign={campaign}
          onPledge={onPledge}
          onShare={onShare}
          index={index}
          query={query}
        />
      )}
    />
  );
}

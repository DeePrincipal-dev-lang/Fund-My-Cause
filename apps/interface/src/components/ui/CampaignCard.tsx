"use client";

import React from "react";
import { motion } from "framer-motion";
import { calculateCampaignProgress, calculateIsEnded } from "@/lib/campaignProgress";
import type { Campaign } from "@/types/campaign";
import { useComparison } from "@/context/ComparisonContext";
import { useBookmarks } from "@/context/BookmarkContext";
import { getFallbackImage, isValidImageUri } from "@/lib/imageValidation";
import { CampaignCardHeader } from "./campaign/CampaignCardHeader";
import { CampaignCardMedia } from "./campaign/CampaignCardMedia";
import { CampaignCardProgress } from "./campaign/CampaignCardProgress";
import { CampaignCardActions } from "./campaign/CampaignCardActions";

export interface CampaignCardProps {
  campaign: Campaign;
  onPledge?: (id: string) => void;
  onShare?: (id: string, title: string) => void;
  /** Pass null when price fetch failed — USD amounts are hidden */
  xlmPrice?: number | null;
  /** Stagger index for slide-up animation on listing page */
  index?: number;
  /** Search query for highlighting matching text */
  query?: string;
}

/**
 * Campaign card for listing, search, bookmark and dashboard views.
 *
 * A composition wrapper over four sections, each in `./campaign/`:
 * `CampaignCardHeader` (media, title, description), `CampaignCardMedia`
 * (overlay badges and share/bookmark), `CampaignCardProgress` (funding and
 * time remaining) and `CampaignCardActions` (compare and pledge). Progress
 * maths and amount formatting come from `@fund-my-cause/shared-utils`.
 */
function CampaignCardComponent({
  campaign,
  onPledge,
  onShare,
  xlmPrice = null,
  index = 0,
  query,
}: CampaignCardProps) {
  const progress = React.useMemo(
    () => calculateCampaignProgress(campaign.raised, campaign.goal),
    [campaign.raised, campaign.goal],
  );
  const isFunded = progress >= 100;
  const isEnded = React.useMemo(
    () => calculateIsEnded(campaign.deadline, campaign.raised, campaign.goal),
    [campaign.deadline, campaign.raised, campaign.goal],
  );

  // Fallback image resolution: track whether the image failed to load so the
  // header can fall back gracefully.
  const [imgError, setImgError] = React.useState(false);
  const resolvedImageUrl =
    !imgError && isValidImageUri(campaign.image) ? campaign.image : undefined;

  const { toggle: toggleCompare, isSelected, selected } = useComparison();
  const { toggle: toggleBookmark, isBookmarked } = useBookmarks();
  const compared = isSelected(campaign.id);
  const bookmarked = isBookmarked(campaign.id);
  const compareDisabled = !compared && selected.length >= 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: "easeOut" }}
      whileHover={{
        scale: 1.02,
        boxShadow: "var(--shadow-card, 0 8px 32px rgba(0,0,0,0.25))",
      }}
      className="ds-card"
    >
      <CampaignCardHeader
        campaign={campaign}
        query={query}
        resolvedImageUrl={resolvedImageUrl}
        fallbackImageUrl={getFallbackImage(campaign.id)}
        onImageError={() => setImgError(true)}
        overlay={
          <CampaignCardMedia
            campaign={campaign}
            isFunded={isFunded}
            isEnded={isEnded}
            bookmarked={bookmarked}
            onToggleBookmark={() => toggleBookmark(campaign.id)}
            onShare={
              onShare ? () => onShare(campaign.id, campaign.title) : undefined
            }
          />
        }
      >
        <CampaignCardProgress
          campaign={campaign}
          progress={progress}
          xlmPrice={xlmPrice}
        />
        <CampaignCardActions
          campaign={campaign}
          compared={compared}
          compareDisabled={compareDisabled}
          onToggleCompare={() => toggleCompare(campaign.id)}
          onPledge={() => onPledge?.(campaign.id)}
          isFunded={isFunded}
          isEnded={isEnded}
        />
      </CampaignCardHeader>
    </motion.div>
  );
}

// `onPledge`/`onShare` are recreated every parent render but are behaviorally
// stable (they just forward to a state setter), so they're excluded here —
// comparing them by reference would defeat the memoization on every list
// update even though nothing this card renders actually changed.
function campaignCardPropsAreEqual(
  prev: CampaignCardProps,
  next: CampaignCardProps,
): boolean {
  return (
    prev.campaign.id === next.campaign.id &&
    prev.campaign.title === next.campaign.title &&
    prev.campaign.description === next.campaign.description &&
    prev.campaign.image === next.campaign.image &&
    prev.campaign.raised === next.campaign.raised &&
    prev.campaign.goal === next.campaign.goal &&
    prev.campaign.deadline === next.campaign.deadline &&
    prev.campaign.category === next.campaign.category &&
    prev.campaign.videoUrl === next.campaign.videoUrl &&
    prev.campaign.contributorCount === next.campaign.contributorCount &&
    prev.xlmPrice === next.xlmPrice &&
    prev.index === next.index &&
    prev.query === next.query
  );
}

export const CampaignCard = React.memo(
  CampaignCardComponent,
  campaignCardPropsAreEqual,
);

"use client";

import React from "react";
import Image from "next/image";
import { CampaignHeader } from "@fund-my-cause/components";
import { SIZES_CARD_THUMB } from "@/lib/imageOptimization";
import type { Campaign } from "@/types/campaign";
import { Highlight } from "./CampaignCardBadges";

export interface CampaignCardHeaderProps {
  campaign: Campaign;
  query?: string;
  /** Undefined when the image is missing or failed to load — fallback is shown instead */
  resolvedImageUrl?: string;
  fallbackImageUrl: string;
  /** Badges and header actions rendered over the media area */
  overlay: React.ReactNode;
  onImageError: () => void;
  children: React.ReactNode;
}

/**
 * Identity shell for a campaign card: media, title and description. Body
 * content (progress, actions) is passed as children.
 */
export function CampaignCardHeader({
  campaign,
  query,
  resolvedImageUrl,
  fallbackImageUrl,
  overlay,
  onImageError,
  children,
}: CampaignCardHeaderProps) {
  return (
    <CampaignHeader
      title={campaign.title}
      description={<Highlight text={campaign.description} query={query} />}
      renderTitle={(title) => <Highlight text={title} query={query} />}
      imageUrl={resolvedImageUrl}
      fallbackImageUrl={fallbackImageUrl}
      imageAlt={`${campaign.title} - campaign header image`}
      renderImage={({ src, alt, onError }) => (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes={SIZES_CARD_THUMB}
          onError={() => {
            onImageError();
            onError?.();
          }}
        />
      )}
      classNames={{
        media: "relative w-full h-48 sm:h-48",
        body: "p-4 sm:p-5 space-y-3",
        title: "text-base sm:text-lg font-semibold text-[var(--color-text-primary)]",
        description: "text-[var(--color-text-secondary)] text-sm line-clamp-2",
      }}
      overlay={overlay}
    >
      {children}
    </CampaignHeader>
  );
}

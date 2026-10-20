"use client";

import React from "react";
import { Bookmark, Share2 } from "lucide-react";
import { CampaignHeaderActions } from "@fund-my-cause/components";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { Campaign } from "@/types/campaign";
import { StatusBadge, CategoryBadge } from "./CampaignCardBadges";

const ICON_BUTTON_CLS =
  "p-2 rounded-full bg-[var(--color-surface)]/80 hover:bg-[var(--color-surface-elevated)] transition touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center";

export interface CampaignCardMediaProps {
  campaign: Campaign;
  isFunded: boolean;
  isEnded: boolean;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onShare?: () => void;
}

/**
 * Overlay drawn on top of the card image: status and category badges plus the
 * share and bookmark buttons.
 */
export function CampaignCardMedia({
  campaign,
  isFunded,
  isEnded,
  bookmarked,
  onToggleBookmark,
  onShare,
}: CampaignCardMediaProps) {
  const t = useTranslations("campaignCard");

  return (
    <>
      {isFunded && <StatusBadge status="funded" label={t("funded")} />}
      {isEnded && <StatusBadge status="ended" label={t("ended")} />}
      {campaign.videoUrl && (
        <span className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
          ▶ {t("video")}
        </span>
      )}
      <CategoryBadge slug={campaign.category} />
      <CampaignHeaderActions
        unstyled
        layout="inline"
        className="absolute top-10 right-3 flex gap-1"
        onShare={onShare}
        shareAriaLabel={t("shareCampaign")}
        onSave={onToggleBookmark}
        saved={bookmarked}
        saveAriaLabel={t("bookmarkCampaign")}
        unsaveAriaLabel={t("removeBookmark")}
        classNames={{
          iconButton: ICON_BUTTON_CLS,
          icon: "text-[var(--color-text-muted)]",
          savedIcon: "fill-[var(--color-brand)] text-[var(--color-brand)]",
        }}
      >
        <button
          aria-label={t("shareCampaign")}
          className={ICON_BUTTON_CLS}
          onClick={(e) => {
            e.stopPropagation();
            onShare?.();
          }}
        >
          <Share2 size={15} className="text-[var(--color-text-muted)]" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark();
          }}
          aria-label={bookmarked ? t("removeBookmark") : t("bookmarkCampaign")}
          className={ICON_BUTTON_CLS}
        >
          <Bookmark
            size={15}
            className={cn(
              bookmarked
                ? "fill-[var(--color-brand)] text-[var(--color-brand)]"
                : "text-[var(--color-text-muted)]",
            )}
          />
        </button>
      </CampaignHeaderActions>
    </>
  );
}

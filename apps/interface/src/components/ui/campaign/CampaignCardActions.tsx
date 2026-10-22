"use client";

import React from "react";
import { GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { Campaign } from "@/types/campaign";

export interface CampaignCardActionsProps {
  campaign: Campaign;
  compared: boolean;
  compareDisabled: boolean;
  onToggleCompare: () => void;
  onPledge: () => void;
  isFunded: boolean;
  isEnded: boolean;
}

/** Compare checkbox and the pledge button at the foot of the card. */
export function CampaignCardActions({
  campaign,
  compared,
  compareDisabled,
  onToggleCompare,
  onPledge,
  isFunded,
  isEnded,
}: CampaignCardActionsProps) {
  const t = useTranslations("campaignCard");
  const isDisabled = isFunded || isEnded;

  const pledgeAriaLabel = isFunded
    ? t("fundedAriaLabel", { title: campaign.title })
    : isEnded
      ? t("endedAriaLabel", { title: campaign.title })
      : t("pledgeAriaLabel", { title: campaign.title });

  return (
    <>
      <label
        className={cn(
          "flex items-center gap-2 text-xs cursor-pointer select-none touch-manipulation",
          compareDisabled && "opacity-40 cursor-not-allowed",
        )}
      >
        <input
          type="checkbox"
          checked={compared}
          disabled={compareDisabled}
          onChange={onToggleCompare}
          className="accent-[var(--color-brand)] w-4 h-4"
        />
        <GitCompare size={12} className="text-[var(--color-text-muted)]" />
        <span className="text-[var(--color-text-muted)]">{t("compare")}</span>
      </label>
      <button
        className="ds-btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        onClick={onPledge}
        disabled={isDisabled}
        aria-label={pledgeAriaLabel}
      >
        {isFunded
          ? t("successfullyFunded")
          : isEnded
            ? t("campaignEnded")
            : t("pledgeNow")}
      </button>
    </>
  );
}

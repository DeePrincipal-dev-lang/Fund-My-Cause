"use client";

import React from "react";
import { ExternalLink, Users, Clock } from "lucide-react";
import { formatCampaignCard } from "@fund-my-cause/components";
import type { CampaignData } from "@/types/soroban";
import { DEFAULT_HERO_IMAGE } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmbedTheme = "dark" | "light" | "auto";
export type EmbedSize = "compact" | "standard" | "wide";
export type EmbedAccent = string; // hex colour, e.g. "#6366f1"

interface EmbedCardProps {
  campaign: CampaignData;
  campaignUrl: string;
  theme: EmbedTheme;
  size: EmbedSize;
  accent: EmbedAccent;
  hideImage?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatXlm(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M XLM`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K XLM`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`;
}

function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

// ── Size config ───────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<
  EmbedSize,
  { imageH: string; titleSize: string; showDesc: boolean; padding: string }
> = {
  compact: {
    imageH: "h-24",
    titleSize: "text-sm",
    showDesc: false,
    padding: "p-3",
  },
  standard: {
    imageH: "h-36",
    titleSize: "text-base",
    showDesc: false,
    padding: "p-4",
  },
  wide: {
    imageH: "h-44",
    titleSize: "text-lg",
    showDesc: true,
    padding: "p-5",
  },
};

// ── Theme config ──────────────────────────────────────────────────────────────

const THEME_CLASSES: Record<EmbedTheme, string> = {
  dark: "bg-gray-950 text-white border-gray-800",
  light: "bg-white text-gray-900 border-gray-200",
  auto: "bg-white text-gray-900 border-gray-200 dark:bg-gray-950 dark:text-white dark:border-gray-800",
};

const MUTED_CLASSES: Record<EmbedTheme, string> = {
  dark: "text-gray-400",
  light: "text-gray-500",
  auto: "text-gray-500 dark:text-gray-400",
};

const TRACK_CLASSES: Record<EmbedTheme, string> = {
  dark: "bg-gray-800",
  light: "bg-gray-200",
  auto: "bg-gray-200 dark:bg-gray-800",
};

const STAT_BG_CLASSES: Record<EmbedTheme, string> = {
  dark: "bg-gray-900",
  light: "bg-gray-100",
  auto: "bg-gray-100 dark:bg-gray-900",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function EmbedCard({
  campaign,
  campaignUrl,
  theme,
  size,
  accent,
  hideImage = false,
}: EmbedCardProps) {
  const cfg = SIZE_CONFIG[size];
  const {
    displayPercent: progress,
    isFunded: isGoalMet,
    isEnded,
    raisedText,
    goalText,
  } = formatCampaignCard(
    {
      raised: campaign.raised,
      goal: campaign.goal,
      deadline: campaign.deadline,
    },
    { formatAmount: formatXlm },
  );

  const heroSrc =
    campaign.socialLinks?.[0]?.startsWith("Qm") ||
    campaign.socialLinks?.[0]?.startsWith("bafy")
      ? `https://ipfs.io/ipfs/${campaign.socialLinks[0]}`
      : DEFAULT_HERO_IMAGE;

  return (
    <a
      href={campaignUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View campaign: ${campaign.title}`}
      className={`
        block w-full rounded-2xl border overflow-hidden
        transition-transform duration-200 hover:scale-[1.01]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        no-underline
        ${THEME_CLASSES[theme]}
      `}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      {/* Hero image */}
      {!hideImage && (
        <img
          src={heroSrc}
          alt=""
          aria-hidden="true"
          className={`w-full object-cover ${cfg.imageH}`}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = DEFAULT_HERO_IMAGE;
          }}
        />
      )}

      <div className={cfg.padding}>
        {/* Title */}
        <h2
          className={`font-bold leading-snug mb-2 line-clamp-2 ${cfg.titleSize}`}
        >
          {campaign.title}
        </h2>

        {/* Description — wide only */}
        {cfg.showDesc && campaign.description && (
          <p
            className={`text-xs leading-relaxed mb-3 line-clamp-2 ${MUTED_CLASSES[theme]}`}
          >
            {campaign.description}
          </p>
        )}

        {/* Progress bar */}
        <div className="mb-2">
          <div
            className={`w-full h-1.5 rounded-full overflow-hidden ${TRACK_CLASSES[theme]}`}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(progress)}% funded`}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: isGoalMet ? "#22c55e" : accent,
              }}
            />
          </div>
        </div>

        {/* Raised / goal */}
        <div
          className={`flex justify-between text-xs mb-3 ${MUTED_CLASSES[theme]}`}
        >
          <span
            className="font-semibold"
            style={{ color: isGoalMet ? "#22c55e" : accent }}
          >
            {raisedText} raised
          </span>
          <span>{goalText} goal</span>
        </div>

        {/* Stats row */}
        <div
          className={`grid grid-cols-2 gap-2 mb-3 ${size === "compact" ? "hidden" : ""}`}
        >
          <div
            className={`rounded-lg px-2 py-1.5 flex items-center gap-1.5 ${STAT_BG_CLASSES[theme]}`}
          >
            <Users
              size={11}
              className={MUTED_CLASSES[theme]}
              aria-hidden="true"
            />
            <span className="text-xs font-medium">
              {campaign.contributorCount ?? 0}
            </span>
            <span className={`text-xs ${MUTED_CLASSES[theme]}`}>backers</span>
          </div>
          <div
            className={`rounded-lg px-2 py-1.5 flex items-center gap-1.5 ${STAT_BG_CLASSES[theme]}`}
          >
            <Clock
              size={11}
              className={MUTED_CLASSES[theme]}
              aria-hidden="true"
            />
            <span className={`text-xs ${isEnded ? "text-red-400" : ""}`}>
              {timeLeft(campaign.deadline)}
            </span>
          </div>
        </div>

        {/* CTA */}
        <div
          className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        >
          {isEnded ? "View Campaign" : "Back This Campaign"}
          <ExternalLink size={11} />
        </div>

        {/* Branding */}
        <p className={`text-center text-[10px] mt-2 ${MUTED_CLASSES[theme]}`}>
          Powered by{" "}
          <span className="font-semibold" style={{ color: accent }}>
            Fund-My-Cause
          </span>
        </p>
      </div>
    </a>
  );
}

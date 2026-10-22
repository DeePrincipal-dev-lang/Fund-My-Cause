/**
 * CampaignDetailSkeleton
 *
 * Renders a full-page placeholder that mirrors the layout of
 * CampaignDetailContent while campaign data is being fetched.
 * Uses the same shimmer animation as the card-level LoadingSkeleton so the
 * visual language is consistent across the app.
 */

import React from "react";
import { cn } from "./lib/utils";

// ── Base block ────────────────────────────────────────────────────────────────

function Block({ className }: { className: string }) {
  return <div className={cn("skeleton-shimmer rounded", className)} />;
}

// ── Row helpers ───────────────────────────────────────────────────────────────

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-3", className)}>{children}</div>;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface CampaignDetailSkeletonProps {
  /** Additional class applied to the outermost wrapper. */
  className?: string;
}

/**
 * Full-page skeleton for the campaign detail view.
 *
 * ```tsx
 * if (loading) return <CampaignDetailSkeleton />;
 * ```
 */
export function CampaignDetailSkeleton({ className }: CampaignDetailSkeletonProps = {}) {
  return (
    <div
      className={cn("mx-auto max-w-3xl space-y-8 px-6 py-10 animate-pulse", className)}
      aria-busy="true"
      aria-label="Loading campaign details"
      data-testid="campaign-detail-skeleton"
    >
      {/* Hero image */}
      <Block className="w-full h-56 rounded-2xl" />

      {/* Title + creator */}
      <div className="space-y-2">
        <Block className="h-8 w-3/4" />
        <Row>
          <Block className="h-4 w-8 rounded-full" />
          <Block className="h-4 w-40" />
        </Row>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Block className="h-3 rounded-full w-full" />
        <Row className="justify-between">
          <Block className="h-4 w-32" />
          <Block className="h-4 w-20" />
        </Row>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ds-card p-4 space-y-2">
            <Block className="h-3 w-1/2" />
            <Block className="h-6 w-2/3" />
          </div>
        ))}
      </div>

      {/* Description lines */}
      <div className="space-y-2">
        <Block className="h-4 w-full" />
        <Block className="h-4 w-5/6" />
        <Block className="h-4 w-4/5" />
        <Block className="h-4 w-3/4" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Block className="h-10 flex-1 rounded-xl" />
        <Block className="h-10 w-28 rounded-xl" />
      </div>

      {/* Contract ID row */}
      <Block className="h-10 rounded-xl w-full" />
    </div>
  );
}

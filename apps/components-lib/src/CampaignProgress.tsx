"use client";

import React, { ReactNode } from "react";
import { cn } from "./lib/utils";
import { ProgressBar } from "./ProgressBar";

export interface CampaignProgressClassNames {
  root?: string;
  amounts?: string;
  raised?: string;
  goal?: string;
  timeRemaining?: string;
}

export interface CampaignProgressProps {
  /**
   * Funding progress as a percentage of the goal. Compute it with
   * `calculateProgress` from `@fund-my-cause/shared-utils` rather than inline —
   * the bar clamps to 0–100 for display but accepts over-funded values.
   */
  percent: number;
  /** Pre-formatted raised amount, e.g. "15,400 XLM (~$2,156 USD)". */
  raisedText?: ReactNode;
  /** Pre-formatted goal amount. */
  goalText?: ReactNode;
  /** Time-remaining element — a live countdown or a static string. */
  timeRemaining?: ReactNode;
  /** Animates the bar fill. */
  animated?: boolean;
  /**
   * Renders the bar itself. Supply this to use an app-themed progress bar; the
   * library's `ProgressBar` is used otherwise.
   */
  renderBar?: (props: { percent: number; animated: boolean }) => ReactNode;
  /** Renders a skeleton in place of the bar and amounts. */
  isLoading?: boolean;
  /** Replaces the bar with an error message. */
  error?: string | null;
  classNames?: CampaignProgressClassNames;
  className?: string;
}

/**
 * Funding progress block: bar, percentage, raised/goal amounts and the
 * remaining-time line.
 *
 * Amounts arrive pre-formatted so this component never duplicates currency or
 * date logic — that lives in `@fund-my-cause/shared-utils`.
 *
 * @example
 * <CampaignProgress
 *   percent={calculateProgress(campaign.raised, campaign.goal)}
 *   raisedText={`${formatXlmWithUsd(campaign.raised, price)} raised`}
 *   goalText={`${formatXlmWithUsd(campaign.goal, price)} goal`}
 *   timeRemaining={<CountdownTimer deadline={campaign.deadline} />}
 * />
 */
function CampaignProgressComponent({
  percent,
  raisedText,
  goalText,
  timeRemaining,
  animated = false,
  renderBar,
  isLoading = false,
  error = null,
  classNames,
  className,
}: CampaignProgressProps) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading funding progress"
        className={cn("space-y-3", classNames?.root, className)}
      >
        <div className="h-2 w-full rounded-full animate-pulse bg-[var(--color-surface-elevated,#e5e7eb)]" />
        <div className="h-4 w-2/3 rounded animate-pulse bg-[var(--color-surface-elevated,#e5e7eb)]" />
      </div>
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className={cn("text-sm text-red-500", classNames?.root, className)}
      >
        {error}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", classNames?.root, className)}>
      {renderBar ? (
        renderBar({ percent, animated })
      ) : (
        <ProgressBar progress={percent} animated={animated} />
      )}
      {(raisedText || goalText) && (
        <div
          className={cn("flex justify-between text-sm", classNames?.amounts)}
        >
          <span className={classNames?.raised}>{raisedText}</span>
          <span className={classNames?.goal}>{goalText}</span>
        </div>
      )}
      {timeRemaining && (
        <div className={classNames?.timeRemaining}>{timeRemaining}</div>
      )}
    </div>
  );
}

export const CampaignProgress = React.memo(CampaignProgressComponent);

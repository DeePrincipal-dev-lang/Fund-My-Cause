/**
 * Campaign card data transformation.
 *
 * Every surface that renders a campaign summary card (funding progress,
 * raised/goal amounts, funded/ended state) was re-deriving the same handful
 * of values inline, each with its own date/number-formatting quirks. This
 * consolidates that transform into one function so the calculation lives in
 * exactly one place.
 */

import { calculateProgress, clampProgress, isProgressFunded } from "./progress";

export interface CampaignCardData {
  /** Amount raised so far, in whatever unit `formatAmount` expects. */
  raised: number;
  /** Funding goal, in the same unit as `raised`. */
  goal: number;
  /** Campaign deadline. Omit for campaigns that never end. */
  deadline?: string | number | Date;
}

export interface FormatCampaignCardOptions {
  /**
   * Formats a raw amount into display text, e.g. "15,400 XLM" or
   * "$2,156.00". Defaults to a locale-aware plain number.
   */
  formatAmount?: (amount: number) => string;
  /** Appended after the formatted raised amount, e.g. "raised". */
  raisedLabel?: string;
  /** Appended after the formatted goal amount, e.g. "goal". */
  goalLabel?: string;
  /** Current time in epoch ms, injectable so callers (and tests) aren't bound to wall-clock time. */
  now?: number;
}

export interface FormattedCampaignCard {
  /** Progress as a percentage of the goal. Not clamped — over-funded campaigns report values above 100. */
  percent: number;
  /** `percent` clamped to 0–100, ready to feed a progress bar. */
  displayPercent: number;
  /** True once the campaign has reached or passed its goal. */
  isFunded: boolean;
  /**
   * True when the deadline has passed and the goal was never met. A funded
   * campaign is never "ended" — funded takes precedence in the UI.
   */
  isEnded: boolean;
  /** Formatted raised amount, with `raisedLabel` appended when given. */
  raisedText: string;
  /** Formatted goal amount, with `goalLabel` appended when given. */
  goalText: string;
}

function defaultFormatAmount(amount: number): string {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Transforms raw campaign funding data into the display-ready values a card
 * needs — nothing here reaches into `window`/`document`, so it's as safe to
 * call during server rendering as on the client.
 *
 * @example
 * const { displayPercent, isFunded, raisedText, goalText } = formatCampaignCard(
 *   { raised: campaign.raised, goal: campaign.goal, deadline: campaign.deadline },
 *   { formatAmount: (n) => formatXlmWithUsd(n, xlmPrice), raisedLabel: "raised", goalLabel: "goal" },
 * );
 */
export function formatCampaignCard(
  data: CampaignCardData,
  options: FormatCampaignCardOptions = {},
): FormattedCampaignCard {
  const {
    formatAmount = defaultFormatAmount,
    raisedLabel,
    goalLabel,
    now = Date.now(),
  } = options;

  const percent = calculateProgress(data.raised, data.goal);
  const isFunded = isProgressFunded(percent);
  const deadlineMs =
    data.deadline === undefined ? NaN : new Date(data.deadline).getTime();
  const isEnded = !isFunded && !Number.isNaN(deadlineMs) && deadlineMs < now;

  const raisedAmount = formatAmount(data.raised);
  const goalAmount = formatAmount(data.goal);

  return {
    percent,
    displayPercent: clampProgress(percent),
    isFunded,
    isEnded,
    raisedText: raisedLabel ? `${raisedAmount} ${raisedLabel}` : raisedAmount,
    goalText: goalLabel ? `${goalAmount} ${goalLabel}` : goalAmount,
  };
}

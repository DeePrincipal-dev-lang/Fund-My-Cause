/**
 * Formatting helpers for campaign detail view.
 */

import { formatAddress } from "@fund-my-cause/shared-utils";

/**
 * Truncate a Stellar address for display.
 * Re-exports formatAddress from shared-utils with configurable start/end.
 */
export function truncateAddress(addr: string, start = 6, end = 4): string {
  return formatAddress(addr, start, end);
}

export function formatSocialLinkTitle(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

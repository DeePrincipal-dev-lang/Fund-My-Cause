/**
 * Centralized campaign date formatting utilities.
 * All formatting logic delegates to @fund-my-cause/shared-utils to ensure a
 * single source of truth for date/time formatting across the monorepo.
 */

import { formatLocalDate, formatLocalDateTime } from "@fund-my-cause/shared-utils";

/**
 * Format campaign deadline in short form (e.g., "Mar 19, 2026")
 * @param date - Date object or ISO string
 * @param locale - BCP-47 locale code (e.g., 'en-US')
 */
export function formatCampaignDateShort(
  date: Date | string,
  locale: string = "en-US",
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return formatLocalDate(dateObj, locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format campaign deadline in long form (e.g., "Wednesday, March 19, 2026")
 * @param date - Date object or ISO string
 * @param locale - BCP-47 locale code (e.g., 'en-US')
 */
export function formatCampaignDateLong(
  date: Date | string,
  locale: string = "en-US",
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return formatLocalDate(dateObj, locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    weekday: "long",
  });
}

/**
 * Format date with time (e.g., "Mar 19, 2026 at 3:45 PM")
 * @param date - Date object or ISO string
 * @param locale - BCP-47 locale code (e.g., 'en-US')
 */
export function formatCampaignDateTime(
  date: Date | string,
  locale: string = "en-US",
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const dateStr = formatLocalDate(dateObj, locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = formatLocalDate(dateObj, locale, {
    hour: "numeric",
    minute: "2-digit",
  } as Intl.DateTimeFormatOptions);
  // formatLocalDateTime gives "date, time" combined — we instead compose the
  // "at" separator manually so the output matches the expected display contract.
  void formatLocalDateTime; // imported for completeness; composed manually above
  return `${dateStr} at ${timeStr}`;
}

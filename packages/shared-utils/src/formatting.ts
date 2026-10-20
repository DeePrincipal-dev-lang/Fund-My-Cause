const STROOPS_PER_XLM = 10_000_000n;

// ── Locale Mapping ────────────────────────────────────────────────────────

const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  zh: "zh-CN",
  ar: "ar-SA",
  he: "he-IL",
};

const RTL_LOCALES = ["ar", "he"];

export function localeToIntlCode(locale: string): string {
  return LOCALE_MAP[locale] ?? locale;
}

function isRTLLocale(locale: string): boolean {
  return RTL_LOCALES.includes(locale);
}

// ── XLM Formatting ────────────────────────────────────────────────────────

/** "1,234.56 XLM" — uses locale-aware number formatting */
export function formatXLM(stroops: bigint, locale: string = "en"): string {
  const xlm = Number(stroops) / Number(STROOPS_PER_XLM);
  return `${xlm.toLocaleString(localeToIntlCode(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM`;
}

/** Locale-aware XLM amount formatter — returns a plain number string */
export function formatXLMAmount(
  stroops: bigint,
  locale: string = "en",
): string {
  const xlm = Number(stroops) / Number(STROOPS_PER_XLM);
  return xlm.toLocaleString(localeToIntlCode(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Currency Formatting ──────────────────────────────────────────────────

/** "$1,234.56" — uses locale-aware currency formatting */
export function formatUSD(amount: number, locale: string = "en"): string {
  return amount.toLocaleString(localeToIntlCode(locale), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format currency with locale and RTL support */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  const isRTL = isRTLLocale(locale);

  const formatted = new Intl.NumberFormat(intlCode, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  // For RTL locales, ensure proper directional formatting
  if (isRTL) {
    return `‮${formatted}‬`; // Explicit directional marks
  }
  return formatted;
}

/** Format currency with proper RTL placement */
export function formatCurrencyRTL(
  amount: number,
  currency: string = "USD",
  locale: string = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  const isRTL = isRTLLocale(locale);

  const parts = new Intl.NumberFormat(intlCode, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(amount);

  if (isRTL) {
    return parts.map((part) => part.value).join("");
  }

  return parts.map((part) => part.value).join("");
}

/** Get currency symbol correctly positioned for locales */
export function getCurrencySymbol(
  currency: string = "USD",
  locale: string = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  const parts = new Intl.NumberFormat(intlCode, {
    style: "currency",
    currency,
  }).formatToParts(0);

  const symbol = parts.find((part) => part.type === "currency")?.value || "";
  return symbol;
}

// ── Number Formatting ────────────────────────────────────────────────────

/** Format number with locale support */
export function formatNumber(
  value: number,
  locale: string = "en",
  options?: Intl.NumberFormatOptions,
): string {
  const intlCode = localeToIntlCode(locale);
  return new Intl.NumberFormat(intlCode, options).format(value);
}

/** Format compact number (e.g., "9,300+" → "9.3K" in some locales) */
export function formatCompactNumber(
  value: number,
  locale: string = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  return new Intl.NumberFormat(intlCode, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Format percentage with locale support */
export function formatPercentage(
  value: number,
  locale: string = "en",
  fractionDigits: number = 1,
): string {
  const intlCode = localeToIntlCode(locale);
  return new Intl.NumberFormat(intlCode, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

// ── Date Formatting ──────────────────────────────────────────────────────

/** "Mar 19, 2026" — uses locale-aware date formatting */
export function formatDate(timestamp: number, locale: string = "en"): string {
  return new Date(timestamp * 1000).toLocaleDateString(
    localeToIntlCode(locale),
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}

/** Format date with locale support */
export function formatLocalDate(
  date: Date | number,
  locale: string = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateObj = typeof date === "number" ? new Date(date * 1000) : date;
  const intlCode = localeToIntlCode(locale);
  return dateObj.toLocaleDateString(intlCode, options);
}

/** Format time with locale support */
export function formatLocalTime(
  date: Date | number,
  locale: string = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateObj = typeof date === "number" ? new Date(date * 1000) : date;
  const intlCode = localeToIntlCode(locale);
  return dateObj.toLocaleTimeString(intlCode, options);
}

/** Full locale-aware datetime string */
export function formatDateTime(
  timestamp: number,
  locale: string = "en",
): string {
  return new Date(timestamp * 1000).toLocaleString(localeToIntlCode(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Format datetime with locale support */
export function formatLocalDateTime(
  date: Date | number,
  locale: string = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateObj = typeof date === "number" ? new Date(date * 1000) : date;
  const intlCode = localeToIntlCode(locale);
  return dateObj.toLocaleString(intlCode, options);
}

/** "5d 3h 22m" or "Ended" — caller should use i18n for the "Ended" string */
export function formatTimeLeft(deadline: number): string {
  const diff = deadline * 1000 - Date.now();
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Relative Time Formatting ─────────────────────────────────────────────

/** Format relative time (e.g., "2 days ago") */
export function formatRelativeTime(
  pastDate: Date | number,
  locale: string = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  const now = new Date();
  const date =
    typeof pastDate === "number" ? new Date(pastDate * 1000) : pastDate;
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(intlCode, { numeric: "auto" });

  if (seconds < 60) return rtf.format(-seconds, "second");
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 604800) return rtf.format(-Math.floor(seconds / 86400), "day");
  return rtf.format(-Math.floor(seconds / 604800), "week");
}

// ── List Formatting ──────────────────────────────────────────────────────

/** Get list format for items (e.g., "a, b, and c") */
export function formatList(items: string[], locale: string = "en"): string {
  const intlCode = localeToIntlCode(locale);
  const formatter = new Intl.ListFormat(intlCode, {
    style: "long",
    type: "conjunction",
  });
  return formatter.format(items);
}

/** Format as short list (e.g., "a, b, c") */
export function formatListShort(
  items: string[],
  locale: string = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  const formatter = new Intl.ListFormat(intlCode, {
    style: "short",
    type: "conjunction",
  });
  return formatter.format(items);
}

// ── Address Formatting ───────────────────────────────────────────────────

/**
 * Truncate a Stellar address for display.
 *
 * @example
 * formatAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ") // "GABCD...WXYZ"
 * formatAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ", 6, 4) // "GABCDE...WXYZ"
 */
export function formatAddress(
  address: string,
  start: number = 5,
  end: number = 4,
): string {
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

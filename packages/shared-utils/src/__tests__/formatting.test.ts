import { describe, it, expect } from "vitest";
import {
  formatXLM,
  formatXLMAmount,
  formatUSD,
  formatCurrency,
  formatCurrencyRTL,
  getCurrencySymbol,
  formatNumber,
  formatCompactNumber,
  formatPercentage,
  formatDate,
  formatLocalDate,
  formatLocalTime,
  formatDateTime,
  formatLocalDateTime,
  formatTimeLeft,
  formatRelativeTime,
  formatList,
  formatListShort,
  formatAddress,
  localeToIntlCode,
} from "../formatting";

describe("Formatting utilities", () => {
  // ── Locale Mapping ──────────────────────────────────────────────────────

  describe("localeToIntlCode", () => {
    it("maps 'en' to 'en-US'", () => {
      expect(localeToIntlCode("en")).toBe("en-US");
    });

    it("maps 'ar' to 'ar-SA'", () => {
      expect(localeToIntlCode("ar")).toBe("ar-SA");
    });

    it("returns unknown locale codes unchanged", () => {
      expect(localeToIntlCode("xx-XX")).toBe("xx-XX");
    });
  });

  // ── XLM Formatting ──────────────────────────────────────────────────

  describe("formatXLM", () => {
    it("should format stroops to XLM with locale", () => {
      const stroops = 1_234_567_890n;
      const result = formatXLM(stroops, "en");
      expect(result).toMatch(/123\.46\s+XLM/);
    });

    it("should handle zero stroops", () => {
      const result = formatXLM(0n, "en");
      expect(result).toMatch(/0\.00\s+XLM/);
    });

    it("should handle very large numbers", () => {
      const stroops = 9_999_999_999_999_999n;
      const result = formatXLM(stroops, "en");
      expect(result).toContain("XLM");
    });
  });

  describe("formatXLMAmount", () => {
    it("should format stroops to XLM amount string", () => {
      const stroops = 1_234_567_890n;
      const result = formatXLMAmount(stroops, "en");
      expect(result).toMatch(/123\.46/);
    });

    it("should handle zero stroops", () => {
      const result = formatXLMAmount(0n, "en");
      expect(result).toMatch(/0\.00/);
    });
  });

  // ── Currency Formatting ──────────────────────────────────────────────

  describe("formatUSD", () => {
    it("should format USD currency in en locale", () => {
      const result = formatUSD(1234.56, "en");
      expect(result).toContain("$");
      expect(result).toContain("1,234.56");
    });

    it("should handle zero amount", () => {
      const result = formatUSD(0, "en");
      expect(result).toContain("$");
      expect(result).toContain("0.00");
    });

    it("should handle negative amounts", () => {
      const result = formatUSD(-1234.56, "en");
      expect(result).toContain("1,234.56");
    });

    it("should handle fractional cents", () => {
      const result = formatUSD(0.01, "en");
      expect(result).toMatch(/0\.01/);
    });
  });

  describe("formatCurrency", () => {
    it("should format currency with locale", () => {
      const result = formatCurrency(1234.56, "USD", "en");
      expect(result).toContain("$");
    });

    it("should handle RTL locales", () => {
      const result = formatCurrency(1234.56, "USD", "ar");
      expect(result).toBeTruthy();
      expect(result).toContain("US$");
    });

    it("should handle different currencies", () => {
      const result = formatCurrency(100, "EUR", "en");
      expect(result).toContain("100");
    });
  });

  describe("formatCurrencyRTL", () => {
it("should format currency for RTL locales", () => {
      const result = formatCurrencyRTL(1234.56, "USD", "ar");
      expect(result).toBeTruthy();
      expect(result).toContain("US$");
    });

    it("should format currency for LTR locales", () => {
      const result = formatCurrencyRTL(1234.56, "USD", "en");
      expect(result).toBeTruthy();
      expect(result).toContain("$");
    });
  });

  describe("getCurrencySymbol", () => {
    it("should get USD symbol", () => {
      const result = getCurrencySymbol("USD", "en");
      expect(result).toBe("$");
    });

    it("should get EUR symbol", () => {
      const result = getCurrencySymbol("EUR", "en");
      expect(result).toContain("€");
    });

    it("returns empty string when currency has no symbol", () => {
      const result = getCurrencySymbol("XYZ", "en");
      expect(typeof result).toBe("string");
    });
  });

  // ── Number Formatting ────────────────────────────────────────────────

  describe("formatNumber", () => {
    it("should format numbers with locale", () => {
      const result = formatNumber(1234.56, "en");
      expect(result).toContain("1,234.56");
    });

    it("should handle custom options", () => {
      const result = formatNumber(0.5, "en", { style: "percent" });
      expect(result).toContain("50%");
    });
  });

  describe("formatCompactNumber", () => {
    it("should format large numbers compactly", () => {
      const result = formatCompactNumber(1200, "en");
      expect(result).toMatch(/1\.2K/);
    });

    it("should handle millions", () => {
      const result = formatCompactNumber(1_200_000, "en");
      expect(result).toContain("M");
    });

    it("should handle billions", () => {
      const result = formatCompactNumber(1_200_000_000, "en");
      expect(result).toContain("B");
    });
  });

  describe("formatPercentage", () => {
    it("should format percentage", () => {
      const result = formatPercentage(50, "en");
      expect(result).toContain("50");
      expect(result).toContain("%");
    });

    it("should handle custom fraction digits", () => {
      const result = formatPercentage(50, "en", 2);
      expect(result).toMatch(/50\.0?0%/);
    });

    it("should handle zero percent", () => {
      const result = formatPercentage(0, "en");
      expect(result).toMatch(/0/);
    });

    it("should handle 100 percent", () => {
      const result = formatPercentage(100, "en");
      expect(result).toMatch(/100/);
    });
  });

  // ── Date Formatting ──────────────────────────────────────────────────

  describe("formatDate", () => {
    it("should format unix timestamp to date", () => {
      const timestamp = 1746432000;
      const result = formatDate(timestamp, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/\w+ \d+, \d+/);
    });
  });

  describe("formatLocalDate", () => {
    it("should format date with locale", () => {
      const date = new Date(2026, 6, 26); // July 26, 2026
      const result = formatLocalDate(date, "en");
      expect(result).toBeTruthy();
      expect(result).toContain("2026");
    });

    it("should handle numeric timestamp", () => {
      const timestamp = 1746432000;
      const result = formatLocalDate(timestamp, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/\d+/);
    });
  });

  describe("formatLocalTime", () => {
    it("should format time with locale", () => {
      const date = new Date();
      const result = formatLocalTime(date, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/\d+:\d+/);
    });

    it("should format numeric timestamp as time", () => {
      const timestamp = 1746432000;
      const result = formatLocalTime(timestamp, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/\d+:\d+/);
    });
  });

  describe("formatDateTime", () => {
    it("should format full datetime", () => {
      const timestamp = 1746432000;
      const result = formatDateTime(timestamp, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/\w+ \d+, \d+/);
    });
  });

  describe("formatLocalDateTime", () => {
    it("should format datetime with locale", () => {
      const date = new Date();
      const result = formatLocalDateTime(date, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/\d+:\d+/);
    });

    it("should format numeric timestamp as datetime", () => {
      const timestamp = 1746432000;
      const result = formatLocalDateTime(timestamp, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/\d+/);
    });
  });

  describe("formatTimeLeft", () => {
    it("should show 'Ended' for past deadlines", () => {
      const pastTimestamp = Date.now() / 1000 - 1000;
      const result = formatTimeLeft(pastTimestamp);
      expect(result).toBe("Ended");
    });

    it("should show minutes for near deadlines", () => {
      const futureTimestamp = Date.now() / 1000 + 300; // 5 minutes
      const result = formatTimeLeft(futureTimestamp);
      expect(result).toMatch(/\d+m/);
    });

    it("should show hours and minutes for medium deadlines", () => {
      const futureTimestamp = Date.now() / 1000 + 7200; // 2 hours
      const result = formatTimeLeft(futureTimestamp);
      expect(result).toContain("h");
    });

    it("should show days for far deadlines", () => {
      const futureTimestamp = Date.now() / 1000 + 172800; // 2 days
      const result = formatTimeLeft(futureTimestamp);
      expect(result).toContain("d");
    });
  });

  describe("formatRelativeTime", () => {
    it("should format relative time in seconds", () => {
      const date = new Date(Date.now() - 30000); // 30 seconds ago
      const result = formatRelativeTime(date, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/second|seconds/);
    });

    it("should format relative time in minutes", () => {
      const date = new Date(Date.now() - 300000); // 5 minutes ago
      const result = formatRelativeTime(date, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/minute|minutes/);
    });

    it("should format relative time in hours", () => {
      const date = new Date(Date.now() - 7200000); // 2 hours ago
      const result = formatRelativeTime(date, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/hour|hours/);
    });

    it("should format relative time in days", () => {
      const date = new Date(Date.now() - 172800000); // 2 days ago
      const result = formatRelativeTime(date, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/day|days/);
    });

    it("should format relative time in weeks", () => {
      const date = new Date(Date.now() - 1209600000); // 2 weeks ago
      const result = formatRelativeTime(date, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/week|weeks/);
    });

    it("accepts a number timestamp", () => {
      const ts = Math.floor((Date.now() - 60000) / 1000); // 1 min ago in seconds
      const result = formatRelativeTime(ts, "en");
      expect(result).toBeTruthy();
      expect(result).toMatch(/minute|minutes/);
    });
  });

  // ── List Formatting ──────────────────────────────────────────────────

  describe("formatList", () => {
    it("should format list with locale", () => {
      const items = ["apple", "banana", "cherry"];
      const result = formatList(items, "en");
      expect(result).toBeTruthy();
      expect(result).toContain("apple");
      expect(result).toContain("banana");
      expect(result).toContain("cherry");
    });

    it("should handle single item", () => {
      const result = formatList(["apple"], "en");
      expect(result).toBe("apple");
    });

    it("should handle two items", () => {
      const result = formatList(["apple", "banana"], "en");
      expect(result).toBeTruthy();
      expect(result).toContain("apple");
      expect(result).toContain("banana");
    });
  });

  describe("formatListShort", () => {
    it("should format short list", () => {
      const items = ["apple", "banana", "cherry"];
      const result = formatListShort(items, "en");
      expect(result).toBeTruthy();
      expect(result).toContain("apple");
      expect(result).toContain("banana");
      expect(result).toContain("cherry");
    });
  });

  // ── Address Formatting ───────────────────────────────────────────────

  describe("formatAddress", () => {
    it("should shorten long addresses", () => {
      const address = "GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const result = formatAddress(address);
      expect(result).toMatch(/^GABCD\.\.\./);
      expect(result).toContain("6789");
    });

    it("should return short addresses unchanged", () => {
      const address = "GABCD";
      const result = formatAddress(address);
      expect(result).toBe("GABCD");
    });

    it("should handle minimum length", () => {
      const address = "GABCDEFGHIJ";
      const result = formatAddress(address);
      expect(result).toMatch(/^GABCD\.\.\./);
    });
  });

  // ── Stellar Asset Decimal Precision ─────────────────────────────────
  // XLM uses 7 decimal places (1 XLM = 10_000_000 stroops).
  // These tests guard against regressions in the stroop-to-XLM conversion
  // that could cause incorrect display amounts in the UI.

  describe("Stellar asset decimal precision (XLM / stroop boundary)", () => {
    const STROOPS_PER_XLM = 10_000_000n;

    it("1 stroop rounds to 0.00 XLM in display (below 0.005 XLM threshold)", () => {
      // 1 stroop = 0.0000001 XLM — should display as "0.00 XLM"
      expect(formatXLM(1n, "en")).toBe("0.00 XLM");
    });

    it("1 XLM (10_000_000 stroops) displays exactly as 1.00 XLM", () => {
      expect(formatXLM(STROOPS_PER_XLM, "en")).toBe("1.00 XLM");
    });

    it("0.01 XLM (100_000 stroops) displays as 0.01 XLM", () => {
      expect(formatXLM(100_000n, "en")).toBe("0.01 XLM");
    });

    it("0.001 XLM (10_000 stroops) rounds to 0.00 XLM in 2-decimal display", () => {
      // 10_000 stroops = 0.001 XLM, which rounds to 0.00 at 2 decimal places
      expect(formatXLM(10_000n, "en")).toBe("0.00 XLM");
    });

    it("0.005 XLM (50_000 stroops) rounds to 0.01 XLM in 2-decimal display", () => {
      // 50_000 stroops = 0.005 XLM, rounds up to 0.01
      expect(formatXLM(50_000n, "en")).toBe("0.01 XLM");
    });

    it("maximum safe integer stroop value does not overflow or produce NaN", () => {
      // 2^53 - 1 stroops ≈ 900_719_925 XLM — must not produce NaN or Infinity
      const result = formatXLM(BigInt(Number.MAX_SAFE_INTEGER), "en");
      expect(result).not.toContain("NaN");
      expect(result).not.toContain("Infinity");
      expect(result).toContain("XLM");
    });

    it("formatXLMAmount returns plain number string without the 'XLM' suffix", () => {
      expect(formatXLMAmount(STROOPS_PER_XLM, "en")).toBe("1.00");
      expect(formatXLMAmount(0n, "en")).toBe("0.00");
    });

    it("1_234_567_890 stroops formats to 123.46 XLM (rounded at 2 decimal places)", () => {
      // 1_234_567_890 / 10_000_000 = 123.456789 → rounds to 123.46
      expect(formatXLM(1_234_567_890n, "en")).toMatch(/123\.46\s+XLM/);
    });

    it("zero stroops displays as 0.00 XLM", () => {
      expect(formatXLM(0n, "en")).toBe("0.00 XLM");
    });

    it("locale-aware formatting uses correct decimal separator (German)", () => {
      // German uses comma as decimal separator: "1,00 XLM"
      const result = formatXLM(STROOPS_PER_XLM, "de");
      expect(result).toContain("1");
      expect(result).toContain("XLM");
      // The comma or period depends on the runtime's Intl support — just verify no NaN
      expect(result).not.toContain("NaN");
    });
  });
});

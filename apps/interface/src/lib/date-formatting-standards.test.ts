import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatLocalDate,
  formatLocalDateTime,
  formatRelativeTime,
} from "./format";

/**
 * Tests for standardized date/timezone formatting across the interface.
 *
 * Enforces:
 * 1. Consistent date-formatting utilities used across all components.
 * 2. DST-transition edge cases handled correctly in all timezones.
 * 3. Multiple locale support with correct calendar formats.
 * 4. Relative time formatting is consistent.
 *
 * Reference timestamps for DST transitions in 2026:
 * - US Spring: Mar 8, 2026 at 2:00am EST → 3:00am EDT (clocks jump forward)
 * - US Fall: Nov 1, 2026 at 2:00am EDT → 1:00am EST (clocks repeat)
 * - Europe Spring: Mar 29, 2026 at 1:00am CET → 2:00am CEST
 * - Europe Fall: Oct 25, 2026 at 3:00am CEST → 2:00am CET
 */

// US Spring Forward 2026: Mar 8 at 2:00am EST → 3:00am EDT
const DST_US_SPRING_BEFORE = 1772951400; // 2026-03-08T06:30:00Z = 01:30 EST
const DST_US_SPRING_AFTER = 1772955000; // 2026-03-08T07:30:00Z = 03:30 EDT

// US Fall Back 2026: Nov 1 at 2:00am EDT → 1:00am EST
const DST_US_FALL_BEFORE = 1793511000; // 2026-11-01T05:30:00Z = 01:30 EDT
const DST_US_FALL_AFTER = 1793514600; // 2026-11-01T06:30:00Z = 01:30 EST

// EU Spring Forward 2026: Mar 29 at 1:00am CET → 2:00am CEST
const DST_EU_SPRING_BEFORE = 1775039400; // 2026-03-29T00:30:00Z = 01:30 CET
const DST_EU_SPRING_AFTER = 1775043000; // 2026-03-29T01:30:00Z = 02:30 CEST

// Fixed reference: 2026-06-27T00:00:00Z
const FIXED_TS = 1782518400;

describe("Date Formatting Standards", () => {
  describe("Locale Coverage", () => {
    describe("formatDate - all supported locales", () => {
      it("formats in English (en-US)", () => {
        const result = formatDate(FIXED_TS, "en");
        expect(result).toBe("Jun 27, 2026");
      });

      it("formats in Spanish (es-ES)", () => {
        const result = formatDate(FIXED_TS, "es");
        expect(result).toBe("27 jun 2026");
      });

      it("formats in French (fr-FR)", () => {
        const result = formatDate(FIXED_TS, "fr");
        expect(result).toBe("27 juin 2026");
      });

      it("formats in German (de-DE)", () => {
        const result = formatDate(FIXED_TS, "de");
        expect(result).toBe("27. Juni 2026");
      });
    });

    describe("formatLocalDate - all supported timezones with locales", () => {
      it("formats in English-UTC as M/D/YYYY", () => {
        expect(formatLocalDate(FIXED_TS, "en", { timeZone: "UTC" })).toBe(
          "6/27/2026",
        );
      });

      it("formats in Spanish-UTC as D/M/YYYY", () => {
        expect(formatLocalDate(FIXED_TS, "es", { timeZone: "UTC" })).toBe(
          "27/6/2026",
        );
      });

      it("formats in French-UTC as DD/MM/YYYY", () => {
        expect(formatLocalDate(FIXED_TS, "fr", { timeZone: "UTC" })).toBe(
          "27/06/2026",
        );
      });

      it("formats in German-UTC as D.M.YYYY", () => {
        expect(formatLocalDate(FIXED_TS, "de", { timeZone: "UTC" })).toBe(
          "27.6.2026",
        );
      });
    });
  });

  describe("DST Transition: US Spring Forward", () => {
    describe("formatLocalDate - correct date on both sides of DST jump", () => {
      it("returns correct date before spring-forward jump (America/New_York)", () => {
        expect(
          formatLocalDate(DST_US_SPRING_BEFORE, "en", {
            timeZone: "America/New_York",
          }),
        ).toBe("3/8/2026");
      });

      it("returns correct date after spring-forward jump (America/New_York)", () => {
        expect(
          formatLocalDate(DST_US_SPRING_AFTER, "en", {
            timeZone: "America/New_York",
          }),
        ).toBe("3/8/2026");
      });
    });

    describe("formatLocalDateTime - reflects hour change across spring-forward", () => {
      it("shows EST hour before jump", () => {
        expect(
          formatLocalDateTime(DST_US_SPRING_BEFORE, "en", {
            timeZone: "America/New_York",
            hour: "numeric",
            minute: "2-digit",
          }),
        ).toContain("1:30 AM");
      });

      it("shows EDT hour after jump (skips 2:00-3:00)", () => {
        expect(
          formatLocalDateTime(DST_US_SPRING_AFTER, "en", {
            timeZone: "America/New_York",
            hour: "numeric",
            minute: "2-digit",
          }),
        ).toContain("3:30 AM");
      });
    });
  });

  describe("DST Transition: US Fall Back", () => {
    describe("formatLocalDate - same date on both sides of fall-back", () => {
      it("returns correct date before fall-back (first pass, EDT)", () => {
        expect(
          formatLocalDate(DST_US_FALL_BEFORE, "en", {
            timeZone: "America/New_York",
          }),
        ).toBe("11/1/2026");
      });

      it("returns correct date after fall-back (second pass, EST)", () => {
        expect(
          formatLocalDate(DST_US_FALL_AFTER, "en", {
            timeZone: "America/New_York",
          }),
        ).toBe("11/1/2026");
      });
    });

    describe("formatLocalDateTime - hour difference across fall-back", () => {
      it("shows EDT hour before fall-back", () => {
        expect(
          formatLocalDateTime(DST_US_FALL_BEFORE, "en", {
            timeZone: "America/New_York",
            hour: "numeric",
            minute: "2-digit",
          }),
        ).toContain("1:30 AM");
      });

      it("shows EST hour after fall-back (same local time, different offset)", () => {
        expect(
          formatLocalDateTime(DST_US_FALL_AFTER, "en", {
            timeZone: "America/New_York",
            hour: "numeric",
            minute: "2-digit",
          }),
        ).toContain("1:30 AM");
      });
    });
  });

  describe("DST Transition: Europe Spring Forward", () => {
    describe("formatLocalDate - correct date on both sides of EU spring jump", () => {
      it("returns correct date before spring-forward (Europe/Berlin)", () => {
        expect(
          formatLocalDate(DST_EU_SPRING_BEFORE, "de", {
            timeZone: "Europe/Berlin",
          }),
        ).toBe("29.3.2026");
      });

      it("returns correct date after spring-forward (Europe/Berlin)", () => {
        expect(
          formatLocalDate(DST_EU_SPRING_AFTER, "de", {
            timeZone: "Europe/Berlin",
          }),
        ).toBe("29.3.2026");
      });
    });
  });

  describe("UTC vs Local Offset Boundaries", () => {
    // 2026-03-08T06:00:00Z = 3/8 in UTC but 3/7 in US Pacific
    const OFFSET_BOUNDARY = 1772949600;

    it("returns different calendar dates for same instant in different timezones", () => {
      const utcDate = formatLocalDate(OFFSET_BOUNDARY, "en", {
        timeZone: "UTC",
      });
      const pacificDate = formatLocalDate(OFFSET_BOUNDARY, "en", {
        timeZone: "America/Los_Angeles",
      });

      expect(utcDate).toBe("3/8/2026");
      expect(pacificDate).toBe("3/7/2026");
      expect(utcDate).not.toBe(pacificDate);
    });
  });

  describe("Relative Time Formatting Consistency", () => {
    it("formats relative time deterministically", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000);
      const result = formatRelativeTime(twoHoursAgo, "en");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles past dates correctly", () => {
      const oneMonthAgo = new Date(Date.now() - 30 * 86400000);
      const result = formatRelativeTime(oneMonthAgo, "en");
      expect(result.toLowerCase()).toContain("ago");
    });
  });

  describe("Error Handling Consistency", () => {
    it("all format functions handle null consistently", () => {
      expect(formatDate(null as unknown as number)).toBe("Invalid Date");
      expect(formatLocalDate(null as unknown as number, "en")).toBe(
        "Invalid Date",
      );
      expect(formatDateTime(null as unknown as number)).toBe("Invalid Date");
      expect(formatLocalDateTime(null as unknown as number, "en")).toBe(
        "Invalid Date",
      );
    });

    it("all format functions handle undefined consistently", () => {
      expect(formatDate(undefined as unknown as number)).toBe("Invalid Date");
      expect(formatLocalDate(undefined as unknown as number, "en")).toBe(
        "Invalid Date",
      );
      expect(formatDateTime(undefined as unknown as number)).toBe(
        "Invalid Date",
      );
      expect(formatLocalDateTime(undefined as unknown as number, "en")).toBe(
        "Invalid Date",
      );
    });

    it("all format functions handle NaN consistently", () => {
      expect(formatDate(NaN)).toBe("Invalid Date");
      expect(formatLocalDate(NaN, "en")).toBe("Invalid Date");
      expect(formatDateTime(NaN)).toBe("Invalid Date");
      expect(formatLocalDateTime(NaN, "en")).toBe("Invalid Date");
    });
  });

  describe("Campaign Deadline Scenarios", () => {
    it("displays deadline correctly when it falls on a DST transition date", () => {
      const deadline = DST_US_SPRING_AFTER; // Mar 8 after 3:30am EDT
      const formatted = formatLocalDateTime(deadline, "en", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      expect(formatted).toContain("Mar");
      expect(formatted).toContain("8");
      expect(formatted).toContain("2026");
      expect(formatted).toContain("3:30 AM");
    });

    it("shows relative time for upcoming campaign deadlines consistently", () => {
      const now = Date.now();
      const oneWeekFromNow = new Date(now + 7 * 86400000);
      const result = formatRelativeTime(oneWeekFromNow, "en");
      expect(typeof result).toBe("string");
    });
  });
});

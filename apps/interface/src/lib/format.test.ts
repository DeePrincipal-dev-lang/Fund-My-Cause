import {
  formatXLM,
  formatUSD,
  formatAddress,
  formatDate,
  formatDateTime,
  formatTimeLeft,
} from "./format";

// Fixed reference timestamp: 2026-06-27T00:00:00Z (unix seconds).
const FIXED_TS = 1782518400;

// US spring-forward 2026: clocks jump 2:00am -> 3:00am local on Mar 8
// (America/New_York). formatDate/formatDateTime take no timezone option,
// so these are evaluated in the test runner's ambient timezone (UTC),
// where the instants land on the same calendar day either side of the
// boundary. Genuine cross-timezone/DST-offset coverage — using an
// explicit `timeZone` option — lives in locale-formatting.test.ts for
// formatLocalDate/formatLocalDateTime.
const DST_SPRING_BEFORE = 1772951400; // 2026-03-08T06:30:00Z
const DST_SPRING_AFTER = 1772955000; // 2026-03-08T07:30:00Z

// US fall-back 2026: clocks repeat 1:00am-2:00am local on Nov 1 (America/New_York).
const DST_FALLBACK_BEFORE = 1793511000; // 2026-11-01T05:30:00Z
const DST_FALLBACK_AFTER = 1793514600; // 2026-11-01T06:30:00Z

describe("formatXLM", () => {
  it("converts stroops to XLM with comma separator", () => {
    expect(formatXLM(12345600000n)).toBe("1,234.56 XLM");
  });
  it("handles zero", () => {
    expect(formatXLM(0n)).toBe("0.00 XLM");
  });
});

describe("formatUSD", () => {
  it("formats with dollar sign and two decimals", () => {
    expect(formatUSD(1234.56)).toBe("$1,234.56");
  });
  it("handles zero", () => {
    expect(formatUSD(0)).toBe("$0.00");
  });
});

describe("formatAddress", () => {
  it("truncates long addresses with default parameters", () => {
    expect(formatAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe("GABCD...WXYZ");
  });
  it("returns short addresses unchanged", () => {
    expect(formatAddress("GABC")).toBe("GABC");
  });
  it("supports custom start/end parameters", () => {
    expect(formatAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ", 6, 4)).toBe(
      "GABCDE...WXYZ",
    );
  });
});

describe("formatDate", () => {
  it("formats a unix timestamp as a readable date", () => {
    // Use a known future timestamp: 2026-03-19T00:00:00Z = 1774137600
    const result = formatDate(1774137600);
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/2026/);
  });

  describe("locale coverage (fixed reference timestamp)", () => {
    it("formats in English", () => {
      expect(formatDate(FIXED_TS, "en")).toBe("Jun 27, 2026");
    });

    it("formats in Spanish", () => {
      expect(formatDate(FIXED_TS, "es")).toBe("27 jun 2026");
    });

    it("formats in French", () => {
      expect(formatDate(FIXED_TS, "fr")).toBe("27 juin 2026");
    });

    it("formats in German", () => {
      expect(formatDate(FIXED_TS, "de")).toBe("27. Juni 2026");
    });
  });

  describe("DST-boundary edge cases (fixed reference timestamps)", () => {
    it("formats correctly either side of the US spring-forward jump", () => {
      expect(formatDate(DST_SPRING_BEFORE)).toBe("Mar 8, 2026");
      expect(formatDate(DST_SPRING_AFTER)).toBe("Mar 8, 2026");
    });

    it("formats correctly either side of the US fall-back repeated hour", () => {
      expect(formatDate(DST_FALLBACK_BEFORE)).toBe("Nov 1, 2026");
      expect(formatDate(DST_FALLBACK_AFTER)).toBe("Nov 1, 2026");
    });
  });

  describe("invalid input", () => {
    it("does not throw for undefined and returns 'Invalid Date'", () => {
      expect(() => formatDate(undefined as unknown as number)).not.toThrow();
      expect(formatDate(undefined as unknown as number)).toBe("Invalid Date");
    });

    it("does not throw for NaN and returns 'Invalid Date'", () => {
      expect(() => formatDate(NaN)).not.toThrow();
      expect(formatDate(NaN)).toBe("Invalid Date");
    });

    it("does not throw for a malformed date string and returns 'Invalid Date'", () => {
      expect(() => formatDate("not-a-date" as unknown as number)).not.toThrow();
      expect(formatDate("not-a-date" as unknown as number)).toBe(
        "Invalid Date",
      );
    });

    it("does not throw for null (coerces to the unix epoch rather than failing)", () => {
      expect(() => formatDate(null as unknown as number)).not.toThrow();
      expect(formatDate(null as unknown as number)).toBe("Jan 1, 1970");
    });
  });
});

describe("formatDateTime", () => {
  describe("invalid input", () => {
    it("does not throw for undefined and returns 'Invalid Date'", () => {
      expect(() =>
        formatDateTime(undefined as unknown as number),
      ).not.toThrow();
      expect(formatDateTime(undefined as unknown as number)).toBe(
        "Invalid Date",
      );
    });

    it("does not throw for a malformed date string and returns 'Invalid Date'", () => {
      expect(() =>
        formatDateTime("not-a-date" as unknown as number),
      ).not.toThrow();
      expect(formatDateTime("not-a-date" as unknown as number)).toBe(
        "Invalid Date",
      );
    });
  });

  it("formats either side of the US spring-forward jump (fixed reference timestamps)", () => {
    expect(formatDateTime(DST_SPRING_BEFORE, "en")).toContain("6:30 AM");
    expect(formatDateTime(DST_SPRING_AFTER, "en")).toContain("7:30 AM");
  });
});

describe("formatTimeLeft", () => {
  it("returns 'Ended' for past deadlines", () => {
    expect(formatTimeLeft(Math.floor(Date.now() / 1000) - 100)).toBe("Ended");
  });
  it("shows days/hours/minutes for future deadlines", () => {
    const future =
      Math.floor(Date.now() / 1000) + 5 * 86400 + 3 * 3600 + 22 * 60;
    expect(formatTimeLeft(future)).toMatch(/\d+d \d+h \d+m/);
  });
  it("shows only hours and minutes when less than a day", () => {
    const future = Math.floor(Date.now() / 1000) + 3 * 3600 + 22 * 60;
    expect(formatTimeLeft(future)).toMatch(/^\d+h \d+m$/);
  });
});

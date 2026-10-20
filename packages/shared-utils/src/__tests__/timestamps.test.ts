import { describe, it, expect } from "vitest";
import {
  nowUtcIso,
  msToUtcIso,
  unixSecondsToUtcIso,
  bigintSecondsToUtcIso,
  normaliseToUtcIso,
  isUtcIsoString,
} from "../timestamps.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The known-good Unix-second timestamp 1 700 000 000 → 2023-11-14T22:13:20.000Z */
const KNOWN_SECONDS = 1_700_000_000;
const KNOWN_MS = KNOWN_SECONDS * 1000;
const KNOWN_ISO = "2023-11-14T22:13:20.000Z";

// ---------------------------------------------------------------------------
// nowUtcIso
// ---------------------------------------------------------------------------

describe("nowUtcIso", () => {
  it("returns a string ending with Z (UTC)", () => {
    const result = nowUtcIso();
    expect(result).toMatch(/Z$/);
  });

  it("returns a parseable date close to the current time", () => {
    const before = Date.now();
    const result = nowUtcIso();
    const after = Date.now();

    const ts = new Date(result).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// msToUtcIso
// ---------------------------------------------------------------------------

describe("msToUtcIso", () => {
  it("converts a known millisecond value to the expected UTC string", () => {
    expect(msToUtcIso(KNOWN_MS)).toBe(KNOWN_ISO);
  });

  it("is idempotent with itself when round-tripped through new Date()", () => {
    const iso = msToUtcIso(KNOWN_MS);
    expect(new Date(iso).getTime()).toBe(KNOWN_MS);
  });

  it("throws RangeError for Infinity", () => {
    expect(() => msToUtcIso(Infinity)).toThrow(RangeError);
  });

  it("throws RangeError for NaN", () => {
    expect(() => msToUtcIso(NaN)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// unixSecondsToUtcIso
// ---------------------------------------------------------------------------

describe("unixSecondsToUtcIso", () => {
  it("converts a known seconds value to the expected UTC string", () => {
    expect(unixSecondsToUtcIso(KNOWN_SECONDS)).toBe(KNOWN_ISO);
  });

  it("produces the same result as msToUtcIso(seconds * 1000)", () => {
    expect(unixSecondsToUtcIso(KNOWN_SECONDS)).toBe(msToUtcIso(KNOWN_MS));
  });

  it("throws RangeError for NaN", () => {
    expect(() => unixSecondsToUtcIso(NaN)).toThrow(RangeError);
  });

  // DST boundary test: 2024-03-10T07:00:00Z is the US DST spring-forward moment.
  // The UTC output should be unaffected by the DST transition regardless of the
  // server's local timezone.
  it("round-trips correctly across a DST boundary (2024-03-10 spring-forward)", () => {
    const dstBoundaryMs = new Date("2024-03-10T07:00:00.000Z").getTime();
    const dstBoundarySeconds = dstBoundaryMs / 1000;

    const result = unixSecondsToUtcIso(dstBoundarySeconds);
    expect(result).toBe("2024-03-10T07:00:00.000Z");
    expect(result.endsWith("Z")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// bigintSecondsToUtcIso
// ---------------------------------------------------------------------------

describe("bigintSecondsToUtcIso", () => {
  it("converts a known BigInt seconds value to the expected UTC string", () => {
    expect(bigintSecondsToUtcIso(BigInt(KNOWN_SECONDS))).toBe(KNOWN_ISO);
  });

  it("produces the same result as unixSecondsToUtcIso for the same value", () => {
    const n = 1_700_000_000n;
    expect(bigintSecondsToUtcIso(n)).toBe(unixSecondsToUtcIso(Number(n)));
  });

  it("throws RangeError for a value that overflows a safe JS number", () => {
    // Number.MAX_SAFE_INTEGER seconds × 1000 ms overflows MAX_SAFE_INTEGER
    const huge = BigInt(Number.MAX_SAFE_INTEGER) * 1000n;
    expect(() => bigintSecondsToUtcIso(huge)).toThrow(RangeError);
  });

  it("throws RangeError for Infinity result from bigint multiplication", () => {
    const veryLarge = BigInt(Number.MAX_VALUE) * 2n;
    expect(() => bigintSecondsToUtcIso(veryLarge)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// normaliseToUtcIso
// ---------------------------------------------------------------------------

describe("normaliseToUtcIso", () => {
  it("is idempotent on an already-UTC string", () => {
    const utc = "2024-01-15T12:00:00.000Z";
    expect(normaliseToUtcIso(utc)).toBe(utc);
  });

  it("converts a +02:00 offset string to the correct UTC value", () => {
    // 14:00 in +02:00 is 12:00 UTC
    expect(normaliseToUtcIso("2024-01-15T14:00:00+02:00")).toBe(
      "2024-01-15T12:00:00.000Z",
    );
  });

  it("converts a -05:00 offset string to the correct UTC value", () => {
    // 07:00 in -05:00 is 12:00 UTC
    expect(normaliseToUtcIso("2024-01-15T07:00:00-05:00")).toBe(
      "2024-01-15T12:00:00.000Z",
    );
  });

  it("throws TypeError for an unparseable string", () => {
    expect(() => normaliseToUtcIso("not-a-date")).toThrow(TypeError);
  });

  // DST boundary: verify the UTC value is stable when the local time is
  // ambiguous (fall-back) or skipped (spring-forward).
  it("round-trips correctly across DST fall-back (2024-11-03 US)", () => {
    // 06:30 UTC is before the US fall-back; the output must still be UTC.
    const result = normaliseToUtcIso("2024-11-03T06:30:00.000Z");
    expect(result).toBe("2024-11-03T06:30:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// isUtcIsoString
// ---------------------------------------------------------------------------

describe("isUtcIsoString", () => {
  it("returns true for a valid UTC ISO string", () => {
    expect(isUtcIsoString("2024-01-15T12:00:00.000Z")).toBe(true);
  });

  it("returns false for a string with a timezone offset", () => {
    expect(isUtcIsoString("2024-01-15T14:00:00+02:00")).toBe(false);
  });

  it("returns false for a plain date string without time", () => {
    expect(isUtcIsoString("2024-01-15")).toBe(false);
  });

  it("returns false for an invalid date string", () => {
    expect(isUtcIsoString("not-a-date")).toBe(false);
  });

  it("returns false for non-string inputs", () => {
    expect(isUtcIsoString(null)).toBe(false);
    expect(isUtcIsoString(undefined)).toBe(false);
    expect(isUtcIsoString(1700000000)).toBe(false);
    expect(isUtcIsoString({})).toBe(false);
  });
});

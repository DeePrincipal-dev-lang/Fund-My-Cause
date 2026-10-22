/**
 * Regression tests for timezone / locale handling in campaign deadlines (#1210).
 *
 * Campaign end-date logic spans three layers:
 *   1. `packages/shared-utils/src/timestamps.ts`   — raw conversion helpers
 *   2. `packages/shared-utils/src/campaign.ts`      — `isCampaignEnded`,
 *                                                      `getTimeRemaining`
 *   3. Any backend service that ingests a contract deadline as Unix seconds
 *      and surfaces it as a UTC ISO string.
 *
 * This file covers the timezone- and DST-sensitive edge cases that are most
 * likely to produce off-by-one bugs:
 *
 *   a) Deadline exactly at a DST spring-forward transition (US, 2024-03-10).
 *   b) Deadline exactly at a DST fall-back transition (US, 2024-11-03).
 *   c) Deadline represented as different timezone offsets that all resolve to
 *      the same UTC instant → `isCampaignEnded` must agree for all of them.
 *   d) Deadline supplied as a Unix-second integer (contract storage) vs. an
 *      ISO string vs. a millisecond timestamp → all three produce the same
 *      UTC instant via `unixSecondsToUtcIso` / `normaliseToUtcIso`.
 *   e) "Exactly at the deadline" boundary — the millisecond the deadline
 *      passes must flip `isCampaignEnded` from false to true.
 *   f) Frontend `getTimeRemaining` with a deadline that spans a DST
 *      boundary must never return a negative total.
 *
 * All tests inject a fixed `now` value so they are deterministic regardless
 * of the wall-clock time or the process's TZ environment variable.
 */

import { describe, it, expect } from "vitest";
import { isCampaignEnded, getTimeRemaining } from "../campaign.js";
import {
  unixSecondsToUtcIso,
  normaliseToUtcIso,
  isUtcIsoString,
  bigintSecondsToUtcIso,
  msToUtcIso,
} from "../timestamps.js";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/**
 * US Eastern DST spring-forward: clocks jump from 02:00 → 03:00 on
 * 2024-03-10.  The UTC equivalent of 07:00 UTC is 03:00 EST / 02:00 EST
 * (skipped hour).  We use 07:00 UTC as the reference point.
 */
const DST_SPRING_FORWARD_UTC_ISO = "2024-03-10T07:00:00.000Z";
const DST_SPRING_FORWARD_UTC_MS = new Date(
  DST_SPRING_FORWARD_UTC_ISO,
).getTime();

/**
 * US Eastern DST fall-back: clocks repeat 01:00–02:00 on 2024-11-03.
 * The UTC equivalent of 06:00 UTC is just inside the ambiguous local hour.
 */
const DST_FALL_BACK_UTC_ISO = "2024-11-03T06:00:00.000Z";
const DST_FALL_BACK_UTC_MS = new Date(DST_FALL_BACK_UTC_ISO).getTime();

/** An arbitrary "safe" campaign goal — only the deadline matters here. */
const GOAL = 10_000;
/** Never-funded raised amount — ensures funded status never short-circuits ended checks. */
const UNFUNDED_RAISED = 0;
/** Over-funded raised amount — ensures funded status always short-circuits ended checks. */
const OVERFUNDED_RAISED = 20_000;

// ---------------------------------------------------------------------------
// 1. DST spring-forward boundary
// ---------------------------------------------------------------------------

describe("#1210 — DST spring-forward boundary (2024-03-10T07:00:00Z)", () => {
  /**
   * At the spring-forward moment, local clocks in US/Eastern jump from
   * 02:00 → 03:00, skipping an entire hour.  Any deadline-evaluation code
   * that uses local time instead of UTC will produce incorrect results here.
   */

  it("deadline exactly at spring-forward instant: expired 1 ms after", () => {
    const deadline = DST_SPRING_FORWARD_UTC_ISO;
    // 1 ms after the deadline
    const now = DST_SPRING_FORWARD_UTC_MS + 1;
    expect(isCampaignEnded(deadline, UNFUNDED_RAISED, GOAL, now)).toBe(true);
  });

  it("deadline exactly at spring-forward instant: NOT expired 1 ms before", () => {
    const deadline = DST_SPRING_FORWARD_UTC_ISO;
    const now = DST_SPRING_FORWARD_UTC_MS - 1;
    expect(isCampaignEnded(deadline, UNFUNDED_RAISED, GOAL, now)).toBe(false);
  });

  it("getTimeRemaining returns zero total exactly at spring-forward deadline", () => {
    const deadline = DST_SPRING_FORWARD_UTC_ISO;
    // now == deadline → expired
    const tr = getTimeRemaining(deadline, DST_SPRING_FORWARD_UTC_MS);
    expect(tr.expired).toBe(true);
    expect(tr.total).toBe(0);
  });

  it("getTimeRemaining total is non-negative 30 min before spring-forward", () => {
    const deadline = DST_SPRING_FORWARD_UTC_ISO;
    const now = DST_SPRING_FORWARD_UTC_MS - 30 * 60 * 1000; // exactly 30 min before
    const tr = getTimeRemaining(deadline, now);
    expect(tr.expired).toBe(false);
    expect(tr.total).toBeGreaterThan(0);
    // 30 * 60 * 1000 ms remaining → 0 hours, 30 minutes, 0 seconds
    expect(tr.hours).toBe(0);
    expect(tr.minutes).toBe(30);
    expect(tr.seconds).toBe(0);
  });

  it("a deadline expressed in EST−5 equals the same UTC instant", () => {
    // 2024-03-10T02:00:00−05:00 is 07:00 UTC — the spring-forward moment.
    const estString = "2024-03-10T02:00:00-05:00";
    const utcNorm = normaliseToUtcIso(estString);
    expect(utcNorm).toBe(DST_SPRING_FORWARD_UTC_ISO);
    // Both representations must produce the same isCampaignEnded result.
    const now = DST_SPRING_FORWARD_UTC_MS + 1;
    expect(isCampaignEnded(estString, UNFUNDED_RAISED, GOAL, now)).toBe(
      isCampaignEnded(DST_SPRING_FORWARD_UTC_ISO, UNFUNDED_RAISED, GOAL, now),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. DST fall-back boundary
// ---------------------------------------------------------------------------

describe("#1210 — DST fall-back boundary (2024-11-03T06:00:00Z)", () => {
  /**
   * At fall-back, local clocks repeat 01:00–02:00 in US/Eastern.  Any
   * deadline stored as a local time string is ambiguous during this window.
   * The UTC representation is the single unambiguous source of truth.
   */

  it("deadline exactly at fall-back instant: expired 1 ms after", () => {
    const deadline = DST_FALL_BACK_UTC_ISO;
    const now = DST_FALL_BACK_UTC_MS + 1;
    expect(isCampaignEnded(deadline, UNFUNDED_RAISED, GOAL, now)).toBe(true);
  });

  it("deadline exactly at fall-back instant: NOT expired 1 ms before", () => {
    const deadline = DST_FALL_BACK_UTC_ISO;
    const now = DST_FALL_BACK_UTC_MS - 1;
    expect(isCampaignEnded(deadline, UNFUNDED_RAISED, GOAL, now)).toBe(false);
  });

  it("getTimeRemaining stays non-negative during ambiguous local hour", () => {
    const deadline = DST_FALL_BACK_UTC_ISO;
    // 30 minutes before fall-back — still active
    const now = DST_FALL_BACK_UTC_MS - 30 * 60 * 1000;
    const tr = getTimeRemaining(deadline, now);
    expect(tr.expired).toBe(false);
    expect(tr.total).toBeGreaterThan(0);
  });

  it("getTimeRemaining expired after fall-back moment", () => {
    const deadline = DST_FALL_BACK_UTC_ISO;
    // 1 hour after fall-back
    const now = DST_FALL_BACK_UTC_MS + 60 * 60 * 1000;
    const tr = getTimeRemaining(deadline, now);
    expect(tr.expired).toBe(true);
    expect(tr.total).toBe(0);
    expect(tr.days).toBe(0);
    expect(tr.hours).toBe(0);
    expect(tr.minutes).toBe(0);
    expect(tr.seconds).toBe(0);
  });

  it("two fall-back-time representations with different offsets resolve to same UTC", () => {
    // Both are 06:00 UTC
    const withOffsetA = "2024-11-03T01:00:00-05:00"; // after clocks fell back (EDT→EST)
    const withOffsetB = "2024-11-03T02:00:00-04:00"; // before fall-back (EDT)
    const utcA = normaliseToUtcIso(withOffsetA);
    const utcB = normaliseToUtcIso(withOffsetB);
    expect(utcA).toBe(utcB);
    expect(utcA).toBe(DST_FALL_BACK_UTC_ISO);
  });
});

// ---------------------------------------------------------------------------
// 3. Multiple timezone representations of the same deadline instant
// ---------------------------------------------------------------------------

describe("#1210 — Timezone offset consistency", () => {
  /**
   * The same logical deadline must produce identical `isCampaignEnded` and
   * `getTimeRemaining` results regardless of how the caller represents it.
   */

  // Canonical UTC deadline: 2025-06-15T18:00:00.000Z
  const CANONICAL_UTC = "2025-06-15T18:00:00.000Z";
  const CANONICAL_MS = new Date(CANONICAL_UTC).getTime();

  const equivalentRepresentations = [
    CANONICAL_UTC, // already UTC
    "2025-06-15T20:00:00+02:00", // CEST +2
    "2025-06-15T14:00:00-04:00", // EDT -4
    "2025-06-16T04:00:00+10:00", // AEST +10 (crosses midnight locally)
    "2025-06-15T18:00:00.000+00:00", // explicit +00:00 offset
  ];

  it("all timezone representations normalise to the same UTC string", () => {
    for (const repr of equivalentRepresentations) {
      const normalised = normaliseToUtcIso(repr);
      expect(normalised).toBe(CANONICAL_UTC, `Failed for input: ${repr}`);
    }
  });

  it("isCampaignEnded is identical for all timezone representations (not expired)", () => {
    // 1 hour before deadline
    const now = CANONICAL_MS - 60 * 60 * 1000;
    const results = equivalentRepresentations.map((repr) =>
      isCampaignEnded(repr, UNFUNDED_RAISED, GOAL, now),
    );
    expect(results.every((r) => r === false)).toBe(true);
  });

  it("isCampaignEnded is identical for all timezone representations (expired)", () => {
    // 1 hour after deadline
    const now = CANONICAL_MS + 60 * 60 * 1000;
    const results = equivalentRepresentations.map((repr) =>
      isCampaignEnded(repr, UNFUNDED_RAISED, GOAL, now),
    );
    expect(results.every((r) => r === true)).toBe(true);
  });

  it("getTimeRemaining total is identical for all equivalent representations", () => {
    const now = CANONICAL_MS - 2 * 60 * 60 * 1000; // 2 hours before
    const totals = equivalentRepresentations.map(
      (repr) => getTimeRemaining(repr, now).total,
    );
    // All totals must be the same value
    const first = totals[0]!;
    for (const t of totals) {
      expect(t).toBe(first);
    }
  });

  it("getTimeRemaining produces a UTC Z-string when deadline is ISO with offset", () => {
    // normaliseToUtcIso must always yield a Z-suffixed string.
    for (const repr of equivalentRepresentations) {
      const utc = normaliseToUtcIso(repr);
      expect(isUtcIsoString(utc)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Contract deadline format consistency
//    (Unix-seconds → UTC string → campaign evaluation)
// ---------------------------------------------------------------------------

describe("#1210 — Contract deadline format (Unix seconds) consistency", () => {
  /**
   * Soroban contract storage returns deadlines as u64 Unix seconds.
   * The indexer converts them via `unixSecondsToUtcIso` (number) or
   * `bigintSecondsToUtcIso` (BigInt).  This suite verifies that all three
   * ingestion paths produce identical campaign evaluation outcomes.
   */

  // Deadline: 2025-09-01T00:00:00.000Z  →  Unix seconds 1756684800
  const DEADLINE_UNIX_SECONDS = 1_756_684_800;
  const DEADLINE_UTC_ISO = "2025-09-01T00:00:00.000Z";
  const DEADLINE_MS = DEADLINE_UNIX_SECONDS * 1000;

  it("unixSecondsToUtcIso matches the known ISO for this deadline", () => {
    expect(unixSecondsToUtcIso(DEADLINE_UNIX_SECONDS)).toBe(DEADLINE_UTC_ISO);
  });

  it("bigintSecondsToUtcIso matches the same deadline", () => {
    expect(bigintSecondsToUtcIso(BigInt(DEADLINE_UNIX_SECONDS))).toBe(
      DEADLINE_UTC_ISO,
    );
  });

  it("msToUtcIso(seconds * 1000) matches the same deadline", () => {
    expect(msToUtcIso(DEADLINE_MS)).toBe(DEADLINE_UTC_ISO);
  });

  it("isCampaignEnded is consistent whether deadline supplied as seconds or ISO string", () => {
    const now = DEADLINE_MS + 1; // just expired
    const endedFromSeconds = isCampaignEnded(
      DEADLINE_UNIX_SECONDS, // number — passed directly (Date constructor handles it)
      UNFUNDED_RAISED,
      GOAL,
      now,
    );
    const endedFromIso = isCampaignEnded(
      DEADLINE_UTC_ISO,
      UNFUNDED_RAISED,
      GOAL,
      now,
    );
    expect(endedFromSeconds).toBe(true);
    expect(endedFromIso).toBe(true);
    expect(endedFromSeconds).toBe(endedFromIso);
  });

  it("isCampaignEnded is consistent whether deadline supplied as ms or ISO string", () => {
    const now = DEADLINE_MS - 1; // not yet expired
    const endedFromMs = isCampaignEnded(
      DEADLINE_MS,
      UNFUNDED_RAISED,
      GOAL,
      now,
    );
    const endedFromIso = isCampaignEnded(
      DEADLINE_UTC_ISO,
      UNFUNDED_RAISED,
      GOAL,
      now,
    );
    expect(endedFromMs).toBe(false);
    expect(endedFromIso).toBe(false);
  });

  it("getTimeRemaining is identical for deadline as ms vs ISO string", () => {
    const now = DEADLINE_MS - 30 * 60 * 1000; // 30 min before
    const trMs = getTimeRemaining(DEADLINE_MS, now);
    const trIso = getTimeRemaining(DEADLINE_UTC_ISO, now);
    expect(trMs.total).toBe(trIso.total);
    expect(trMs.expired).toBe(trIso.expired);
    expect(trMs.hours).toBe(trIso.hours);
    expect(trMs.minutes).toBe(trIso.minutes);
  });
});

// ---------------------------------------------------------------------------
// 5. Exact deadline boundary — millisecond precision
// ---------------------------------------------------------------------------

describe("#1210 — Exact deadline boundary (millisecond precision)", () => {
  /**
   * `isCampaignEnded` uses a strict `<` comparison: the deadline instant
   * itself is the last moment the campaign is live.
   *
   * Contract:
   *   now <  deadline  →  NOT ended  (false)
   *   now == deadline  →  NOT ended  (false)  — campaign is still alive at this instant
   *   now >  deadline  →  ended      (true)
   */
  const DEADLINE = "2025-04-01T12:00:00.000Z";
  const DEADLINE_MS = new Date(DEADLINE).getTime();

  it("NOT ended when now < deadline by 1 ms", () => {
    expect(
      isCampaignEnded(DEADLINE, UNFUNDED_RAISED, GOAL, DEADLINE_MS - 1),
    ).toBe(false);
  });

  it("NOT ended when now === deadline (boundary — still live)", () => {
    expect(isCampaignEnded(DEADLINE, UNFUNDED_RAISED, GOAL, DEADLINE_MS)).toBe(
      false,
    );
  });

  it("ended when now > deadline by 1 ms", () => {
    expect(
      isCampaignEnded(DEADLINE, UNFUNDED_RAISED, GOAL, DEADLINE_MS + 1),
    ).toBe(true);
  });

  it("getTimeRemaining total === 0 and expired === true at deadline", () => {
    const tr = getTimeRemaining(DEADLINE, DEADLINE_MS);
    expect(tr.expired).toBe(true);
    expect(tr.total).toBe(0);
  });

  it("getTimeRemaining total is exactly 1 when 1 ms remains", () => {
    const tr = getTimeRemaining(DEADLINE, DEADLINE_MS - 1);
    expect(tr.expired).toBe(false);
    expect(tr.total).toBe(1);
    expect(tr.seconds).toBe(0); // < 1 second, floor → 0
  });

  it("getTimeRemaining total is never negative after expiry", () => {
    // 1 week after deadline
    const far_future = DEADLINE_MS + 7 * 24 * 60 * 60 * 1000;
    const tr = getTimeRemaining(DEADLINE, far_future);
    expect(tr.expired).toBe(true);
    expect(tr.total).toBe(0);
    expect(tr.days).toBe(0);
    expect(tr.hours).toBe(0);
    expect(tr.minutes).toBe(0);
    expect(tr.seconds).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Funded campaigns are never "ended"
// ---------------------------------------------------------------------------

describe("#1210 — Funded campaigns are never considered ended", () => {
  /**
   * `isCampaignEnded` must return false when the goal is met, even if the
   * deadline has long passed.  Funding status takes precedence.
   */
  const DEADLINE = "2024-01-01T00:00:00.000Z"; // well in the past
  const FAR_FUTURE_NOW = new Date("2030-01-01T00:00:00.000Z").getTime();

  it("funded campaign after deadline is NOT ended", () => {
    expect(
      isCampaignEnded(DEADLINE, OVERFUNDED_RAISED, GOAL, FAR_FUTURE_NOW),
    ).toBe(false);
  });

  it("exactly at 100 % funded: NOT ended even if deadline passed", () => {
    expect(isCampaignEnded(DEADLINE, GOAL, GOAL, FAR_FUTURE_NOW)).toBe(false);
  });

  it("1 stroop below goal after deadline: IS ended", () => {
    // raised = goal - 1 → not funded
    expect(isCampaignEnded(DEADLINE, GOAL - 1, GOAL, FAR_FUTURE_NOW)).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Cross-layer consistency: unixSecondsToUtcIso → normaliseToUtcIso
// ---------------------------------------------------------------------------

describe("#1210 — Cross-layer consistency: contract deadline round-trip", () => {
  /**
   * Simulate the full data path a campaign deadline travels:
   *
   *   Soroban contract (u64 Unix seconds)
   *     → indexer parses: `unixSecondsToUtcIso(seconds)`
   *     → stored as UTC ISO string in indexed state
   *     → frontend receives ISO string
   *     → `normaliseToUtcIso(isoString)` (sanity-check pass)
   *     → `isCampaignEnded(isoString, ...)` / `getTimeRemaining(isoString, ...)`
   *
   * The round-trip must be lossless: each conversion must yield the same
   * number of milliseconds since epoch.
   */

  const testCases: Array<{ label: string; unix: number; expected: string }> = [
    {
      label: "end of 2025",
      unix: 1_767_225_599, // 2025-12-31T23:59:59.000Z
      expected: "2025-12-31T23:59:59.000Z",
    },
    {
      label: "year 2000 (Y2K reference)",
      unix: 946_684_800, // 2000-01-01T00:00:00.000Z
      expected: "2000-01-01T00:00:00.000Z",
    },
    {
      label: "exactly midnight UTC",
      unix: 1_700_352_000, // 2023-11-19T00:00:00.000Z
      expected: "2023-11-19T00:00:00.000Z",
    },
    {
      label: "US DST spring-forward instant",
      unix: DST_SPRING_FORWARD_UTC_MS / 1000,
      expected: DST_SPRING_FORWARD_UTC_ISO,
    },
    {
      label: "US DST fall-back instant",
      unix: DST_FALL_BACK_UTC_MS / 1000,
      expected: DST_FALL_BACK_UTC_ISO,
    },
  ];

  for (const { label, unix, expected } of testCases) {
    it(`round-trip is lossless: ${label}`, () => {
      // Step 1: indexer conversion
      const fromContract = unixSecondsToUtcIso(unix);
      expect(fromContract).toBe(expected);

      // Step 2: normalise (frontend sanity pass — must be idempotent)
      const normalised = normaliseToUtcIso(fromContract);
      expect(normalised).toBe(expected);

      // Step 3: both forms must agree on campaign-ended status
      const nowBefore = new Date(expected).getTime() - 1;
      const nowAfter = new Date(expected).getTime() + 1;

      expect(
        isCampaignEnded(fromContract, UNFUNDED_RAISED, GOAL, nowBefore),
      ).toBe(false);
      expect(
        isCampaignEnded(normalised, UNFUNDED_RAISED, GOAL, nowBefore),
      ).toBe(false);

      expect(
        isCampaignEnded(fromContract, UNFUNDED_RAISED, GOAL, nowAfter),
      ).toBe(true);
      expect(isCampaignEnded(normalised, UNFUNDED_RAISED, GOAL, nowAfter)).toBe(
        true,
      );
    });
  }

  it("isUtcIsoString returns true for every output of unixSecondsToUtcIso", () => {
    for (const { unix } of testCases) {
      const iso = unixSecondsToUtcIso(unix);
      expect(isUtcIsoString(iso)).toBe(true);
    }
  });
});

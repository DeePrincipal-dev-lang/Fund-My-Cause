/**
 * Unit tests for packages/shared-utils/src/trace.ts
 *
 * Validates:
 * - isValidTraceId() against the shared cross-language fixture file
 * - generateTraceId() produces compliant IDs
 * - resolveTraceId() extracts / falls back as documented
 *
 * Shared fixture: fixtures/trace-id-fixtures.json
 * The same fixture file is consumed by the Python test suite
 * (backend/fraud_detection/stages/tests_trace_id.py).  Any mismatch in
 * acceptance/rejection between the two suites signals implementation drift.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TRACE_ID_HEADER,
  generateTraceId,
  isValidTraceId,
  resolveTraceId,
} from "../trace";

// ---------------------------------------------------------------------------
// Load the shared cross-language fixture file.
// This file lives at: <repo-root>/fixtures/trace-id-fixtures.json
// ---------------------------------------------------------------------------
const FIXTURE_PATH = resolve(
  __dirname,
  "../../../../fixtures/trace-id-fixtures.json",
);

interface TraceIdFixtures {
  valid: string[];
  invalid: string[];
}

const fixtures: TraceIdFixtures = JSON.parse(
  readFileSync(FIXTURE_PATH, "utf-8"),
) as TraceIdFixtures;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe("TRACE_ID_HEADER", () => {
  it("is the canonical lowercase header name", () => {
    expect(TRACE_ID_HEADER).toBe("x-trace-id");
  });
});

// ---------------------------------------------------------------------------
// isValidTraceId — cross-language fixtures
// ---------------------------------------------------------------------------
describe("isValidTraceId", () => {
  it.each(fixtures.valid)(
    "accepts valid ID: %s",
    (id) => {
      expect(isValidTraceId(id)).toBe(true);
    },
  );

  it.each(fixtures.invalid)(
    "rejects invalid ID: %s",
    (id) => {
      expect(isValidTraceId(id)).toBe(false);
    },
  );

  it("rejects non-string values", () => {
    expect(isValidTraceId(null)).toBe(false);
    expect(isValidTraceId(undefined)).toBe(false);
    expect(isValidTraceId(42)).toBe(false);
    expect(isValidTraceId({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateTraceId
// ---------------------------------------------------------------------------
describe("generateTraceId", () => {
  it("produces a string that passes isValidTraceId", () => {
    const id = generateTraceId();
    expect(isValidTraceId(id)).toBe(true);
  });

  it("produces the correct structural format", () => {
    const id = generateTraceId();
    expect(id).toMatch(/^fmc-[0-9a-f]{8}-[0-9a-f]{16}$/);
  });

  it("has total length of 28 characters", () => {
    expect(generateTraceId()).toHaveLength(28);
  });

  it("generates unique IDs on successive calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateTraceId()));
    expect(ids.size).toBe(20);
  });

  it("embeds a recent Unix timestamp (within 2 seconds)", () => {
    const before = Math.floor(Date.now() / 1000);
    const id = generateTraceId();
    const after = Math.floor(Date.now() / 1000);
    const tsHex = id.split("-")[1];
    const ts = parseInt(tsHex, 16);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 1);
  });

  it("uses only lowercase hex characters", () => {
    const id = generateTraceId();
    expect(id).toBe(id.toLowerCase());
  });
});

// ---------------------------------------------------------------------------
// resolveTraceId
// ---------------------------------------------------------------------------
describe("resolveTraceId", () => {
  it("returns the header value when it is a valid trace ID", () => {
    const validId = "fmc-67946a1b-3f8c2a0d9e4b71c2";
    const result = resolveTraceId({ "x-trace-id": validId });
    expect(result).toBe(validId);
  });

  it("generates a fresh ID when header is absent", () => {
    const result = resolveTraceId({});
    expect(isValidTraceId(result)).toBe(true);
  });

  it("generates a fresh ID when header is malformed", () => {
    const result = resolveTraceId({ "x-trace-id": "not-a-trace-id" });
    expect(isValidTraceId(result)).toBe(true);
  });

  it("generates a fresh ID when header is an empty string", () => {
    const result = resolveTraceId({ "x-trace-id": "" });
    expect(isValidTraceId(result)).toBe(true);
  });

  it("handles an array header value (takes the first element)", () => {
    const validId = "fmc-deadbeef-cafebabe12345678";
    const result = resolveTraceId({ "x-trace-id": [validId, "other"] });
    expect(result).toBe(validId);
  });

  it("generates a fresh ID when array header element is malformed", () => {
    const result = resolveTraceId({ "x-trace-id": ["BAD-ID"] });
    expect(isValidTraceId(result)).toBe(true);
  });

  it("each generated fallback passes the shared fixture invalid list", () => {
    // None of the fixtures['invalid'] values should slip through as "valid"
    for (const invalid of fixtures.invalid) {
      const result = resolveTraceId({ "x-trace-id": invalid });
      // The result must be a freshly generated (valid) ID, not the invalid input
      expect(isValidTraceId(result)).toBe(true);
      expect(result).not.toBe(invalid);
    }
  });
});

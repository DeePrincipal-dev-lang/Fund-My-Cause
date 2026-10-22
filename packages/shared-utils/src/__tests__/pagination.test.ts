/**
 * Unit tests for packages/shared-utils/src/pagination.ts
 *
 * Coverage:
 *  - encodeCursor / decodeCursor round-trip
 *  - decodeCursor rejects invalid input (CursorDecodeError)
 *  - resolvePaginationArgs defaults and clamping
 *  - resolvePaginationArgs: after cursor overrides offset
 *  - buildConnection — full page, empty page, single page, last page
 *  - buildConnection hasNextPage / hasPreviousPage correctness
 *  - buildPage mirrors buildConnection for REST callers
 */

import { describe, it, expect } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  resolvePaginationArgs,
  buildConnection,
  buildPage,
  CursorDecodeError,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../pagination.js";

// ── encodeCursor / decodeCursor ───────────────────────────────────────────────

describe("encodeCursor", () => {
  it("encodes 0 to a non-empty string", () => {
    expect(encodeCursor(0)).toBeTruthy();
  });

  it("encodes different offsets to different cursors", () => {
    expect(encodeCursor(0)).not.toBe(encodeCursor(1));
    expect(encodeCursor(19)).not.toBe(encodeCursor(20));
  });

  it("clamps negative offsets to 0", () => {
    expect(encodeCursor(-5)).toBe(encodeCursor(0));
  });

  it("floors fractional offsets", () => {
    expect(encodeCursor(2.9)).toBe(encodeCursor(2));
  });
});

describe("decodeCursor", () => {
  it("round-trips offset 0", () => {
    expect(decodeCursor(encodeCursor(0))).toBe(0);
  });

  it("round-trips offset 40", () => {
    expect(decodeCursor(encodeCursor(40))).toBe(40);
  });

  it("round-trips large offsets", () => {
    expect(decodeCursor(encodeCursor(9999))).toBe(9999);
  });

  it("throws CursorDecodeError for random base64 strings", () => {
    expect(() => decodeCursor("abc")).toThrow(CursorDecodeError);
  });

  it("throws CursorDecodeError for non-integer base64", () => {
    // base64("3.7") → looks numeric but fails integer check
    const b64float = Buffer.from("3.7").toString("base64");
    expect(() => decodeCursor(b64float)).toThrow(CursorDecodeError);
  });

  it("throws CursorDecodeError for empty string", () => {
    expect(() => decodeCursor("")).toThrow(CursorDecodeError);
  });

  it("clamps decoded negative offset to 0 (edge case: encoded -1)", () => {
    const negativeCursor = Buffer.from("-1").toString("base64");
    // -1 decodes as -1 → clamped to 0
    expect(decodeCursor(negativeCursor)).toBe(0);
  });
});

// ── resolvePaginationArgs ─────────────────────────────────────────────────────

describe("resolvePaginationArgs", () => {
  it("returns defaults when called with no args", () => {
    const { limit, offset } = resolvePaginationArgs();
    expect(limit).toBe(DEFAULT_PAGE_SIZE);
    expect(offset).toBe(0);
  });

  it("respects explicit limit and offset", () => {
    const { limit, offset } = resolvePaginationArgs({ limit: 10, offset: 5 });
    expect(limit).toBe(10);
    expect(offset).toBe(5);
  });

  it("clamps limit to MAX_PAGE_SIZE", () => {
    const { limit } = resolvePaginationArgs({ limit: MAX_PAGE_SIZE + 500 });
    expect(limit).toBe(MAX_PAGE_SIZE);
  });

  it("clamps limit to minimum 1", () => {
    const { limit } = resolvePaginationArgs({ limit: 0 });
    expect(limit).toBe(1);
  });

  it("clamps negative offset to 0", () => {
    const { offset } = resolvePaginationArgs({ offset: -10 });
    expect(offset).toBe(0);
  });

  it("after cursor overrides offset", () => {
    const cursor = encodeCursor(60);
    const { offset } = resolvePaginationArgs({ offset: 0, after: cursor });
    expect(offset).toBe(60);
  });

  it("throws CursorDecodeError for invalid after cursor", () => {
    expect(() => resolvePaginationArgs({ after: "!!!invalid!!!" })).toThrow(
      CursorDecodeError,
    );
  });
});

// ── buildConnection ───────────────────────────────────────────────────────────

describe("buildConnection", () => {
  const items = ["a", "b", "c"];

  it("returns the correct number of edges", () => {
    const conn = buildConnection(items, 0, 3, 10);
    expect(conn.edges).toHaveLength(3);
  });

  it("wraps each item as a node", () => {
    const conn = buildConnection(items, 0, 3, 10);
    expect(conn.edges.map((e) => e.node)).toEqual(items);
  });

  it("encodes cursors based on offset position", () => {
    const conn = buildConnection(items, 10, 3, 20);
    expect(decodeCursor(conn.edges[0]!.cursor)).toBe(10);
    expect(decodeCursor(conn.edges[1]!.cursor)).toBe(11);
    expect(decodeCursor(conn.edges[2]!.cursor)).toBe(12);
  });

  it("sets hasNextPage true when more items exist", () => {
    const conn = buildConnection(items, 0, 3, 10);
    expect(conn.pageInfo.hasNextPage).toBe(true);
  });

  it("sets hasNextPage false on the last page", () => {
    const conn = buildConnection(items, 7, 3, 10);
    expect(conn.pageInfo.hasNextPage).toBe(false);
  });

  it("sets hasPreviousPage false on the first page", () => {
    const conn = buildConnection(items, 0, 3, 10);
    expect(conn.pageInfo.hasPreviousPage).toBe(false);
  });

  it("sets hasPreviousPage true on subsequent pages", () => {
    const conn = buildConnection(items, 3, 3, 10);
    expect(conn.pageInfo.hasPreviousPage).toBe(true);
  });

  it("includes totalCount", () => {
    const conn = buildConnection(items, 0, 3, 42);
    expect(conn.totalCount).toBe(42);
  });

  it("returns null cursors for empty page", () => {
    const conn = buildConnection([], 0, 20, 0);
    expect(conn.edges).toHaveLength(0);
    expect(conn.pageInfo.startCursor).toBeNull();
    expect(conn.pageInfo.endCursor).toBeNull();
    expect(conn.pageInfo.hasNextPage).toBe(false);
    expect(conn.pageInfo.hasPreviousPage).toBe(false);
  });

  it("single item page has matching start and end cursor", () => {
    const conn = buildConnection(["x"], 5, 20, 6);
    expect(conn.pageInfo.startCursor).toBe(conn.pageInfo.endCursor);
    expect(conn.pageInfo.hasNextPage).toBe(false);
  });
});

// ── buildPage ─────────────────────────────────────────────────────────────────

describe("buildPage", () => {
  const items = [1, 2, 3];

  it("returns items directly", () => {
    const page = buildPage(items, 0, 3, 10);
    expect(page.items).toEqual(items);
  });

  it("computes hasNextPage correctly", () => {
    expect(buildPage(items, 0, 3, 10).pageInfo.hasNextPage).toBe(true);
    expect(buildPage(items, 7, 3, 10).pageInfo.hasNextPage).toBe(false);
  });

  it("computes hasPreviousPage correctly", () => {
    expect(buildPage(items, 0, 3, 10).pageInfo.hasPreviousPage).toBe(false);
    expect(buildPage(items, 3, 3, 10).pageInfo.hasPreviousPage).toBe(true);
  });

  it("includes totalCount", () => {
    expect(buildPage(items, 0, 3, 99).totalCount).toBe(99);
  });

  it("returns null cursors for empty page", () => {
    const page = buildPage([], 0, 20, 0);
    expect(page.pageInfo.startCursor).toBeNull();
    expect(page.pageInfo.endCursor).toBeNull();
  });

  it("start cursor decodes to offset, end cursor decodes to last item position", () => {
    const page = buildPage(items, 10, 3, 30);
    expect(decodeCursor(page.pageInfo.startCursor!)).toBe(10);
    expect(decodeCursor(page.pageInfo.endCursor!)).toBe(12);
  });

  it("empty page: hasNextPage false even with totalCount > 0", () => {
    // This can happen if offset is exactly at totalCount.
    const page = buildPage([], 10, 5, 10);
    expect(page.pageInfo.hasNextPage).toBe(false);
  });
});

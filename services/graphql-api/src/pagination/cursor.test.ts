import { describe, expect, it } from "vitest";
import { buildConnection, decodeCursor, encodeCursor, normalizePageSize, toOffsetLimit } from "./cursor.js";

describe("cursor pagination", () => {
  it("round-trips encode/decode", () => {
    expect(decodeCursor(encodeCursor("abc-123"))).toBe("abc-123");
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeCursor(Buffer.from("not-a-cursor").toString("base64"))).toThrow();
  });

  it("caps page size at the maximum", () => {
    expect(normalizePageSize({ first: 500 })).toBe(100);
  });

  it("defaults page size when unspecified", () => {
    expect(normalizePageSize({})).toBe(20);
  });

  it("builds a connection and reports hasNextPage from the extra row", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const conn = buildConnection(items, { first: 2 }, (i) => i.id);
    expect(conn.edges).toHaveLength(2);
    expect(conn.pageInfo.hasNextPage).toBe(true);
    expect(conn.pageInfo.startCursor).toBe(encodeCursor(1));
    expect(conn.pageInfo.endCursor).toBe(encodeCursor(2));
  });

  it("reports no next page when fewer rows than the limit are returned", () => {
    const items = [{ id: 1 }];
    const conn = buildConnection(items, { first: 5 }, (i) => i.id);
    expect(conn.pageInfo.hasNextPage).toBe(false);
  });

  it("converts connection args into offset/limit for data-source queries", () => {
    const first = toOffsetLimit({ first: 10 });
    expect(first).toEqual({ offset: 0, limit: 11 });

    const after = toOffsetLimit({ first: 10, after: encodeCursor(19) });
    expect(after).toEqual({ offset: 20, limit: 11 });
  });
});

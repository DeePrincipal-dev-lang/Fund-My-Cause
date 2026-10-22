/**
 * Shared cursor-based pagination utilities
 * ─────────────────────────────────────────
 * A single source of truth for cursor encoding / decoding used by both
 * services/graphql-api (Relay-style Connection) and services/indexer
 * (limit/offset REST endpoints).
 *
 * Design
 * ──────
 * Cursors are opaque base64-encoded strings.  Internally they encode a
 * numeric offset so the database/store layer can use a simple OFFSET clause
 * without needing a stable sort key.  Callers treat cursors as black boxes.
 *
 * Edge cases handled
 * ──────────────────
 * - Empty page:       returns empty edges / empty items with hasNextPage=false
 * - Single page:      hasNextPage=false, hasPreviousPage=false
 * - Invalid cursor:   throws CursorDecodeError instead of returning NaN
 * - Negative offset:  clamps to 0
 *
 * Usage — GraphQL Connection
 * ──────────────────────────
 * ```ts
 * import { encodeCursor, buildConnection } from "@fund-my-cause/shared-utils/pagination";
 *
 * const items = await db.getCampaigns({ limit, offset });
 * const totalCount = await db.countCampaigns(filter);
 * return buildConnection(items, offset, limit, totalCount);
 * ```
 *
 * Usage — REST limit/offset
 * ─────────────────────────
 * ```ts
 * import { decodeCursor, buildPage } from "@fund-my-cause/shared-utils/pagination";
 *
 * const offset = after ? decodeCursor(after) : 0;
 * const items = store.query({ limit, offset });
 * return buildPage(items, offset, limit, store.count());
 * ```
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** A Relay-style edge wrapping one node. */
export interface PageEdge<T> {
  node: T;
  cursor: string;
}

/** Relay-style PageInfo object. */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

/** Full Relay-style connection result. */
export interface Connection<T> {
  edges: PageEdge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
}

/** Lightweight page result for REST-style pagination. */
export interface Page<T> {
  items: T[];
  pageInfo: PageInfo;
  totalCount: number;
}

/** Arguments accepted by most paginated queries. */
export interface PaginationArgs {
  /** Maximum number of items to return. Defaults to 20. */
  limit?: number;
  /** Zero-based offset. Defaults to 0. */
  offset?: number;
  /** Opaque cursor from a previous response (overrides `offset` when present). */
  after?: string;
}

// ── Errors ────────────────────────────────────────────────────────────────────

/** Thrown when a cursor string cannot be decoded. */
export class CursorDecodeError extends Error {
  constructor(cursor: string) {
    super(`Invalid pagination cursor: "${cursor}"`);
    this.name = "CursorDecodeError";
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Encode a zero-based numeric offset into an opaque base64 cursor string.
 *
 * @example
 *   encodeCursor(0)   // → "MA=="   (base64 of "0")
 *   encodeCursor(40)  // → "NDA="   (base64 of "40")
 */
export function encodeCursor(offset: number): string {
  const clamped = Math.max(0, Math.floor(offset));
  return Buffer.from(String(clamped)).toString("base64");
}

/**
 * Decode an opaque cursor back to a zero-based numeric offset.
 *
 * @throws {CursorDecodeError} when the string is not valid base64-of-integer.
 *
 * @example
 *   decodeCursor("MA==")  // → 0
 *   decodeCursor("NDA=")  // → 40
 */
export function decodeCursor(cursor: string): number {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, "base64").toString("utf8");
  } catch {
    throw new CursorDecodeError(cursor);
  }

  const offset = parseInt(decoded, 10);
  if (!Number.isFinite(offset) || String(Math.floor(offset)) !== decoded.trim()) {
    throw new CursorDecodeError(cursor);
  }

  return Math.max(0, offset);
}

/**
 * Resolve `PaginationArgs` into a concrete `{ limit, offset }` pair, applying
 * clamping and defaults.  When `after` is supplied it takes precedence over
 * `offset`.
 */
export function resolvePaginationArgs(args: PaginationArgs = {}): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(
    Math.max(1, args.limit ?? DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  let offset = Math.max(0, args.offset ?? 0);
  if (args.after !== undefined) {
    offset = decodeCursor(args.after);
  }

  return { limit, offset };
}

// ── Builder helpers ───────────────────────────────────────────────────────────

/**
 * Build a Relay-style `Connection` from an already-fetched page of items.
 *
 * @param items      The items for the current page (length ≤ limit).
 * @param offset     The zero-based offset at which the page starts.
 * @param limit      The page size used for the query.
 * @param totalCount The total number of matching records.
 */
export function buildConnection<T>(
  items: T[],
  offset: number,
  limit: number,
  totalCount: number,
): Connection<T> {
  const edges: PageEdge<T>[] = items.map((node, i) => ({
    node,
    cursor: encodeCursor(offset + i),
  }));

  const startCursor = edges[0]?.cursor ?? null;
  const endCursor = edges[edges.length - 1]?.cursor ?? null;

  return {
    edges,
    pageInfo: {
      hasNextPage: offset + items.length < totalCount,
      hasPreviousPage: offset > 0,
      startCursor,
      endCursor,
    },
    totalCount,
  };
}

/**
 * Build a REST-style `Page` from an already-fetched page of items.
 * Identical to `buildConnection` but returns `items` instead of `edges`.
 */
export function buildPage<T>(
  items: T[],
  offset: number,
  limit: number,
  totalCount: number,
): Page<T> {
  const startCursor = items.length > 0 ? encodeCursor(offset) : null;
  const endCursor =
    items.length > 0 ? encodeCursor(offset + items.length - 1) : null;

  return {
    items,
    pageInfo: {
      hasNextPage: offset + items.length < totalCount,
      hasPreviousPage: offset > 0,
      startCursor,
      endCursor,
    },
    totalCount,
  };
}

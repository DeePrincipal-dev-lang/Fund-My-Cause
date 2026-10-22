/**
 * Shared Relay-style cursor pagination helper. This is the single
 * pagination strategy for all list resolvers (campaigns, contributions,
 * etc.) so that offset-based and cursor-based shapes no longer coexist
 * across services/graphql-api.
 */

export interface Connection<T> {
  edges: Array<{ cursor: string; node: T }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}

export interface ConnectionArgs {
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function encodeCursor(id: string | number): string {
  return Buffer.from(`cursor:${id}`, "utf-8").toString("base64");
}

export function decodeCursor(cursor: string): string {
  const decoded = Buffer.from(cursor, "base64").toString("utf-8");
  const prefix = "cursor:";
  if (!decoded.startsWith(prefix)) {
    throw new Error(`Invalid cursor: ${cursor}`);
  }
  return decoded.slice(prefix.length);
}

/**
 * Builds a Relay connection out of an already-fetched page of results.
 * `getId` extracts the stable identifier used to encode cursors.
 * Callers should fetch `limit + 1` rows so `hasNextPage` can be computed
 * without a second count query.
 */
export function buildConnection<T>(
  items: T[],
  args: ConnectionArgs,
  getId: (item: T) => string | number
): Connection<T> {
  const limit = normalizePageSize(args);
  const hasExtra = items.length > limit;
  const pageItems = hasExtra ? items.slice(0, limit) : items;

  const edges = pageItems.map((node) => ({ cursor: encodeCursor(getId(node)), node }));

  return {
    edges,
    pageInfo: {
      hasNextPage: Boolean(args.first) && hasExtra,
      hasPreviousPage: Boolean(args.after) || Boolean(args.last && args.before),
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
    },
  };
}

export function normalizePageSize(args: ConnectionArgs): number {
  const requested = args.first ?? args.last ?? DEFAULT_PAGE_SIZE;
  if (requested <= 0) {
    throw new Error("Page size must be greater than 0");
  }
  return Math.min(requested, MAX_PAGE_SIZE);
}

/**
 * Translates connection args into the offset/limit params expected by the
 * current data-source layer, so resolvers can adopt the cursor API without
 * an immediate rewrite of every query builder.
 */
export function toOffsetLimit(args: ConnectionArgs): { offset: number; limit: number } {
  const limit = normalizePageSize(args) + 1; // fetch one extra row for hasNextPage
  const offset = args.after ? Number(decodeCursor(args.after)) + 1 : 0;
  return { offset, limit };
}

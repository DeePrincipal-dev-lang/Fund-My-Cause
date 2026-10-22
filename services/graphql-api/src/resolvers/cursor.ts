/**
 * Cursor + page helpers used by paginated resolvers (#1388).
 *
 * NOTE: This module assumes the original `decodeCursor`, `CursorError`, and
 * `buildPage` symbols are either (a) imported from a sibling helper in the
 * original file, or (b) need to be defined here. If the originals exist
 * elsewhere, replace the definitions below with re-exports.
 */

export class CursorError extends Error {}

export function decodeCursor(cursor: string): { sortKey: string; id: string } {
  try {
    const raw = Buffer.from(cursor, "base64").toString("utf8");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.sortKey !== "string" ||
      typeof parsed?.id !== "string"
    ) {
      throw new CursorError("cursor payload missing sortKey or id");
    }
    return { sortKey: parsed.sortKey, id: parsed.id };
  } catch (err) {
    if (err instanceof CursorError) throw err;
    throw new CursorError("malformed cursor");
  }
}

export function buildPage<T>(
  items: T[],
  getId: (item: T) => string,
  getSortKey: (item: T) => string,
  hasNextPage: boolean,
  hasPreviousPage: boolean,
): {
  edges: { node: T; cursor: string }[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
} {
  const edges = items.map((node) => ({
    node,
    cursor: Buffer.from(
      JSON.stringify({ sortKey: getSortKey(node), id: getId(node) }),
    ).toString("base64"),
  }));
  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges[edges.length - 1]?.cursor ?? null,
    },
  };
}

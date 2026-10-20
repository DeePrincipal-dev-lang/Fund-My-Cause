/**
 * Client-side helpers for consuming the Relay-style cursor connections now
 * returned by services/graphql-api list resolvers (campaigns, contributions).
 * Mirrors the shape defined in
 * services/graphql-api/src/pagination/cursor.ts.
 */

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface Connection<T> {
  edges: Array<{ cursor: string; node: T }>;
  pageInfo: PageInfo;
}

export function nodesFrom<T>(connection: Connection<T>): T[] {
  return connection.edges.map((edge) => edge.node);
}

/**
 * Repeatedly calls `fetchPage` following `endCursor` until `hasNextPage`
 * is false, returning all nodes. Intended for SDK consumers that need the
 * full list rather than paged UI rendering.
 */
export async function fetchAllPages<T>(
  fetchPage: (after: string | null) => Promise<Connection<T>>,
  pageLimit = 50
): Promise<T[]> {
  const results: T[] = [];
  let after: string | null = null;
  let pages = 0;

  while (pages < pageLimit) {
    const page = await fetchPage(after);
    results.push(...nodesFrom(page));
    pages += 1;

    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) {
      break;
    }
    after = page.pageInfo.endCursor;
  }

  return results;
}

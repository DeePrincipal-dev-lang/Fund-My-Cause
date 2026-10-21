/**
 * Client-side helpers for consuming the Relay-style cursor connections now
 * returned by services/graphql-api list resolvers (campaigns, contributions).
 * Mirrors the shape defined in
 * services/graphql-api/src/pagination/cursor.ts.
 */

/** Relay-style pagination metadata for a {@link Connection}. */
export interface PageInfo {
  /** Whether another page exists after the current one. */
  hasNextPage: boolean;
  /** Whether a page exists before the current one. */
  hasPreviousPage: boolean;
  /** Cursor for the first edge in this page, or `null` when the page is empty. */
  startCursor: string | null;
  /** Cursor for the last edge in this page, or `null` when the page is empty. */
  endCursor: string | null;
}

/**
 * A Relay-style cursor connection returned by paginated SDK methods.
 *
 * @typeParam T - The type of node contained in each edge.
 */
export interface Connection<T> {
  /** The nodes in this page, paired with their opaque pagination cursors. */
  edges: Array<{ cursor: string; node: T }>;
  /** Cursors and flags used to navigate to adjacent pages. */
  pageInfo: PageInfo;
}

/**
 * Extracts the nodes from a Relay-style connection.
 *
 * @param connection - A connection returned by an SDK list method.
 * @returns The `node` value from each edge, preserving order.
 * @example
 * ```ts
 * const connection: Connection<string> = {
 *   edges: [{ cursor: "cursor-1", node: "campaign-1" }],
 *   pageInfo: {
 *     hasNextPage: false,
 *     hasPreviousPage: false,
 *     startCursor: "cursor-1",
 *     endCursor: "cursor-1",
 *   },
 * };
 *
 * const campaigns = nodesFrom(connection);
 * console.log(campaigns); // ["campaign-1"]
 * ```
 */
export function nodesFrom<T>(connection: Connection<T>): T[] {
  return connection.edges.map((edge) => edge.node);
}

/**
 * Repeatedly calls `fetchPage` following `endCursor` until `hasNextPage`
 * is false, returning all nodes. Intended for SDK consumers that need the
 * full list rather than paged UI rendering.
 *
 * @param fetchPage - Loads one page. Receives the previous page's end cursor,
 * or `null` for the first page.
 * @param pageLimit - Maximum number of pages to request. Defaults to `50`.
 * @returns Every node from the fetched pages, in order.
 * @example
 * ```ts
 * const campaigns = await fetchAllPages(async (after) => {
 *   const response = await fetch(`/api/campaigns?after=${after ?? ""}`);
 *   return response.json() as Promise<Connection<string>>;
 * });
 * ```
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

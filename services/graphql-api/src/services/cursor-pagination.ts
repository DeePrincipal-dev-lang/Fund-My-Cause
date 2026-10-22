/**
 * Cursor-based pagination for campaign listing queries.
 *
 * ## Cursor format
 *
 * A cursor encodes the last-seen item's sort key and opaque ID as a
 * URL-safe base64 JSON payload:
 *
 * ```
 * base64url( JSON.stringify({ sortKey: <string>, id: <string>, v: 1 }) )
 * ```
 *
 * The `v` (version) field lets us detect – and reject – cursors produced by
 * a future schema change rather than silently returning wrong results.
 *
 * ## Tamper detection
 *
 * We validate the decoded payload's shape strictly (required fields, types,
 * correct version tag).  Any cursor that fails validation is rejected with a
 * `CursorError` rather than silently causing undefined query behaviour.
 *
 * Note: this implementation uses **symmetric signing** (`CURSOR_SECRET`)
 * to protect against forgery in production.  Tests may supply a custom
 * secret via the `secret` parameter.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURSOR_VERSION = 1;

/**
 * Default signing secret.  In production, set the `CURSOR_SECRET` env var to
 * a long, random string so that cursors are authenticated and tamper-evident.
 * Tests pass their own secret directly so they are independent of the env.
 */
const DEFAULT_SECRET =
  process.env.CURSOR_SECRET ?? "dev-cursor-secret-changeme";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

import { AppError } from "@fund-my-cause/shared-utils";

/** Thrown when a cursor string cannot be decoded or fails validation. */
export class CursorError extends AppError {
  constructor(message: string) {
    super("CURSOR_INVALID", message, { severity: "warn" });
    this.name = "CursorError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The decoded contents of a pagination cursor. */
export interface CursorPayload {
  /** The sort key of the last-seen item (e.g. createdAt ISO string, raised amount). */
  sortKey: string;
  /** The opaque item identifier of the last-seen item. */
  id: string;
  /** Schema version — must equal CURSOR_VERSION. */
  v: number;
}

/** Input to `encodeCursor`. */
export type CursorInput = Omit<CursorPayload, "v">;

/** Result returned by `buildPage`. */
export interface PageResult<T> {
  edges: Array<{ node: T; cursor: string }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}

// ---------------------------------------------------------------------------
// HMAC helpers (Node.js crypto, available in both ESM and CJS)
// ---------------------------------------------------------------------------

import { createHmac } from "node:crypto";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Encode a cursor string by base64url-encoding the JSON payload, then
 * appending a short HMAC signature so that tampering can be detected.
 *
 * Output format: `<base64url(json)>.<hmac>`
 */
export function encodeCursor(
  input: CursorInput,
  secret = DEFAULT_SECRET,
): string {
  const payload: CursorPayload = { ...input, v: CURSOR_VERSION };
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString("base64url");
  const mac = sign(encoded, secret);
  return `${encoded}.${mac}`;
}

/**
 * Decode and validate a cursor string produced by `encodeCursor`.
 *
 * @throws {CursorError} for any of:
 *   - Malformed base64url or JSON
 *   - Missing or wrong-typed required fields
 *   - Wrong cursor version
 *   - Invalid HMAC signature (tampered cursor)
 */
export function decodeCursor(
  cursor: string,
  secret = DEFAULT_SECRET,
): CursorPayload {
  // Split off the signature.
  const dotIndex = cursor.lastIndexOf(".");
  if (dotIndex === -1) {
    throw new CursorError("Malformed cursor: missing signature separator");
  }

  const encoded = cursor.slice(0, dotIndex);
  const mac = cursor.slice(dotIndex + 1);

  // Verify HMAC before touching the payload (constant-time-ish; good enough for
  // server-to-server cursor validation).
  const expectedMac = sign(encoded, secret);
  if (mac !== expectedMac) {
    throw new CursorError(
      "Invalid cursor: signature mismatch (possible tampering)",
    );
  }

  // Decode payload.
  let json: string;
  try {
    json = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    throw new CursorError("Malformed cursor: base64url decode failed");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new CursorError("Malformed cursor: JSON parse failed");
  }

  // Shape validation.
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as Record<string, unknown>).sortKey !== "string" ||
    typeof (payload as Record<string, unknown>).id !== "string" ||
    typeof (payload as Record<string, unknown>).v !== "number"
  ) {
    throw new CursorError("Malformed cursor: missing required fields");
  }

  const typed = payload as CursorPayload;

  if (typed.v !== CURSOR_VERSION) {
    throw new CursorError(
      `Unsupported cursor version ${typed.v} (expected ${CURSOR_VERSION})`,
    );
  }

  return typed;
}

// ---------------------------------------------------------------------------
// buildPage helper
// ---------------------------------------------------------------------------

/**
 * Build a cursor-paginated result from a slice of items.
 *
 * @param items     The raw page items (already sliced to the requested limit).
 * @param getId     Extract the item's opaque ID.
 * @param getSortKey Extract the item's sort key (e.g. `item.createdAt`).
 * @param hasNextPage  Whether there are more items after this page.
 * @param hasPreviousPage Whether there are items before this page.
 * @param secret    Optional signing secret (tests supply their own).
 */
export function buildPage<T>(
  items: T[],
  getId: (item: T) => string,
  getSortKey: (item: T) => string,
  hasNextPage: boolean,
  hasPreviousPage: boolean,
  secret = DEFAULT_SECRET,
): PageResult<T> {
  const edges = items.map((node) => ({
    node,
    cursor: encodeCursor(
      { id: getId(node), sortKey: getSortKey(node) },
      secret,
    ),
  }));

  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor: edges.length > 0 ? edges[0]!.cursor : null,
      endCursor: edges.length > 0 ? edges[edges.length - 1]!.cursor : null,
    },
  };
}

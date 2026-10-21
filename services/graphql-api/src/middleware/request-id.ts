/**
 * Request ID middleware for graphql-api.
 *
 * Ensures every incoming request has a unique, traceable request ID that:
 * 1. Is generated or accepted from X-Trace-ID header
 * 2. Is attached to all logs via request-scoped logger
 * 3. Is propagated to downstream HTTP calls (Horizon, fraud detection, etc.)
 * 4. Is returned in the response X-Trace-ID header
 *
 * See docs/logging-conventions.md for full tracing specification.
 */

import type { Request, Response, NextFunction } from "express";
import { generateTraceId, isValidTraceId, TRACE_ID_HEADER } from "@fund-my-cause/shared-utils";

/**
 * Express middleware that processes incoming request IDs.
 *
 * - Reads X-Trace-ID from request headers (if present and valid)
 * - Generates a fresh trace ID if header is missing or malformed
 * - Attaches the resolved trace ID to the response header
 * - Stores the trace ID on req.traceId for downstream use
 *
 * Usage:
 * ```ts
 * app.use(requestIdMiddleware);
 * app.get("/some-endpoint", (req, res) => {
 *   console.log(req.traceId); // The resolved or generated trace ID
 *   res.json({ traceId: req.traceId });
 * });
 * ```
 */
export function requestIdMiddleware(
  req: Request & { traceId?: string },
  res: Response,
  next: NextFunction,
): void {
  // Extract trace ID from incoming headers
  const incomingTraceId = Array.isArray(req.headers[TRACE_ID_HEADER])
    ? req.headers[TRACE_ID_HEADER][0]
    : (req.headers[TRACE_ID_HEADER] as string | undefined);

  // Resolve or generate trace ID
  const traceId = isValidTraceId(incomingTraceId) ? incomingTraceId : generateTraceId();

  // Attach to request for downstream handlers
  req.traceId = traceId;

  // Set response header so caller can correlate their logs
  res.set(TRACE_ID_HEADER, traceId);

  next();
}

/**
 * Type-safe getter for the trace ID stored on a request object.
 * Use this in route handlers when TypeScript doesn't carry the req.traceId property.
 *
 * @param req The Express request object
 * @returns The trace ID (guaranteed non-empty)
 */
export function getRequestTraceId(req: any): string {
  if (!req.traceId || typeof req.traceId !== "string") {
    throw new Error("Request trace ID middleware has not been initialized");
  }
  return req.traceId;
}

/**
 * Shared error class hierarchy for Fund-My-Cause Node services and frontend.
 *
 * All application-level errors should extend `AppError` so that logging,
 * monitoring, and serialization are consistent across every service.
 *
 * @example
 * ```ts
 * import { AppError } from "@fund-my-cause/shared-utils";
 *
 * throw new AppError("CAMPAIGN_NOT_FOUND", "Campaign not found", {
 *   severity: "warn",
 *   context:  { campaignId: "cmp_abc" },
 * });
 * ```
 *
 * @example Extending for a service-specific variant
 * ```ts
 * export class ContractCallError extends AppError {
 *   constructor(method: string, cause: unknown) {
 *     super("CONTRACT_CALL_FAILED", `Contract call ${method} failed`, {
 *       severity: "error",
 *       context:  { method },
 *       cause:    cause instanceof Error ? cause : undefined,
 *     });
 *     this.name = "ContractCallError";
 *   }
 * }
 * ```
 */

/** Severity levels that mirror common logging conventions. */
export type AppErrorSeverity = "debug" | "info" | "warn" | "error" | "fatal";

export interface AppErrorOptions {
  /** How serious this error is; defaults to `"error"`. */
  severity?: AppErrorSeverity;
  /**
   * Arbitrary structured metadata attached to the error.  Every key–value pair
   * here should be safe to log — do not include PII or secrets.
   */
  context?: Record<string, unknown>;
  /** The underlying error that caused this one, if any. */
  cause?: Error;
}

/**
 * Base class for all application-level errors across Fund-My-Cause services
 * and the frontend.
 *
 * Compared with a plain `Error`, `AppError` adds:
 * - A stable string `code` field suitable for programmatic branching and log
 *   aggregation (never localised, never changes between releases).
 * - A `severity` field consumed by the logging layer to route to the correct
 *   alert severity.
 * - A typed `context` bag for structured key–value metadata (trace IDs,
 *   resource IDs, etc.) that ends up in JSON log lines.
 * - Correct `JSON.stringify` behaviour — all own enumerable properties are
 *   included in the serialized form.
 */
export class AppError extends Error {
  /** Stable machine-readable error code. Never localised. */
  public readonly code: string;
  /** How serious this error is. */
  public readonly severity: AppErrorSeverity;
  /** Structured key–value metadata safe to include in log lines. */
  public readonly context: Record<string, unknown>;

  constructor(code: string, message?: string, options?: AppErrorOptions) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.severity = options?.severity ?? "error";
    this.context = options?.context ?? {};

    // Attach cause manually so it works regardless of the TypeScript lib version.
    if (options?.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }

    // Restore the prototype chain so `instanceof` works correctly when the
    // class is transpiled to ES5 by older TypeScript targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns a plain object with all structured fields.
   *
   * Called automatically by `JSON.stringify`, so `AppError` instances
   * serialise to a consistent shape in logs:
   *
   * ```json
   * {
   *   "name":     "AppError",
   *   "code":     "CONTRACT_FAILED",
   *   "message":  "Campaign failed",
   *   "severity": "error",
   *   "context":  { "campaignId": "cmp_123" }
   * }
   * ```
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
    };
  }
}

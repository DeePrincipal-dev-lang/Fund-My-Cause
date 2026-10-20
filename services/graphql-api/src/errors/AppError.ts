import { GraphQLError } from "graphql";

/** Well-known error codes used throughout the graphql-api service. */
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_USER_INPUT"
  | "TOO_MANY_REQUESTS"
  | "QUERY_TOO_COMPLEX"
  | "INTERNAL_SERVER_ERROR";

const HTTP_STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_USER_INPUT: 400,
  TOO_MANY_REQUESTS: 429,
  QUERY_TOO_COMPLEX: 400,
  INTERNAL_SERVER_ERROR: 500,
};

export interface AppErrorOptions {
  /** Machine-readable error code. */
  code: AppErrorCode;
  /** Optional structured details forwarded in extensions.details. */
  details?: Record<string, unknown>;
}

/**
 * Shared application error for the graphql-api service.
 *
 * Extends GraphQLError so it can be thrown anywhere in the resolver tree
 * and will be serialised by Apollo Server into the standard error shape.
 * All errors produced by middleware and resolvers should use this class so
 * clients receive one predictable response contract.
 *
 * @example
 * throw new AppError("Authentication required", {
 *   code: "UNAUTHENTICATED",
 * });
 *
 * @example
 * throw new AppError(`Rate limit exceeded for '${op}'. Retry after ${retryAfter}s`, {
 *   code: "TOO_MANY_REQUESTS",
 *   details: { retryAfter, operationName: op },
 * });
 */
export class AppError extends GraphQLError {
  readonly appCode: AppErrorCode;

  constructor(message: string, options: AppErrorOptions) {
    const { code, details } = options;
    super(message, {
      extensions: {
        code,
        http: { status: HTTP_STATUS[code] },
        ...(details ? { details } : {}),
      },
    });
    this.appCode = code;
    // Maintain correct prototype chain in transpiled output.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

import type { AuthService } from "../services/auth.js";
import type { Context } from "../types.js";
import { AppError } from "../errors/AppError.js";

/**
 * GraphQL middleware that enforces authentication on protected resolvers.
 *
 * Wraps a resolver and checks that `context.user` is present (i.e. a valid
 * JWT was supplied and verified in the Apollo context factory in index.ts).
 * Throws a structured UNAUTHENTICATED error when no authenticated user is
 * found, matching the Apollo Server error-extension conventions used
 * throughout the API.
 *
 * Usage:
 *   import { requireAuth } from "../middleware/auth.js";
 *
 *   // In resolvers:
 *   async myProtectedResolver(parent, args, context, info) {
 *     await requireAuth(context);
 *     // ... resolver logic
 *   }
 */
export function requireAuth(context: Context): void {
  if (!context.user || !context.user.isAuthenticated) {
    throw new AppError("Authentication required", { code: "UNAUTHENTICATED" });
  }
}

/**
 * Higher-order resolver wrapper that enforces authentication.
 *
 * Equivalent to calling `requireAuth(context)` at the top of every
 * protected resolver, but expressed as a wrapper so it can be applied
 * uniformly to a set of resolvers without modifying each one.
 *
 * @param resolver - The resolver function to protect.
 * @returns A new resolver that checks authentication before delegating.
 */
export function withAuth<TParent, TArgs, TReturn>(
  resolver: (
    parent: TParent,
    args: TArgs,
    context: Context,
    info: any,
  ) => Promise<TReturn> | TReturn,
): (
  parent: TParent,
  args: TArgs,
  context: Context,
  info: any,
) => Promise<TReturn> {
  return async (parent, args, context, info) => {
    requireAuth(context);
    return resolver(parent, args, context, info);
  };
}

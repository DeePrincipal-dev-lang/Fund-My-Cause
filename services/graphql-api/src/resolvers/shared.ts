/**
 * Shared resolver infrastructure (#1388).
 *
 * Contains pieces used across multiple domain files:
 *   - CAMPAIGN_STATUS_ENUM_MAP (schema enum → internal enum)
 *   - BigIntScalar (custom scalar)
 *   - enforceMutationRateLimit (per-mutation rate limiting)
 *   - CursorError + decodeCursor + buildPage helpers
 */
import { GraphQLError } from "graphql";
import {
  CAMPAIGN_STATUS_VALUES,
  type CampaignStatus,
} from "@fund-my-cause/types";
import type { Context } from "../types.js";

/** GraphQL SCREAMING_CASE → internal PascalCase status mapping. */
export const CAMPAIGN_STATUS_ENUM_MAP: Record<string, CampaignStatus> =
  Object.fromEntries(
    CAMPAIGN_STATUS_VALUES.map((value) => [value.toUpperCase(), value]),
  );

export type MutationName =
  | "authenticate"
  | "createCampaign"
  | "updateCampaign"
  | "recordContribution";

export async function enforceMutationRateLimit(
  mutation: MutationName,
  context: Context,
): Promise<void> {
  const rateLimiter = (context as any).rateLimiter;
  if (!rateLimiter) return;

  const key = context.user?.address ?? (context as any).ip ?? "anonymous";
  try {
    await rateLimiter.checkMutationLimit(mutation, key);
  } catch (error: any) {
    const retryAfter: number = error.retryAfter ?? 60;
    throw new GraphQLError(
      error.message ??
        `Rate limit exceeded for mutation '${mutation}'. Retry after ${retryAfter}s.`,
      {
        extensions: {
          code: "TOO_MANY_REQUESTS",
          http: { status: 429 },
          retryAfter,
          mutation,
        },
      },
    );
  }
}

export const BigIntScalar = {
  serialize(value: bigint | string | number) {
    return value.toString();
  },
  parseValue(value: string) {
    return BigInt(value);
  },
  parseLiteral(ast: any) {
    if (ast.kind === "IntValue") {
      return BigInt(ast.value);
    }
    throw new GraphQLError(`Cannot coerce value: ${ast}`);
  },
};

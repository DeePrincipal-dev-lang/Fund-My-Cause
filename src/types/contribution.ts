/**
 * Domain types for contribution models.
 *
 * These types mirror the shapes returned by the GraphQL schema and the
 * Soroban contribution contract so that consumers get precise, compile-time
 * checked data instead of `any`.
 */

/**
 * Scalar values that can be returned by the Soroban contract for a
 * contribution field. Soroban encodes integers as strings to avoid
 * precision loss, so numeric fields may arrive as either a number or a
 * stringified number.
 */
export type SorobanScalar = string | number | boolean;

/**
 * A single contribution made by a backer towards a campaign.
 */
export interface Contribution {
  /** Unique contribution identifier (GraphQL `ID`). */
  id: string;
  /** Campaign this contribution belongs to. */
  campaignId: string;
  /** Address of the contributor (Stellar public key). */
  contributor: string;
  /** Amount contributed, in stroops or the contract's base unit. */
  amount: string;
  /** Asset/token used for the contribution (e.g. `XLM`, `USDC`). */
  asset: string;
  /** ISO-8601 timestamp of when the contribution was made. */
  createdAt: string;
  /** Optional transaction hash for the on-chain contribution. */
  transactionHash?: string;
  /** Optional ledger sequence the contribution was recorded at. */
  ledger?: number;
}

/**
 * Raw contribution payload as returned by the Soroban contract, before it is
 * normalised into a {@link Contribution}.
 */
export interface ContributionContractResult {
  id: SorobanScalar;
  campaign_id: SorobanScalar;
  contributor: SorobanScalar;
  amount: SorobanScalar;
  asset: SorobanScalar;
  created_at: SorobanScalar;
  transaction_hash?: SorobanScalar;
  ledger?: SorobanScalar;
}

/**
 * GraphQL connection-style page of contributions.
 */
export interface ContributionConnection {
  edges: Array<{
    node: Contribution;
    cursor: string;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  totalCount: number;
}

/**
 * Filter arguments accepted when querying contributions.
 */
export interface ContributionFilter {
  campaignId?: string;
  contributor?: string;
  asset?: string;
  minAmount?: string;
  maxAmount?: string;
}

/**
 * Generic paginated result wrapper used by contribution queries.
 *
 * @typeParam T - The node type contained in the page.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Normalises a raw Soroban contract result into a typed {@link Contribution}.
 */
export function toContribution(
  raw: ContributionContractResult,
): Contribution {
  return {
    id: String(raw.id),
    campaignId: String(raw.campaign_id),
    contributor: String(raw.contributor),
    amount: String(raw.amount),
    asset: String(raw.asset),
    createdAt: String(raw.created_at),
    transactionHash:
      raw.transaction_hash !== undefined
        ? String(raw.transaction_hash)
        : undefined,
    ledger: raw.ledger !== undefined ? Number(raw.ledger) : undefined,
  };
}

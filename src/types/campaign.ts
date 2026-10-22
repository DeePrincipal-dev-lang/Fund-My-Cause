export type CampaignStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type ContributionStatus =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'refunded';

/**
 * Generic paginated response shape returned by the GraphQL API.
 * Kept generic so callers can supply the precise node type instead of `any`.
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface Connection<TNode> {
  edges: Array<{ node: TNode; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

/**
 * Soroban contract amounts are returned as i128 strings to avoid
 * precision loss in JavaScript. Keep them as strings end-to-end.
 */
export type SorobanAmount = string;

export interface CampaignCreator {
  id: string;
  address: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Campaign {
  id: string;
  contractId: string;
  title: string;
  description: string;
  status: CampaignStatus;
  goalAmount: SorobanAmount;
  raisedAmount: SorobanAmount;
  currency: string;
  creator: CampaignCreator;
  createdAt: string;
  updatedAt: string;
  deadline: string | null;
  contributorCount: number;
}

export interface Contribution {
  id: string;
  campaignId: string;
  contributor: string;
  amount: SorobanAmount;
  status: ContributionStatus;
  transactionHash: string;
  createdAt: string;
  confirmedAt: string | null;
}

export interface CampaignFilter {
  status?: CampaignStatus;
  creator?: string;
  search?: string;
}

export interface CampaignConnection extends Connection<Campaign> {}

export interface ContributionConnection extends Connection<Contribution> {}

export interface CampaignQueryVariables {
  first?: number;
  after?: string | null;
  filter?: CampaignFilter;
}

export interface ContributionQueryVariables {
  campaignId: string;
  first?: number;
  after?: string | null;
}

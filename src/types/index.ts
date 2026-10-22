// Core domain types for campaigns and contributions.
// These mirror the GraphQL schema / Soroban contract return shapes.

export type CampaignStatus =
  | 'draft'
  | 'active'
  | 'funded'
  | 'failed'
  | 'cancelled';

export type ContributionStatus =
  | 'pending'
  | 'confirmed'
  | 'refunded';

/** A single contribution made toward a campaign. */
export interface Contribution {
  id: string;
  campaignId: string;
  contributor: string;
  amount: string;
  asset: string;
  status: ContributionStatus;
  transactionHash: string | null;
  createdAt: string;
}

/** A campaign as returned by the GraphQL API / Soroban contract. */
export interface Campaign {
  id: string;
  title: string;
  description: string;
  creator: string;
  goal: string;
  raised: string;
  asset: string;
  status: CampaignStatus;
  deadline: string;
  createdAt: string;
  contributions: Contribution[];
}

/** Generic paginated response wrapper used by list queries. */
export interface Page<T> {
  items: T[];
  total: number;
  hasNextPage: boolean;
  endCursor: string | null;
}

/** Generic GraphQL connection edge/node shape. */
export interface Edge<T> {
  node: T;
  cursor: string;
}

export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

/** Input payload for creating a campaign. */
export interface CreateCampaignInput {
  title: string;
  description: string;
  goal: string;
  asset: string;
  deadline: string;
}

/** Input payload for making a contribution. */
export interface CreateContributionInput {
  campaignId: string;
  amount: string;
  asset: string;
}

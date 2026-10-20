// GraphQL schema-aligned types for core domain models.
// These mirror the shapes returned by the backend GraphQL API and the
// Soroban contract read methods used by the frontend.

export type ID = string;

/** ISO-8601 timestamp string as returned by the GraphQL API. */
export type DateTime = string;

/** Soroban contract amounts are returned as base-10 integer strings (i128). */
export type BigIntString = string;

export type CampaignStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'FUNDED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ContributionStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REFUNDED';

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface User {
  id: ID;
  address: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: DateTime;
}

export interface Campaign {
  id: ID;
  title: string;
  description: string;
  imageUrl: string | null;
  creator: User;
  creatorAddress: string;
  goal: BigIntString;
  raised: BigIntString;
  currency: string;
  status: CampaignStatus;
  deadline: DateTime;
  createdAt: DateTime;
  updatedAt: DateTime;
  contributions: Contribution[];
  contributionCount: number;
}

export interface Contribution {
  id: ID;
  campaign: Campaign;
  campaignId: ID;
  contributor: User;
  contributorAddress: string;
  amount: BigIntString;
  currency: string;
  status: ContributionStatus;
  transactionHash: string | null;
  createdAt: DateTime;
}

export interface CampaignConnection {
  nodes: Campaign[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface ContributionConnection {
  nodes: Contribution[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface CampaignFilter {
  status?: CampaignStatus;
  creatorAddress?: string;
  search?: string;
}

export interface ContributionFilter {
  campaignId?: ID;
  contributorAddress?: string;
  status?: ContributionStatus;
}

export interface PaginationInput {
  first?: number;
  after?: string | null;
  last?: number;
  before?: string | null;
}

export interface QueryCampaignsArgs {
  filter?: CampaignFilter;
  pagination?: PaginationInput;
}

export interface QueryCampaignArgs {
  id: ID;
}

export interface QueryContributionsArgs {
  filter?: ContributionFilter;
  pagination?: PaginationInput;
}

export interface GraphQLResponse<TData> {
  data?: TData;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  path?: ReadonlyArray<string | number>;
  extensions?: Record<string, string | number | boolean | null>;
}

export interface CampaignsQueryData {
  campaigns: CampaignConnection;
}

export interface CampaignQueryData {
  campaign: Campaign | null;
}

export interface ContributionsQueryData {
  contributions: ContributionConnection;
}

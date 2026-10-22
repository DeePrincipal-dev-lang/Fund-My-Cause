/**
 * Server-side representation of the GraphQL schema
 * (`services/graphql-api/src/schema.ts`).
 *
 * `./graphql` holds the *client* view of the same schema — the codegen output
 * consumed by the frontend, where the custom `BigInt` scalar is serialised as
 * `string`.  Resolvers, by contrast, work with the values they read straight
 * off Soroban, so the same fields are `bigint` here.  Both representations
 * live in this package so a schema change lands in one place, and the drift
 * guard at the bottom of this file fails to compile if their fields diverge.
 *
 * These types were previously redefined in `services/graphql-api/src/types.ts`;
 * that module now re-exports them, keeping the service's import paths intact.
 */

import type { CampaignStatus } from "./soroban";
import type * as Client from "./graphql";

// ── Domain objects ───────────────────────────────────────────────────────────

/** Campaign as exposed to GraphQL resolvers. */
export interface Campaign {
  /** Soroban contract address of the campaign */
  id: string;
  /** Alias for id (kept for GraphQL schema compat) */
  contractId: string;
  title: string;
  description: string;
  creator: string;
  /** Funding goal in stroops */
  goal: bigint;
  /** Net amount raised in stroops */
  raised: bigint;
  /** ISO-8601 deadline */
  deadline: string;
  status: CampaignStatus;
  category: string;
  image?: string;
  videoUrl?: string;
  minContribution: bigint;
  /**
   * Upper bound per contribution, in stroops.
   * Read from the contract but not exposed through the GraphQL schema.
   */
  maxContribution: bigint;
  totalContributors: number;
  token: string;
  platformFeeBps?: number;
  hasRBACEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Contribution {
  id: string;
  campaignId: string;
  contributor: string;
  amount: bigint;
  timestamp: string;
  transactionHash: string;
}

export interface User {
  address: string;
  totalContributed: bigint;
  contributionCount: number;
  campaigns: Campaign[];
  contributions: Contribution[];
  joinedAt: string;
}

export interface CampaignUpdate {
  id: string;
  campaignId: string;
  content: string;
  ipfsHash: string;
  timestamp: string;
}

export interface Milestone {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  targetAmount: bigint;
  releasePercentage: number;
  status: MilestoneStatus;
}

export interface Contributor {
  address: string;
  amount: bigint;
  contributionCount: number;
  isTopContributor: boolean;
}

export interface CampaignProgress {
  campaignId: string;
  raised: bigint;
  percentageFunded: number;
  contributors: number;
  daysRemaining: number;
  timestamp: string;
}

export interface Statistics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalRaised: bigint;
  totalContributors: number;
  averageContribution: bigint;
  successRate: number;
}

// ── Enums ────────────────────────────────────────────────────────────────────

export enum MilestoneStatus {
  PENDING = "PENDING",
  REACHED = "REACHED",
  RELEASED = "RELEASED",
}

export enum SortField {
  CREATED_AT = "CREATED_AT",
  RAISED_AMOUNT = "RAISED_AMOUNT",
  GOAL = "GOAL",
  DEADLINE = "DEADLINE",
  CONTRIBUTORS = "CONTRIBUTORS",
}

export enum SortDirection {
  ASC = "ASC",
  DESC = "DESC",
}

// ── Query arguments ──────────────────────────────────────────────────────────

export interface CampaignFilter {
  status?: CampaignStatus[];
  category?: string[];
  minGoal?: bigint;
  maxGoal?: bigint;
  creator?: string;
  search?: string;
}

export interface PaginationInput {
  limit: number;
  offset: number;
}

export interface CampaignSort {
  field: SortField;
  direction: SortDirection;
}

export interface GetCampaignsParams {
  filter?: CampaignFilter;
  pagination: PaginationInput;
  sort?: CampaignSort;
}

// ── Mutation inputs ──────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  title: string;
  description: string;
  goal: bigint;
  deadline: string;
  category: string;
  image?: string;
  videoUrl?: string;
  minContribution: bigint;
}

export interface UpdateCampaignInput {
  title?: string;
  description?: string;
  image?: string;
  videoUrl?: string;
}

export interface RecordContributionInput {
  campaignId: string;
  contributor: string;
  amount: bigint;
  transactionHash: string;
}

// ── Drift guard ──────────────────────────────────────────────────────────────
//
// This module and `./graphql` describe the same schema, so a field added to one
// and forgotten in the other is a bug. `GraphQLFieldParity` fails to compile
// when their field sets diverge by anything other than the deltas named below,
// which makes `npm run typecheck` in this package the check that catches it.

/** Field names of a type, ignoring the codegen-only `__typename` discriminator. */
type FieldsOf<T> = Exclude<keyof T, "__typename">;

/** `true` only when `A` and `B` are the same union of keys. */
type SameKeys<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * `true` when the server and client views of a type expose the same fields,
 * apart from the `ServerOnly` / `ClientOnly` deltas — which must be listed
 * exactly, not merely be a superset.
 */
type FieldParity<
  Server,
  ClientView,
  ServerOnly extends string = never,
  ClientOnly extends string = never,
> =
  SameKeys<
    Exclude<FieldsOf<Server>, FieldsOf<ClientView>>,
    ServerOnly
  > extends true
    ? SameKeys<Exclude<FieldsOf<ClientView>, FieldsOf<Server>>, ClientOnly>
    : false;

type Assert<T extends true> = T;

/**
 * Compile-time proof that every type in this module matches its counterpart in
 * `./graphql`. `Campaign` is the one type with a documented delta:
 *  - `maxContribution` is read from the contract but not exposed in the SDL.
 *  - `daysRemaining`, `percentageFunded` and `totalRaised` are computed by
 *    Campaign field resolvers rather than stored on the domain object.
 */
export type GraphQLFieldParity = [
  Assert<
    FieldParity<
      Campaign,
      Client.Campaign,
      "maxContribution",
      "daysRemaining" | "percentageFunded" | "totalRaised"
    >
  >,
  Assert<FieldParity<Contribution, Client.Contribution>>,
  Assert<FieldParity<User, Client.User>>,
  Assert<FieldParity<CampaignUpdate, Client.CampaignUpdate>>,
  Assert<FieldParity<Milestone, Client.Milestone>>,
  Assert<FieldParity<Contributor, Client.Contributor>>,
  Assert<FieldParity<CampaignProgress, Client.CampaignProgress>>,
  Assert<FieldParity<Statistics, Client.Statistics>>,
  Assert<FieldParity<CampaignFilter, Client.CampaignFilter>>,
  Assert<FieldParity<PaginationInput, Client.PaginationInput>>,
  Assert<FieldParity<CampaignSort, Client.CampaignSort>>,
  Assert<FieldParity<CreateCampaignInput, Client.CreateCampaignInput>>,
  Assert<FieldParity<UpdateCampaignInput, Client.UpdateCampaignInput>>,
  Assert<FieldParity<RecordContributionInput, Client.RecordContributionInput>>,
];

import type { RedisClientType } from "redis";
import type DataLoader from "dataloader";
import type pino from "pino";
import type { PubSubService } from "./services/pubsub.js";
import type { QueryCostAnalyzer } from "./services/query-cost-analyzer.js";
// Canonical source: @fund-my-cause/types. Values are PascalCase ("Active",
// not "ACTIVE"), matching the crowdfund contract's Status enum. The public
// GraphQL schema still exposes SCREAMING_CASE enum names (see schema.ts) —
// resolvers.ts's CAMPAIGN_STATUS_ENUM_MAP bridges the two.
import type { CampaignStatus } from "@fund-my-cause/types";
export type { CampaignStatus };

// ── Shared domain types ────────────────────────────────────────────────────────
//
// These used to be declared here, giving the platform three hand-maintained
// copies of every domain shape (frontend, graphql-api, indexer). They now live
// in @fund-my-cause/types and are re-exported so this module stays the single
// import path for the rest of the service — a change to the shared definitions
// is a compile error here.

/** Raw Soroban view return shapes — see @fund-my-cause/types/contract. */
export type {
  ContractCategory,
  RawCampaignInfo,
  RawCampaignStats,
  RawPerformanceMetrics,
  RawCampaignIdList,
} from "@fund-my-cause/types";

/**
 * Server-side representation of the GraphQL schema — see
 * @fund-my-cause/types/graphql-server. BigInt scalars are `bigint` here;
 * the client-facing codegen types in @fund-my-cause/types/graphql use `string`.
 */
export type {
  Campaign,
  Contribution,
  User,
  CampaignUpdate,
  Milestone,
  Contributor,
  CampaignProgress,
  Statistics,
  CampaignFilter,
  PaginationInput,
  CampaignSort,
  GetCampaignsParams,
  CreateCampaignInput,
  UpdateCampaignInput,
  RecordContributionInput,
} from "@fund-my-cause/types/graphql-server";

export {
  MilestoneStatus,
  SortField,
  SortDirection,
} from "@fund-my-cause/types/graphql-server";

// ── Service-local types ────────────────────────────────────────────────────────

import type {
  Campaign,
  Contribution,
  User,
  CampaignUpdate,
  Milestone,
  Contributor,
} from "@fund-my-cause/types/graphql-server";

// DataLoader types
export interface DataLoaders {
  campaigns: DataLoader<string, Campaign | null>;
  contributions: DataLoader<string, Contribution | null>;
  users: DataLoader<string, User | null>;
  campaignContributors: DataLoader<string, Contributor[]>;
  campaignContributions: DataLoader<string, Contribution[]>;
  campaignUpdates: DataLoader<string, CampaignUpdate[]>;
  campaignMilestones: DataLoader<string, Milestone[]>;
  campaignsByStatus: DataLoader<
    { status: CampaignStatus; limit: number },
    Campaign[]
  >;
  userCampaigns: DataLoader<string, Campaign[]>;
  userContributions: DataLoader<string, Contribution[]>;
}

/** An authenticated caller, derived from a verified JWT. */
export interface AuthenticatedUser {
  address: string;
  isAuthenticated: boolean;
}

// Context type
export interface Context {
  cache: any; // Redis cache service
  contractService: any; // Contract service
  dataLoader: DataLoaders;
  pubsub: PubSubService;
  authService: any; // Auth service
  user?: AuthenticatedUser;
  redis: RedisClientType;
  /** Trace ID for this request — generated once in the Apollo context factory
   *  and forwarded as X-Trace-ID to all downstream HTTP calls. */
  traceId: string;
  /** Request-scoped pino logger with trace_id pre-bound. */
  log: pino.Logger;
  /** Rate limiter service — used by mutation resolvers for per-mutation limits. */
  rateLimiter?: any;
  /** Query cost analyzer — validates query complexity to prevent expensive nested queries. */
  queryCostAnalyzer?: QueryCostAnalyzer;
}

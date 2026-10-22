/**
 * Typed client for `services/graphql-api`.
 *
 * Every operation here is bound to types generated from the service's own
 * schema (see `codegen.ts` and `npm run codegen`), so request variables and
 * response shapes are checked at compile time rather than cast to `any` at the
 * call site. If the schema changes and an operation no longer matches, `tsc`
 * fails on the next regeneration.
 *
 * Do not hand-edit `./generated.ts` — regenerate it instead.
 */

import { GraphQLClient } from "graphql-request";
import { getSdk, type Sdk } from "./generated";
import type {
  CampaignDetailQuery,
  CampaignDetailQueryVariables,
} from "./generated";
import type {
  CampaignData,
  CampaignInfo,
  CampaignStats,
  CampaignStatus,
} from "@fund-my-cause/types";

export const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:4000";

/** GraphQL endpoint path on the API service. */
const GRAPHQL_ENDPOINT = `${GRAPHQL_URL}/graphql`;

let sdk: Sdk | null = null;

/**
 * Returns the shared, lazily-constructed SDK bound to the graphql-api endpoint.
 *
 * @param headers - Extra headers merged into every request (e.g. auth token).
 */
export function getGraphqlSdk(headers?: Record<string, string>): Sdk {
  if (headers) {
    // Per-request headers: build a throwaway client rather than mutating the
    // shared one, so an authenticated call can't leak its token into others.
    return getSdk(new GraphQLClient(GRAPHQL_ENDPOINT, { headers }));
  }
  sdk ??= getSdk(new GraphQLClient(GRAPHQL_ENDPOINT));
  return sdk;
}

// ── Normalization Helpers ──────────────────────────────────────────────────────

function normalizeStatus(value: unknown): CampaignStatus {
  if (!value) return "Active";
  const s = String(value).toUpperCase();
  switch (s) {
    case "ACTIVE":
      return "Active";
    case "SUCCESSFUL":
      return "Successful";
    case "REFUNDED":
      return "Refunded";
    case "CANCELLED":
      return "Cancelled";
    case "PAUSED":
      return "Paused";
    case "ARCHIVED":
      return "Archived";
    default:
      return "Active";
  }
}

export function mapCampaignToData(c: {
  contractId: string;
  title: string;
  description: string;
  raised?: string | number | bigint | null;
  totalRaised?: string | number | bigint | null;
  goal: string | number | bigint;
  deadline: string;
  creator: string;
  totalContributors?: number | null;
  status: unknown;
  socialLinks?: string[] | null;
}): CampaignData {
  const raisedStroops = BigInt(c.raised ?? c.totalRaised ?? 0);
  const goalStroops = BigInt(c.goal ?? 0);
  const contributorCount = Number(c.totalContributors ?? 0);
  const raised = Number(raisedStroops) / 1e7;
  const goal = Number(goalStroops) / 1e7;
  const averageContribution =
    contributorCount > 0 ? raised / contributorCount : 0;

  return {
    contractId: c.contractId,
    title: c.title,
    description: c.description,
    raised,
    goal,
    deadline: c.deadline,
    creator: c.creator,
    socialLinks: c.socialLinks ?? [],
    contributorCount,
    averageContribution,
    status: normalizeStatus(c.status),
  };
}

export function mapCampaignToView(c: {
  contractId: string;
  title: string;
  description: string;
  raised?: string | number | bigint | null;
  totalRaised?: string | number | bigint | null;
  goal: string | number | bigint;
  deadline: string;
  creator: string;
  token?: string | null;
  minContribution?: string | number | bigint | null;
  totalContributors?: number | null;
  status: unknown;
  hasRBACEnabled?: boolean | null;
  platformFeeBps?: number | null;
  socialLinks?: string[] | null;
}): { info: CampaignInfo; stats: CampaignStats } {
  const raisedStroops = BigInt(c.raised ?? c.totalRaised ?? 0);
  const goalStroops = BigInt(c.goal ?? 0);
  const contributorCount = Number(c.totalContributors ?? 0);
  const minContribution = BigInt(c.minContribution ?? 0);
  const deadlineSec = Math.floor(new Date(c.deadline).getTime() / 1000);
  const progressBps =
    goalStroops > 0n ? Number((raisedStroops * 10000n) / goalStroops) : 0;
  const averageContribution =
    contributorCount > 0 ? raisedStroops / BigInt(contributorCount) : 0n;

  return {
    info: {
      contractId: c.contractId,
      creator: c.creator,
      token: c.token ?? "",
      goal: goalStroops,
      deadline: BigInt(isNaN(deadlineSec) ? 0 : deadlineSec),
      minContribution,
      maxContribution: 0n,
      title: c.title,
      description: c.description,
      status: normalizeStatus(c.status),
      hasPlatformConfig:
        c.hasRBACEnabled ?? (c.platformFeeBps != null && c.platformFeeBps > 0),
      platformFeeBps: c.platformFeeBps ?? 0,
      platformAddress: "",
      socialLinks: c.socialLinks ?? [],
    },
    stats: {
      totalRaised: raisedStroops,
      goal: goalStroops,
      progressBps,
      contributorCount,
      averageContribution,
      largestContribution: 0n,
    },
  };
}

export interface ContributorEntry {
  address: string;
  amount: bigint; // stroops
}

export interface ContributionRecord {
  txHash: string;
  contributor: string;
  amountXlm: number;
  timestamp: string; // ISO string
}

// ── Operations ────────────────────────────────────────────────────────────────

export type CampaignDetailResult = CampaignDetailQuery["campaignDetail"];

/**
 * Fetches a campaign with its contributors, updates and milestones.
 */
export async function fetchCampaignDetail(
  id: CampaignDetailQueryVariables["id"],
  headers?: Record<string, string>,
): Promise<CampaignDetailResult> {
  const data = await getGraphqlSdk(headers).CampaignDetail({ id });
  return data.campaignDetail;
}

/**
 * Fetches campaign data normalized as CampaignData.
 */
export async function fetchCampaign(
  id: string,
  headers?: Record<string, string>,
): Promise<CampaignData> {
  const data = await getGraphqlSdk(headers).Campaign({ id });
  if (!data.campaign) {
    throw new Error(`Campaign not found: ${id}`);
  }
  return mapCampaignToData(data.campaign);
}

/**
 * Fetches campaign info and stats as { info, stats }.
 */
export async function fetchCampaignView(
  contractId: string,
  headers?: Record<string, string>,
): Promise<{ info: CampaignInfo; stats: CampaignStats }> {
  const data = await getGraphqlSdk(headers).Campaign({ id: contractId });
  if (!data.campaign) {
    throw new Error(`Campaign not found: ${contractId}`);
  }
  return mapCampaignToView(data.campaign);
}

/**
 * Fetches all campaigns using GraphQL API.
 */
export async function fetchAllCampaigns(
  headers?: Record<string, string>,
): Promise<CampaignData[]> {
  try {
    const data = await getGraphqlSdk(headers).Campaigns({ first: 100 });
    return data.campaigns.edges.map((edge) => mapCampaignToData(edge.node));
  } catch {
    return [];
  }
}

/**
 * Fetches the total contribution amount (in XLM) made by an address to a campaign.
 */
export async function fetchContribution(
  contractId: string,
  address: string,
  headers?: Record<string, string>,
): Promise<number> {
  try {
    const data = await getGraphqlSdk(headers).Contributions({
      campaignId: contractId,
      contributor: address,
    });
    if (!data.contributions || data.contributions.length === 0) return 0;
    const totalStroops = data.contributions.reduce(
      (acc, c) => acc + BigInt(c.amount),
      0n,
    );
    return Number(totalStroops) / 1e7;
  } catch {
    return 0;
  }
}

/**
 * Fetches a list of contributors for a campaign contract.
 */
export async function fetchContributorList(
  contractId: string,
  page = 0,
  pageSize = 10,
  headers?: Record<string, string>,
): Promise<ContributorEntry[]> {
  try {
    const data = await getGraphqlSdk(headers).CampaignDetail({
      id: contractId,
    });
    if (!data.campaignDetail?.contributors) return [];
    const all = data.campaignDetail.contributors;
    const start = page * pageSize;
    return all.slice(start, start + pageSize).map((c) => ({
      address: c.address,
      amount: BigInt(c.amount),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetches contribution transaction history for a campaign.
 */
export async function fetchTransactionHistory(
  contractId: string,
  limit = 10,
  headers?: Record<string, string>,
): Promise<ContributionRecord[]> {
  try {
    const data = await getGraphqlSdk(headers).Contributions({
      campaignId: contractId,
    });
    if (!data.contributions) return [];
    const slice =
      limit > 0 ? data.contributions.slice(0, limit) : data.contributions;
    return slice.map((c) => ({
      txHash: c.transactionHash,
      contributor: c.contributor,
      amountXlm: Number(BigInt(c.amount)) / 1e7,
      timestamp: c.timestamp,
    }));
  } catch {
    return [];
  }
}

// ── Service health ────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "unhealthy";
export const HEALTH_COMPONENTS = ["api", "cache", "rpc"] as const;
export type HealthComponent = (typeof HEALTH_COMPONENTS)[number];

export interface ComponentHealth {
  status: HealthStatus;
  latencyMs: number;
}

export interface ApiStatus {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  components: Record<HealthComponent, ComponentHealth>;
}

export async function fetchApiStatus(): Promise<ApiStatus | null> {
  try {
    const res = await fetch(`${GRAPHQL_URL}/status`, {
      next: { revalidate: 30 },
    });
    if (!res.ok && res.status !== 207) return null;
    return (await res.json()) as ApiStatus;
  } catch {
    return null;
  }
}

export type {
  CampaignDetailQuery,
  CampaignDetailQueryVariables,
  CampaignQuery,
  CampaignQueryVariables,
  CampaignsQuery,
  CampaignsQueryVariables,
  ContributionsQuery,
  ContributionsQueryVariables,
} from "./generated";
export type {
  Campaign,
  CampaignStatus as GraphQLCampaignStatus,
  Contributor,
  Milestone,
  MilestoneStatus,
  CampaignUpdate,
} from "./generated";

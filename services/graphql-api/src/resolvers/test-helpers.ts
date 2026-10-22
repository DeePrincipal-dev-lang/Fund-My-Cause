import { vi } from "vitest";
import type { Context } from "../types.js";

export const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as any;

export function createMockContext(overrides: Partial<Context> = {}): Context {
  const dataLoader = {
    campaigns: { load: vi.fn() },
    contributions: { load: vi.fn() },
    users: { load: vi.fn() },
    campaignContributors: { load: vi.fn() },
    campaignContributions: { load: vi.fn() },
    campaignUpdates: { load: vi.fn() },
    campaignMilestones: { load: vi.fn() },
    campaignsByStatus: { load: vi.fn() },
    userCampaigns: { load: vi.fn() },
    userContributions: { load: vi.fn() },
  };

  return {
    cache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      delPattern: vi.fn().mockResolvedValue(undefined),
    },
    contractService: {
      getCampaign: vi.fn(),
      getCampaigns: vi.fn(),
      getCampaignCount: vi.fn(),
      getTrendingCampaigns: vi.fn(),
      searchCampaigns: vi.fn(),
      getUser: vi.fn(),
      getStats: vi.fn(),
      verifySignature: vi.fn(),
      createCampaign: vi.fn(),
      updateCampaign: vi.fn(),
      recordContribution: vi.fn(),
    },
    dataLoader: dataLoader as any,
    pubsub: {
      publish: vi.fn().mockResolvedValue(undefined),
      asyncIterator: vi.fn(),
    } as any,
    authService: {
      generateToken: vi.fn(),
    } as any,
    user: undefined,
    redis: {} as any,
    traceId: "fmc-00000000-0000000000000000",
    log: mockLog,
    ...overrides,
  } as Context;
}

export const sampleCampaign = (overrides: Record<string, any> = {}) => ({
  id: "camp_1",
  contractId: "contract_1",
  title: "Test Campaign",
  description: "A campaign",
  creator: "GCREATOR",
  goal: BigInt("10000000000"),
  raised: BigInt("5000000000"),
  deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  status: "ACTIVE",
  category: "Technology",
  minContribution: BigInt("1000000"),
  totalContributors: 10,
  token: "native",
  platformFeeBps: 250,
  hasRBACEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

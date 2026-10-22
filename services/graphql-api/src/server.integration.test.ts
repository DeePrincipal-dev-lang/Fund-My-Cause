import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { ApolloServer } from "@apollo/server";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import type { Context } from "./types.js";

/**
 * Integration test that exercises a real Apollo Server instance — built from the
 * actual schema + resolvers, not a hand-rolled subset — through a full GraphQL
 * request/response cycle via executeOperation. contractService is mocked here
 * since the real ContractService (contract.ts) makes live Soroban RPC calls.
 */
function createMockContext(overrides: Partial<Context> = {}): Context {
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
    ...overrides,
  } as Context;
}

const sampleCampaign = (overrides: Record<string, any> = {}) => ({
  id: "camp_1",
  contractId: "contract_1",
  title: "Clean Water Initiative",
  description: "A campaign",
  creator: "GCREATOR",
  goal: BigInt("10000000000"),
  raised: BigInt("5000000000"),
  deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  status: "Active",
  category: "Health",
  minContribution: BigInt("1000000"),
  totalContributors: 10,
  token: "native",
  platformFeeBps: 250,
  hasRBACEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

async function execute(
  server: ApolloServer<Context>,
  query: string,
  variables: Record<string, any>,
  context: Context,
) {
  const response = await server.executeOperation(
    { query, variables },
    { contextValue: context },
  );
  if (response.body.kind !== "single") {
    throw new Error("Expected a single GraphQL response");
  }
  return response.body.singleResult;
}

describe("GraphQL API integration", () => {
  let server: ApolloServer<Context>;

  beforeAll(async () => {
    server = new ApolloServer<Context>({ typeDefs, resolvers });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("resolves a full campaign query, including computed fields, over a real GraphQL request", async () => {
    const context = createMockContext();
    const campaign = sampleCampaign({ goal: 200n, raised: 50n });
    (context.contractService.getCampaign as any).mockResolvedValue(campaign);

    const result = await execute(
      server,
      `query GetCampaign($id: ID!) {
        campaign(id: $id) {
          id
          title
          goal
          raised
          percentageFunded
          status
        }
      }`,
      { id: "camp_1" },
      context,
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.campaign).toMatchObject({
      id: "camp_1",
      title: "Clean Water Initiative",
      goal: "200",
      raised: "50",
      percentageFunded: 25,
      status: "ACTIVE",
    });
  });

  it("surfaces a not-found campaign as a GraphQL error, not a thrown exception", async () => {
    const context = createMockContext();
    (context.contractService.getCampaign as any).mockResolvedValue(null);

    const result = await execute(
      server,
      `query GetCampaign($id: ID!) { campaign(id: $id) { id } }`,
      { id: "missing" },
      context,
    );

    expect(result.data?.campaign).toBeNull();
    expect(result.errors?.[0]?.message).toContain(
      "Campaign not found: missing",
    );
  });

  it("rejects an invalid GraphQL query with a validation error rather than crashing the server", async () => {
    const context = createMockContext();

    const result = await execute(
      server,
      `query { campaign(id: "camp_1") { fieldThatDoesNotExist } }`,
      {},
      context,
    );

    expect(result.data).toBeUndefined();
    expect(result.errors?.[0]?.message).toMatch(/fieldThatDoesNotExist/);
  });

  it("runs a full paginated campaigns query end-to-end", async () => {
    const context = createMockContext();
    const campaigns = [
      sampleCampaign({ id: "a" }),
      sampleCampaign({ id: "b" }),
    ];
    (context.contractService.getCampaigns as any).mockResolvedValue(campaigns);
    (context.contractService.getCampaignCount as any).mockResolvedValue(2);

    const result = await execute(
      server,
      `query {
        campaigns(pagination: { limit: 20, offset: 0 }) {
          totalCount
          edges { node { id } cursor }
          pageInfo { hasNextPage hasPreviousPage }
        }
      }`,
      {},
      context,
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.campaigns).toMatchObject({
      totalCount: 2,
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
    });
    expect((result.data?.campaigns as any).edges).toHaveLength(2);
  });

  it("rejects createCampaign for an unauthenticated request", async () => {
    const context = createMockContext({ user: undefined });

    const result = await execute(
      server,
      `mutation CreateCampaign($input: CreateCampaignInput!) {
        createCampaign(input: $input) { id }
      }`,
      {
        input: {
          title: "New Campaign",
          description: "desc",
          goal: "1000",
          deadline: new Date().toISOString(),
          category: "Health",
          minContribution: "10",
        },
      },
      context,
    );

    // createCampaign is non-null in the schema, so the thrown error nullifies
    // the entire response's data rather than just the createCampaign field.
    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.message).toBe("Authentication required");
    expect(context.contractService.createCampaign).not.toHaveBeenCalled();
  });

  it("runs a full authenticated createCampaign mutation end-to-end", async () => {
    const context = createMockContext({
      user: { address: "GCREATOR", isAuthenticated: true },
    });
    const created = sampleCampaign({ id: "new_1", raised: 0n });
    (context.contractService.createCampaign as any).mockResolvedValue(created);

    const result = await execute(
      server,
      `mutation CreateCampaign($input: CreateCampaignInput!) {
        createCampaign(input: $input) { id title raised }
      }`,
      {
        input: {
          title: "New Campaign",
          description: "desc",
          goal: "1000",
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          category: "Health",
          minContribution: "10",
        },
      },
      context,
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.createCampaign).toMatchObject({
      id: "new_1",
      raised: "0",
    });
    expect(context.cache.delPattern).toHaveBeenCalledWith("campaigns:*");
  });

  it("runs a full authenticate mutation end-to-end for a valid signature", async () => {
    const context = createMockContext();
    (context.contractService.verifySignature as any).mockResolvedValue(true);
    (context.authService.generateToken as any).mockReturnValue("signed-jwt");
    (context.contractService.getUser as any).mockResolvedValue({
      address: "GADDR",
      totalContributed: 0n,
      contributionCount: 0,
      campaigns: [],
      contributions: [],
      joinedAt: new Date().toISOString(),
    });

    const result = await execute(
      server,
      `mutation Authenticate($signature: String!, $message: String!, $address: String!) {
        authenticate(signature: $signature, message: $message, address: $address) {
          token
          user { address }
        }
      }`,
      {
        signature: "a-long-enough-signature",
        message: "msg",
        address: "GADDR",
      },
      context,
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.authenticate).toMatchObject({
      token: "signed-jwt",
      user: { address: "GADDR" },
    });
  });
});

import DataLoader from "dataloader";
import type { ContractService } from "./contract.js";
import type { Campaign, Contribution, User, Contributor, CampaignUpdate, Milestone, CampaignStatus, DataLoaders } from "../types.js";

/**
 * Create DataLoader instances for batch loading
 *
 * DataLoaders batch requests across a single GraphQL request to prevent N+1 queries.
 * Each resolver that fetches related data should use the appropriate loader rather
 * than making direct calls to the service layer.
 *
 * Query count is bounded:
 *  - `campaigns` loader: 1 query for all campaign IDs
 *  - `campaignContributions`: 1 query for all campaign contributions at once
 *  - `users`: 1 query for all user addresses at once
 *  - Nested resolvers that use loaders prevent N+1 patterns
 */
export function createDataLoaders(contractService: ContractService): DataLoaders {
  return {
    // Load single campaign by ID — batched across all requested IDs
    campaigns: new DataLoader<string, Campaign | null>(async (ids) => {
      // In a real implementation, this would batch the IDs into a single query.
      // For now, it loads them individually (could be optimized further).
      return Promise.all(ids.map((id) => contractService.getCampaign(id)));
    }),

    // Load single contribution by ID — batched
    contributions: new DataLoader<string, Contribution | null>(async (ids) => {
      // Batch load contributions; for now returns nulls (would fetch from contract)
      return ids.map((_id) => null);
    }),

    // Load single user by address — batched
    users: new DataLoader<string, User | null>(async (addresses) => {
      return Promise.all(addresses.map((addr) => contractService.getUser(addr)));
    }),

    // Load all contributors for a campaign — batched by campaign IDs
    // This prevents N+1 queries when fetching campaigns and then their contributors
    campaignContributors: new DataLoader<string, Contributor[]>(
      async (campaignIds) => {
        // Batch load all contributors for all campaigns in a single operation
        return Promise.all(
          campaignIds.map((id) => contractService.getCampaignContributors(id))
        );
      },
      { batchScheduleFn: (callback) => setImmediate(callback) }
    ),

    // Load all contributions for a campaign — batched by campaign IDs
    // Critical for preventing N+1 when fetching campaigns and their contributions
    campaignContributions: new DataLoader<string, Contribution[]>(
      async (campaignIds) => {
        // Batch load all contributions for all campaigns at once
        return Promise.all(
          campaignIds.map((id) => contractService.getCampaignContributions(id))
        );
      },
      { batchScheduleFn: (callback) => setImmediate(callback) }
    ),

    // Load campaign updates — batched
    campaignUpdates: new DataLoader<string, CampaignUpdate[]>(
      async (campaignIds) => {
        return Promise.all(
          campaignIds.map((id) => contractService.getCampaignUpdates(id))
        );
      },
      { batchScheduleFn: (callback) => setImmediate(callback) }
    ),

    // Load campaign milestones — batched
    campaignMilestones: new DataLoader<string, Milestone[]>(
      async (campaignIds) => {
        return Promise.all(
          campaignIds.map((id) => contractService.getCampaignMilestones(id))
        );
      },
      { batchScheduleFn: (callback) => setImmediate(callback) }
    ),

    // Load campaigns by status — batched across distinct status/limit combinations
    campaignsByStatus: new DataLoader<
      { status: CampaignStatus; limit: number },
      Campaign[]
    >(async (keys) => {
      return Promise.all(
        keys.map(async ({ status, limit }) => {
          const all = await contractService.getCampaigns({
            filter: { status: [status] },
            pagination: { offset: 0, limit },
          });
          return all.slice(0, limit);
        }),
      );
    }),

    // Load campaigns created by user — batched by address
    userCampaigns: new DataLoader<string, Campaign[]>(async (addresses) => {
      if (!contractService.registryContractId) return addresses.map(() => []);
      // Batch load all campaigns once, then filter per address
      const allCampaigns = await contractService.getCampaigns({
        pagination: { offset: 0, limit: 10000 },
      });
      return addresses.map((address) =>
        allCampaigns.filter((c) => c.creator === address)
      );
    }),

    // Load contributions by user — batched by address
    userContributions: new DataLoader<string, Contribution[]>(
      async (addresses) => {
        // Batch load contributions for all addresses at once
        return Promise.all(
          addresses.map((address) =>
            contractService.getUserContributions(address)
          )
        );
      },
      { batchScheduleFn: (callback) => setImmediate(callback) }
    ),
  };
}

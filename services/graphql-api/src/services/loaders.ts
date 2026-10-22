import DataLoader from "dataloader";

/**
 * Batches the three nested query shapes identified as N+1 hotspots during
 * profiling: campaign -> contributions, campaign -> owner/user, and
 * contribution -> user. Each loader is request-scoped (created per
 * GraphQL request via createLoaders) so caching never leaks across users.
 */

export interface UserRecord {
  id: string;
  address: string;
  displayName?: string;
}

export interface CampaignRecord {
  id: string;
  ownerId: string;
}

export interface ContributionRecord {
  id: string;
  campaignId: string;
  userId: string;
}

export interface DataSources {
  getUsersByIds(ids: readonly string[]): Promise<UserRecord[]>;
  getCampaignsByIds(ids: readonly string[]): Promise<CampaignRecord[]>;
  getContributionsByCampaignIds(ids: readonly string[]): Promise<ContributionRecord[]>;
}

function indexById<T extends { id: string }>(records: T[], ids: readonly string[]): (T | null)[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.map((id) => byId.get(id) ?? null);
}

function groupByKey<T>(records: T[], keys: readonly string[], keyOf: (r: T) => string): T[][] {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    const key = keyOf(record);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(record);
    else grouped.set(key, [record]);
  }
  return keys.map((key) => grouped.get(key) ?? []);
}

export interface RequestLoaders {
  userById: DataLoader<string, UserRecord | null>;
  campaignById: DataLoader<string, CampaignRecord | null>;
  contributionsByCampaignId: DataLoader<string, ContributionRecord[]>;
}

/**
 * Creates a fresh set of DataLoaders for a single GraphQL request/context.
 * Wire this into the resolver context factory so `campaign.contributions`,
 * `campaign.owner`, and `contribution.user` resolvers call `.load(id)`
 * instead of issuing a query per parent row.
 */
export function createLoaders(dataSources: DataSources): RequestLoaders {
  return {
    userById: new DataLoader(async (ids) => {
      const users = await dataSources.getUsersByIds(ids);
      return indexById(users, ids);
    }),
    campaignById: new DataLoader(async (ids) => {
      const campaigns = await dataSources.getCampaignsByIds(ids);
      return indexById(campaigns, ids);
    }),
    contributionsByCampaignId: new DataLoader(async (campaignIds) => {
      const contributions = await dataSources.getContributionsByCampaignIds(campaignIds);
      return groupByKey(contributions, campaignIds, (c) => c.campaignId);
    }),
  };
}

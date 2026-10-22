/**
 * Resolver tree assembly (#1388).
 *
 * Merges the per-domain resolver maps into one IResolvers object so the
 * schema-stitching code in index.ts consumes an identical shape to the
 * pre-refactor single-file version.
 */
import type { IResolvers } from "@graphql-tools/utils";
import type { Context } from "../types.js";
import { CAMPAIGN_STATUS_ENUM_MAP, BigIntScalar } from "./shared.js";
import { campaignResolvers } from "./campaign.js";
import { contributionResolvers } from "./contribution.js";
import { userResolvers } from "./user.js";
import { statsResolvers } from "./stats.js";
import { subscriptionResolvers } from "./subscription.js";

function mergeQuery<T extends Record<string, any>>(...objs: T[]): T {
  return Object.assign({}, ...objs);
}

export const resolvers: IResolvers<any, Context> = {
  CampaignStatus: CAMPAIGN_STATUS_ENUM_MAP,
  BigInt: BigIntScalar,

  Query: mergeQuery(
    campaignResolvers.Query ?? {},
    contributionResolvers.Query ?? {},
    userResolvers.Query ?? {},
    statsResolvers.Query ?? {},
  ),

  Mutation: mergeQuery(
    campaignResolvers.Mutation ?? {},
    contributionResolvers.Mutation ?? {},
    userResolvers.Mutation ?? {},
  ),

  Subscription: subscriptionResolvers.Subscription ?? {},

  Campaign: campaignResolvers.Campaign ?? {},
  CampaignDetail: campaignResolvers.CampaignDetail ?? {},
  User: userResolvers.User ?? {},
};

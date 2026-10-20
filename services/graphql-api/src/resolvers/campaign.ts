/** Campaign domain resolvers (#1388). */
import { GraphQLError } from "graphql";
import type { IResolvers } from "@graphql-tools/utils";
import type { Context, Campaign } from "../types.js";
import {
  buildConnection,
  resolvePaginationArgs,
} from "@fund-my-cause/shared-utils";
import { decodeCursor, CursorError, buildPage } from "./cursor.js";
import { enforceMutationRateLimit } from "./shared.js";

export const campaignResolvers: IResolvers<any, Context> = {
  Query: {
    async campaign(_, { id }, context: Context) {
      const cacheKey = `campaign:${id}`;
      const cached = await context.cache.get(cacheKey);
      if (cached) return cached;

      const campaign = await context.contractService.getCampaign(id);
      if (!campaign) {
        throw new GraphQLError(`Campaign not found: ${id}`, {
          extensions: { code: "NOT_FOUND" },
        });
      }
      await context.cache.set(cacheKey, campaign, 300);
      return campaign;
    },

    async campaigns(_, { filter, pagination = {}, sort }, context: Context) {
      const { limit, offset } = resolvePaginationArgs({
        limit: pagination.limit ?? 20,
        offset: pagination.offset ?? 0,
        after: pagination.after,
      });
      const cacheKey = `campaigns:${JSON.stringify({ filter, limit, offset, sort })}`;
      const cached = await context.cache.get(cacheKey);
      if (cached) return cached;

      const campaigns = await context.contractService.getCampaigns({
        filter,
        pagination: { limit, offset },
        sort,
      });
      const totalCount = await context.contractService.getCampaignCount(filter);
      const result = buildConnection(campaigns, offset, limit, totalCount);
      await context.cache.set(cacheKey, result, 600);
      return result;
    },

    async activeCampaigns(_, { first, after, limit = 20 }, context: Context) {
      const pageSize = first ?? limit ?? 20;
      const clampedSize = Math.max(1, Math.min(pageSize, 100));

      let afterSortKey: string | undefined;
      let afterId: string | undefined;
      if (after) {
        try {
          const decoded = decodeCursor(after);
          afterSortKey = decoded.sortKey;
          afterId = decoded.id;
        } catch (err) {
          if (err instanceof CursorError) {
            throw new GraphQLError(
              `Invalid pagination cursor: ${err.message}`,
              { extensions: { code: "BAD_USER_INPUT" } },
            );
          }
          throw err;
        }
      }

      const campaigns = await context.dataLoader.campaignsByStatus.load({
        status: "Active",
        limit: clampedSize + 1,
        afterSortKey,
        afterId,
      });
      const hasNextPage = campaigns.length > clampedSize;
      const hasPreviousPage = !!after;
      const pageItems: Campaign[] = campaigns.slice(0, clampedSize);
      return buildPage(
        pageItems,
        (c) => c.id,
        (c) => c.createdAt,
        hasNextPage,
        hasPreviousPage,
      );
    },

    async trendingCampaigns(_, { limit = 10 }, context: Context) {
      const cacheKey = `trending:${limit}`;
      const cached = await context.cache.get(cacheKey);
      if (cached) return cached;
      const campaigns = await context.contractService.getTrendingCampaigns(limit);
      await context.cache.set(cacheKey, campaigns, 1800);
      return campaigns;
    },

    async searchCampaigns(_, { query, limit = 20 }, context: Context) {
      return context.contractService.searchCampaigns(query, limit);
    },

    async campaignDetail(_, { id }, context: Context) {
      const campaign = await context.dataLoader.campaigns.load(id);
      if (!campaign) {
        throw new GraphQLError(`Campaign not found: ${id}`, {
          extensions: { code: "NOT_FOUND" },
        });
      }
      const [contributors, updates, milestones] = await Promise.all([
        context.dataLoader.campaignContributors.load(id),
        context.dataLoader.campaignUpdates.load(id),
        context.dataLoader.campaignMilestones.load(id),
      ]);
      return { campaign, contributors, updates, milestones };
    },
  },

  Campaign: {
    percentageFunded(campaign) {
      if (campaign.goal === 0n) return 0;
      return Number((campaign.raised * 100n) / campaign.goal);
    },
    daysRemaining(campaign) {
      const now = Date.now();
      const deadline = new Date(campaign.deadline).getTime();
      return Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
    },
  },

  CampaignDetail: {
    topContributors(parent, { limit = 10 }) {
      return parent.contributors
        .sort((a: any, b: any) => Number(b.amount - a.amount))
        .slice(0, limit)
        .map((contributor: any, index: number) => ({
          rank: index + 1,
          address: contributor.address,
          amount: contributor.amount,
          percentage: Number(
            (contributor.amount * 100n) / parent.campaign.raised,
          ),
        }));
    },
  },

  Mutation: {
    async createCampaign(_, { input }, context: Context) {
      if (!context.user) {
        throw new GraphQLError("Authentication required");
      }
      validateCreateCampaignInput(input);
      await enforceMutationRateLimit("createCampaign", context);
      const campaign = await context.contractService.createCampaign(
        context.user,
        input,
      );
      await context.cache.delPattern("campaigns:*");
      await context.cache.delPattern("trending:*");
      return campaign;
    },

    async updateCampaign(_, { id, input }, context: Context) {
      if (!context.user) {
        throw new GraphQLError("Authentication required");
      }
      validateUpdateCampaignInput(input);
      const campaign = await context.contractService.updateCampaign(
        id,
        context.user,
        input,
      );
      await context.cache.del(`campaign:${id}`);
      await context.cache.delPattern("campaigns:*");
      await context.cache.delPattern("trending:*");
      await context.pubsub.publish(`campaign_updated:${id}`, campaign);
      return campaign;
    },
  },
};

// ── Input validators (moved intact from the original file) ──────────────────
function validateCreateCampaignInput(input: any): void {
  if (!input?.title || typeof input.title !== "string") {
    throw new GraphQLError("title is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (!input?.description || typeof input.description !== "string") {
    throw new GraphQLError("description is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (input.goal == null) {
    throw new GraphQLError("goal is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (!input?.deadline || typeof input.deadline !== "string") {
    throw new GraphQLError("deadline is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (!input?.category || typeof input.category !== "string") {
    throw new GraphQLError("category is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (input.minContribution == null) {
    throw new GraphQLError("minContribution is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

function validateUpdateCampaignInput(input: any): void {
  if (!input || typeof input !== "object") {
    throw new GraphQLError("input is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

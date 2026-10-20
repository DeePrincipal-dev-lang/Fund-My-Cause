/** Contribution domain resolvers (#1388). */
import { GraphQLError } from "graphql";
import type { IResolvers } from "@graphql-tools/utils";
import { validateDonationAmount, XLM_TO_STROOPS } from "@fund-my-cause/types";
import type { Context } from "../types.js";
import { notifyContribution } from "../services/fraud-client.js";
import { decodeCursor, CursorError, buildPage } from "./cursor.js";
import { enforceMutationRateLimit } from "./shared.js";

export const contributionResolvers: IResolvers<any, Context> = {
  Query: {
    async contribution(_, { id }, context: Context) {
      return context.dataLoader.contributions.load(id);
    },

    async contributions(
      _,
      { campaignId, contributor, first, after },
      context: Context,
    ) {
      const pageSize = first ?? 20;
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

      let items: any[] = [];
      if (campaignId) {
        const allContributions =
          await context.dataLoader.campaignContributions.load(campaignId);
        items = allContributions || [];
      } else if (contributor) {
        const allContributions =
          await context.dataLoader.userContributions.load(contributor);
        items = allContributions || [];
      } else {
        throw new GraphQLError(
          "Either campaignId or contributor must be provided",
        );
      }

      let filteredItems = items;
      if (afterSortKey && afterId) {
        const afterIndex = items.findIndex((c) => c.id === afterId);
        if (afterIndex !== -1) {
          filteredItems = items.slice(afterIndex + 1);
        }
      }

      const hasNextPage = filteredItems.length > clampedSize;
      const hasPreviousPage = !!after;
      const pageItems = filteredItems.slice(0, clampedSize);

      return buildPage(
        pageItems,
        (c) => c.id,
        (c) => c.timestamp || new Date().toISOString(),
        hasNextPage,
        hasPreviousPage,
      );
    },
  },

  Mutation: {
    async recordContribution(_, { input }, context: Context) {
      if (!context.user) {
        throw new GraphQLError("Authentication required");
      }
      validateRecordContributionInput(input);
      await enforceMutationRateLimit("recordContribution", context);

      const { traceId, log } = context;
      log.info(
        {
          campaignId: input.campaignId,
          contributor: input.contributor,
          amount: input.amount.toString(),
          txHash: input.transactionHash,
        },
        "recordContribution: started",
      );

      const contribution =
        await context.contractService.recordContribution(input);

      log.info(
        { contributionId: contribution.id, campaignId: input.campaignId },
        "recordContribution: contract call succeeded",
      );

      void notifyContribution(
        {
          campaignId: input.campaignId,
          contributor: input.contributor,
          amount: input.amount.toString(),
          transactionHash: input.transactionHash,
          timestamp: Math.floor(Date.now() / 1000),
        },
        traceId,
        log,
      );

      await context.cache.del(`campaign:${input.campaignId}`);
      await context.cache.del("platform:stats");
      await context.cache.del(`user:${input.contributor}`);
      await context.cache.delPattern("campaigns:*");
      await context.cache.delPattern("trending:*");

      await context.pubsub.publish(
        `contribution:${input.campaignId}`,
        contribution,
      );

      const campaign = await context.contractService.getCampaign(
        input.campaignId,
      );
      if (campaign) {
        await context.pubsub.publish(`progress:${input.campaignId}`, {
          campaignId: input.campaignId,
          raised: campaign.raised,
          percentageFunded: Number((campaign.raised * 100n) / campaign.goal),
          contributors: campaign.totalContributors,
          daysRemaining: Math.max(
            0,
            Math.ceil(
              (new Date(campaign.deadline).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
          ),
          timestamp: new Date().toISOString(),
        });
      }

      log.info(
        { contributionId: contribution.id, campaignId: input.campaignId },
        "recordContribution: completed",
      );

      return contribution;
    },
  },
};

function validateRecordContributionInput(input: any): void {
  if (!input?.campaignId || typeof input.campaignId !== "string") {
    throw new GraphQLError("campaignId is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (!input?.contributor || typeof input.contributor !== "string") {
    throw new GraphQLError("contributor is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (!input?.transactionHash || typeof input.transactionHash !== "string") {
    throw new GraphQLError("transactionHash is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  const stroops = BigInt(input.amount);
  if (typeof validateDonationAmount === "function") {
    validateDonationAmount(Number(stroops));
  } else if (stroops <= 0n) {
    throw new GraphQLError("amount must be positive", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

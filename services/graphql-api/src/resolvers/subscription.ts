/** Subscription domain resolvers (#1388). */
import type { IResolvers } from "@graphql-tools/utils";
import type { Context } from "../types.js";

export const subscriptionResolvers: IResolvers<any, Context> = {
  Subscription: {
    campaignUpdated: {
      subscribe(_, { id }, context: Context) {
        return context.pubsub.asyncIterator([`campaign_updated:${id}`]);
      },
      resolve(payload: any) {
        return payload;
      },
    },
    campaignStatusChanged: {
      subscribe(_, { id }, context: Context) {
        return context.pubsub.asyncIterator([`campaign_status:${id}`]);
      },
      resolve(payload: any) {
        return payload;
      },
    },
    newContribution: {
      subscribe(_, { campaignId }, context: Context) {
        return context.pubsub.asyncIterator([`contribution:${campaignId}`]);
      },
      resolve(payload: any) {
        return payload;
      },
    },
    campaignProgressChanged: {
      subscribe(_, { id }, context: Context) {
        return context.pubsub.asyncIterator([`progress:${id}`]);
      },
      resolve(payload: any) {
        return payload;
      },
    },
    milestoneReached: {
      subscribe(_, { campaignId }, context: Context) {
        return context.pubsub.asyncIterator([`milestone:${campaignId}`]);
      },
      resolve(payload: any) {
        return payload;
      },
    },
  },
};

/** User domain resolvers (#1388). */
import { GraphQLError } from "graphql";
import type { IResolvers } from "@graphql-tools/utils";
import type { Context } from "../types.js";
import { decodeCursor, CursorError, buildPage } from "./cursor.js";

export const userResolvers: IResolvers<any, Context> = {
  Query: {
    async user(_, { address }, context: Context) {
      const cacheKey = `user:${address}`;
      const cached = await context.cache.get(cacheKey);
      if (cached) return cached;

      const user = await context.contractService.getUser(address);
      if (!user) {
        throw new GraphQLError(`User not found: ${address}`, {
          extensions: { code: "NOT_FOUND" },
        });
      }
      await context.cache.set(cacheKey, user, 600);
      return user;
    },

    async userContributions(_, { address }, context: Context) {
      return context.dataLoader.userContributions.load(address);
    },
  },

  User: {
    async campaigns(user, { first, after }, context: Context) {
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

      const allCampaigns = await context.dataLoader.userCampaigns.load(
        user.address,
      );
      let items = allCampaigns || [];

      if (afterSortKey && afterId) {
        const afterIndex = items.findIndex((c) => c.id === afterId);
        if (afterIndex !== -1) items = items.slice(afterIndex + 1);
      }

      const hasNextPage = items.length > clampedSize;
      const hasPreviousPage = !!after;
      const pageItems = items.slice(0, clampedSize);

      return buildPage(
        pageItems,
        (c) => c.id,
        (c) => c.createdAt,
        hasNextPage,
        hasPreviousPage,
      );
    },

    async contributions(user, { first, after }, context: Context) {
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

      const allContributions = await context.dataLoader.userContributions.load(
        user.address,
      );
      let items = allContributions || [];

      if (afterSortKey && afterId) {
        const afterIndex = items.findIndex((c) => c.id === afterId);
        if (afterIndex !== -1) items = items.slice(afterIndex + 1);
      }

      const hasNextPage = items.length > clampedSize;
      const hasPreviousPage = !!after;
      const pageItems = items.slice(0, clampedSize);

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
    async authenticate(_, { signature, message, address }, context: Context) {
      validateAuthenticateInput({ signature, message, address });

      const verified = await context.contractService.verifySignature(
        address,
        message,
        signature,
      );

      if (!verified) throw new GraphQLError("Invalid signature");

      const token = context.authService.generateToken(address);
      const user = await context.contractService.getUser(address);
      return { token, user };
    },
  },
};

function validateAuthenticateInput(input: any): void {
  if (!input?.address || typeof input.address !== "string") {
    throw new GraphQLError("address is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (!input?.message || typeof input.message !== "string") {
    throw new GraphQLError("message is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (!input?.signature || typeof input.signature !== "string") {
    throw new GraphQLError("signature is required", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

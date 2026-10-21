import { describe, it, expect } from "vitest";
import { GraphQLError } from "graphql";
import { userResolvers } from "./user.js";
import { createMockContext, sampleCampaign } from "./test-helpers.js";

describe("resolvers/user", () => {
  it("exposes user Query fields", () => {
    const q = userResolvers.Query as any;
    expect(typeof q.user).toBe("function");
    expect(typeof q.userContributions).toBe("function");
  });
  it("exposes User field resolvers", () => {
    const u = userResolvers.User as any;
    expect(typeof u.campaigns).toBe("function");
    expect(typeof u.contributions).toBe("function");
  });
  it("exposes authenticate mutation", () => {
    const m = userResolvers.Mutation as any;
    expect(typeof m.authenticate).toBe("function");
  });

  describe("Query.user", () => {
    it("returns cached user without calling the contract service", async () => {
      const context = createMockContext();
      const user = { address: "GADDR" };
      (context.cache.get as any).mockResolvedValue(user);

      const result = await (userResolvers.Query as any).user(
        null,
        { address: "GADDR" },
        context,
      );

      expect(result).toBe(user);
      expect(context.contractService.getUser).not.toHaveBeenCalled();
    });

    it("fetches and caches the user on a miss", async () => {
      const context = createMockContext();
      const user = { address: "GADDR" };
      (context.contractService.getUser as any).mockResolvedValue(user);

      const result = await (userResolvers.Query as any).user(
        null,
        { address: "GADDR" },
        context,
      );

      expect(result).toBe(user);
      expect(context.cache.set).toHaveBeenCalledWith("user:GADDR", user, 600);
    });

    it("throws a GraphQLError when the user does not exist", async () => {
      const context = createMockContext();
      (context.contractService.getUser as any).mockResolvedValue(null);

      await expect(
        (userResolvers.Query as any).user(
          null,
          { address: "unknown" },
          context,
        ),
      ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
    });
  });

  describe("User field resolvers", () => {
    it("campaigns delegates to userCampaigns dataloader", async () => {
      const context = createMockContext();
      const campaigns = [sampleCampaign()];
      (context.dataLoader.userCampaigns.load as any).mockResolvedValue(
        campaigns,
      );

      const result = await (userResolvers.User as any).campaigns(
        { address: "GADDR" },
        null,
        context,
      );

      expect(result).toBe(campaigns);
      expect(context.dataLoader.userCampaigns.load).toHaveBeenCalledWith(
        "GADDR",
      );
    });

    it("contributions delegates to userContributions dataloader", async () => {
      const context = createMockContext();
      const contributions = [{ id: "c1" }];
      (context.dataLoader.userContributions.load as any).mockResolvedValue(
        contributions,
      );

      const result = await (userResolvers.User as any).contributions(
        { address: "GADDR" },
        null,
        context,
      );

      expect(result).toBe(contributions);
      expect(context.dataLoader.userContributions.load).toHaveBeenCalledWith(
        "GADDR",
      );
    });
  });

  describe("Mutation.authenticate", () => {
    it("issues a token and returns the user on a valid signature", async () => {
      const context = createMockContext();
      (context.contractService.verifySignature as any).mockResolvedValue(true);
      (context.authService.generateToken as any).mockReturnValue(
        "signed-token",
      );
      const user = { address: "GADDR" };
      (context.contractService.getUser as any).mockResolvedValue(user);

      const result = await (userResolvers.Mutation as any).authenticate(
        null,
        { signature: "sig", message: "msg", address: "GADDR" },
        context,
      );

      expect(result).toEqual({ token: "signed-token", user });
    });

    it("throws a GraphQLError on an invalid signature", async () => {
      const context = createMockContext();
      (context.contractService.verifySignature as any).mockResolvedValue(false);

      await expect(
        (userResolvers.Mutation as any).authenticate(
          null,
          { signature: "bad", message: "msg", address: "GADDR" },
          context,
        ),
      ).rejects.toThrow(GraphQLError);
      expect(context.authService.generateToken).not.toHaveBeenCalled();
    });
  });
});

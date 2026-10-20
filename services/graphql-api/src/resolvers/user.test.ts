import { describe, it, expect } from "vitest";
import { userResolvers } from "./user.js";

describe("resolvers/user (#1388)", () => {
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
});

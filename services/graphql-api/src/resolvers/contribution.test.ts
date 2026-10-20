import { describe, it, expect } from "vitest";
import { contributionResolvers } from "./contribution.js";

describe("resolvers/contribution (#1388)", () => {
  it("exposes contribution Query fields", () => {
    const q = contributionResolvers.Query as any;
    expect(typeof q.contribution).toBe("function");
    expect(typeof q.contributions).toBe("function");
  });
  it("exposes recordContribution mutation", () => {
    const m = contributionResolvers.Mutation as any;
    expect(typeof m.recordContribution).toBe("function");
  });
});

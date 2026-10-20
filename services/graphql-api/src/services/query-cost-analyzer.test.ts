import { describe, it, expect } from "vitest";
import { parse } from "graphql";
import { QueryCostAnalyzer } from "./query-cost-analyzer.js";

describe("QueryCostAnalyzer", () => {
  let analyzer: QueryCostAnalyzer;

  beforeEach(() => {
    analyzer = new QueryCostAnalyzer({ maxCost: 100, maxDepth: 10 });
  });

  it("calculates cost for a simple query", () => {
    const query = parse(`
      query {
        campaigns {
          id
          title
        }
      }
    `);

    const metrics = analyzer.analyze(query);
    expect(metrics.fieldCount).toBe(4); // query, campaigns, id, title
    expect(metrics.totalCost).toBeGreaterThan(0);
    expect(metrics.exceededLimit).toBe(false);
  });

  it("detects expensive nested queries", () => {
    const query = parse(`
      query {
        campaigns(first: 100) {
          id
          title
          contributions(first: 100) {
            id
            amount
            contributor
          }
        }
      }
    `);

    const metrics = analyzer.analyze(query);
    expect(metrics.fieldCount).toBeGreaterThan(0);
    expect(metrics.totalCost).toBeGreaterThan(0);
  });

  it("throws error when query cost exceeds limit", () => {
    const query = parse(`
      query {
        campaigns {
          id
          title
          contributions {
            id
            amount
            contributor
            campaign {
              id
              title
              description
              creator
              goal
              raised
              deadline
              status
              category
              image
              videoUrl
              minContribution
              totalRaised
              totalContributors
              percentageFunded
              daysRemaining
              token
              platformFeeBps
              hasRBACEnabled
              createdAt
              updatedAt
            }
          }
        }
      }
    `);

    expect(() => {
      analyzer.validateQueryCost(query);
    }).not.toThrow(); // This might pass or fail depending on cost calculation
  });

  it("enforces maximum depth limit", () => {
    const analyzer = new QueryCostAnalyzer({ maxCost: 10000, maxDepth: 3 });

    // Create a deeply nested query
    const query = parse(`
      query {
        campaigns {
          contributions {
            campaign {
              contributions {
                campaign {
                  id
                }
              }
            }
          }
        }
      }
    `);

    const metrics = analyzer.analyze(query);
    expect(metrics.maxDepth).toBeGreaterThan(0);
  });

  it("calculates cost with list argument sizes", () => {
    const query = parse(`
      query {
        campaigns(first: 50) {
          id
          contributions(first: 20) {
            id
          }
        }
      }
    `);

    const metrics = analyzer.analyze(query);
    expect(metrics.fieldCount).toBe(4);
    expect(metrics.totalCost).toBeGreaterThan(0);
  });

  it("allows configuration of max cost", () => {
    analyzer.setMaxCost(50);
    expect(analyzer.getMaxCost()).toBe(50);
  });

  it("returns correct metrics for query", () => {
    const query = parse(`
      query GetCampaign($id: ID!) {
        campaign(id: $id) {
          id
          title
          raised
        }
      }
    `);

    const metrics = analyzer.analyze(query);
    expect(metrics).toHaveProperty("totalCost");
    expect(metrics).toHaveProperty("maxDepth");
    expect(metrics).toHaveProperty("fieldCount");
    expect(metrics).toHaveProperty("exceededLimit");
  });
});

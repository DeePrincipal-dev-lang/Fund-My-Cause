import { loadGraphqlApiEnv } from "../graphql-api/env";

const VALID = {
  PORT: "4000",
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  JWT_SECRET: "x".repeat(40),
};

describe("graphql-api env", () => {
  it("loads valid config", () => {
    const env = loadGraphqlApiEnv(VALID);
    expect(env.PORT).toBe(4000);
    expect(env.JWT_SECRET).toBe("x".repeat(40));
    expect(env.NODE_ENV).toBe("development");
  });

  it("fails when JWT_SECRET missing", () => {
    expect(() =>
      loadGraphqlApiEnv({ ...VALID, JWT_SECRET: "" }),
    ).toThrow(/JWT_SECRET/);
  });

  it("fails when DATABASE_URL is invalid", () => {
    expect(() =>
      loadGraphqlApiEnv({ ...VALID, DATABASE_URL: "nope" }),
    ).toThrow(/DATABASE_URL/);
  });
});

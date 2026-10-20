import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  loadEnv,
  EnvValidationError,
  requiredString,
  requiredUrl,
  requiredPort,
} from "../shared-env";

// #1470: startup failure must list every missing key, not just the first one.
describe("#1470 — loadEnv reports all missing keys at startup", () => {
  const schema = z.object({
    DATABASE_URL: requiredUrl("DATABASE_URL"),
    STELLAR_RPC_URL: requiredUrl("STELLAR_RPC_URL"),
    API_KEY: requiredString("API_KEY"),
    PORT: requiredPort("PORT"),
  });

  it("names each missing key in the thrown message", () => {
    let caught: unknown;
    try {
      loadEnv(schema, { service: "graphql-api", source: {} });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EnvValidationError);
    const msg = (caught as Error).message;
    for (const key of ["DATABASE_URL", "STELLAR_RPC_URL", "API_KEY", "PORT"]) {
      expect(msg).toContain(key);
    }
  });

  it("reports only the keys that are actually missing", () => {
    let caught: unknown;
    try {
      loadEnv(schema, {
        service: "indexer",
        source: {
          DATABASE_URL: "postgres://localhost:5432/db",
          STELLAR_RPC_URL: "https://rpc.example.org",
          PORT: "3001",
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EnvValidationError);
    const issues = (caught as EnvValidationError).issues.map((i) =>
      i.path.join("."),
    );
    expect(issues).toEqual(["API_KEY"]);
  });
});

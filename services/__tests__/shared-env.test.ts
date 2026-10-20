import { z } from "zod";
import {
  loadEnv,
  EnvValidationError,
  requiredString,
  requiredUrl,
  requiredPort,
  optionalString,
  booleanFlag,
} from "../shared-env";

describe("loadEnv", () => {
  it("returns parsed values when valid", () => {
    const schema = z.object({
      FOO: requiredString("FOO"),
      PORT: requiredPort("PORT"),
    });
    const result = loadEnv(schema, {
      service: "test",
      source: { FOO: "bar", PORT: "8080" },
    });
    expect(result).toEqual({ FOO: "bar", PORT: 8080 });
  });

  it("throws EnvValidationError when required var is missing", () => {
    const schema = z.object({ FOO: requiredString("FOO") });
    expect(() =>
      loadEnv(schema, { service: "test", source: {} }),
    ).toThrow(EnvValidationError);
  });

  it("error message names the service and the missing key", () => {
    const schema = z.object({ DATABASE_URL: requiredUrl("DATABASE_URL") });
    try {
      loadEnv(schema, { service: "graphql-api", source: {} });
      fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const msg = (err as Error).message;
      expect(msg).toContain("graphql-api");
      expect(msg).toContain("DATABASE_URL");
    }
  });

  it("aggregates multiple failures into one error", () => {
    const schema = z.object({
      A: requiredString("A"),
      B: requiredString("B"),
    });
    try {
      loadEnv(schema, { service: "svc", source: {} });
    } catch (err) {
      const issues = (err as EnvValidationError).issues;
      expect(issues.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("does not include secret VALUES in error messages", () => {
    const schema = z.object({ SECRET: requiredString("SECRET").min(32) });
    try {
      loadEnv(schema, { service: "svc", source: { SECRET: "short" } });
    } catch (err) {
      expect((err as Error).message).not.toContain("short");
    }
  });

  it("rejects invalid port", () => {
    const schema = z.object({ PORT: requiredPort("PORT") });
    expect(() =>
      loadEnv(schema, { service: "svc", source: { PORT: "99999" } }),
    ).toThrow(EnvValidationError);
  });

  it("rejects invalid URL", () => {
    const schema = z.object({ URL: requiredUrl("URL") });
    expect(() =>
      loadEnv(schema, { service: "svc", source: { URL: "not-a-url" } }),
    ).toThrow(EnvValidationError);
  });

  it("applies defaults for optional fields", () => {
    const schema = z.object({
      NODE_ENV: optionalString("NODE_ENV", "development"),
      FLAG: booleanFlag(false),
    });
    const result = loadEnv(schema, { service: "svc", source: {} });
    expect(result.NODE_ENV).toBe("development");
    expect(result.FLAG).toBe(false);
  });

  it("parses boolean flags correctly", () => {
    const schema = z.object({ FLAG: booleanFlag(false) });
    expect(
      loadEnv(schema, { service: "svc", source: { FLAG: "true" } }).FLAG,
    ).toBe(true);
    expect(
      loadEnv(schema, { service: "svc", source: { FLAG: "0" } }).FLAG,
    ).toBe(false);
  });
});

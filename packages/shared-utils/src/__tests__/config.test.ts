import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateConfig, requireEnv, getEnvInt, getEnvBoolean } from "../config.js";

describe("validateConfig", () => {
  it("returns empty config when schema is empty", () => {
    expect(validateConfig({}, {})).toEqual({});
  });

  it("returns config with defaults when env is empty and default is provided", () => {
    const schema = { FOO: { env: "FOO", required: false, default: "bar" } };
    expect(validateConfig(schema, {})).toEqual({ FOO: "bar" });
  });

  it("skips undefined values when default is also undefined", () => {
    const schema = { FOO: { env: "FOO", required: false } };
    expect(validateConfig(schema, {})).toEqual({});
  });

  it("validates enum values", () => {
    const schema = { FOO: { env: "FOO", required: false, enum: ["a", "b"] } };
    expect(validateConfig(schema, { FOO: "a" })).toEqual({ FOO: "a" });
  });

  it("rejects invalid enum values", () => {
    const schema = { FOO: { env: "FOO", required: false, enum: ["a", "b"] } };
    expect(() => validateConfig(schema, { FOO: "c" })).toThrow();
  });

  it("validates custom validation function", () => {
    const schema = { FOO: { env: "FOO", required: false, validate: (v: string) => v.length > 0 } };
    expect(validateConfig(schema, { FOO: "x" })).toEqual({ FOO: "x" });
  });

  it("throws when required env var is missing", () => {
    const schema = { FOO: { env: "FOO", required: true } };
    expect(() => validateConfig(schema, {})).toThrow("Missing required");
  });
});

describe("requireEnv", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("returns the env value when valid", () => {
    process.env.TEST_VAR = "value";
    expect(requireEnv("TEST_VAR", { description: "test" })).toBe("value");
  });

  it("throws when env var is missing", () => {
    delete process.env.TEST_VAR;
    expect(() => requireEnv("TEST_VAR")).toThrow("Required environment variable missing");
  });

  it("throws when enum validation fails", () => {
    process.env.TEST_VAR = "invalid";
    expect(() => requireEnv("TEST_VAR", { enum: ["a", "b"] })).toThrow("Invalid value");
  });

  it("throws when custom validation fails", () => {
    process.env.TEST_VAR = "bad";
    expect(() => requireEnv("TEST_VAR", { validate: (v: string) => v === "good" })).toThrow("Invalid value");
  });
});

describe("getEnvInt", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("returns the parsed int value", () => {
    process.env.TEST_VAR = "42";
    expect(getEnvInt("TEST_VAR")).toBe(42);
  });

  it("returns default when env var is missing and no required flag", () => {
    delete process.env.TEST_INT_VAR;
    expect(getEnvInt("TEST_INT_VAR", { default: 10 })).toBe(10);
  });

  it("throws when env var is missing and required", () => {
    delete process.env.TEST_INT_VAR;
    expect(() => getEnvInt("TEST_INT_VAR", { required: true, description: "test" })).toThrow("Required integer environment variable missing");
  });

  it("throws when value is not a valid integer", () => {
    process.env.TEST_VAR = "not-a-number";
    expect(() => getEnvInt("TEST_VAR")).toThrow("Invalid integer value");
  });
});

describe("getEnvBoolean", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it("returns true for truthy values", () => {
    process.env.TEST_VAR = "true";
    expect(getEnvBoolean("TEST_VAR")).toBe(true);
  });

  it("returns false for falsy values", () => {
    process.env.TEST_VAR = "false";
    expect(getEnvBoolean("TEST_VAR")).toBe(false);
  });

  it("throws for invalid boolean values", () => {
    process.env.TEST_VAR = "maybe";
    expect(() => getEnvBoolean("TEST_VAR")).toThrow("Invalid boolean value");
  });

  it("returns default when env var is missing", () => {
    delete process.env.TEST_BOOL_VAR;
    expect(getEnvBoolean("TEST_BOOL_VAR", true)).toBe(true);
  });
});

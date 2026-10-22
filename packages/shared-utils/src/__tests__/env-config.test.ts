import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateEnv,
  createEnvValidator,
  getRequiredEnv,
  getOptionalEnv,
  getIntEnv,
  getBooleanEnv,
  isNotEmpty,
  isValidUrl,
  isValidUuid,
  isPositiveInteger,
  isValidPort,
  type EnvSchema,
} from "../env-config";

describe("env-config", () => {
  describe("validateEnv", () => {
    it("should pass validation when all required variables are set", () => {
      const schema: EnvSchema = {
        DATABASE_URL: { required: true },
        API_PORT: { required: false },
      };

      const result = validateEnv(schema, {
        DATABASE_URL: "postgres://localhost",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation when required variable is missing", () => {
      const schema: EnvSchema = {
        DATABASE_URL: { required: true, description: "Database connection string" },
      };

      const result = validateEnv(schema, {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Missing required environment variable: DATABASE_URL (Database connection string)"
      );
    });

    it("should fail validation when required variable is empty string", () => {
      const schema: EnvSchema = {
        DATABASE_URL: { required: true },
      };

      const result = validateEnv(schema, {
        DATABASE_URL: "",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Missing required environment variable: DATABASE_URL"
      );
    });

    it("should fail validation when custom validation fails", () => {
      const schema: EnvSchema = {
        API_PORT: {
          required: true,
          description: "Port number",
          validate: isPositiveInteger,
        },
      };

      const result = validateEnv(schema, {
        API_PORT: "not-a-number",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Invalid value for API_PORT (Port number): "not-a-number"'
      );
    });

    it("should collect multiple errors", () => {
      const schema: EnvSchema = {
        DATABASE_URL: { required: true },
        API_KEY: { required: true },
        API_PORT: {
          required: true,
          validate: isPositiveInteger,
        },
      };

      const result = validateEnv(schema, {
        API_PORT: "invalid",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });

    it("should skip validation for optional unset variables", () => {
      const schema: EnvSchema = {
        API_PORT: {
          required: false,
          validate: isPositiveInteger,
        },
      };

      const result = validateEnv(schema, {});

      expect(result.valid).toBe(true);
    });
  });

  describe("createEnvValidator", () => {
    let exitSpy: any;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    });

    afterEach(() => {
      exitSpy.mockRestore();
    });

    it("should exit with code 1 on validation failure", () => {
      const schema: EnvSchema = {
        REQUIRED_VAR: { required: true },
      };

      const validator = createEnvValidator(schema, "TestService", {});
      validator();

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should not exit on successful validation", () => {
      const schema: EnvSchema = {
        REQUIRED_VAR: { required: true },
      };

      const validator = createEnvValidator(schema, "TestService", {
        REQUIRED_VAR: "value",
      });
      validator();

      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe("getRequiredEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return the environment variable value", () => {
      process.env.TEST_VAR = "test-value";

      const value = getRequiredEnv("TEST_VAR");

      expect(value).toBe("test-value");
    });

    it("should throw error if variable is not set", () => {
      delete process.env.MISSING_VAR;

      expect(() => getRequiredEnv("MISSING_VAR")).toThrow(
        "Expected environment variable MISSING_VAR to be set"
      );
    });
  });

  describe("getOptionalEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return the environment variable value", () => {
      process.env.TEST_VAR = "test-value";

      const value = getOptionalEnv("TEST_VAR");

      expect(value).toBe("test-value");
    });

    it("should return undefined if variable is not set", () => {
      delete process.env.MISSING_VAR;

      const value = getOptionalEnv("MISSING_VAR");

      expect(value).toBeUndefined();
    });

    it("should return default value if variable is not set", () => {
      delete process.env.MISSING_VAR;

      const value = getOptionalEnv("MISSING_VAR", "default");

      expect(value).toBe("default");
    });
  });

  describe("getIntEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should parse integer environment variable", () => {
      process.env.TEST_PORT = "8080";

      const value = getIntEnv("TEST_PORT");

      expect(value).toBe(8080);
    });

    it("should return default value for invalid integer", () => {
      process.env.TEST_PORT = "not-a-number";

      const value = getIntEnv("TEST_PORT", 3000);

      expect(value).toBe(3000);
    });

    it("should return 0 for missing variable without default", () => {
      delete process.env.TEST_PORT;

      const value = getIntEnv("TEST_PORT");

      expect(value).toBe(0);
    });

    it("should return default value for missing variable", () => {
      delete process.env.TEST_PORT;

      const value = getIntEnv("TEST_PORT", 3000);

      expect(value).toBe(3000);
    });
  });

  describe("getBooleanEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should parse true values", () => {
      const trueValues = ["true", "1", "yes", "TRUE", "YES"];

      trueValues.forEach((val) => {
        process.env.TEST_BOOL = val;
        expect(getBooleanEnv("TEST_BOOL")).toBe(true);
      });
    });

    it("should parse false values", () => {
      const falseValues = ["false", "0", "no", "anything-else"];

      falseValues.forEach((val) => {
        process.env.TEST_BOOL = val;
        expect(getBooleanEnv("TEST_BOOL")).toBe(false);
      });
    });

    it("should return default value for missing variable", () => {
      delete process.env.TEST_BOOL;

      expect(getBooleanEnv("TEST_BOOL", true)).toBe(true);
      expect(getBooleanEnv("TEST_BOOL", false)).toBe(false);
    });
  });

  describe("validation helpers", () => {
    describe("isNotEmpty", () => {
      it("should validate non-empty strings", () => {
        expect(isNotEmpty("value")).toBe(true);
        expect(isNotEmpty("  value  ")).toBe(true);
      });

      it("should reject empty or whitespace strings", () => {
        expect(isNotEmpty("")).toBe(false);
        expect(isNotEmpty("   ")).toBe(false);
      });
    });

    describe("isValidUrl", () => {
      it("should validate URLs", () => {
        expect(isValidUrl("http://localhost:3000")).toBe(true);
        expect(isValidUrl("https://example.com")).toBe(true);
        expect(isValidUrl("postgres://user:pass@host:5432/db")).toBe(true);
      });

      it("should reject invalid URLs", () => {
        expect(isValidUrl("not-a-url")).toBe(false);
        expect(isValidUrl("")).toBe(false);
      });
    });

    describe("isValidUuid", () => {
      it("should validate UUIDs", () => {
        expect(
          isValidUuid("550e8400-e29b-41d4-a716-446655440000")
        ).toBe(true);
        expect(
          isValidUuid("550E8400-E29B-41D4-A716-446655440000")
        ).toBe(true);
      });

      it("should reject invalid UUIDs", () => {
        expect(isValidUuid("not-a-uuid")).toBe(false);
        expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false);
        expect(isValidUuid("")).toBe(false);
      });
    });

    describe("isPositiveInteger", () => {
      it("should validate positive integers", () => {
        expect(isPositiveInteger("1")).toBe(true);
        expect(isPositiveInteger("999")).toBe(true);
      });

      it("should reject non-positive integers", () => {
        expect(isPositiveInteger("0")).toBe(false);
        expect(isPositiveInteger("-1")).toBe(false);
        expect(isPositiveInteger("1.5")).toBe(false);
        expect(isPositiveInteger("not-a-number")).toBe(false);
      });
    });

    describe("isValidPort", () => {
      it("should validate port numbers", () => {
        expect(isValidPort("80")).toBe(true);
        expect(isValidPort("443")).toBe(true);
        expect(isValidPort("8080")).toBe(true);
        expect(isValidPort("65535")).toBe(true);
      });

      it("should reject invalid port numbers", () => {
        expect(isValidPort("0")).toBe(false);
        expect(isValidPort("65536")).toBe(false);
        expect(isValidPort("-1")).toBe(false);
        expect(isValidPort("not-a-port")).toBe(false);
      });
    });
  });
});

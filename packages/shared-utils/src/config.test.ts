import { describe, it, expect, beforeEach } from "vitest";
import {
  validateConfig,
  requireEnv,
  getOptionalEnv,
  getEnvInt,
  getEnvBoolean,
  type ConfigSchema,
} from "./config.js";

describe("Config Validator", () => {
  describe("validateConfig", () => {
    it("validates required environment variables", () => {
      const schema: ConfigSchema = {
        databaseUrl: {
          env: "DATABASE_URL",
          required: true,
          description: "PostgreSQL connection string",
        },
      };

      const env = { DATABASE_URL: "postgres://localhost/testdb" };
      const config = validateConfig(schema, env);

      expect(config.databaseUrl).toBe("postgres://localhost/testdb");
    });

    it("throws error for missing required variables", () => {
      const schema: ConfigSchema = {
        apiKey: {
          env: "API_KEY",
          required: true,
          description: "API authentication key",
        },
      };

      expect(() => {
        validateConfig(schema, {});
      }).toThrow("Missing required environment variable: API_KEY");
    });

    it("uses default values when variables are missing", () => {
      const schema: ConfigSchema = {
        logLevel: {
          env: "LOG_LEVEL",
          required: false,
          default: "info",
        },
      };

      const config = validateConfig(schema, {});
      expect(config.logLevel).toBe("info");
    });

    it("validates enum values", () => {
      const schema: ConfigSchema = {
        env: {
          env: "NODE_ENV",
          required: true,
          enum: ["development", "staging", "production"],
        },
      };

      expect(() => {
        validateConfig(schema, { NODE_ENV: "invalid" });
      }).toThrow("Invalid value for NODE_ENV");
    });

    it("accepts valid enum values", () => {
      const schema: ConfigSchema = {
        env: {
          env: "NODE_ENV",
          required: true,
          enum: ["development", "staging", "production"],
        },
      };

      const config = validateConfig(schema, { NODE_ENV: "production" });
      expect(config.env).toBe("production");
    });

    it("validates with custom validation function", () => {
      const schema: ConfigSchema = {
        port: {
          env: "PORT",
          required: true,
          validate: (value) =>
            !isNaN(parseInt(value, 10)) && parseInt(value, 10) > 0,
          description: "Valid port number",
        },
      };

      expect(() => {
        validateConfig(schema, { PORT: "invalid" });
      }).toThrow("Invalid value for PORT");

      const config = validateConfig(schema, { PORT: "3000" });
      expect(config.port).toBe("3000");
    });

    it("returns all configuration values", () => {
      const schema: ConfigSchema = {
        databaseUrl: { env: "DB_URL", required: true },
        apiKey: { env: "API_KEY", required: true },
        logLevel: { env: "LOG_LEVEL", required: false, default: "info" },
      };

      const env = {
        DB_URL: "postgres://localhost/db",
        API_KEY: "secret123",
      };

      const config = validateConfig(schema, env);
      expect(config).toEqual({
        databaseUrl: "postgres://localhost/db",
        apiKey: "secret123",
        logLevel: "info",
      });
    });
  });

  describe("requireEnv", () => {
    it("returns environment variable value", () => {
      const value = requireEnv("PATH", {
        description: "System PATH variable",
      });
      expect(value).toBeDefined();
      expect(typeof value).toBe("string");
    });

    it("throws error when variable is missing", () => {
      expect(() => {
        requireEnv("NONEXISTENT_VAR_12345", {
          description: "This variable does not exist",
        });
      }).toThrow("Required environment variable missing");
    });

    it("validates enum values", () => {
      process.env.TEST_ENV = "invalid";

      expect(() => {
        requireEnv("TEST_ENV", {
          enum: ["a", "b", "c"],
        });
      }).toThrow("Invalid value for TEST_ENV");

      delete process.env.TEST_ENV;
    });

    it("validates with custom function", () => {
      process.env.TEST_VAL = "not-a-number";

      expect(() => {
        requireEnv("TEST_VAL", {
          validate: (v) => !isNaN(parseInt(v, 10)),
        });
      }).toThrow("Invalid value for TEST_VAL");

      delete process.env.TEST_VAL;
    });
  });

  describe("getOptionalEnv", () => {
    it("returns environment variable if set", () => {
      process.env.OPTIONAL_TEST = "value123";
      const value = getOptionalEnv("OPTIONAL_TEST");
      expect(value).toBe("value123");
      delete process.env.OPTIONAL_TEST;
    });

    it("returns default value if not set", () => {
      const value = getOptionalEnv("NONEXISTENT_123", "default-value");
      expect(value).toBe("default-value");
    });

    it("returns undefined if not set and no default", () => {
      const value = getOptionalEnv("NONEXISTENT_456");
      expect(value).toBeUndefined();
    });

    it("validates enum values", () => {
      process.env.OPT_ENV = "invalid";

      expect(() => {
        getOptionalEnv("OPT_ENV", undefined, {
          enum: ["valid1", "valid2"],
        });
      }).toThrow("Invalid value for OPT_ENV");

      delete process.env.OPT_ENV;
    });
  });

  describe("getEnvInt", () => {
    it("parses integer environment variable", () => {
      process.env.TEST_INT = "42";
      const value = getEnvInt("TEST_INT");
      expect(value).toBe(42);
      delete process.env.TEST_INT;
    });

    it("returns default value if not set", () => {
      const value = getEnvInt("NONEXISTENT_INT", { default: 100 });
      expect(value).toBe(100);
    });

    it("throws error for non-numeric values", () => {
      process.env.INVALID_INT = "not-a-number";

      expect(() => {
        getEnvInt("INVALID_INT");
      }).toThrow("Invalid integer value");

      delete process.env.INVALID_INT;
    });

    it("validates minimum value", () => {
      process.env.SMALL_INT = "5";

      expect(() => {
        getEnvInt("SMALL_INT", { min: 10 });
      }).toThrow("too small");

      delete process.env.SMALL_INT;
    });

    it("validates maximum value", () => {
      process.env.LARGE_INT = "100";

      expect(() => {
        getEnvInt("LARGE_INT", { max: 50 });
      }).toThrow("too large");

      delete process.env.LARGE_INT;
    });
  });

  describe("getEnvBoolean", () => {
    it("parses true values", () => {
      process.env.TRUE_TEST = "true";
      expect(getEnvBoolean("TRUE_TEST")).toBe(true);

      process.env.TRUE_TEST = "1";
      expect(getEnvBoolean("TRUE_TEST")).toBe(true);

      process.env.TRUE_TEST = "yes";
      expect(getEnvBoolean("TRUE_TEST")).toBe(true);

      delete process.env.TRUE_TEST;
    });

    it("parses false values", () => {
      process.env.FALSE_TEST = "false";
      expect(getEnvBoolean("FALSE_TEST")).toBe(false);

      process.env.FALSE_TEST = "0";
      expect(getEnvBoolean("FALSE_TEST")).toBe(false);

      process.env.FALSE_TEST = "no";
      expect(getEnvBoolean("FALSE_TEST")).toBe(false);

      delete process.env.FALSE_TEST;
    });

    it("returns default value if not set", () => {
      const value = getEnvBoolean("NONEXISTENT_BOOL", true);
      expect(value).toBe(true);
    });

    it("throws error for invalid boolean values", () => {
      process.env.INVALID_BOOL = "maybe";

      expect(() => {
        getEnvBoolean("INVALID_BOOL");
      }).toThrow("Invalid boolean value");

      delete process.env.INVALID_BOOL;
    });
  });
});

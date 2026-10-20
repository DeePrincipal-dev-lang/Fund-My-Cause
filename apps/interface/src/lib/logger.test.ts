import { logger, type LogLevel } from "./logger";

const originalEnv = process.env.NODE_ENV;
let consoleLogSpy: jest.SpyInstance;
let consoleDebugSpy: jest.SpyInstance;
let consoleInfoSpy: jest.SpyInstance;
let consoleWarnSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

describe("logger", () => {
  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation();
    consoleInfoSpy = jest.spyOn(console, "info").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  describe("debug level", () => {
    it("emits debug logs in development", () => {
      process.env.NODE_ENV = "development";
      logger.debug("test message");
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining("test message"),
      );
    });

    it("skips debug logs in production", () => {
      process.env.NODE_ENV = "production";
      logger.debug("test message");
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });

  describe("info level", () => {
    it("emits info logs in development", () => {
      process.env.NODE_ENV = "development";
      logger.info("info message");
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("info message"),
      );
    });

    it("skips info logs in production", () => {
      process.env.NODE_ENV = "production";
      logger.info("info message");
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe("warn level", () => {
    it("emits warn logs in development", () => {
      process.env.NODE_ENV = "development";
      logger.warn("warning message");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("warning message"),
      );
    });

    it("emits warn logs in production", () => {
      process.env.NODE_ENV = "production";
      logger.warn("warning message");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("warning message"),
      );
    });
  });

  describe("error level", () => {
    it("emits error logs in development", () => {
      process.env.NODE_ENV = "development";
      logger.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("error message"),
      );
    });

    it("emits error logs in production", () => {
      process.env.NODE_ENV = "production";
      logger.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("error message"),
      );
    });
  });

  describe("context", () => {
    it("includes context in logs", () => {
      process.env.NODE_ENV = "development";
      const context = { userId: 123, action: "login" };
      logger.info("user action", context);
      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.any(String), context);
    });

    it("logs without context when not provided", () => {
      process.env.NODE_ENV = "development";
      logger.info("simple message");
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("simple message"),
      );
    });
  });

  describe("scoped loggers", () => {
    it("creates child logger with scope", () => {
      process.env.NODE_ENV = "development";
      const scoped = logger.child("auth");
      scoped.info("login attempt");
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("[auth]"),
      );
    });

    it("creates nested scopes", () => {
      process.env.NODE_ENV = "development";
      const nested = logger.child("api").child("auth");
      nested.warn("permission denied");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[api:auth]"),
      );
    });

    it("child logger respects level filtering", () => {
      process.env.NODE_ENV = "production";
      const scoped = logger.child("module");
      scoped.debug("debug message");
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      scoped.warn("warning message");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe("message formatting", () => {
    it("prefixes messages with scope", () => {
      process.env.NODE_ENV = "development";
      const scoped = logger.child("test");
      scoped.error("error occurred");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[test]"),
      );
    });

    it("uses default prefix for root logger", () => {
      process.env.NODE_ENV = "development";
      logger.warn("root warning");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[app]"),
      );
    });
  });

  describe("production safety", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("never logs debug in production", () => {
      logger.debug("secret data");
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it("never logs info in production", () => {
      logger.info("internal state");
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it("always logs warn in production", () => {
      logger.warn("recoverable error");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("always logs error in production", () => {
      logger.error("critical failure");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});

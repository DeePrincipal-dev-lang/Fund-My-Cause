import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { createLogger, requestLogger } from "./logger";

describe("shared logger", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("binds the module name to every log line", () => {
    const log = createLogger("indexer:rpc-client");
    expect(log.bindings()).toMatchObject({ module: "indexer:rpc-client" });
  });

  it("binds trace_id when a trace is supplied", () => {
    const log = createLogger("monitoring-service:alerts", "trace-123");
    expect(log.bindings()).toMatchObject({
      module: "monitoring-service:alerts",
      trace_id: "trace-123",
    });
  });

  it("creates request loggers with a trace_id", () => {
    const log = requestLogger("trace-456", "monitoring-service:request");
    expect(log.bindings()).toMatchObject({
      module: "monitoring-service:request",
      trace_id: "trace-456",
    });
  });
});

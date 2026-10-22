import pino, { type Logger, type LoggerOptions } from "pino";

function loggerOptions(): LoggerOptions {
  const usePretty =
    process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";
  return {
    level: process.env.LOG_LEVEL || "info",
    transport: usePretty
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  };
}

export function createLogger(module: string, traceId?: string): Logger {
  const bindings: Record<string, string> = { module };
  if (traceId) {
    bindings.trace_id = traceId;
  }
  return pino(loggerOptions()).child(bindings);
}

export function requestLogger(traceId: string, module = "request"): Logger {
  return createLogger(module, traceId);
}

export const logger = createLogger("app");

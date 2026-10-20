/**
 * Env-driven configuration for request-level rate limiting on the public
 * GraphQL endpoint. Values are validated at startup so misconfiguration
 * fails fast instead of silently disabling protection (see issue #45 for
 * the shared env-validation convention).
 */

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequestsPerIp: number;
  maxRequestsPerApiKey: number;
  trustProxy: boolean;
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid value for ${name}: expected a non-negative integer, got "${raw}"`);
  }
  return parsed;
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new Error(`Invalid value for ${name}: expected "true"/"false", got "${raw}"`);
}

export function loadRateLimitConfig(env: NodeJS.ProcessEnv = process.env): RateLimitConfig {
  const config: RateLimitConfig = {
    enabled: parseBoolEnv("RATE_LIMIT_ENABLED", true),
    windowMs: parseIntEnv("RATE_LIMIT_WINDOW_MS", 60_000),
    maxRequestsPerIp: parseIntEnv("RATE_LIMIT_MAX_PER_IP", 120),
    maxRequestsPerApiKey: parseIntEnv("RATE_LIMIT_MAX_PER_API_KEY", 600),
    trustProxy: parseBoolEnv("RATE_LIMIT_TRUST_PROXY", false),
  };

  if (config.windowMs <= 0) {
    throw new Error("RATE_LIMIT_WINDOW_MS must be greater than 0");
  }
  if (config.enabled && config.maxRequestsPerIp <= 0) {
    throw new Error("RATE_LIMIT_MAX_PER_IP must be greater than 0 when rate limiting is enabled");
  }
  if (config.enabled && config.maxRequestsPerApiKey <= 0) {
    throw new Error("RATE_LIMIT_MAX_PER_API_KEY must be greater than 0 when rate limiting is enabled");
  }

  return config;
}

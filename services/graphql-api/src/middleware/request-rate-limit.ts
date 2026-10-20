import { GraphQLError } from "graphql";
import type { RateLimitConfig } from "../config/rate-limit-config.js";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window-reset limiter, keyed per-IP or per-API-key.
 * Mirrors the token-bucket-per-key approach used in
 * apps/interface/src/lib/rate-limit, adapted for request-level enforcement
 * across the whole public GraphQL endpoint (not just mutations).
 */
export class RequestRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly config: RateLimitConfig) {}

  private consume(key: string, limit: number): { allowed: boolean; retryAfter: number } {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.config.windowMs });
      return { allowed: true, retryAfter: 0 };
    }

    if (bucket.count >= limit) {
      return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
    }

    bucket.count += 1;
    return { allowed: true, retryAfter: 0 };
  }

  reset(): void {
    this.buckets.clear();
  }

  checkIp(ip: string): { allowed: boolean; retryAfter: number } {
    return this.consume(`ip:${ip}`, this.config.maxRequestsPerIp);
  }

  checkApiKey(apiKey: string): { allowed: boolean; retryAfter: number } {
    return this.consume(`key:${apiKey}`, this.config.maxRequestsPerApiKey);
  }
}

function resolveClientIp(req: any, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req?.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      return forwarded.split(",")[0].trim();
    }
  }
  return req?.ip || req?.socket?.remoteAddress || "unknown";
}

/**
 * Express/HTTP-layer middleware applied in front of the GraphQL handler so
 * that rate limiting happens before any resolver or parsing work occurs.
 */
export function createPublicEndpointRateLimit(config: RateLimitConfig, limiter: RequestRateLimiter) {
  return function rateLimitMiddleware(req: any, res: any, next: (err?: unknown) => void) {
    if (!config.enabled) {
      return next();
    }

    const apiKey = req?.headers?.["x-api-key"];
    const result =
      typeof apiKey === "string" && apiKey.length > 0
        ? limiter.checkApiKey(apiKey)
        : limiter.checkIp(resolveClientIp(req, config.trustProxy));

    if (!result.allowed) {
      const error = new GraphQLError("Too many requests", {
        extensions: {
          code: "TOO_MANY_REQUESTS",
          http: { status: 429 },
          retryAfter: result.retryAfter,
        },
      });

      res.status?.(429);
      res.setHeader?.("Retry-After", String(result.retryAfter));
      res.setHeader?.("Content-Type", "application/json");
      return res.end?.(
        JSON.stringify({
          errors: [
            {
              message: error.message,
              extensions: error.extensions,
            },
          ],
        })
      );
    }

    return next();
  };
}

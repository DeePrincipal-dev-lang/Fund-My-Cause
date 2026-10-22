/**
 * Shared environment-variable validation for all services.
 *
 * Usage (per service):
 *   const env = loadEnv(schema, { service: "graphql-api" });
 *
 * Design goals:
 *  - Fail fast at startup with a clear, aggregated error message.
 *  - Single source of truth for the schema; `.env.example` is generated from it.
 *  - No secret values are ever included in error messages.
 */

import { z } from "zod";

// ───────────────────────── Types ─────────────────────────
export interface LoadEnvOptions {
  /** Service name shown in error messages, e.g. "graphql-api". */
  service: string;
  /** Optional source override — mainly for tests. Defaults to process.env. */
  source?: Record<string, string | undefined>;
  /** If true, log the parsed keys (values redacted) at startup. Default false. */
  logOnSuccess?: boolean;
}

export class EnvValidationError extends Error {
  readonly service: string;
  readonly issues: z.ZodIssue[];

  constructor(service: string, issues: z.ZodIssue[]) {
    const lines = issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    super(`[${service}] Invalid environment configuration:\n${lines}`);
    this.name = "EnvValidationError";
    this.service = service;
    this.issues = issues;
  }
}

// ───────────────────────── Core loader ─────────────────────────
/**
 * Validate `process.env` (or a custom source) against a Zod schema.
 * Throws EnvValidationError with an aggregated, readable message.
 */
export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  options: LoadEnvOptions,
): z.infer<T> {
  const source = options.source ?? process.env;
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(options.service, result.error.issues);
  }

  if (options.logOnSuccess) {
    // eslint-disable-next-line no-console
    console.log(
      `[${options.service}] env validated:`,
      Object.keys(result.data as Record<string, unknown>).sort().join(", "),
    );
  }

  return result.data;
}

// ───────────────────────── Reusable primitives ─────────────────────────
/** A required, non-empty string. */
export const requiredString = (name: string) =>
  z
    .string({ required_error: `${name} is required` })
    .min(1, `${name} must not be empty`);

/** A required URL string (http/https/redis/postgres). */
export const requiredUrl = (name: string) =>
  requiredString(name).url(`${name} must be a valid URL`);

/** A required integer, e.g. port numbers. */
export const requiredPort = (name: string) =>
  z.coerce
    .number({ invalid_type_error: `${name} must be a number` })
    .int(`${name} must be an integer`)
    .min(1, `${name} must be >= 1`)
    .max(65535, `${name} must be <= 65535`);

/** Optional string with a default. */
export const optionalString = (name: string, defaultValue: string) =>
  z.string().default(defaultValue);

/** Optional positive integer with a default. */
export const optionalInt = (name: string, defaultValue: number) =>
  z.coerce.number().int().positive().default(defaultValue);

/** A required secret that must be at least `min` chars. */
export const requiredSecret = (name: string, min = 32) =>
  z
    .string({ required_error: `${name} is required` })
    .min(min, `${name} must be at least ${min} characters`);

/** A boolean flag: "true"/"1"/"yes"/"on" → true, else false. */
export const booleanFlag = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return defaultValue;
      return ["true", "1", "yes", "on"].includes(v.toLowerCase());
    });

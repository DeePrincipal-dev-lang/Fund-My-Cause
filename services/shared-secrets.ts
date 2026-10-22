cd ~/Desktop/007/Fund-My-Cause

cat > services/shared-secrets.ts << 'EOF'
/**
 * Centralized secrets management module.
 *
 * All services should load secrets through this module to ensure consistent
 * validation and prevent accidental logging of sensitive values.
 *
 * Hardening (issue #1392):
 *  - `Redacted<T>` wrapper: values can never be logged, serialized, or inspected.
 *  - Typed accessors in `secrets.*` cover every known secret key.
 *  - `SecretProvider` abstraction allows tests to inject mocked sources.
 *  - Values are read at call-time — no stale caching across environments.
 */

// ───────────────────────── Logger ─────────────────────────
const logger = console;

// ───────────────────────── Redaction wrapper ─────────────────────────
/**
 * Wraps a secret so it can never be accidentally logged or serialized.
 * Call `.reveal()` — explicitly — to obtain the raw value.
 */
export class Redacted<T extends string = string> {
  readonly #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  reveal(): T {
    return this.#value;
  }

  toString(): string {
    return "[REDACTED]";
  }

  toJSON(): string {
    return "[REDACTED]";
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return "[REDACTED]";
  }
}

// ───────────────────────── Config type ─────────────────────────
export interface SecretsConfig {
  jwtSecret?: string;
  pagerDutyApiKey?: string;
  redisUrl?: string;
  databaseUrl?: string;
  rpcUrl?: string;
}

// ───────────────────────── Known placeholders ─────────────────────────
const KNOWN_DEFAULTS = [
  "your-secret-key",
  "your-secret-key-change-in-production",
  "dev-secret-key-change-in-production",
  "test-key",
  "test-secret",
  "dev-secret",
  "123456",
];

function isKnownDefault(value: string): boolean {
  return KNOWN_DEFAULTS.includes(value.toLowerCase());
}

function validateSecret(name: string, value: string | undefined): void {
  if (!value || value.trim() === "") {
    throw new Error(`Secret '${name}' is required but not set`);
  }

  if (isKnownDefault(value)) {
    throw new Error(
      `Secret '${name}' appears to be a default/example value and must be changed`
    );
  }

  if (value.length < 32) {
    logger.warn(
      `Secret '${name}' is shorter than 32 characters; consider using a stronger value`
    );
  }
}

// ───────────────────────── Provider abstraction ─────────────────────────
export interface SecretProvider {
  get(key: string): string | undefined;
}

/** Default provider: reads process.env at call-time (no caching). */
export const envProvider: SecretProvider = {
  get: (key) => process.env[key],
};

let activeProvider: SecretProvider = envProvider;

/** Override the provider (tests). Pass `null` to restore the env provider. */
export function setSecretProvider(provider: SecretProvider | null): void {
  activeProvider = provider ?? envProvider;
}

// ───────────────────────── Loaders (existing API) ─────────────────────────

/**
 * Load and validate JWT secret from environment.
 */
export function loadJwtSecret(): string {
  const secret = activeProvider.get("JWT_SECRET");
  validateSecret("JWT_SECRET", secret);
  return secret!;
}

/**
 * Load PagerDuty API key. Optional for non-critical deployments.
 */
export function loadPagerDutyApiKey(): string | undefined {
  const key = activeProvider.get("PAGERDUTY_API_KEY");
  if (key && isKnownDefault(key)) {
    throw new Error(
      "PAGERDUTY_API_KEY appears to be a default/example value and must be changed"
    );
  }
  if (key && key.length < 20) {
    logger.warn(
      "PAGERDUTY_API_KEY appears to be too short for a valid API key"
    );
  }
  return key;
}

/**
 * Load and validate Redis URL.
 */
export function loadRedisUrl(): string {
  const url = activeProvider.get("REDIS_URL") || "redis://localhost:6379";
  if (isKnownDefault(url)) {
    throw new Error(
      "REDIS_URL appears to be a default value and must be changed"
    );
  }
  return url;
}

/**
 * Load and validate database URL.
 */
export function loadDatabaseUrl(): string | undefined {
  const url = activeProvider.get("DATABASE_URL");
  if (url && isKnownDefault(url)) {
    throw new Error(
      "DATABASE_URL appears to be a default value and must be changed"
    );
  }
  if (url && url.includes("password")) {
    logger.warn(
      "DATABASE_URL contains password in connection string; use environment variables"
    );
  }
  return url;
}

/**
 * Load and validate RPC URL.
 */
export function loadRpcUrl(): string {
  const url =
    activeProvider.get("RPC_URL") ||
    activeProvider.get("SOROBAN_RPC_URL") ||
    "https://soroban-testnet.stellar.org";
  if (isKnownDefault(url)) {
    throw new Error("RPC_URL appears to be a default value and must be changed");
  }
  return url;
}

/**
 * Load all secrets at once.
 */
export function loadAllSecrets(): SecretsConfig {
  return {
    jwtSecret: activeProvider.get("JWT_SECRET"),
    pagerDutyApiKey: loadPagerDutyApiKey(),
    redisUrl: loadRedisUrl(),
    databaseUrl: loadDatabaseUrl(),
    rpcUrl: loadRpcUrl(),
  };
}

// ───────────────────────── Typed redacted accessors (new) ─────────────────────────
/**
 * Canonical list of every secret the service depends on.
 * Add new keys here AND in the `secrets` object below.
 */
export const SECRET_KEYS = [
  "JWT_SECRET",
  "PAGERDUTY_API_KEY",
  "REDIS_URL",
  "DATABASE_URL",
  "RPC_URL",
] as const;

export type SecretKey = (typeof SECRET_KEYS)[number];

export class MissingSecretError extends Error {
  constructor(public readonly key: SecretKey) {
    super(`Missing required secret: ${key}`);
    this.name = "MissingSecretError";
  }
}

function requireSecret(key: SecretKey): Redacted {
  const raw = activeProvider.get(key);
  if (raw === undefined || raw === "") {
    throw new MissingSecretError(key);
  }
  return new Redacted(raw);
}

function optionalSecret(key: SecretKey): Redacted | null {
  const raw = activeProvider.get(key);
  if (raw === undefined || raw === "") return null;
  return new Redacted(raw);
}

/**
 * Typed redacted accessors — one per known secret.
 * Prefer these in new code; the `load*` functions above remain for back-compat.
 */
export const secrets = {
  jwtSecret: (): Redacted => requireSecret("JWT_SECRET"),
  pagerDutyApiKey: (): Redacted | null => optionalSecret("PAGERDUTY_API_KEY"),
  redisUrl: (): Redacted => requireSecret("REDIS_URL"),
  databaseUrl: (): Redacted | null => optionalSecret("DATABASE_URL"),
  rpcUrl: (): Redacted => requireSecret("RPC_URL"),
} as const;

// ───────────────────────── Back-compat escape hatch ─────────────────────────
/**
 * @deprecated Use `secrets.<name>()` or one of the `load*` functions.
 */
export function getSecret(key: string): string | undefined {
  return activeProvider.get(key);
}
EOF
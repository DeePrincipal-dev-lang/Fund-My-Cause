/**
 * env-config.ts
 * ──────────────
 * Shared environment variable validation utilities for all services.
 * Validates environment configuration at startup and fails fast with clear
 * messages about any missing or invalid variables.
 */

/**
 * Environment variable schema definition.
 * Maps variable names to their validation rules.
 */
export interface EnvSchema {
  [key: string]: {
    /** Whether the variable is required */
    required: boolean;
    /** Optional description for error messages */
    description?: string;
    /** Optional validation function */
    validate?: (value: string) => boolean;
  };
}

/**
 * Result of environment validation.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates environment variables against a schema.
 * Collects all errors and returns them at once for better UX.
 *
 * @param schema - Schema defining required and optional variables
 * @param env - Environment object (defaults to process.env)
 * @returns ValidationResult with any errors or warnings
 */
export function validateEnv(
  schema: EnvSchema,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [key, config] of Object.entries(schema)) {
    const value = env[key];

    // Check if required variable is missing
    if (config.required && !value) {
      const desc = config.description ? ` (${config.description})` : "";
      errors.push(`Missing required environment variable: ${key}${desc}`);
      continue;
    }

    // Skip validation if variable is not present and not required
    if (!value) {
      continue;
    }

    // Run custom validation if provided
    if (config.validate && !config.validate(value)) {
      const desc = config.description ? ` (${config.description})` : "";
      errors.push(`Invalid value for ${key}${desc}: "${value}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Creates a validator function that can be used to validate environment
 * at service startup. Fails the process if validation fails.
 *
 * @param schema - Schema defining required and optional variables
 * @param serviceName - Name of the service (for error messages)
 * @param env - Environment object (defaults to process.env)
 * @throws Process exits with code 1 if validation fails
 */
export function createEnvValidator(
  schema: EnvSchema,
  serviceName: string,
  env?: Record<string, string | undefined>
) {
  return () => {
    const result = validateEnv(schema, env);

    if (!result.valid) {
      console.error(`\n[${serviceName}] Environment validation failed:\n`);
      result.errors.forEach((error) => {
        console.error(`  ✗ ${error}`);
      });
      console.error("\nPlease set the missing environment variables and try again.\n");
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      console.warn(`\n[${serviceName}] Environment warnings:\n`);
      result.warnings.forEach((warning) => {
        console.warn(`  ⚠ ${warning}`);
      });
      console.warn();
    }
  };
}

/**
 * Utility function to get a required environment variable with type safety.
 * Use this after validation has passed to safely access env vars.
 *
 * @param key - Environment variable name
 * @returns The environment variable value
 * @throws Error if variable is not set (for when it passes validation)
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Expected environment variable ${key} to be set`);
  }
  return value;
}

/**
 * Utility function to get an optional environment variable.
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The environment variable value or default
 */
export function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/**
 * Parse an integer environment variable safely.
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set or invalid
 * @returns The parsed integer or default
 */
export function getIntEnv(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value) {
    return defaultValue ?? 0;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? (defaultValue ?? 0) : parsed;
}

/**
 * Parse a boolean environment variable safely.
 * Treats "true", "1", "yes" as true; everything else as false.
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The parsed boolean or default
 */
export function getBooleanEnv(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  return ["true", "1", "yes"].includes(value.toLowerCase());
}

/**
 * Validates that a value is not empty or just whitespace.
 */
export const isNotEmpty = (value: string): boolean => value.trim().length > 0;

/**
 * Validates that a value matches a URL pattern.
 */
export const isValidUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates that a value matches a UUID pattern.
 */
export const isValidUuid = (value: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Validates that a value is a valid positive integer.
 */
export const isPositiveInteger = (value: string): boolean => {
  const num = parseInt(value, 10);
  return !isNaN(num) && num > 0 && num.toString() === value;
};

/**
 * Validates that a value is a valid port number (1-65535).
 */
export const isValidPort = (value: string): boolean => {
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= 1 && num <= 65535;
};

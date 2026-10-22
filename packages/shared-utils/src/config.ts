/**
 * Configuration validation utilities for standardized environment variable loading
 * across backend services. Provides a schema-based validator that fails fast with
 * descriptive error messages for missing or invalid settings.
 */

export interface ConfigRule {
  /** Environment variable name */
  env: string;
  /** Whether this variable is required */
  required: boolean;
  /** Default value if not provided */
  default?: string | number | boolean;
  /** Validation function (optional) */
  validate?: (value: string) => boolean;
  /** Human-readable description for error messages */
  description?: string;
  /** Allowed values for enum-like validation */
  enum?: string[];
}

export interface ConfigSchema {
  [key: string]: ConfigRule;
}

export interface ParsedConfig {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Parse and validate environment variables against a schema
 * @throws Error with detailed message if validation fails
 */
export function validateConfig(
  schema: ConfigSchema,
  env: NodeJS.ProcessEnv = process.env,
): ParsedConfig {
  const config: ParsedConfig = {};
  const errors: string[] = [];

  for (const [key, rule] of Object.entries(schema)) {
    const envValue = env[rule.env];

    // Check if required
    if (!envValue && rule.required && rule.default === undefined) {
      errors.push(
        `Missing required environment variable: ${rule.env}${rule.description ? ` (${rule.description})` : ""}`,
      );
      continue;
    }

    // Use default if not provided
    const value = envValue || rule.default;
    if (value === undefined) {
      continue;
    }

    // Validate enum values
    if (rule.enum && rule.enum.length > 0) {
      if (!rule.enum.includes(String(value))) {
        errors.push(
          `Invalid value for ${rule.env}: "${value}". Must be one of: ${rule.enum.join(", ")}` +
            `${rule.description ? ` (${rule.description})` : ""}`,
        );
        continue;
      }
    }

    // Custom validation
    if (rule.validate && !rule.validate(String(value))) {
      errors.push(
        `Invalid value for ${rule.env}: "${value}"${rule.description ? ` (${rule.description})` : ""}`,
      );
      continue;
    }

    config[key] = value;
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.map((e) => `  ✗ ${e}`).join("\n")}`,
    );
  }

  return config;
}

/**
 * Require an environment variable and validate it at startup
 * Fails immediately with a descriptive error if missing or invalid
 * @throws Error if the variable is missing or invalid
 */
export function requireEnv(
  name: string,
  options?: {
    description?: string;
    validate?: (value: string) => boolean;
    enum?: string[];
  },
): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(
      `Required environment variable missing: ${name}${options?.description ? ` (${options.description})` : ""}`,
    );
  }

  if (options?.enum && !options.enum.includes(value)) {
    throw new Error(
      `Invalid value for ${name}: "${value}". Must be one of: ${options.enum.join(", ")}` +
        `${options?.description ? ` (${options.description})` : ""}`,
    );
  }

  if (options?.validate && !options.validate(value)) {
    throw new Error(
      `Invalid value for ${name}: "${value}"${options?.description ? ` (${options.description})` : ""}`,
    );
  }

  return value;
}

/**
 * Get optional environment variable with validation
 */
export function getOptionalEnv(
  name: string,
  defaultValue?: string,
  options?: {
    description?: string;
    validate?: (value: string) => boolean;
    enum?: string[];
  },
): string | undefined {
  const value = process.env[name];

  if (!value) {
    return defaultValue;
  }

  if (options?.enum && !options.enum.includes(value)) {
    throw new Error(
      `Invalid value for ${name}: "${value}". Must be one of: ${options.enum.join(", ")}` +
        `${options?.description ? ` (${options.description})` : ""}`,
    );
  }

  if (options?.validate && !options.validate(value)) {
    throw new Error(
      `Invalid value for ${name}: "${value}"${options?.description ? ` (${options.description})` : ""}`,
    );
  }

  return value;
}

/**
 * Validate an integer environment variable
 */
export function getEnvInt(
  name: string,
  options?: {
    required?: boolean;
    default?: number;
    min?: number;
    max?: number;
    description?: string;
  },
): number | undefined {
  const value = process.env[name];

  if (!value) {
    if (options?.required) {
      throw new Error(
        `Required integer environment variable missing: ${name}${options?.description ? ` (${options.description})` : ""}`,
      );
    }
    return options?.default;
  }

  const intValue = parseInt(value, 10);
  if (isNaN(intValue)) {
    throw new Error(
      `Invalid integer value for ${name}: "${value}"${options?.description ? ` (${options.description})` : ""}`,
    );
  }

  if (options?.min !== undefined && intValue < options.min) {
    throw new Error(
      `Value for ${name} is too small: ${intValue} < ${options.min}${options?.description ? ` (${options.description})` : ""}`,
    );
  }

  if (options?.max !== undefined && intValue > options.max) {
    throw new Error(
      `Value for ${name} is too large: ${intValue} > ${options.max}${options?.description ? ` (${options.description})` : ""}`,
    );
  }

  return intValue;
}

/**
 * Validate a boolean environment variable
 */
export function getEnvBoolean(
  name: string,
  defaultValue: boolean = false,
  description?: string,
): boolean {
  const value = process.env[name];

  if (!value) {
    return defaultValue;
  }

  if (["true", "1", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  throw new Error(
    `Invalid boolean value for ${name}: "${value}"${description ? ` (${description})` : ""}`,
  );
}

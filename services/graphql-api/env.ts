/**
 * Environment schema for graphql-api.
 * Keep this in sync with services/graphql-api/.env.example
 */

import { z } from "zod";
import {
  loadEnv,
  requiredString,
  requiredUrl,
  requiredPort,
  optionalString,
  booleanFlag,
} from "../shared-env";

export const graphqlApiSchema = z.object({
  NODE_ENV: optionalString("NODE_ENV", "development"),
  PORT: requiredPort("PORT"),
  DATABASE_URL: requiredUrl("DATABASE_URL"),
  REDIS_URL: requiredUrl("REDIS_URL"),
  JWT_SECRET: requiredString("JWT_SECRET"),
  LOG_LEVEL: optionalString("LOG_LEVEL", "info"),
  ENABLE_GRAPHIQL: booleanFlag(false),
});

export type GraphqlApiEnv = z.infer<typeof graphqlApiSchema>;

export function loadGraphqlApiEnv(
  source?: Record<string, string | undefined>,
): GraphqlApiEnv {
  return loadEnv(graphqlApiSchema, { service: "graphql-api", source });
}

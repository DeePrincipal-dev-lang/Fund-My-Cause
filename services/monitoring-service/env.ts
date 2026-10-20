/**
 * Environment schema for monitoring-service.
 * Keep this in sync with services/monitoring-service/.env.example
 */

import { z } from "zod";
import {
  loadEnv,
  requiredUrl,
  requiredPort,
  optionalString,
  optionalInt,
  requiredSecret,
} from "../shared-env";

export const monitoringServiceSchema = z.object({
  NODE_ENV: optionalString("NODE_ENV", "development"),
  PORT: requiredPort("PORT"),
  DOWNSTREAM_API_URL: requiredUrl("DOWNSTREAM_API_URL"),
  REDIS_URL: requiredUrl("REDIS_URL"),
  PAGERDUTY_API_KEY: requiredSecret("PAGERDUTY_API_KEY", 20),
  ALERT_INTERVAL_MS: optionalInt("ALERT_INTERVAL_MS", 60_000),
  SERVICE_VERSION: optionalString("SERVICE_VERSION", "0.0.0"),
});

export type MonitoringServiceEnv = z.infer<typeof monitoringServiceSchema>;

export function loadMonitoringServiceEnv(
  source?: Record<string, string | undefined>,
): MonitoringServiceEnv {
  return loadEnv(monitoringServiceSchema, {
    service: "monitoring-service",
    source,
  });
}

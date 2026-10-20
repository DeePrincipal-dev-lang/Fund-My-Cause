/**
 * Liveness/readiness primitives for services/monitoring-service.
 * See ../HEALTH_ENDPOINTS.md for the endpoint contract this backs.
 */

export interface DependencyCheck {
  name: string;
  check: () => Promise<boolean>;
  timeoutMs?: number;
}

export interface LivenessResult {
  status: "ok";
  uptimeSeconds: number;
  timestamp: string;
}

export type DependencyStatus = "ok" | "unreachable";

export interface ReadinessResult {
  status: "ok" | "degraded";
  checks: Record<string, DependencyStatus>;
  timestamp: string;
}

const DEFAULT_TIMEOUT_MS = 2000;

async function withTimeout(
  promise: Promise<boolean>,
  timeoutMs: number
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export function getLiveness(startedAt: number = Date.now()): LivenessResult {
  return {
    status: "ok",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
}

export async function getReadiness(
  dependencies: DependencyCheck[]
): Promise<ReadinessResult> {
  const results = await Promise.all(
    dependencies.map(async (dep) => {
      let ok = false;
      try {
        ok = await withTimeout(
          dep.check(),
          dep.timeoutMs ?? DEFAULT_TIMEOUT_MS
        );
      } catch {
        ok = false;
      }
      return [dep.name, ok ? "ok" : "unreachable"] as const;
    })
  );

  const checks = Object.fromEntries(results) as Record<
    string,
    DependencyStatus
  >;
  const status = results.every(([, s]) => s === "ok") ? "ok" : "degraded";

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
  };
}

/** Default dependency set wired to the real monitoring-service integrations. */
export function buildDefaultDependencyChecks(deps: {
  checkAlertTransport: () => Promise<boolean>;
  checkPagerDuty: () => Promise<boolean>;
  checkRulesEngineStore: () => Promise<boolean>;
}): DependencyCheck[] {
  return [
    { name: "alertTransport", check: deps.checkAlertTransport },
    { name: "pagerduty", check: deps.checkPagerDuty },
    { name: "rulesEngineStore", check: deps.checkRulesEngineStore },
  ];
}

import pino from "pino";

/**
 * Health check for the indexer service
 */
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  lastEventTime: number;
  lastLedger: number;
  eventsProcessed: number;
}

/** Default window after boot during which a lack of processed events is not
 *  reported as "unhealthy" — the indexer may simply not have caught its
 *  first ledger yet. */
const DEFAULT_STARTUP_GRACE_PERIOD_MS = 30000;

export class HealthChecker {
  private startTime: number;
  private lastEventTime: number = 0;
  private lastLedger: number = 0;
  private eventsProcessed: number = 0;
  private logger: pino.Logger;
  private readonly startupGracePeriodMs: number;

  constructor(
    logger: pino.Logger,
    startupGracePeriodMs: number = DEFAULT_STARTUP_GRACE_PERIOD_MS,
  ) {
    this.logger = logger;
    this.startTime = Date.now();
    this.startupGracePeriodMs = startupGracePeriodMs;
  }

  /**
   * Update health metrics when processing events
   */
  recordEvent(ledger: number): void {
    this.lastEventTime = Date.now();
    this.lastLedger = Math.max(this.lastLedger, ledger);
    this.eventsProcessed += 1;
  }

  /**
   * Get current health status
   */
  getStatus(): HealthStatus {
    const uptime = Date.now() - this.startTime;

    // During the startup grace window, a service that hasn't processed its
    // first event yet is still starting up, not unhealthy — report
    // "degraded" instead of "unhealthy" until either an event lands or the
    // window elapses.
    if (this.eventsProcessed === 0 && uptime < this.startupGracePeriodMs) {
      return {
        status: "degraded",
        uptime,
        lastEventTime: this.lastEventTime,
        lastLedger: this.lastLedger,
        eventsProcessed: this.eventsProcessed,
      };
    }

    const isHealthy =
      this.eventsProcessed > 0 && Date.now() - this.lastEventTime < 60000;
    const isDegraded =
      this.eventsProcessed > 0 && Date.now() - this.lastEventTime < 120000;

    const status = isHealthy
      ? "healthy"
      : isDegraded
        ? "degraded"
        : "unhealthy";

    return {
      status,
      uptime,
      lastEventTime: this.lastEventTime,
      lastLedger: this.lastLedger,
      eventsProcessed: this.eventsProcessed,
    };
  }

  /**
   * Log current health status
   */
  logStatus(): void {
    const status = this.getStatus();
    this.logger.info(status, `Health check: ${status.status}`);
  }
}

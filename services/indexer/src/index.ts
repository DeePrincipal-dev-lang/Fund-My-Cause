import "dotenv/config";
import express, { Express } from "express";
import pino from "pino";
import { SorobanRPCClient } from "./rpc-client.js";
import { HealthChecker } from "./health-checker.js";
import { EventStore } from "./event-store.js";
import {
  AchievementHandler,
  AchievementPointsAwardedHandler,
  AchievementUnlockedHandler,
  CampaignHandler,
  DonationHandler,
  EventDispatcher,
  QFCalculatedHandler,
  RegisteredHandler,
} from "./handlers/index.js";
import type { EventHandler } from "./handlers/index.js";
import {
  buildPage,
  resolvePaginationArgs,
  CursorDecodeError,
} from "@fund-my-cause/shared-utils";

// Environment variables
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const RPC_URL =
  process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org:443";
const CONTRACT_ID = process.env.CROWDFUND_CONTRACT_ID ?? "";
// Registry contract ID (#1125) — optional. When set, the RPC client also
// subscribes to registry contract events (routed to handlers/registry/*).
const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID ?? "";
const QF_CONTRACT_ID = process.env.QF_CONTRACT_ID ?? "";
const ACHIEVEMENTS_CONTRACT_ID = process.env.ACHIEVEMENTS_CONTRACT_ID ?? "";
const CONTRACT_IDS = [
  CONTRACT_ID,
  REGISTRY_CONTRACT_ID,
  QF_CONTRACT_ID,
  ACHIEVEMENTS_CONTRACT_ID,
].filter(
  (id): id is string => id.length > 0,
);
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

// Resolve store / RPC capacity configuration from environment (#902)
const storeConfig = loadStoreConfig();

// Resolve the shared DB pool config (#1128). Not yet backing a live
// connection — this service stores events in-memory (see
// README.md#connection-pool-configuration) — but resolved and logged at
// startup ahead of a real persistence layer landing. See
// docs/db-pool-conventions.md.
const dbPoolConfig = loadDbPoolConfig();

// Logger
const logger = pino({ level: LOG_LEVEL });

// Express app
const app: Express = express();

// Global state
const rpcClient = new SorobanRPCClient(
  { url: RPC_URL, contractId: CONTRACT_ID, contractIds: CONTRACT_IDS },
  logger,
);
const healthChecker = new HealthChecker(logger);

// Build the repository once at startup.  All handlers interact with
// `eventRepository` (the interface) rather than `eventStore` directly,
// so the storage layer can be replaced without touching handler code.
const eventStore = new EventStore(logger, 10000, storeConfig.maxEventCapacity);
const eventRepository: EventRepository = new EventStoreRepository(
  eventStore,
  logger,
);

// Apply store migrations (#894, #1127) before ingestion starts so
// queryByContract/queryByType/queryByContractAndType use the O(k) secondary
// indexes from the first event onward instead of falling back to a linear
// scan for the lifetime of the process.
runMigrations(eventStore, "up", logger);

// Build the dispatcher once at startup, registering one handler per
// (contractType, eventType) pair (#896, modularized by contract type in
// #1125). Unknown event types fall back to `eventRepository` directly so no
// event is ever lost.
const handlers: EventHandler[] = [
  new CampaignHandler(logger),
  new DonationHandler(logger),
  new AchievementHandler(logger),
  new QFCalculatedHandler(logger),
  new AchievementUnlockedHandler(logger),
  new AchievementPointsAwardedHandler(logger),
  new RegisteredHandler(logger),
];
const dispatcher = new EventDispatcher(handlers, eventRepository, logger);

let isRunning = false;

/**
 * Start the indexer service
 */
async function startIndexer(): Promise<void> {
  logger.info(
    { rpc: RPC_URL, contract: CONTRACT_ID, contractIds: CONTRACT_IDS },
    "Starting indexer service",
  );
  logger.info({ storeConfig }, "Effective store configuration");
  logger.info({ dbPoolConfig }, "Effective DB pool configuration (#1128)");

  // Connect to RPC
  const connected = await rpcClient.connect();
  if (!connected) {
    logger.error("Failed to connect to Soroban RPC. Retrying in 10 seconds...");
    setTimeout(startIndexer, 10000);
    return;
  }

  isRunning = true;

  // Stream events
  logger.info("Streaming events from Soroban RPC");
  for await (const events of rpcClient.streamEvents()) {
    try {
      // Route events to domain handlers via the dispatcher (#896).
      // Each handler stores events and emits domain-specific log lines.
      // Unknown event types fall back to the repository directly.
      dispatcher.dispatch(events);

      // Update health
      for (const event of events) {
        healthChecker.recordEvent(parseInt(event.id.split("-")[0] ?? "0", 10));
      }

      // Log batch
      logger.debug({ eventCount: events.length }, "Ingested events");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error processing events",
      );
    }
  }
}

/**
 * Routes
 */

// Health endpoint (liveness)
app.get("/health", (req, res) => {
  const status = healthChecker.getStatus();
  const statusCode =
    status.status === "healthy"
      ? 200
      : status.status === "degraded"
        ? 202
        : 503;
  res.status(statusCode).json(status);
});

// Kubernetes-style liveness probe — alias of /health.
// Returns 200 as long as the process is up and responding.
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness endpoint — checks actual downstream dependency (Soroban RPC).
// Returns 200 only when the indexer has successfully connected to the RPC
// and is actively ingesting events; 503 otherwise.
app.get("/readyz", async (req, res) => {
  const rpcReachable = rpcClient.isConnected();
  if (isRunning && rpcReachable) {
    res.status(200).json({
      ready: true,
      checks: { rpc: "ok", indexer: "running" },
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      ready: false,
      checks: {
        rpc: rpcReachable ? "ok" : "unreachable",
        indexer: isRunning ? "running" : "not_started",
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Readiness endpoint (original — kept for backwards compatibility)
app.get("/ready", (req, res) => {
  if (isRunning) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});

// Events query endpoint — supports cursor-based and offset-based pagination
// via the shared pagination utilities.
//
// Query params:
//   contractId  filter by contract ID
//   type        filter by event type
//   limit       max items per page (default 100, max 200)
//   offset      zero-based offset (default 0)
//   after       opaque cursor from a previous response (overrides offset)
app.get("/events", (req, res) => {
  const { contractId, type, limit: rawLimit, offset: rawOffset, after } = req.query;

  let pagination: { limit: number; offset: number };
  try {
    pagination = resolvePaginationArgs({
      limit: rawLimit !== undefined ? parseInt(rawLimit as string, 10) : 100,
      offset: rawOffset !== undefined ? parseInt(rawOffset as string, 10) : 0,
      after: after as string | undefined,
    });
  } catch (err) {
    if (err instanceof CursorDecodeError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  const { limit, offset } = pagination;

  // Fetch all matching events, then apply pagination.
  let allEvents: ReturnType<typeof eventStore.getAllEvents>;
  if (contractId) {
    allEvents = eventStore.queryByContract(contractId as string, Infinity as unknown as number);
  } else if (type) {
    allEvents = eventStore.queryByType(type as string, Infinity as unknown as number);
  } else {
    allEvents = eventStore.getAllEvents(Infinity as unknown as number);
  }

  const totalCount = allEvents.length;
  const pageItems = allEvents.slice(offset, offset + limit);
  const page = buildPage(pageItems, offset, limit, totalCount);

  res.json(page);
});

// Stats endpoint — uses EventRepository interface
app.get("/stats", (req, res) => {
  const health = healthChecker.getStatus();
  res.json({
    eventCount: eventRepository.getCount(),
    health: health.status,
    uptime: health.uptime,
    lastLedger: health.lastLedger,
    eventsProcessed: health.eventsProcessed,
    // Circuit breaker metrics — expose for observability (Issue #906)
    circuitBreaker: rpcClient.getCircuitBreakerMetrics(),
  });
});

/**
 * Start server
 */
app.listen(PORT, async () => {
  logger.info({ port: PORT }, "Indexer service listening");

  // Start indexing in background
  startIndexer().catch((error) => {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Indexer crashed",
    );
    process.exit(1);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully");
  process.exit(0);
});

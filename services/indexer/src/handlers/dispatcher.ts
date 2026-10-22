import type pino from "pino";
import type { IndexerEvent } from "../rpc-client.js";
import type { EventRepository } from "../repository.js";
import type { EventHandler } from "./types.js";

/**
 * EventDispatcher receives a mixed batch of events, groups them by type,
 * and routes each group to the appropriate domain handler.
 * Unknown event types are handled by a fallback that still stores them.
 *
 * Design principles:
 *  - Events MUST NOT be lost.  Any event whose type has no registered handler
 *    is sent to the fallback repository so it is still persisted and queryable.
 *  - Routing is determined at construction time (O(1) lookup per event type).
 *  - The dispatcher is type-blind — it does not know about individual domains.
 *    Domain knowledge lives in each handler class.
 *
 * Backward-compatibility aliases:
 *  - If a handler class exposes a static `aliases` array (e.g. DonationHandler
 *    exposes ["Contribute"]), those aliases are also mapped to that handler.
 *    This lets the dispatcher handle legacy event type names without
 *    duplicating handler logic.
 */
export class EventDispatcher {
  private readonly handlerMap: Map<string, EventHandler>;
  private readonly fallbackRepository: EventRepository;
  private readonly logger: pino.Logger;

  /**
   * @param handlers            Domain handlers to register.
   * @param fallbackRepository  Repository used for events whose type has no
   *                            registered handler.  Ensures no events are lost.
   * @param logger              Pino logger instance.
   */
  constructor(
    handlers: EventHandler[],
    fallbackRepository: EventRepository,
    logger: pino.Logger,
  ) {
    this.fallbackRepository = fallbackRepository;
    this.logger = logger;

    this.handlerMap = new Map<string, EventHandler>();

    for (const handler of handlers) {
      this.handlerMap.set(handler.eventType, handler);

      // Register any backward-compat aliases declared by the handler class.
      const ctor = handler.constructor as { aliases?: readonly string[] };
      if (Array.isArray(ctor.aliases)) {
        for (const alias of ctor.aliases) {
          this.handlerMap.set(alias, handler);
        }
      }
    }

    this.logger.debug(
      { registeredTypes: Array.from(this.handlerMap.keys()) },
      "EventDispatcher: registered handlers",
    );
  }

  /**
   * Route a mixed batch of events to the appropriate domain handlers.
   *
   * Events are grouped by type first so each handler receives a homogeneous
   * batch rather than being called once per event (minimises overhead when
   * batches are large).
   *
   * Events whose type is unknown are forwarded directly to the fallback
   * repository so they are still persisted — the dispatcher never discards an
   * event.
   *
   * @param events Mixed batch of IndexerEvents to dispatch.
   */
  dispatch(events: IndexerEvent[]): void {
    if (events.length === 0) {
      return;
    }

    // Group events by type.
    const groups = new Map<string, IndexerEvent[]>();
    for (const event of events) {
      const bucket = groups.get(event.type);
      if (bucket) {
        bucket.push(event);
      } else {
        groups.set(event.type, [event]);
      }
    }

    // Log dispatch stats (counts per type).
    const stats: Record<string, number> = {};
    for (const [type, batch] of groups) {
      stats[type] = batch.length;
    }
    this.logger.debug(
      { stats, total: events.length },
      "EventDispatcher: dispatching events",
    );

    // Route each group.
    for (const [type, batch] of groups) {
      const handler = this.handlerMap.get(type);
      if (handler) {
        handler.handle(batch, this.fallbackRepository);
      } else {
        // Unknown type — persist via fallback so no event is lost.
        this.logger.warn(
          { type, count: batch.length },
          "EventDispatcher: no handler for event type, using fallback repository",
        );
        this.fallbackRepository.addEvents(batch);
      }
    }
  }
}

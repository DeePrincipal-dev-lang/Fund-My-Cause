import { describe, expect, it, vi } from "vitest";
import pino from "pino";
import {
  EVENT_HANDLER_CONSTRUCTORS,
  createEventDispatcher,
  createHandlers,
} from "./handler-registry.js";
import type { EventRepository } from "../repository.js";
import type { IndexerEvent } from "../rpc-client.js";

function makeMockRepository(): EventRepository {
  return {
    addEvents: vi.fn(),
    queryByContract: vi.fn().mockReturnValue([]),
    queryByType: vi.fn().mockReturnValue([]),
    getAllEvents: vi.fn().mockReturnValue([]),
    getCount: vi.fn().mockReturnValue(0),
  };
}

const silentLogger = pino({ level: "silent" });
const canonicalEventTypes = Object.keys(EVENT_HANDLER_CONSTRUCTORS);

describe("handler registry", () => {
  it("has one handler constructor for every canonical event type", () => {
    const handlers = createHandlers(silentLogger);

    expect(handlers).toHaveLength(canonicalEventTypes.length);
    expect(handlers.map((handler) => handler.eventType)).toEqual(
      canonicalEventTypes,
    );
  });

  it("does not register duplicate canonical event types", () => {
    const handlers = createHandlers(silentLogger);
    const eventTypes = handlers.map((handler) => handler.eventType);

    expect(new Set(eventTypes).size).toBe(eventTypes.length);
  });

  it("maps each event type to the handler that declares it", () => {
    for (const [eventType, Handler] of Object.entries(
      EVENT_HANDLER_CONSTRUCTORS,
    )) {
      const handler = new Handler(silentLogger);

      expect(handler.eventType).toBe(eventType);
      expect(handler.contractType).toBeTypeOf("string");
    }
  });

  it("creates a dispatcher that routes every canonical event type", () => {
    const repository = makeMockRepository();
    const dispatcher = createEventDispatcher(silentLogger, repository);
    const events: IndexerEvent[] = canonicalEventTypes.map((type, index) => ({
      id: `registry-${index}`,
      timestamp: 1_700_000_000 + index,
      type,
      contractId: "CCONTRACT111111111111111111111111111111111111111111",
      data: {},
    }));

    dispatcher.dispatch(events);

    expect(repository.addEvents).toHaveBeenCalledTimes(events.length);
    const persistedIds = (
      repository.addEvents as ReturnType<typeof vi.fn>
    ).mock.calls.flatMap(([batch]) =>
      (batch as IndexerEvent[]).map((event) => event.id),
    );

    expect(persistedIds).toEqual(events.map((event) => event.id));
  });
});

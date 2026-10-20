import { describe, expect, it, vi } from "vitest";
import pino from "pino";
import { RegisteredHandler } from "./registered.handler.js";
import type { EventRepository } from "../../repository.js";
import type { IndexerEvent } from "../../rpc-client.js";

const registeredEvent: IndexerEvent = {
  id: "registry-registered-001",
  timestamp: 1_700_000_900_000,
  type: "reg_proj",
  contractId: "CREGISTRY1111111111111111111111111111111111111111111",
  data: {
    project_id: 17,
    creator: "GCREATOR1111111111111111111111111111111111111111111",
    name: "Community Garden",
    category: "environment",
    timestamp: 1_700_000_900,
  },
};

describe("RegisteredHandler", () => {
  it("registers the shared-schema topic and persists its event unchanged", () => {
    const repository: EventRepository = {
      addEvents: vi.fn(),
      queryByContract: vi.fn().mockReturnValue([]),
      queryByType: vi.fn().mockReturnValue([]),
      getAllEvents: vi.fn().mockReturnValue([]),
      getCount: vi.fn().mockReturnValue(0),
    };
    const handler = new RegisteredHandler(pino({ level: "silent" }));

    expect(handler.eventType).toBe("reg_proj");
    handler.handle([registeredEvent], repository);

    expect(repository.addEvents).toHaveBeenCalledWith([registeredEvent]);
  });
});
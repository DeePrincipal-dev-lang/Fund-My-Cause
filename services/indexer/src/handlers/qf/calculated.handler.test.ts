import { describe, expect, it, vi } from "vitest";
import pino from "pino";
import { QFCalculatedHandler } from "./calculated.handler.js";
import type { EventRepository } from "../../repository.js";
import type { IndexerEvent } from "../../rpc-client.js";

const qfEvent: IndexerEvent = {
  id: "qf-001",
  timestamp: 1_700_000_600_000,
  type: "qf_calc",
  contractId: "CQF111111111111111111111111111111111111111111111111",
  data: {
    total_distributed: "7500000",
    remaining_pool: "2500000",
    recipients_funded: 3,
    timestamp: 1_700_000_600,
  },
};

describe("QFCalculatedHandler", () => {
  it("persists the decoded QF event without changing its data", () => {
    const repository: EventRepository = {
      addEvents: vi.fn(),
      queryByContract: vi.fn().mockReturnValue([]),
      queryByType: vi.fn().mockReturnValue([]),
      getAllEvents: vi.fn().mockReturnValue([]),
      getCount: vi.fn().mockReturnValue(0),
    };
    const handler = new QFCalculatedHandler(pino({ level: "silent" }));

    handler.handle([qfEvent], repository);

    expect(repository.addEvents).toHaveBeenCalledWith([qfEvent]);
  });
});
import { describe, it, expect } from "vitest";
import { EventStore, type IndexerEvent } from "./event-store";
import pino from "pino";

const logger = pino({ level: "silent" });

describe("EventStore", () => {
  it("should add and retrieve events", () => {
    const store = new EventStore(logger);
    const events: IndexerEvent[] = [
      {
        id: "1",
        timestamp: Date.now(),
        type: "Contribute",
        contractId: "CXXX",
        data: { amount: "1000" },
      },
    ];

    store.addEvents(events);
    expect(store.getCount()).toBe(1);
  });

  it("should query events by contract ID", () => {
    const store = new EventStore(logger);
    const events: IndexerEvent[] = [
      {
        id: "1",
        timestamp: Date.now(),
        type: "Contribute",
        contractId: "CXXX",
        data: { amount: "1000" },
      },
      {
        id: "2",
        timestamp: Date.now(),
        type: "Contribute",
        contractId: "CYYY",
        data: { amount: "2000" },
      },
    ];

    store.addEvents(events);
    const results = store.queryByContract("CXXX");
    expect(results).toHaveLength(1);
    expect(results[0].contractId).toBe("CXXX");
  });

  it("should query events by type", () => {
    const store = new EventStore(logger);
    const events: IndexerEvent[] = [
      {
        id: "1",
        timestamp: Date.now(),
        type: "Contribute",
        contractId: "CXXX",
        data: {},
      },
      {
        id: "2",
        timestamp: Date.now(),
        type: "Withdraw",
        contractId: "CXXX",
        data: {},
      },
    ];

    store.addEvents(events);
    const results = store.queryByType("Contribute");
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("Contribute");
  });

  it("should enforce max size limit", () => {
    const store = new EventStore(logger, 5);
    const events: IndexerEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      timestamp: Date.now() + i,
      type: "Contribute",
      contractId: "CXXX",
      data: {},
    }));

    store.addEvents(events);
    expect(store.getCount()).toBeLessThanOrEqual(5);
  });

  it("evicts the oldest-inserted events first (FIFO, not a per-insert sort)", () => {
    const store = new EventStore(logger, 5);
    const events: IndexerEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      timestamp: Date.now() + i,
      type: "Contribute",
      contractId: "CXXX",
      data: {},
    }));

    store.addEvents(events);

    // The 5 most-recently-inserted events (5..9) survive; 0..4 were evicted.
    const remaining = store
      .getAllEvents(10)
      .map((e) => e.id)
      .sort();
    expect(remaining).toEqual(["5", "6", "7", "8", "9"]);
  });

  it("should clear all events", () => {
    const store = new EventStore(logger);
    const events: IndexerEvent[] = [
      {
        id: "1",
        timestamp: Date.now(),
        type: "Contribute",
        contractId: "CXXX",
        data: {},
      },
    ];

    store.addEvents(events);
    expect(store.getCount()).toBe(1);

    store.clear();
    expect(store.getCount()).toBe(0);
  });

  describe("queryByContractAndType", () => {
    const events: IndexerEvent[] = [
      { id: "1", timestamp: 1, type: "Contribute", contractId: "C1", data: {} },
      { id: "2", timestamp: 2, type: "Withdraw", contractId: "C1", data: {} },
      { id: "3", timestamp: 3, type: "Contribute", contractId: "C2", data: {} },
      { id: "4", timestamp: 4, type: "Contribute", contractId: "C1", data: {} },
    ];

    it("filters by both contract and type (indexes disabled)", () => {
      const store = new EventStore(logger);
      store.addEvents(events);

      const results = store.queryByContractAndType("C1", "Contribute");
      expect(results.map((e) => e.id).sort()).toEqual(["1", "4"]);
    });

    it("filters by both contract and type (indexes enabled)", () => {
      const store = new EventStore(logger);
      store.enableIndexes();
      store.addEvents(events);

      const results = store.queryByContractAndType("C1", "Contribute");
      expect(results.map((e) => e.id).sort()).toEqual(["1", "4"]);
    });

    it("returns an empty array when no events match both filters", () => {
      const store = new EventStore(logger);
      store.addEvents(events);

      expect(store.queryByContractAndType("C2", "Withdraw")).toEqual([]);
    });
  });
});

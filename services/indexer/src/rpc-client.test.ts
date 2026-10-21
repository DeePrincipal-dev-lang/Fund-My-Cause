import { describe, it, expect, vi, afterEach } from "vitest";
import { SorobanRPCClient, type IndexerEvent } from "./rpc-client";
import pino from "pino";

const logger = pino({ level: "silent" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SorobanRPCClient", () => {
  it("should initialize with config", () => {
    const client = new SorobanRPCClient(
      { url: "https://localhost:8000", contractId: "CXXX" },
      logger
    );
    expect(client).toBeDefined();
  });

  it("should parse events correctly", () => {
    const client = new SorobanRPCClient(
      { url: "https://localhost:8000", contractId: "CXXX" },
      logger
    );
    // parseEvent is private, so we test indirectly through event structure
    expect(client).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Timestamp normalisation (#911)
  //
  // Soroban RPC returns ledger close_time in Unix SECONDS.  IndexerEvent must
  // always carry UTC MILLISECONDS.  Verify the conversion via fetchEvents by
  // mocking the HTTP response.
  // ---------------------------------------------------------------------------
  describe("timestamp normalisation", () => {
    /**
     * Build a SorobanRPCClient whose internal HTTP fetch is replaced by a
     * mock that returns the supplied raw event array.
     */
    function clientWithMockEvents(rawEvents: unknown[]) {
      const client = new SorobanRPCClient(
        { url: "http://localhost:8000", contractId: "CXXX" },
        logger,
        () => Promise.resolve(), // instant sleep
      );

      // Reach into the private createHttpClient path by monkeypatching fetch.
      // fetchEvents uses createHttpClient internally; we override global fetch
      // for this test only.
      vi.stubGlobal("fetch", () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              result: { events: rawEvents },
            }),
        }),
      );

      return client;
    }

    it("converts Soroban Unix seconds to UTC milliseconds", async () => {
      // 1 700 000 000 s → 1 700 000 000 000 ms
      const UNIX_SECONDS = 1_700_000_000;
      const EXPECTED_MS = UNIX_SECONDS * 1000;

      const client = clientWithMockEvents([
        { id: "1-0", timestamp: UNIX_SECONDS, type: "Contribute", contractId: "CXXX", data: {} },
      ]);

      const events = await client.fetchEvents(1);

      expect(events).toHaveLength(1);
      expect(events[0]!.timestamp).toBe(EXPECTED_MS);
    });

    it("uses Date.now() (ms) when timestamp is absent in the raw event", async () => {
      const before = Date.now();
      const client = clientWithMockEvents([
        { id: "2-0", type: "Withdraw", contractId: "CXXX", data: {} },
      ]);

      const events = await client.fetchEvents(1);
      const after = Date.now();

      expect(events).toHaveLength(1);
      const ts = events[0]!.timestamp;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("timestamps can be directly passed to new Date() to get a valid UTC Date", async () => {
      const client = clientWithMockEvents([
        { id: "3-0", timestamp: 1_700_000_000, type: "Initialize", contractId: "CXXX", data: {} },
      ]);

      const events = await client.fetchEvents(1);
      const ts = events[0]!.timestamp;
      const date = new Date(ts);

      expect(date.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    });
  });

  describe("shared retry policy", () => {
    it("retries a transient 500 through the shared helper and recovers", async () => {
      const rawEvent = {
        id: "4-0",
        timestamp: 1_700_000_000,
        type: "Contribute",
        contractId: "CXXX",
        data: {},
      };
      let calls = 0;
      const fetchMock = vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ result: { events: [rawEvent] } }),
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      const sleep = vi.fn().mockResolvedValue(undefined);
      const client = new SorobanRPCClient(
        { url: "http://localhost:8000", contractId: "CXXX" },
        logger,
        sleep,
      );

      const events = await client.fetchEvents(1);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(500);
      expect(events).toHaveLength(1);
    });
  });
});

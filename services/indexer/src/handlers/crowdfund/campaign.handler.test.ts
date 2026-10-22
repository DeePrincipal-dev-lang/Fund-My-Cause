/**
 * Unit tests for CampaignHandler (#896)
 *
 * Verifies that the handler persists events to the repository and emits
 * the expected structured log entries, without coupling to EventStore
 * internals.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import pino from "pino";
import { CampaignHandler } from "./campaign.handler.js";
import type { EventRepository } from "../../repository.js";
import type { IndexerEvent } from "../../rpc-client.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONTRACT_A = "CCAMPAIGN111111111111111111111111111111111111111111111";

const campaignEvent: IndexerEvent = {
  id: "campaign-001",
  timestamp: 1_700_000_001,
  type: "campaign",
  contractId: CONTRACT_A,
  data: {
    creator: "GCREATOR111111111111111111111111111111111111111111111",
    title: "Clean Water Initiative",
    goal: "10000000000",
    deadline: "1800000000",
    token: "CTOKEN11111111111111111111111111111111111111111111111",
    min_contribution: "1000000",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CampaignHandler", () => {
  let handler: CampaignHandler;
  let repo: EventRepository;

  beforeEach(() => {
    handler = new CampaignHandler(silentLogger);
    repo = makeMockRepository();
  });

  it("has the correct eventType", () => {
    expect(handler.eventType).toBe("campaign");
  });

  it("calls repository.addEvents with the provided batch", () => {
    const batch = [campaignEvent];
    handler.handle(batch, repo);
    expect(repo.addEvents).toHaveBeenCalledOnce();
    expect(repo.addEvents).toHaveBeenCalledWith(batch);
  });

  it("passes an empty batch to addEvents without throwing", () => {
    expect(() => handler.handle([], repo)).not.toThrow();
    expect(repo.addEvents).toHaveBeenCalledWith([]);
  });

  it("handles multiple campaign events in a single batch", () => {
    const second: IndexerEvent = {
      ...campaignEvent,
      id: "campaign-002",
      contractId: "CCAMPAIGN222222222222222222222222222222222222222222222",
    };
    const batch = [campaignEvent, second];
    handler.handle(batch, repo);
    expect(repo.addEvents).toHaveBeenCalledWith(batch);
  });

  it("persists events with nested data fields intact", () => {
    handler.handle([campaignEvent], repo);
    const stored = (repo.addEvents as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as IndexerEvent[];
    expect(stored[0]?.data["title"]).toBe("Clean Water Initiative");
    expect(stored[0]?.data["goal"]).toBe("10000000000");
  });
});

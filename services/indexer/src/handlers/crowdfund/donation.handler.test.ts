/**
 * Unit tests for DonationHandler (#896)
 *
 * Verifies that the handler persists donation events (and the backward-compat
 * 'Contribute' alias) to the repository.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import pino from "pino";
import { DonationHandler } from "./donation.handler.js";
import type { EventRepository } from "../../repository.js";
import type { IndexerEvent } from "../../rpc-client.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONTRACT_A = "CCAMPAIGN111111111111111111111111111111111111111111111";
const CONTRIBUTOR_1 = "GCONTRIB1111111111111111111111111111111111111111111111";

const donationEvent: IndexerEvent = {
  id: "donation-001",
  timestamp: 1_700_000_100,
  type: "donation",
  contractId: CONTRACT_A,
  data: {
    contributor: CONTRIBUTOR_1,
    amount: "500000000",
    total_raised: "500000000",
  },
};

const contributeEvent: IndexerEvent = {
  id: "contribute-001",
  timestamp: 1_700_000_200,
  type: "Contribute", // legacy Soroban contract event name
  contractId: CONTRACT_A,
  data: {
    contributor: CONTRIBUTOR_1,
    amount: "1000000000",
    total_raised: "1500000000",
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

describe("DonationHandler", () => {
  let handler: DonationHandler;
  let repo: EventRepository;

  beforeEach(() => {
    handler = new DonationHandler(silentLogger);
    repo = makeMockRepository();
  });

  it("has the correct canonical eventType", () => {
    expect(handler.eventType).toBe("donation");
  });

  it("declares 'Contribute' as a backward-compat alias", () => {
    expect(DonationHandler.aliases).toContain("Contribute");
  });

  it("calls repository.addEvents with donation events", () => {
    handler.handle([donationEvent], repo);
    expect(repo.addEvents).toHaveBeenCalledWith([donationEvent]);
  });

  it("handles 'Contribute' typed events (backward compat)", () => {
    // The dispatcher routes 'Contribute' events here via aliases.
    // The handler itself treats them identically.
    handler.handle([contributeEvent], repo);
    expect(repo.addEvents).toHaveBeenCalledWith([contributeEvent]);
  });

  it("handles a mixed batch of donation and Contribute events", () => {
    const batch = [donationEvent, contributeEvent];
    handler.handle(batch, repo);
    expect(repo.addEvents).toHaveBeenCalledWith(batch);
  });

  it("does not throw on an empty batch", () => {
    expect(() => handler.handle([], repo)).not.toThrow();
  });

  it("persists the contributor address and amount", () => {
    handler.handle([donationEvent], repo);
    const stored = (repo.addEvents as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as IndexerEvent[];
    expect(stored[0]?.data["contributor"]).toBe(CONTRIBUTOR_1);
    expect(stored[0]?.data["amount"]).toBe("500000000");
  });

  it("handles events with non-parseable amount without throwing", () => {
    const badAmount: IndexerEvent = {
      ...donationEvent,
      id: "bad-amount",
      data: { contributor: CONTRIBUTOR_1, amount: "not-a-number" },
    };
    expect(() => handler.handle([badAmount], repo)).not.toThrow();
    expect(repo.addEvents).toHaveBeenCalled();
  });
});

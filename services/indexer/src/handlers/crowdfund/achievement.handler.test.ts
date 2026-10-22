/**
 * Unit tests for AchievementHandler (#896)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import pino from "pino";
import { AchievementHandler } from "./achievement.handler.js";
import type { EventRepository } from "../../repository.js";
import type { IndexerEvent } from "../../rpc-client.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONTRACT_A = "CCAMPAIGN111111111111111111111111111111111111111111111";
const CONTRIBUTOR_1 = "GCONTRIB1111111111111111111111111111111111111111111111";

const achievementEvent: IndexerEvent = {
  id: "achievement-001",
  timestamp: 1_700_000_400,
  type: "achievement",
  contractId: CONTRACT_A,
  data: {
    contributor: CONTRIBUTOR_1,
    achievement_type: "first_contribution",
    badge: "pioneer",
    points: 100,
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

describe("AchievementHandler", () => {
  let handler: AchievementHandler;
  let repo: EventRepository;

  beforeEach(() => {
    handler = new AchievementHandler(silentLogger);
    repo = makeMockRepository();
  });

  it("has the correct eventType", () => {
    expect(handler.eventType).toBe("achievement");
  });

  it("calls repository.addEvents with the achievement batch", () => {
    handler.handle([achievementEvent], repo);
    expect(repo.addEvents).toHaveBeenCalledWith([achievementEvent]);
  });

  it("handles an empty batch without throwing", () => {
    expect(() => handler.handle([], repo)).not.toThrow();
    expect(repo.addEvents).toHaveBeenCalledWith([]);
  });

  it("persists badge and points data faithfully", () => {
    handler.handle([achievementEvent], repo);
    const stored = (repo.addEvents as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as IndexerEvent[];
    expect(stored[0]?.data["badge"]).toBe("pioneer");
    expect(stored[0]?.data["points"]).toBe(100);
    expect(stored[0]?.data["achievement_type"]).toBe("first_contribution");
  });

  it("handles a multi-event batch", () => {
    const second: IndexerEvent = {
      ...achievementEvent,
      id: "achievement-002",
      data: {
        contributor: CONTRIBUTOR_1,
        achievement_type: "top_contributor",
        badge: "champion",
        points: 500,
      },
    };
    handler.handle([achievementEvent, second], repo);
    const stored = (repo.addEvents as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as IndexerEvent[];
    expect(stored).toHaveLength(2);
  });
});

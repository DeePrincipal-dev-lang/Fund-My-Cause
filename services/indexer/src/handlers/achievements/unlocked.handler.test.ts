import { describe, expect, it, vi } from "vitest";
import pino from "pino";
import { AchievementUnlockedHandler } from "./unlocked.handler.js";
import type { EventRepository } from "../../repository.js";
import type { IndexerEvent } from "../../rpc-client.js";

const unlockedEvent: IndexerEvent = {
  id: "achievement-unlocked-001",
  timestamp: 1_700_000_700_000,
  type: "ach_unl",
  contractId: "CACHIEVEMENTS1111111111111111111111111111111111111111",
  data: {
    user: "GUSER111111111111111111111111111111111111111111111111",
    achievement_type: 2,
    points_earned: 100,
    timestamp: 1_700_000_700,
  },
};

describe("AchievementUnlockedHandler", () => {
  it("persists the decoded achievement event without changing its data", () => {
    const repository: EventRepository = {
      addEvents: vi.fn(),
      queryByContract: vi.fn().mockReturnValue([]),
      queryByType: vi.fn().mockReturnValue([]),
      getAllEvents: vi.fn().mockReturnValue([]),
      getCount: vi.fn().mockReturnValue(0),
    };
    const handler = new AchievementUnlockedHandler(pino({ level: "silent" }));

    handler.handle([unlockedEvent], repository);

    expect(repository.addEvents).toHaveBeenCalledWith([unlockedEvent]);
  });
});
import { describe, expect, it, vi } from "vitest";
import pino from "pino";
import { AchievementPointsAwardedHandler } from "./points-awarded.handler.js";
import type { EventRepository } from "../../repository.js";
import type { IndexerEvent } from "../../rpc-client.js";

const pointsEvent: IndexerEvent = {
  id: "achievement-points-001",
  timestamp: 1_700_000_800_000,
  type: "ach_pts",
  contractId: "CACHIEVEMENTS1111111111111111111111111111111111111111",
  data: {
    user: "GUSER111111111111111111111111111111111111111111111111",
    points: 25,
    total_points: 125,
    timestamp: 1_700_000_800,
  },
};

describe("AchievementPointsAwardedHandler", () => {
  it("persists the decoded points event without changing its data", () => {
    const repository: EventRepository = {
      addEvents: vi.fn(),
      queryByContract: vi.fn().mockReturnValue([]),
      queryByType: vi.fn().mockReturnValue([]),
      getAllEvents: vi.fn().mockReturnValue([]),
      getCount: vi.fn().mockReturnValue(0),
    };
    const handler = new AchievementPointsAwardedHandler(
      pino({ level: "silent" }),
    );

    handler.handle([pointsEvent], repository);

    expect(repository.addEvents).toHaveBeenCalledWith([pointsEvent]);
  });
});
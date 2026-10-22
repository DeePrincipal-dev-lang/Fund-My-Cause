/**
 * Unit tests for milestone handlers — Issue #1283
 *
 * Tests handler validation and dispatch logic for milestone events.
 */

import {
  handleMilestoneReached,
  handleMilestoneEvent,
  MILESTONE_EVENTS,
  MilestonePayload,
} from "../handlers/milestone";

describe("milestone handlers", () => {
  const validPayload: MilestonePayload = {
    milestoneId: "milestone-123",
    campaignId: "camp-456",
    percentage: 50,
    amount: 5000,
    currency: "USDC",
    timestamp: Date.now(),
  };

  describe("handleMilestoneReached", () => {
    it("accepts valid milestone.reached payload", () => {
      expect(() => handleMilestoneReached(validPayload)).not.toThrow();
    });

    it("rejects payload without milestoneId", () => {
      const invalid = { ...validPayload, milestoneId: "" };
      expect(() => handleMilestoneReached(invalid)).toThrow(
        "missing required fields",
      );
    });

    it("rejects payload without campaignId", () => {
      const invalid = { ...validPayload, campaignId: "" };
      expect(() => handleMilestoneReached(invalid)).toThrow(
        "missing required fields",
      );
    });

    it("rejects payload without percentage", () => {
      const invalid = { ...validPayload, percentage: undefined };
      expect(() => handleMilestoneReached(invalid)).toThrow(
        "missing required fields",
      );
    });

    it("rejects payload without amount", () => {
      const invalid = { ...validPayload, amount: undefined };
      expect(() => handleMilestoneReached(invalid)).toThrow(
        "missing required fields",
      );
    });

    it("rejects percentage below 0", () => {
      const invalid = { ...validPayload, percentage: -1 };
      expect(() => handleMilestoneReached(invalid)).toThrow(
        "percentage must be between 0 and 100",
      );
    });

    it("rejects percentage above 100", () => {
      const invalid = { ...validPayload, percentage: 101 };
      expect(() => handleMilestoneReached(invalid)).toThrow(
        "percentage must be between 0 and 100",
      );
    });

    it("accepts percentage at boundaries", () => {
      const payload0 = { ...validPayload, percentage: 0 };
      const payload25 = { ...validPayload, percentage: 25 };
      const payload50 = { ...validPayload, percentage: 50 };
      const payload100 = { ...validPayload, percentage: 100 };

      expect(() => handleMilestoneReached(payload0)).not.toThrow();
      expect(() => handleMilestoneReached(payload25)).not.toThrow();
      expect(() => handleMilestoneReached(payload50)).not.toThrow();
      expect(() => handleMilestoneReached(payload100)).not.toThrow();
    });

    it("rejects negative amount", () => {
      const invalid = { ...validPayload, amount: -100 };
      expect(() => handleMilestoneReached(invalid)).toThrow(
        "amount must be non-negative",
      );
    });

    it("accepts zero and positive amounts", () => {
      const payload0 = { ...validPayload, amount: 0 };
      const payload1 = { ...validPayload, amount: 0.01 };
      const payloadLarge = { ...validPayload, amount: 999999999 };

      expect(() => handleMilestoneReached(payload0)).not.toThrow();
      expect(() => handleMilestoneReached(payload1)).not.toThrow();
      expect(() => handleMilestoneReached(payloadLarge)).not.toThrow();
    });

    it("accepts payload without optional metadata", () => {
      const payload = { ...validPayload };
      delete payload.metadata;
      expect(() => handleMilestoneReached(payload)).not.toThrow();
    });
  });

  describe("handleMilestoneEvent router", () => {
    it("routes milestone.reached to correct handler", () => {
      const spy = jest.spyOn(
        require("../handlers/milestone"),
        "handleMilestoneReached",
      );
      handleMilestoneEvent("milestone.reached", validPayload);
      expect(spy).toHaveBeenCalledWith(validPayload);
      spy.mockRestore();
    });

    it("throws on unknown milestone event type", () => {
      expect(() =>
        handleMilestoneEvent("milestone.unknown" as any, validPayload),
      ).toThrow("Unknown milestone event type");
    });
  });

  describe("MILESTONE_EVENTS constant", () => {
    it("contains milestone.reached event", () => {
      expect(MILESTONE_EVENTS.has("milestone.reached")).toBe(true);
      expect(MILESTONE_EVENTS.size).toBe(1);
    });

    it("does not contain non-milestone events", () => {
      expect(MILESTONE_EVENTS.has("campaign.created")).toBe(false);
      expect(MILESTONE_EVENTS.has("contribution.received")).toBe(false);
    });
  });
});

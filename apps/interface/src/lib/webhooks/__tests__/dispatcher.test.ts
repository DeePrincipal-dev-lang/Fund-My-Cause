/**
 * Unit tests for webhook dispatcher — Issue #1283
 *
 * Tests the central dispatcher that routes events to appropriate handlers.
 */

import {
  dispatchWebhookEvent,
  isValidEventType,
  getRegisteredEventTypes,
} from "../dispatcher";

describe("webhook dispatcher", () => {
  const validPayloads = {
    "campaign.created": {
      campaignId: "camp-1",
      title: "Test",
      ownerAddress: "G123",
      timestamp: Date.now(),
    },
    "campaign.updated": {
      campaignId: "camp-1",
      title: "Updated",
      ownerAddress: "G123",
      timestamp: Date.now(),
    },
    "campaign.funded": {
      campaignId: "camp-1",
      title: "Test",
      ownerAddress: "G123",
      currentAmount: 1000,
      timestamp: Date.now(),
    },
    "campaign.successful": {
      campaignId: "camp-1",
      title: "Test",
      ownerAddress: "G123",
      timestamp: Date.now(),
    },
    "campaign.cancelled": {
      campaignId: "camp-1",
      title: "Test",
      ownerAddress: "G123",
      timestamp: Date.now(),
    },
    "contribution.received": {
      contributionId: "contrib-1",
      campaignId: "camp-1",
      contributorAddress: "G123",
      amount: 100,
      currency: "USDC",
      timestamp: Date.now(),
    },
    "milestone.reached": {
      milestoneId: "ms-1",
      campaignId: "camp-1",
      percentage: 50,
      amount: 5000,
      currency: "USDC",
      timestamp: Date.now(),
    },
  };

  describe("dispatchWebhookEvent", () => {
    it("successfully dispatches all valid event types", () => {
      for (const [eventType, payload] of Object.entries(validPayloads)) {
        expect(() =>
          dispatchWebhookEvent(eventType as any, payload as any),
        ).not.toThrow();
      }
    });

    it("throws on unknown event type by default", () => {
      const payload = { id: "test", timestamp: Date.now() };
      expect(() =>
        dispatchWebhookEvent("unknown.event", payload as any),
      ).toThrow("Unknown webhook event type");
    });

    it("does not throw on unknown event when throwOnUnknown is false", () => {
      const payload = { id: "test", timestamp: Date.now() };
      expect(() =>
        dispatchWebhookEvent("unknown.event", payload as any, {
          throwOnUnknown: false,
        }),
      ).not.toThrow();
    });

    it("logs errors when logErrors is true", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const payload = { id: "test", timestamp: Date.now() };

      dispatchWebhookEvent("unknown.event", payload as any, {
        throwOnUnknown: false,
        logErrors: true,
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("does not log errors when logErrors is false", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const payload = { id: "test", timestamp: Date.now() };

      dispatchWebhookEvent("unknown.event", payload as any, {
        throwOnUnknown: false,
        logErrors: false,
      });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("uses default options when none provided", () => {
      const payload = { id: "test", timestamp: Date.now() };
      expect(() =>
        dispatchWebhookEvent("unknown.event", payload as any),
      ).toThrow();
    });

    it("respects partial options override", () => {
      const payload = { id: "test", timestamp: Date.now() };
      expect(() =>
        dispatchWebhookEvent("unknown.event", payload as any, {
          logErrors: true,
        }),
      ).toThrow();
    });
  });

  describe("isValidEventType", () => {
    it("returns true for all registered event types", () => {
      const eventTypes = Object.keys(validPayloads);
      eventTypes.forEach((eventType) => {
        expect(isValidEventType(eventType)).toBe(true);
      });
    });

    it("returns false for unknown event types", () => {
      expect(isValidEventType("unknown.event")).toBe(false);
      expect(isValidEventType("campaign.deleted")).toBe(false);
      expect(isValidEventType("payment.failed")).toBe(false);
    });

    it("returns false for non-string inputs", () => {
      expect(isValidEventType(null)).toBe(false);
      expect(isValidEventType(undefined)).toBe(false);
      expect(isValidEventType(123)).toBe(false);
      expect(isValidEventType({})).toBe(false);
      expect(isValidEventType([])).toBe(false);
    });
  });

  describe("getRegisteredEventTypes", () => {
    it("returns all registered event types", () => {
      const registered = getRegisteredEventTypes();
      const expected = Object.keys(validPayloads);

      expect(registered).toHaveLength(expected.length);
      expected.forEach((eventType) => {
        expect(registered).toContain(eventType as any);
      });
    });

    it("returns campaign events", () => {
      const registered = getRegisteredEventTypes();
      expect(registered).toContain("campaign.created" as any);
      expect(registered).toContain("campaign.updated" as any);
      expect(registered).toContain("campaign.funded" as any);
      expect(registered).toContain("campaign.successful" as any);
      expect(registered).toContain("campaign.cancelled" as any);
    });

    it("returns payment events", () => {
      const registered = getRegisteredEventTypes();
      expect(registered).toContain("contribution.received" as any);
    });

    it("returns milestone events", () => {
      const registered = getRegisteredEventTypes();
      expect(registered).toContain("milestone.reached" as any);
    });

    it("returns no duplicates", () => {
      const registered = getRegisteredEventTypes();
      const uniqueTypes = new Set(registered);
      expect(registered).toHaveLength(uniqueTypes.size);
    });
  });

  describe("event routing correctness", () => {
    it("routes campaign events to campaign handler", () => {
      const campaignEvents = [
        "campaign.created",
        "campaign.updated",
        "campaign.funded",
        "campaign.successful",
        "campaign.cancelled",
      ];

      campaignEvents.forEach((eventType) => {
        const payload = validPayloads[eventType as keyof typeof validPayloads];
        expect(() =>
          dispatchWebhookEvent(eventType as any, payload as any),
        ).not.toThrow();
      });
    });

    it("routes payment events to payment handler", () => {
      const payload = validPayloads["contribution.received"];
      expect(() =>
        dispatchWebhookEvent("contribution.received", payload as any),
      ).not.toThrow();
    });

    it("routes milestone events to milestone handler", () => {
      const payload = validPayloads["milestone.reached"];
      expect(() =>
        dispatchWebhookEvent("milestone.reached", payload as any),
      ).not.toThrow();
    });
  });

  describe("error handling for malformed payloads", () => {
    it("throws when campaign.created payload is missing required fields", () => {
      const invalidPayload = { timestamp: Date.now() };
      expect(() =>
        dispatchWebhookEvent("campaign.created", invalidPayload as any),
      ).toThrow();
    });

    it("throws when contribution.received payload has invalid amount", () => {
      const invalidPayload = {
        contributionId: "c1",
        campaignId: "camp1",
        contributorAddress: "G123",
        amount: 0,
        currency: "USDC",
        timestamp: Date.now(),
      };
      expect(() =>
        dispatchWebhookEvent("contribution.received", invalidPayload as any),
      ).toThrow();
    });

    it("throws when milestone.reached payload has invalid percentage", () => {
      const invalidPayload = {
        milestoneId: "ms1",
        campaignId: "camp1",
        percentage: 150,
        amount: 5000,
        currency: "USDC",
        timestamp: Date.now(),
      };
      expect(() =>
        dispatchWebhookEvent("milestone.reached", invalidPayload as any),
      ).toThrow();
    });
  });
});

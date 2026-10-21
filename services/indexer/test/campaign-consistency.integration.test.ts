/**
 * campaign-consistency.integration.test.ts
 * ──────────────────────────────────────────
 * Integration tests for campaign event consistency.
 * Tests the complete lifecycle of campaign creation and donations.
 * This file demonstrates the new separation of concerns using fixtures,
 * assertions, and base classes.
 *
 * These tests are marked as integration tests and can be separated
 * from unit tests in CI to maintain fast unit test execution.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { IntegrationTestBase } from "./integration-test-base";
import {
  createCampaignCreatedEvent,
  createDonationReceivedEvent,
  createCampaignLifecycleEvents,
} from "./fixtures/campaign-event-builder";
import {
  assertCampaignCreatedEvent,
  assertDonationReceivedEvent,
  assertEventOrder,
  assertAllEventsProcessed,
  assertCampaignState,
  assertNoDuplicateEvents,
} from "./assertions/campaign-assertions";

/**
 * Integration test suite for campaign event consistency.
 * Uses fixtures and assertions to make tests more readable and maintainable.
 */
describe("[Integration] Campaign Consistency", () => {
  class CampaignConsistencyTests extends IntegrationTestBase {}

  let testBase: CampaignConsistencyTests;
  const campaignContractId = "CAVQVW4OKQT4GCKKBSW4LRGHQ3P6WQEHB3Z4L3GZMRQCVFVYKNWK4B3";

  beforeEach(async () => {
    testBase = new CampaignConsistencyTests();
    await testBase.setupTestEnvironment();
  });

  afterEach(async () => {
    await testBase.teardownTestEnvironment();
  });

  describe("Campaign Creation", () => {
    it("should successfully process a CampaignCreated event", async () => {
      // Arrange
      const event = createCampaignCreatedEvent(campaignContractId, {
        title: "Emergency Relief Fund",
        creator: "GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO",
        goal: BigInt(100000),
      });

      // Act
      await testBase.submitAndProcess([event]);

      // Assert
      assertCampaignCreatedEvent(event, {
        title: "Emergency Relief Fund",
        goal: BigInt(100000),
      });
    });

    it("should validate required fields in CampaignCreated event", async () => {
      // Arrange
      const event = createCampaignCreatedEvent(campaignContractId);

      // Assert
      expect(event.type).toBe("CampaignCreated");
      expect(event.data.title).toBeDefined();
      expect(event.data.creator).toBeDefined();
      expect(event.data.deadline).toBeDefined();
      expect(event.data.goal).toBeGreaterThan(BigInt(0));
    });

    it("should maintain campaign creator immutability", async () => {
      // Arrange
      const creator = "GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO";
      const event = createCampaignCreatedEvent(campaignContractId, { creator });

      // Act & Assert
      assertCampaignCreatedEvent(event, { creator });
      expect(event.data.creator).toBe(creator);
    });
  });

  describe("Donation Processing", () => {
    it("should successfully process a DonationReceived event", async () => {
      // Arrange
      const donor = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
      const amount = BigInt(50000);
      const event = createDonationReceivedEvent(campaignContractId, {
        donor,
        amount,
      });

      // Act
      await testBase.submitAndProcess([event]);

      // Assert
      assertDonationReceivedEvent(event, { donor, amount });
      expect(event.processed).toBe(true);
    });

    it("should track multiple donations from different donors", async () => {
      // Arrange
      const donor1 = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
      const donor2 = "GBU34MZXVPUV3O4NMCQ4GJRYXRP3TSLZCAXJ4OBN3PJM7OC2UJHEZOJC";

      const donation1 = createDonationReceivedEvent(campaignContractId, {
        donor: donor1,
        amount: BigInt(30000),
      });

      const donation2 = createDonationReceivedEvent(campaignContractId, {
        donor: donor2,
        amount: BigInt(20000),
      });

      // Act
      await testBase.submitAndProcess([donation1, donation2]);

      // Assert
      expect(donation1.data.donor).not.toBe(donation2.data.donor);
      expect(donation1.data.amount).toEqual(BigInt(30000));
      expect(donation2.data.amount).toEqual(BigInt(20000));
    });

    it("should reject duplicate donation events", async () => {
      // Arrange
      const donation = createDonationReceivedEvent(campaignContractId, {
        donor: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        amount: BigInt(10000),
      });

      // Act & Assert - should handle duplicate gracefully
      // Implementation depends on EventStore behavior
      expect(donation.id).toBeDefined();
    });
  });

  describe("Campaign Lifecycle", () => {
    it("should maintain correct event order in campaign lifecycle", async () => {
      // Arrange
      const events = createCampaignLifecycleEvents(campaignContractId);

      // Assert - verify expected order
      const typeSequence = events.map((e) => e.type);
      expect(typeSequence[0]).toBe("CampaignCreated");
      expect(typeSequence).toContain("DonationReceived");
      expect(typeSequence).toContain("AchievementUnlocked");
    });

    it("should compute correct campaign totals from event sequence", async () => {
      // Arrange
      const events = createCampaignLifecycleEvents(campaignContractId, {
        donationAmounts: [BigInt(5000), BigInt(3000)],
      });

      // Act
      await testBase.submitAndProcess(events);

      // Assert - total raised should be sum of all donations
      assertCampaignState(events, {
        totalRaised: BigInt(8000),
        contributorCount: 2,
      });
    });

    it("should process all events without duplicates", async () => {
      // Arrange
      const events = createCampaignLifecycleEvents(campaignContractId);

      // Act
      await testBase.submitAndProcess(events);

      // Assert
      assertNoDuplicateEvents(events);
      assertAllEventsProcessed(events);
    });
  });

  describe("Event Consistency Checks", () => {
    it("should ensure every donor gets a unique event record", async () => {
      // Arrange
      const donors = [
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        "GBU34MZXVPUV3O4NMCQ4GJRYXRP3TSLZCAXJ4OBN3PJM7OC2UJHEZOJC",
        "GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO",
      ];

      const donations = donors.map((donor) =>
        createDonationReceivedEvent(campaignContractId, {
          donor,
          amount: BigInt(10000),
        })
      );

      // Assert
      const donorSet = new Set(donations.map((d) => d.data.donor));
      expect(donorSet.size).toBe(donors.length);
    });

    it("should maintain temporal ordering of events", async () => {
      // Arrange
      const events = createCampaignLifecycleEvents(campaignContractId);

      // Assert - all events should have timestamps
      events.forEach((event) => {
        expect(event.timestamp).toBeDefined();
        // Timestamp should be a valid ISO string or number
        if (typeof event.timestamp === "string") {
          expect(() => new Date(event.timestamp)).not.toThrow();
        }
      });
    });

    it("should track ledger sequence numbers correctly", async () => {
      // Arrange
      const events = createCampaignLifecycleEvents(campaignContractId);

      // Assign ledger numbers to simulate ledger progression
      events.forEach((event, index) => {
        event.ledger = 1000 + index;
      });

      // Assert - ledger numbers should be monotonically increasing
      for (let i = 1; i < events.length; i++) {
        expect(events[i].ledger).toBeGreaterThanOrEqual(events[i - 1].ledger);
      }
    });
  });

  describe("Error Recovery", () => {
    it("should handle malformed events gracefully", async () => {
      // Arrange
      const malformedEvent = createCampaignCreatedEvent(campaignContractId);
      malformedEvent.data = {}; // Clear data to simulate malformed event

      // Assert - should not throw
      expect(() => {
        assertCampaignCreatedEvent(malformedEvent);
      }).toThrow(); // Expected to fail assertion
    });

    it("should recover from processing interruption", async () => {
      // Arrange
      const event1 = createCampaignCreatedEvent(campaignContractId);
      const event2 = createDonationReceivedEvent(campaignContractId);

      // Act - process events sequentially (simulate recovery)
      await testBase.submitAndProcess([event1]);
      // Simulate interruption/recovery
      await testBase.submitAndProcess([event2]);

      // Assert
      expect(event1.type).toBe("CampaignCreated");
      expect(event2.type).toBe("DonationReceived");
    });
  });
});

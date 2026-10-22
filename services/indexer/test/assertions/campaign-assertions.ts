/**
 * campaign-assertions.ts
 * ──────────────────────
 * Campaign-specific assertions for integration tests.
 * Separates assertion logic from test files for reusability.
 */

import { expect } from "vitest";
import type { SorobanEvent } from "../../src/repository";

/**
 * Assert that a CampaignCreated event has the expected structure
 */
export function assertCampaignCreatedEvent(
  event: SorobanEvent,
  expectedData: Partial<{
    title: string;
    creator: string;
    goal: bigint;
    minContribution: bigint;
  }> = {}
): void {
  expect(event.type).toBe("CampaignCreated");
  expect(event.data).toBeDefined();

  if (expectedData.title) {
    expect(event.data.title).toBe(expectedData.title);
  }

  if (expectedData.creator) {
    expect(event.data.creator).toBe(expectedData.creator);
  }

  if (expectedData.goal) {
    expect(event.data.goal).toBe(expectedData.goal);
  }

  if (expectedData.minContribution) {
    expect(event.data.minContribution).toBe(expectedData.minContribution);
  }

  // Verify required fields always present
  expect(event.data.title).toBeDefined();
  expect(event.data.creator).toBeDefined();
  expect(event.data.deadline).toBeDefined();
  expect(event.data.goal).toBeDefined();
}

/**
 * Assert that a DonationReceived event has the expected structure
 */
export function assertDonationReceivedEvent(
  event: SorobanEvent,
  expectedData: Partial<{
    donor: string;
    amount: bigint;
  }> = {}
): void {
  expect(event.type).toBe("DonationReceived");
  expect(event.data).toBeDefined();

  if (expectedData.donor) {
    expect(event.data.donor).toBe(expectedData.donor);
  }

  if (expectedData.amount) {
    expect(event.data.amount).toBe(expectedData.amount);
  }

  // Verify required fields
  expect(event.data.donor).toBeDefined();
  expect(event.data.amount).toBeDefined();
  expect(event.data.timestamp).toBeDefined();
}

/**
 * Assert that an AchievementUnlocked event has the expected structure
 */
export function assertAchievementUnlockedEvent(
  event: SorobanEvent,
  expectedData: Partial<{
    achievementId: string;
    unlockedBy: string;
  }> = {}
): void {
  expect(event.type).toBe("AchievementUnlocked");
  expect(event.data).toBeDefined();

  if (expectedData.achievementId) {
    expect(event.data.achievementId).toBe(expectedData.achievementId);
  }

  if (expectedData.unlockedBy) {
    expect(event.data.unlockedBy).toBe(expectedData.unlockedBy);
  }

  // Verify required fields
  expect(event.data.achievementId).toBeDefined();
  expect(event.data.unlockedBy).toBeDefined();
  expect(event.data.timestamp).toBeDefined();
}

/**
 * Assert that a UserRegistered event has the expected structure
 */
export function assertUserRegisteredEvent(
  event: SorobanEvent,
  expectedData: Partial<{
    userAddress: string;
  }> = {}
): void {
  expect(event.type).toBe("UserRegistered");
  expect(event.data).toBeDefined();

  if (expectedData.userAddress) {
    expect(event.data.userAddress).toBe(expectedData.userAddress);
  }

  // Verify required fields
  expect(event.data.userAddress).toBeDefined();
  expect(event.data.registeredAt).toBeDefined();
}

/**
 * Assert that events were processed in a specific order
 */
export function assertEventOrder(
  events: SorobanEvent[],
  expectedTypeSequence: string[]
): void {
  expect(events).toHaveLength(expectedTypeSequence.length);

  events.forEach((event, index) => {
    expect(event.type).toBe(
      expectedTypeSequence[index],
      `Event at index ${index} has wrong type`
    );
  });
}

/**
 * Assert that all events have been marked as processed
 */
export function assertAllEventsProcessed(events: SorobanEvent[]): void {
  events.forEach((event) => {
    expect(event.processed).toBe(
      true,
      `Event ${event.id} of type ${event.type} was not processed`
    );
  });
}

/**
 * Assert campaign state after a series of events
 */
export function assertCampaignState(
  events: SorobanEvent[],
  expectedState: Partial<{
    totalRaised: bigint;
    contributorCount: number;
    status: string;
  }> = {}
): void {
  const campaignState = {
    totalRaised: BigInt(0),
    contributorCount: 0,
    status: "Active",
  };

  // Aggregate state from events
  events.forEach((event) => {
    if (event.type === "DonationReceived") {
      campaignState.totalRaised += event.data.amount || BigInt(0);
      campaignState.contributorCount += 1;
    }
    if (event.type === "CampaignCreated") {
      campaignState.status = "Active";
    }
  });

  if (expectedState.totalRaised !== undefined) {
    expect(campaignState.totalRaised).toBe(expectedState.totalRaised);
  }

  if (expectedState.contributorCount !== undefined) {
    expect(campaignState.contributorCount).toBe(expectedState.contributorCount);
  }

  if (expectedState.status !== undefined) {
    expect(campaignState.status).toBe(expectedState.status);
  }
}

/**
 * Assert that no duplicate events were processed
 */
export function assertNoDuplicateEvents(events: SorobanEvent[]): void {
  const eventIds = new Set<string>();

  events.forEach((event) => {
    if (eventIds.has(event.id)) {
      throw new Error(`Duplicate event ID found: ${event.id}`);
    }
    eventIds.add(event.id);
  });
}

/**
 * Assert that events belong to expected contracts
 */
export function assertEventContracts(
  events: SorobanEvent[],
  expectedContractIds: string[]
): void {
  const contractIds = new Set(events.map((e) => e.contractId));
  const expected = new Set(expectedContractIds);

  expect(contractIds).toEqual(expected);
}

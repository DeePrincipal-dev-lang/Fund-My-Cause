/**
 * campaign-event-builder.ts
 * ─────────────────────────
 * Fixture builder for campaign-related Soroban events.
 * Used to create consistent test data for integration tests.
 */

import type { SorobanEvent } from "../../src/repository";

/**
 * Builder for creating campaign events in tests.
 * Encapsulates the structure and reduces repetition across test files.
 */
export class CampaignEventBuilder {
  private event: Partial<SorobanEvent> = {
    contractId: "CA...",
    type: "CampaignCreated",
    data: {},
  };

  /**
   * Set the contract ID for this event
   */
  withContractId(contractId: string): this {
    this.event.contractId = contractId;
    return this;
  }

  /**
   * Set the event type
   */
  withType(type: string): this {
    this.event.type = type;
    return this;
  }

  /**
   * Set the event data payload
   */
  withData(data: Record<string, any>): this {
    this.event.data = data;
    return this;
  }

  /**
   * Set the event timestamp
   */
  withTimestamp(timestamp: string): this {
    this.event.timestamp = timestamp;
    return this;
  }

  /**
   * Set the ledger sequence number
   */
  withLedger(ledger: number): this {
    this.event.ledger = ledger;
    return this;
  }

  /**
   * Build the final event object
   */
  build(): SorobanEvent {
    const defaults: SorobanEvent = {
      id: `event_${Date.now()}`,
      contractId: this.event.contractId || "CA_DEFAULT",
      type: this.event.type || "CampaignCreated",
      data: this.event.data || {},
      timestamp: this.event.timestamp || new Date().toISOString(),
      ledger: this.event.ledger || 0,
      processed: false,
    };

    return {
      ...defaults,
      ...this.event,
    };
  }
}

/**
 * Create a CampaignCreated event
 */
export function createCampaignCreatedEvent(
  contractId: string,
  data: Partial<{
    title: string;
    creator: string;
    deadline: bigint;
    goal: bigint;
    minContribution: bigint;
  }> = {}
): SorobanEvent {
  return new CampaignEventBuilder()
    .withContractId(contractId)
    .withType("CampaignCreated")
    .withData({
      title: data.title || "Test Campaign",
      creator: data.creator || "GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO",
      deadline: data.deadline || BigInt(Math.floor(Date.now() / 1000) + 86400),
      goal: data.goal || BigInt(10000),
      minContribution: data.minContribution || BigInt(1),
    })
    .build();
}

/**
 * Create a DonationReceived event
 */
export function createDonationReceivedEvent(
  contractId: string,
  data: Partial<{
    donor: string;
    amount: bigint;
    timestamp: bigint;
  }> = {}
): SorobanEvent {
  return new CampaignEventBuilder()
    .withContractId(contractId)
    .withType("DonationReceived")
    .withData({
      donor: data.donor || "GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO",
      amount: data.amount || BigInt(1000),
      timestamp: data.timestamp || BigInt(Math.floor(Date.now() / 1000)),
    })
    .build();
}

/**
 * Create an AchievementUnlocked event
 */
export function createAchievementUnlockedEvent(
  contractId: string,
  data: Partial<{
    achievementId: string;
    unlockedBy: string;
    timestamp: bigint;
  }> = {}
): SorobanEvent {
  return new CampaignEventBuilder()
    .withContractId(contractId)
    .withType("AchievementUnlocked")
    .withData({
      achievementId: data.achievementId || "achievement_1",
      unlockedBy: data.unlockedBy || "GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO",
      timestamp: data.timestamp || BigInt(Math.floor(Date.now() / 1000)),
    })
    .build();
}

/**
 * Create a UserRegistered event
 */
export function createUserRegisteredEvent(
  contractId: string,
  data: Partial<{
    userAddress: string;
    registeredAt: bigint;
  }> = {}
): SorobanEvent {
  return new CampaignEventBuilder()
    .withContractId(contractId)
    .withType("UserRegistered")
    .withData({
      userAddress: data.userAddress || "GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO",
      registeredAt: data.registeredAt || BigInt(Math.floor(Date.now() / 1000)),
    })
    .build();
}

/**
 * Create a batch of events for a campaign lifecycle
 */
export function createCampaignLifecycleEvents(
  contractId: string,
  options: {
    creatorAddress?: string;
    donorAddresses?: string[];
    donationAmounts?: bigint[];
  } = {}
): SorobanEvent[] {
  const creator = options.creatorAddress || "GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO";
  const donors = options.donorAddresses || [
    "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    "GBU34MZXVPUV3O4NMCQ4GJRYXRP3TSLZCAXJ4OBN3PJM7OC2UJHEZOJC",
  ];
  const amounts = options.donationAmounts || [BigInt(5000), BigInt(3000)];

  const events: SorobanEvent[] = [];

  // Campaign creation event
  events.push(
    createCampaignCreatedEvent(contractId, {
      creator,
      title: "Test Campaign",
      goal: BigInt(10000),
    })
  );

  // Donation events
  donors.forEach((donor, index) => {
    const amount = amounts[index] || BigInt(1000);
    events.push(
      createDonationReceivedEvent(contractId, {
        donor,
        amount,
      })
    );
  });

  // Achievement unlock events
  events.push(
    createAchievementUnlockedEvent(contractId, {
      achievementId: "first_donor",
      unlockedBy: donors[0],
    })
  );

  return events;
}

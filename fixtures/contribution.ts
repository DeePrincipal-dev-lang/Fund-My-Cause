/**
 * Canonical contribution fixtures for test suites across the monorepo.
 */

export interface ContributionFixture {
  id: string;
  campaignId: string;
  contributor: string;
  /** BigInt represented as a decimal string */
  amount: string;
  /** ISO 8601 date-time string */
  timestamp: string;
  transactionHash: string;
}

// ---------------------------------------------------------------------------
// Individual contributions
// ---------------------------------------------------------------------------

/** A standard mid-sized contribution to the active campaign. */
export const contributionAlice: ContributionFixture = {
  id: "contrib-001",
  campaignId: "campaign-001",
  contributor: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
  amount: "500000000",
  timestamp: "2026-07-15T10:30:00.000Z",
  transactionHash:
    "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
};

/** A minimum-sized contribution to the active campaign. */
export const contributionBob: ContributionFixture = {
  id: "contrib-002",
  campaignId: "campaign-001",
  contributor: "GBWMCCC3NHWHWMEF6JS4XS1ZB8IRNRR5YB7XOQZ7HNFKALAHPO36YIB",
  amount: "10000000",
  timestamp: "2026-07-20T14:00:00.000Z",
  transactionHash:
    "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
};

/** A large contribution to the funded campaign (pushed it over the goal). */
export const contributionCarol: ContributionFixture = {
  id: "contrib-003",
  campaignId: "campaign-002",
  contributor: "GCLNM5EKHNPHKB6ZIQWXRXZQV7JZQ7KBNK4FQTFHCJHKPKNP2PPZBIO",
  amount: "1000000000",
  timestamp: "2026-08-10T09:00:00.000Z",
  transactionHash:
    "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
};

/** A refundable contribution to the campaign that did not meet its goal. */
export const contributionDave: ContributionFixture = {
  id: "contrib-004",
  campaignId: "campaign-005",
  contributor: "GDCIHEQYQFQ4MPKBHBF5DQWIRN5JL5U5YTZB5Z4MXKMKBVVJJIBVCND",
  amount: "200000000",
  timestamp: "2026-05-03T16:45:00.000Z",
  transactionHash:
    "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
};

/** A second refundable contribution from a different contributor on the failed campaign. */
export const contributionEve: ContributionFixture = {
  id: "contrib-005",
  campaignId: "campaign-005",
  contributor: "GBFLP7KBOGGKJSJ4IHKHNXWVWVJVN7JXNRTVWRLXJPF6MQOVTQQ3WDR",
  amount: "350000000",
  timestamp: "2026-06-18T11:20:00.000Z",
  transactionHash:
    "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
};

// ---------------------------------------------------------------------------
// Convenience collections
// ---------------------------------------------------------------------------

/** All contributions for campaign-001 (active campaign). */
export const campaign001Contributions: ContributionFixture[] = [
  contributionAlice,
  contributionBob,
];

/** All contributions for campaign-005 (refunding campaign). */
export const campaign005Contributions: ContributionFixture[] = [
  contributionDave,
  contributionEve,
];

/** Every contribution fixture in one flat array. */
export const allContributions: ContributionFixture[] = [
  contributionAlice,
  contributionBob,
  contributionCarol,
  contributionDave,
  contributionEve,
];

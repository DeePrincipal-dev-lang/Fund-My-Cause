/**
 * Canonical campaign fixtures for test suites across the monorepo.
 *
 * Each fixture represents a distinct campaign lifecycle state so that tests can
 * import a ready-made object instead of building ad-hoc inline data.
 */

export interface CampaignFixture {
  id: string;
  contractId: string;
  title: string;
  description: string;
  creator: string;
  /** BigInt represented as a decimal string (e.g. "10000000000") */
  goal: string;
  /** BigInt represented as a decimal string */
  raised: string;
  /** ISO 8601 date-time string */
  deadline: string;
  status: "ACTIVE" | "SUCCESSFUL" | "REFUNDED" | "CANCELLED" | "PAUSED" | "ARCHIVED";
  category: string;
  image: string | null;
  videoUrl: string | null;
  /** BigInt represented as a decimal string */
  minContribution: string;
  /** BigInt represented as a decimal string */
  totalRaised: string;
  totalContributors: number;
  percentageFunded: number;
  daysRemaining: number;
  /** Stellar asset issuer or native token identifier */
  token: string;
  platformFeeBps: number | null;
  hasRBACEnabled: boolean;
  /** ISO 8601 date-time string */
  createdAt: string;
  /** ISO 8601 date-time string */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// activeCampaign — currently accepting contributions, ~45 % funded
// ---------------------------------------------------------------------------
export const activeCampaign: CampaignFixture = {
  id: "campaign-001",
  contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  title: "Clean Water for Kajiado",
  description:
    "Fund three boreholes to supply clean drinking water for 4,000 people in the Kajiado district.",
  creator: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
  goal: "10000000000",
  raised: "4500000000",
  deadline: "2026-12-31T23:59:59.000Z",
  status: "ACTIVE",
  category: "Humanitarian",
  image: "https://example.com/images/campaign-001.jpg",
  videoUrl: null,
  minContribution: "10000000",
  totalRaised: "4500000000",
  totalContributors: 87,
  percentageFunded: 45,
  daysRemaining: 125,
  token: "native",
  platformFeeBps: 250,
  hasRBACEnabled: false,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-08-28T05:00:00.000Z",
};

// ---------------------------------------------------------------------------
// fundedCampaign — goal met, awaiting creator withdrawal
// ---------------------------------------------------------------------------
export const fundedCampaign: CampaignFixture = {
  id: "campaign-002",
  contractId: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBSC4",
  title: "Solar Panels for Rural Schools",
  description:
    "Install solar panels across 12 rural schools to provide reliable electricity for students.",
  creator: "GBWMCCC3NHWHWMEF6JS4XS1ZB8IRNRR5YB7XOQZ7HNFKALAHPO36YIB",
  goal: "5000000000",
  raised: "5250000000",
  deadline: "2026-09-15T23:59:59.000Z",
  status: "SUCCESSFUL",
  category: "Education",
  image: "https://example.com/images/campaign-002.jpg",
  videoUrl: "https://example.com/videos/campaign-002.mp4",
  minContribution: "5000000",
  totalRaised: "5250000000",
  totalContributors: 214,
  percentageFunded: 105,
  daysRemaining: 0,
  token: "native",
  platformFeeBps: 200,
  hasRBACEnabled: true,
  createdAt: "2026-06-01T08:00:00.000Z",
  updatedAt: "2026-08-20T14:30:00.000Z",
};

// ---------------------------------------------------------------------------
// draftCampaign — created but not yet accepting contributions (PAUSED)
// ---------------------------------------------------------------------------
export const draftCampaign: CampaignFixture = {
  id: "campaign-003",
  contractId: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCSC4",
  title: "Community Library Renovation",
  description:
    "Renovate the 1960s public library building to make it accessible and energy-efficient.",
  creator: "GCLNM5EKHNPHKB6ZIQWXRXZQV7JZQ7KBNK4FQTFHCJHKPKNP2PPZBIO",
  goal: "2000000000",
  raised: "0",
  deadline: "2027-03-01T23:59:59.000Z",
  status: "PAUSED",
  category: "Community",
  image: null,
  videoUrl: null,
  minContribution: "1000000",
  totalRaised: "0",
  totalContributors: 0,
  percentageFunded: 0,
  daysRemaining: 185,
  token: "native",
  platformFeeBps: null,
  hasRBACEnabled: false,
  createdAt: "2026-08-25T09:00:00.000Z",
  updatedAt: "2026-08-25T09:00:00.000Z",
};

// ---------------------------------------------------------------------------
// closedCampaign — campaign ended and archived
// ---------------------------------------------------------------------------
export const closedCampaign: CampaignFixture = {
  id: "campaign-004",
  contractId: "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDSC4",
  title: "Tree Planting Drive 2025",
  description:
    "Plant 10,000 trees across deforested highland areas to restore the local watershed.",
  creator: "GDCIHEQYQFQ4MPKBHBF5DQWIRN5JL5U5YTZB5Z4MXKMKBVVJJIBVCND",
  goal: "3000000000",
  raised: "3000000000",
  deadline: "2025-12-31T23:59:59.000Z",
  status: "ARCHIVED",
  category: "Environment",
  image: "https://example.com/images/campaign-004.jpg",
  videoUrl: null,
  minContribution: "2000000",
  totalRaised: "3000000000",
  totalContributors: 412,
  percentageFunded: 100,
  daysRemaining: 0,
  token: "native",
  platformFeeBps: 300,
  hasRBACEnabled: false,
  createdAt: "2025-08-01T00:00:00.000Z",
  updatedAt: "2026-01-05T12:00:00.000Z",
};

// ---------------------------------------------------------------------------
// refundingCampaign — deadline passed, goal not met, refunds available
// ---------------------------------------------------------------------------
export const refundingCampaign: CampaignFixture = {
  id: "campaign-005",
  contractId: "CEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEESC4",
  title: "Community Kitchen Equipment",
  description:
    "Purchase commercial kitchen equipment for a neighbourhood soup kitchen serving 200 meals a day.",
  creator: "GBFLP7KBOGGKJSJ4IHKHNXWVWVJVN7JXNRTVWRLXJPF6MQOVTQQ3WDR",
  goal: "8000000000",
  raised: "2100000000",
  deadline: "2026-07-31T23:59:59.000Z",
  status: "REFUNDED",
  category: "Community",
  image: "https://example.com/images/campaign-005.jpg",
  videoUrl: null,
  minContribution: "5000000",
  totalRaised: "2100000000",
  totalContributors: 63,
  percentageFunded: 26,
  daysRemaining: 0,
  token: "native",
  platformFeeBps: 250,
  hasRBACEnabled: false,
  createdAt: "2026-04-01T07:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Convenience collection
// ---------------------------------------------------------------------------
export const allCampaigns: CampaignFixture[] = [
  activeCampaign,
  fundedCampaign,
  draftCampaign,
  closedCampaign,
  refundingCampaign,
];

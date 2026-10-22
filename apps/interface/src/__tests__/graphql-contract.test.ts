/**
 * Contract tests: validate that all frontend GraphQL operations are compatible
 * with the backend schema defined in services/graphql-api/src/schema.ts.
 *
 * The SDL is inlined here so the test has no runtime dependency on graphql-tag
 * or on the backend package itself.  When the schema changes, update the SDL
 * copy below (and update the operations if necessary) to keep the contract in sync.
 *
 * Approach:
 *   1. Build a GraphQLSchema from the SDL string using `buildSchema`.
 *   2. Parse each frontend operation document with `parse`.
 *   3. Call `validate(schema, document)` — an empty errors array means the
 *      operation is fully compatible with the schema.
 *   4. Write explicit field-presence tests for the most critical types so that
 *      accidental field removals are caught with a clear failure message.
 */

import { buildSchema, parse, validate, GraphQLObjectType, GraphQLEnumType } from "graphql";

// ---------------------------------------------------------------------------
// Schema SDL — keep in sync with services/graphql-api/src/schema.ts
// ---------------------------------------------------------------------------
const SDL = /* GraphQL */ `
  type Campaign {
    id: ID!
    contractId: String!
    title: String!
    description: String!
    creator: String!
    goal: BigInt!
    raised: BigInt!
    deadline: String!
    status: CampaignStatus!
    category: String!
    image: String
    videoUrl: String
    minContribution: BigInt!
    totalRaised: BigInt!
    totalContributors: Int!
    percentageFunded: Float!
    daysRemaining: Int!
    token: String!
    platformFeeBps: Int
    hasRBACEnabled: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  enum CampaignStatus {
    ACTIVE
    SUCCESSFUL
    REFUNDED
    CANCELLED
    PAUSED
    ARCHIVED
  }

  type Contribution {
    id: ID!
    campaignId: ID!
    contributor: String!
    amount: BigInt!
    timestamp: String!
    transactionHash: String!
  }

  type User {
    address: String!
    totalContributed: BigInt!
    contributionCount: Int!
    campaigns: [Campaign!]!
    contributions: [Contribution!]!
    joinedAt: String!
  }

  type CampaignDetail {
    campaign: Campaign!
    contributors: [Contributor!]!
    topContributors(limit: Int = 10): [TopContributor!]!
    updates: [CampaignUpdate!]!
    milestones: [Milestone!]!
  }

  type Contributor {
    address: String!
    amount: BigInt!
    contributionCount: Int!
    isTopContributor: Boolean!
  }

  type TopContributor {
    rank: Int!
    address: String!
    amount: BigInt!
    percentage: Float!
  }

  type CampaignUpdate {
    id: ID!
    campaignId: ID!
    content: String!
    ipfsHash: String!
    timestamp: String!
  }

  type Milestone {
    id: ID!
    campaignId: ID!
    title: String!
    description: String!
    targetAmount: BigInt!
    releasePercentage: Int!
    status: MilestoneStatus!
  }

  enum MilestoneStatus {
    PENDING
    REACHED
    RELEASED
  }

  input CampaignFilter {
    status: [CampaignStatus!]
    category: [String!]
    minGoal: BigInt
    maxGoal: BigInt
    creator: String
    search: String
  }

  input PaginationInput {
    limit: Int = 20
    offset: Int = 0
  }

  type CampaignConnection {
    edges: [CampaignEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CampaignEdge {
    node: Campaign!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  input CampaignSort {
    field: SortField!
    direction: SortDirection!
  }

  enum SortField {
    CREATED_AT
    RAISED_AMOUNT
    GOAL
    DEADLINE
    CONTRIBUTORS
  }

  enum SortDirection {
    ASC
    DESC
  }

  type Statistics {
    totalCampaigns: Int!
    activeCampaigns: Int!
    totalRaised: BigInt!
    totalContributors: Int!
    averageContribution: BigInt!
    successRate: Float!
  }

  type CampaignProgress {
    campaignId: ID!
    raised: BigInt!
    percentageFunded: Float!
    contributors: Int!
    daysRemaining: Int!
    timestamp: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input CreateCampaignInput {
    title: String!
    description: String!
    goal: BigInt!
    deadline: String!
    category: String!
    image: String
    videoUrl: String
    minContribution: BigInt!
  }

  input UpdateCampaignInput {
    title: String
    description: String
    image: String
    videoUrl: String
  }

  input RecordContributionInput {
    campaignId: ID!
    contributor: String!
    amount: BigInt!
    transactionHash: String!
  }

  scalar BigInt

  type Query {
    campaign(id: ID!): Campaign
    campaigns(
      filter: CampaignFilter
      first: Int
      after: String
      pagination: PaginationInput
      sort: CampaignSort
    ): CampaignConnection!
    activeCampaigns(limit: Int = 20): [Campaign!]!
    trendingCampaigns(limit: Int = 10): [Campaign!]!
    searchCampaigns(query: String!, limit: Int = 20): [Campaign!]!
    campaignDetail(id: ID!): CampaignDetail
    contribution(id: ID!): Contribution
    contributions(campaignId: ID, contributor: String): [Contribution!]!
    user(address: String!): User
    userContributions(address: String!, limit: Int = 50): [Contribution!]!
    stats: Statistics!
  }

  type Subscription {
    campaignUpdated(id: ID!): CampaignUpdate!
    campaignStatusChanged(id: ID!): Campaign!
    newContribution(campaignId: ID!): Contribution!
    campaignProgressChanged(id: ID!): CampaignProgress!
    milestoneReached(campaignId: ID!): Milestone!
  }

  type Mutation {
    authenticate(
      signature: String!
      message: String!
      address: String!
    ): AuthPayload!
    createCampaign(input: CreateCampaignInput!): Campaign!
    updateCampaign(id: ID!, input: UpdateCampaignInput!): Campaign!
    recordContribution(input: RecordContributionInput!): Contribution!
  }
`;

// ---------------------------------------------------------------------------
// Frontend operation documents — mirrors apps/interface/src/lib/graphql/operations/
// ---------------------------------------------------------------------------

const CAMPAIGNS_OPERATION = /* GraphQL */ `
  query Campaigns(
    $filter: CampaignFilter
    $first: Int
    $after: String
    $pagination: PaginationInput
    $sort: CampaignSort
  ) {
    campaigns(
      filter: $filter
      first: $first
      after: $after
      pagination: $pagination
      sort: $sort
    ) {
      edges {
        cursor
        node {
          id
          contractId
          title
          description
          creator
          goal
          raised
          deadline
          status
          category
          image
          videoUrl
          minContribution
          totalRaised
          totalContributors
          percentageFunded
          daysRemaining
          token
          platformFeeBps
          hasRBACEnabled
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

const ACTIVE_CAMPAIGNS_OPERATION = /* GraphQL */ `
  query ActiveCampaigns($limit: Int) {
    activeCampaigns(limit: $limit) {
      id
      contractId
      title
      description
      creator
      goal
      raised
      deadline
      status
      category
      image
      videoUrl
      minContribution
      totalRaised
      totalContributors
      percentageFunded
      daysRemaining
      token
      platformFeeBps
      hasRBACEnabled
      createdAt
      updatedAt
    }
  }
`;

const CAMPAIGN_OPERATION = /* GraphQL */ `
  query Campaign($id: ID!) {
    campaign(id: $id) {
      id
      contractId
      title
      description
      creator
      goal
      raised
      deadline
      status
      category
      image
      videoUrl
      minContribution
      totalRaised
      totalContributors
      percentageFunded
      daysRemaining
      token
      platformFeeBps
      hasRBACEnabled
      createdAt
      updatedAt
    }
  }
`;

const CONTRIBUTIONS_OPERATION = /* GraphQL */ `
  query Contributions($campaignId: ID, $contributor: String) {
    contributions(campaignId: $campaignId, contributor: $contributor) {
      id
      campaignId
      contributor
      amount
      timestamp
      transactionHash
    }
  }
`;

const USER_CONTRIBUTIONS_OPERATION = /* GraphQL */ `
  query UserContributions($address: String!, $limit: Int) {
    userContributions(address: $address, limit: $limit) {
      id
      campaignId
      contributor
      amount
      timestamp
      transactionHash
    }
  }
`;

const USER_OPERATION = /* GraphQL */ `
  query User($address: String!) {
    user(address: $address) {
      address
      totalContributed
      contributionCount
      joinedAt
    }
  }
`;

// ---------------------------------------------------------------------------
// Build schema once for all tests
// ---------------------------------------------------------------------------
const schema = buildSchema(SDL);

// ---------------------------------------------------------------------------
// Helper: assert operation validates cleanly
// ---------------------------------------------------------------------------
function assertValidOperation(operationSDL: string, label: string): void {
  const document = parse(operationSDL);
  const errors = validate(schema, document);
  if (errors.length > 0) {
    const messages = errors.map((e) => `  • ${e.message}`).join("\n");
    throw new Error(
      `Schema contract violation in "${label}":\n${messages}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GraphQL contract — operation validation", () => {
  it("campaigns.graphql: Campaigns query is valid against the schema", () => {
    assertValidOperation(CAMPAIGNS_OPERATION, "Campaigns");
  });

  it("campaigns.graphql: ActiveCampaigns query is valid against the schema", () => {
    assertValidOperation(ACTIVE_CAMPAIGNS_OPERATION, "ActiveCampaigns");
  });

  it("campaign.graphql: Campaign query is valid against the schema", () => {
    assertValidOperation(CAMPAIGN_OPERATION, "Campaign");
  });

  it("contributions.graphql: Contributions query is valid against the schema", () => {
    assertValidOperation(CONTRIBUTIONS_OPERATION, "Contributions");
  });

  it("contributions.graphql: UserContributions query is valid against the schema", () => {
    assertValidOperation(USER_CONTRIBUTIONS_OPERATION, "UserContributions");
  });

  it("user.graphql: User query is valid against the schema", () => {
    assertValidOperation(USER_OPERATION, "User");
  });
});

describe("GraphQL contract — Campaign type field presence", () => {
  const campaignType = schema.getType("Campaign") as GraphQLObjectType;
  const fields = campaignType.getFields();

  const requiredFields = [
    "id",
    "contractId",
    "title",
    "description",
    "creator",
    "goal",
    "raised",
    "deadline",
    "status",
    "category",
    "image",
    "videoUrl",
    "minContribution",
    "totalRaised",
    "totalContributors",
    "percentageFunded",
    "daysRemaining",
    "token",
    "platformFeeBps",
    "hasRBACEnabled",
    "createdAt",
    "updatedAt",
  ];

  for (const field of requiredFields) {
    it(`Campaign.${field} exists in schema`, () => {
      expect(fields[field]).toBeDefined();
    });
  }
});

describe("GraphQL contract — Contribution type field presence", () => {
  const contributionType = schema.getType("Contribution") as GraphQLObjectType;
  const fields = contributionType.getFields();

  const requiredFields = [
    "id",
    "campaignId",
    "contributor",
    "amount",
    "timestamp",
    "transactionHash",
  ];

  for (const field of requiredFields) {
    it(`Contribution.${field} exists in schema`, () => {
      expect(fields[field]).toBeDefined();
    });
  }
});

describe("GraphQL contract — User type field presence", () => {
  const userType = schema.getType("User") as GraphQLObjectType;
  const fields = userType.getFields();

  const requiredFields = [
    "address",
    "totalContributed",
    "contributionCount",
    "joinedAt",
  ];

  for (const field of requiredFields) {
    it(`User.${field} exists in schema`, () => {
      expect(fields[field]).toBeDefined();
    });
  }
});

describe("GraphQL contract — CampaignStatus enum values", () => {
  const statusEnum = schema.getType("CampaignStatus") as GraphQLEnumType;
  const values = statusEnum.getValues().map((v) => v.name);

  const expectedValues = [
    "ACTIVE",
    "SUCCESSFUL",
    "REFUNDED",
    "CANCELLED",
    "PAUSED",
    "ARCHIVED",
  ];

  for (const value of expectedValues) {
    it(`CampaignStatus.${value} is defined in schema`, () => {
      expect(values).toContain(value);
    });
  }
});

describe("GraphQL contract — Query root field presence", () => {
  const queryType = schema.getQueryType() as GraphQLObjectType;
  const fields = queryType.getFields();

  const requiredQueryFields = [
    "campaign",
    "campaigns",
    "activeCampaigns",
    "contributions",
    "userContributions",
    "user",
  ];

  for (const field of requiredQueryFields) {
    it(`Query.${field} exists in schema`, () => {
      expect(fields[field]).toBeDefined();
    });
  }
});

describe("GraphQL contract — CampaignConnection pagination shape", () => {
  const connectionType = schema.getType("CampaignConnection") as GraphQLObjectType;
  const edgeType = schema.getType("CampaignEdge") as GraphQLObjectType;
  const pageInfoType = schema.getType("PageInfo") as GraphQLObjectType;

  it("CampaignConnection has edges, pageInfo, totalCount", () => {
    const fields = connectionType.getFields();
    expect(fields["edges"]).toBeDefined();
    expect(fields["pageInfo"]).toBeDefined();
    expect(fields["totalCount"]).toBeDefined();
  });

  it("CampaignEdge has node and cursor", () => {
    const fields = edgeType.getFields();
    expect(fields["node"]).toBeDefined();
    expect(fields["cursor"]).toBeDefined();
  });

  it("PageInfo has hasNextPage, hasPreviousPage, startCursor, endCursor", () => {
    const fields = pageInfoType.getFields();
    expect(fields["hasNextPage"]).toBeDefined();
    expect(fields["hasPreviousPage"]).toBeDefined();
    expect(fields["startCursor"]).toBeDefined();
    expect(fields["endCursor"]).toBeDefined();
  });
});

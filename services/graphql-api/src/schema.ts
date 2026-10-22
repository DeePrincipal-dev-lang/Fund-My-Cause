import { gql } from "graphql-tag";

export const typeDefs = gql`
  # Campaign entity
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

  # Campaign status
  enum CampaignStatus {
    ACTIVE
    SUCCESSFUL
    REFUNDED
    CANCELLED
    PAUSED
    ARCHIVED
  }

  # Contribution record
  type Contribution {
    id: ID!
    campaignId: ID!
    contributor: String!
    amount: BigInt!
    timestamp: String!
    transactionHash: String!
  }

  # User profile
  type User {
    address: String!
    totalContributed: BigInt!
    contributionCount: Int!
    campaigns: [Campaign!]!
    contributions: [Contribution!]!
    joinedAt: String!
  }

  # Campaign with detailed stats
  type CampaignDetail {
    campaign: Campaign!
    contributors: [Contributor!]!
    topContributors(limit: Int = 10): [TopContributor!]!
    updates: [CampaignUpdate!]!
    milestones: [Milestone!]!
  }

  # Contributor info
  type Contributor {
    address: String!
    amount: BigInt!
    contributionCount: Int!
    isTopContributor: Boolean!
  }

  # Top contributor
  type TopContributor {
    rank: Int!
    address: String!
    amount: BigInt!
    percentage: Float!
  }

  # Campaign update
  type CampaignUpdate {
    id: ID!
    campaignId: ID!
    content: String!
    ipfsHash: String!
    timestamp: String!
  }

  # Milestone
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

  # Campaign filters
  input CampaignFilter {
    status: [CampaignStatus!]
    category: [String!]
    minGoal: BigInt
    maxGoal: BigInt
    creator: String
    search: String
  }

  # Pagination
  input PaginationInput {
    limit: Int = 20
    offset: Int = 0
  }

  # Campaign connection for pagination
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

  # Query root
  type Query {
    # Campaign queries
    campaign(id: ID!): Campaign
    # List campaigns with cursor-based pagination.
    #
    # Cursor pagination arguments:
    #   first  - maximum number of items to return (default 20, max 100).
    #   after  - opaque cursor from a previous response's pageInfo.endCursor;
    #            when supplied, results start *after* that item.
    #
    # Legacy offset arguments (kept for backwards compatibility):
    #   pagination.limit / pagination.offset
    # When both cursor and offset arguments are present, cursor arguments take precedence.
    campaigns(
      filter: CampaignFilter
      # Cursor-based: return at most this many items (max 100).
      first: Int
      # Cursor-based: start after this opaque cursor.
      after: String
      # Legacy offset pagination - superseded by first/after.
      pagination: PaginationInput
      sort: CampaignSort
    ): CampaignConnection!
    activeCampaigns(limit: Int = 20): [Campaign!]!
    trendingCampaigns(limit: Int = 10): [Campaign!]!
    searchCampaigns(query: String!, limit: Int = 20): [Campaign!]!

    # Campaign detail
    campaignDetail(id: ID!): CampaignDetail

    # Contribution queries
    contribution(id: ID!): Contribution
    contributions(campaignId: ID, contributor: String): [Contribution!]!

    # User queries
    user(address: String!): User
    userContributions(address: String!, limit: Int = 50): [Contribution!]!

    # Statistics
    stats: Statistics!
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

  # Platform statistics
  type Statistics {
    totalCampaigns: Int!
    activeCampaigns: Int!
    totalRaised: BigInt!
    totalContributors: Int!
    averageContribution: BigInt!
    successRate: Float!
  }

  # Subscription root
  type Subscription {
    # Campaign subscriptions
    campaignUpdated(id: ID!): CampaignUpdate!
    campaignStatusChanged(id: ID!): Campaign!

    # Contribution subscriptions
    newContribution(campaignId: ID!): Contribution!
    campaignProgressChanged(id: ID!): CampaignProgress!

    # Milestone subscriptions
    milestoneReached(campaignId: ID!): Milestone!
  }

  # Campaign progress
  type CampaignProgress {
    campaignId: ID!
    raised: BigInt!
    percentageFunded: Float!
    contributors: Int!
    daysRemaining: Int!
    timestamp: String!
  }

  # Mutation root (for future use)
  type Mutation {
    # Authentication
    authenticate(
      signature: String!
      message: String!
      address: String!
    ): AuthPayload!

    # Campaign mutations
    createCampaign(input: CreateCampaignInput!): Campaign!
    updateCampaign(id: ID!, input: UpdateCampaignInput!): Campaign!

    # Contribution mutations
    recordContribution(input: RecordContributionInput!): Contribution!
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

  # Scalars
  scalar BigInt
  # NOTE: DateTime scalar removed — no field in this schema used DateTime as its
  # type (all date/time fields use String!).  Evidence: static analysis of the
  # full SDL above shows zero field definitions referencing "DateTime".
  # The generated client type (apps/interface/src/lib/graphql/generated.ts) was
  # regenerated accordingly; no consumer broke.
`;

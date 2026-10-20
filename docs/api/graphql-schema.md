# GraphQL Schema Reference

> **Service:** `services/graphql-api`  
> **Regenerate:** `npm run schema:export` from the GraphQL service directory

This document contains the complete GraphQL schema definition for the Fund-My-Cause GraphQL API.

## Schema Definition Language (SDL)

```graphql
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

type Query {
  campaign(id: ID!): Campaign
  campaigns(filter: CampaignFilter, first: Int, after: String, pagination: PaginationInput, sort: CampaignSort): CampaignConnection!
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

type Subscription {
  campaignUpdated(id: ID!): CampaignUpdate!
  campaignStatusChanged(id: ID!): Campaign!
  newContribution(campaignId: ID!): Contribution!
  campaignProgressChanged(id: ID!): CampaignProgress!
  milestoneReached(campaignId: ID!): Milestone!
}

type CampaignProgress {
  campaignId: ID!
  raised: BigInt!
  percentageFunded: Float!
  contributors: Int!
  daysRemaining: Int!
  timestamp: String!
}

type Mutation {
  authenticate(signature: String!, message: String!, address: String!): AuthPayload!
  createCampaign(input: CreateCampaignInput!): Campaign!
  updateCampaign(id: ID!, input: UpdateCampaignInput!): Campaign!
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

scalar BigInt
```

## Authentication Headers

All mutations and authenticated queries require a JWT token in the Authorization header:

```http
Authorization: Bearer <jwt-token>
```

Obtain a JWT token via the `authenticate` mutation by signing a challenge message with your Stellar wallet.

## Rate Limits

Rate limiting is applied per resolver/mutation (Redis-backed, in-memory
fallback for development). Exceeding a limit returns HTTP 429 or a GraphQL
error with `extensions.code = "TOO_MANY_REQUESTS"` and an
`extensions.retryAfter` value in seconds.

| Scope | Limit | Window |
|-------|-------|--------|
| Global (all resolvers) | 100 requests | 60 s (sliding) |
| Per IP | 1 000 requests | 1 hour |
| Per authenticated account | 10 000 requests | 1 hour |
| `createCampaign` | 5 campaigns | 1 hour per wallet |
| `recordContribution` | 20 contributions | 10 minutes per wallet |

Wallet-keyed limits fall back to the client IP for unauthenticated calls.

> An additional request-level limiter for the whole public endpoint
> (per IP / per `X-API-Key`, env-configurable via `RATE_LIMIT_*`) is
> implemented in `src/middleware/request-rate-limit.ts` but is **not yet
> mounted** in `src/index.ts`. See `src/middleware/RATE_LIMITING.md`.

## Usage Examples

### Authentication
```graphql
mutation Authenticate($signature: String!, $message: String!, $address: String!) {
  authenticate(signature: $signature, message: $message, address: $address) {
    token
    user {
      address
      joinedAt
    }
  }
}
```

### Query Campaigns
```graphql
query GetCampaigns($first: Int, $filter: CampaignFilter) {
  campaigns(first: $first, filter: $filter) {
    edges {
      node {
        id
        title
        goal
        raised
        status
        creator
        deadline
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Subscribe to Contributions
```graphql
subscription NewContribution($campaignId: ID!) {
  newContribution(campaignId: $campaignId) {
    id
    contributor
    amount
    timestamp
    transactionHash
  }
}
```

For complete API documentation including all resolvers, see [docs/api/graphql.md](./graphql.md).

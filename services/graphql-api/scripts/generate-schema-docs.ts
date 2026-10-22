import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { print } from "graphql";
import { typeDefs } from "../src/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDocPath = path.resolve(__dirname, "../../../docs/api/graphql.md");

const docContent = `# Fund-My-Cause GraphQL API Reference

> **Service:** \`services/graphql-api\`  
> **Endpoint:** \`POST /graphql\`  
> **WebSocket Subscriptions:** \`ws://<host>:<port>/graphql\`  
> **Default Port:** \`4000\`

The Fund-My-Cause GraphQL API service provides a unified query and subscription layer for Stellar Soroban crowdfunding contracts, caching contract state with Redis and emitting real-time event updates over WebSockets.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Rate Limiting](#rate-limiting)
3. [Errors & Status Codes](#errors--status-codes)
4. [Queries](#queries)
5. [Mutations](#mutations)
6. [Subscriptions](#subscriptions)
7. [Types & Inputs](#types--inputs)
8. [Enums & Scalars](#enums--scalars)
9. [Full SDL Schema](#full-sdl-schema)

---

## Authentication & Authorization

### Overview
- Read operations (Queries) and Subscriptions are **public** by default unless querying user-private settings.
- Write operations (Mutations) like \`createCampaign\`, \`updateCampaign\`, and \`recordContribution\` require authentication.
- Authentication uses JSON Web Tokens (JWT) signed by the GraphQL server upon verifying a Stellar wallet signature.

### Authenticating via Stellar Wallet Signature

To authenticate, clients perform a challenge-response handshake via the \`authenticate\` mutation:

\`\`\`graphql
mutation Authenticate($signature: String!, $message: String!, $address: String!) {
  authenticate(signature: $signature, message: $message, address: $address) {
    token
    user {
      address
      joinedAt
    }
  }
}
\`\`\`

### Authorization Header
Include the returned JWT in the HTTP \`Authorization\` header for all subsequent requests:

\`\`\`http
Authorization: Bearer <jwt-token>
\`\`\`

### Protected Resolvers & Permissions
| Operation | Auth Required | Scope / Rule |
|-----------|---------------|--------------|
| \`authenticate\` | No | Public (verifies wallet ed25519 signature) |
| \`createCampaign\` | Yes | Authenticated wallet becomes campaign creator |
| \`updateCampaign\` | Yes | Authenticated wallet must match campaign creator |
| \`recordContribution\` | Yes | Authenticated wallet or valid contribution signature |
| All \`Query.*\` | No | Publicly accessible |
| All \`Subscription.*\` | No | Publicly subscribeable via WebSocket protocol (\`graphql-ws\`) |

---

## Rate Limiting

The GraphQL service applies multi-tiered rate limiting backed by Redis (or in-memory fallback in local development).

### Global & Tier Limits

| Limiter Scope | Limit / Quota | Window | Key / Strategy |
|---------------|---------------|--------|----------------|
| **General Request Window** | 100 requests | 60 seconds (sliding) | Global per-client key |
| **IP-Based Limit** | 1,000 requests | 1 hour | Client IP address |
| **Authenticated User** | 10,000 requests | 1 hour | Authenticated Stellar wallet address |

### Per-Mutation Limits

To prevent spam attacks, Sybil campaign generation, and donation bot flooding, dedicated rate limits apply per mutation:

| Mutation | Limit | Window | Key | Purpose |
|----------|-------|--------|-----|---------|
| \`createCampaign\` | **5 requests** | 1 hour (3600s) | Wallet address | Mitigates spam campaign creation |
| \`recordContribution\` | **20 requests** | 10 minutes (600s) | Wallet address | Prevents bot-driven donation flooding |

### Rate Limit Headers & Error Response
When a rate limit is exceeded, the server returns HTTP status \`429\` or a GraphQL error with code \`TOO_MANY_REQUESTS\` containing a \`retryAfter\` duration in seconds:

\`\`\`json
{
  "errors": [
    {
      "message": "Rate limit exceeded for mutation 'createCampaign'. Retry after 1840s.",
      "extensions": {
        "code": "TOO_MANY_REQUESTS",
        "http": { "status": 429 },
        "retryAfter": 1840,
        "mutation": "createCampaign"
      }
    }
  ]
}
\`\`\`

---

## Errors & Status Codes

Standard GraphQL error codes returned in \`extensions.code\`:

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| \`UNAUTHENTICATED\` | 401 | Missing or invalid JWT in \`Authorization\` header |
| \`FORBIDDEN\` | 403 | Caller lacks permission for the requested resource |
| \`BAD_USER_INPUT\` | 400 | Invalid arguments, input validation error, or malformed amounts |
| \`NOT_FOUND\` | 404 | Requested campaign, contribution, or user does not exist |
| \`TOO_MANY_REQUESTS\` | 429 | Exceeded IP, user, or per-mutation rate limit |
| \`INTERNAL_SERVER_ERROR\` | 500 | Unexpected server error |

---

## Queries

### \`campaign(id: ID!): Campaign\`
Fetch a single campaign by contract address or unique identifier.

\`\`\`graphql
query GetCampaign($id: ID!) {
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
    minContribution
    percentageFunded
    daysRemaining
    token
    hasRBACEnabled
  }
}
\`\`\`

---

### \`campaigns(...): CampaignConnection!\`
List campaigns with cursor-based pagination (or legacy offset pagination), filtering, and sorting.

**Arguments:**
- \`filter: CampaignFilter\` — Filter by status, category, goal range, creator, or search term.
- \`first: Int\` — Maximum items to return (default: \`20\`, max: \`100\`).
- \`after: String\` — Cursor from \`pageInfo.endCursor\` to fetch subsequent page.
- \`sort: CampaignSort\` — Sort field (\`CREATED_AT\`, \`RAISED_AMOUNT\`, \`GOAL\`, \`DEADLINE\`, \`CONTRIBUTORS\`) and direction (\`ASC\`, \`DESC\`).
- \`pagination: PaginationInput\` — Legacy offset pagination (superseded by \`first\` / \`after\`).

\`\`\`graphql
query ListCampaigns($first: Int, $after: String, $filter: CampaignFilter) {
  campaigns(first: $first, after: $after, filter: $filter) {
    edges {
      cursor
      node {
        id
        title
        goal
        raised
        status
        category
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
\`\`\`

---

### \`activeCampaigns(limit: Int = 20): [Campaign!]!\`
Retrieve active campaigns.

### \`trendingCampaigns(limit: Int = 10): [Campaign!]!\`
Retrieve trending campaigns ranked by recent activity and funding volume.

### \`searchCampaigns(query: String!, limit: Int = 20): [Campaign!]!\`
Perform full-text search across campaign titles and descriptions.

### \`campaignDetail(id: ID!): CampaignDetail\`
Fetch full campaign details including contributors, top contributors, updates, and milestones.

### \`contribution(id: ID!): Contribution\`
Fetch a single contribution record by ID.

### \`contributions(campaignId: ID, contributor: String): [Contribution!]!\`
Fetch contributions filtered by campaign ID or contributor wallet address.

### \`user(address: String!): User\`
Fetch user profile by Stellar account public key.

### \`userContributions(address: String!, limit: Int = 50): [Contribution!]!\`
Fetch contribution history for a given user.

### \`stats: Statistics!\`
Platform-wide aggregate statistics (total campaigns, raised volume, contributors, success rate).

---

## Mutations

### \`authenticate(signature: String!, message: String!, address: String!): AuthPayload!\`
Authenticate with ed25519 signature of a challenge message. Returns JWT token and user profile.

---

### \`createCampaign(input: CreateCampaignInput!): Campaign!\`
Create a new campaign. Requires authentication and is rate limited to 5 per hour per user.

**Input:**
- \`title: String!\`
- \`description: String!\`
- \`goal: BigInt!\` (in stroops)
- \`deadline: String!\` (ISO timestamp)
- \`category: String!\`
- \`image: String\`
- \`videoUrl: String\`
- \`minContribution: BigInt!\`

---

### \`updateCampaign(id: ID!, input: UpdateCampaignInput!): Campaign!\`
Update campaign metadata. Caller must be the campaign creator.

---

### \`recordContribution(input: RecordContributionInput!): Contribution!\`
Record a new on-chain contribution. Requires authentication and is rate limited to 20 per 10 minutes per user.

**Input:**
- \`campaignId: ID!\`
- \`contributor: String!\`
- \`amount: BigInt!\`
- \`transactionHash: String!\`

---

## Subscriptions

Real-time subscriptions delivered over WebSockets (\`graphql-ws\` protocol).

### \`campaignUpdated(id: ID!): CampaignUpdate!\`
Emitted when a campaign update is posted.

### \`campaignStatusChanged(id: ID!): Campaign!\`
Emitted when a campaign changes status (e.g. \`ACTIVE\` -> \`SUCCESSFUL\`, \`CANCELLED\`, \`REFUNDED\`).

### \`newContribution(campaignId: ID!): Contribution!\`
Emitted in real-time when a contribution is received for a campaign.

### \`campaignProgressChanged(id: ID!): CampaignProgress!\`
Emitted when progress metrics change (raised amount, percentage funded, contributors count, days remaining).

### \`milestoneReached(campaignId: ID!): Milestone!\`
Emitted when a milestone target is reached.

---

## Types & Inputs

### \`Campaign\`
\`\`\`graphql
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
\`\`\`

### \`Contribution\`
\`\`\`graphql
type Contribution {
  id: ID!
  campaignId: ID!
  contributor: String!
  amount: BigInt!
  timestamp: String!
  transactionHash: String!
}
\`\`\`

### \`User\`
\`\`\`graphql
type User {
  address: String!
  totalContributed: BigInt!
  contributionCount: Int!
  campaigns: [Campaign!]!
  contributions: [Contribution!]!
  joinedAt: String!
}
\`\`\`

### \`CampaignDetail\`
\`\`\`graphql
type CampaignDetail {
  campaign: Campaign!
  contributors: [Contributor!]!
  topContributors(limit: Int = 10): [TopContributor!]!
  updates: [CampaignUpdate!]!
  milestones: [Milestone!]!
}
\`\`\`

### \`Statistics\`
\`\`\`graphql
type Statistics {
  totalCampaigns: Int!
  activeCampaigns: Int!
  totalRaised: BigInt!
  totalContributors: Int!
  averageContribution: BigInt!
  successRate: Float!
}
\`\`\`

---

## Enums & Scalars

### \`CampaignStatus\`
- \`ACTIVE\`: Campaign is active and accepting contributions.
- \`SUCCESSFUL\`: Goal reached before or at deadline.
- \`REFUNDED\`: Deadline passed without reaching goal; refunds available.
- \`CANCELLED\`: Cancelled by creator or governance.
- \`PAUSED\`: Temporarily paused.
- \`ARCHIVED\`: Archived historical campaign.

### \`MilestoneStatus\`
- \`PENDING\`: Milestone not yet reached.
- \`REACHED\`: Milestone funding goal reached.
- \`RELEASED\`: Milestone funds released to creator.

### \`SortField\`
- \`CREATED_AT\`, \`RAISED_AMOUNT\`, \`GOAL\`, \`DEADLINE\`, \`CONTRIBUTORS\`

### \`SortDirection\`
- \`ASC\`, \`DESC\`

### \`BigInt\`
Custom scalar representing 64-bit/128-bit integers (serialized as strings over JSON/GraphQL transport to prevent precision loss).

---

## Full SDL Schema

\`\`\`graphql
${print(typeDefs).trim()}
\`\`\`
`;

fs.writeFileSync(targetDocPath, docContent);
console.log(`Generated GraphQL API reference at: ${targetDocPath}`);

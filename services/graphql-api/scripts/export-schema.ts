#!/usr/bin/env tsx

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { print, buildSchema, introspectionFromSchema, printSchema } from "graphql";
import { typeDefs } from "../src/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build the schema from type definitions
const schema = buildSchema(print(typeDefs));

// Generate SDL (Schema Definition Language) output
const sdl = printSchema(schema);

// Generate introspection JSON
const introspection = introspectionFromSchema(schema);

// Output paths
const sdlOutputPath = path.resolve(__dirname, "../../../docs/api/graphql-schema.sdl");
const introspectionOutputPath = path.resolve(__dirname, "../../../docs/api/graphql-introspection.json");

// Write SDL file
fs.writeFileSync(sdlOutputPath, sdl);
console.log(`✅ SDL schema exported to: ${sdlOutputPath}`);

// Write introspection JSON
fs.writeFileSync(introspectionOutputPath, JSON.stringify(introspection, null, 2));
console.log(`✅ Introspection JSON exported to: ${introspectionOutputPath}`);

// Also generate the docs/api/graphql-schema.md as requested in the issue.
// No timestamps are embedded so repeated runs produce an identical file
// (keeps `git diff` clean when regenerating unchanged schemas).
const docContent = `# GraphQL Schema Reference

> **Service:** \`services/graphql-api\`  
> **Regenerate:** \`npm run schema:export\` from the GraphQL service directory

This document contains the complete GraphQL schema definition for the Fund-My-Cause GraphQL API.

## Schema Definition Language (SDL)

\`\`\`graphql
${sdl}
\`\`\`

## Authentication Headers

All mutations and authenticated queries require a JWT token in the Authorization header:

\`\`\`http
Authorization: Bearer <jwt-token>
\`\`\`

Obtain a JWT token via the \`authenticate\` mutation by signing a challenge message with your Stellar wallet.

## Rate Limits

Rate limiting is applied per resolver/mutation (Redis-backed, in-memory
fallback for development). Exceeding a limit returns HTTP 429 or a GraphQL
error with \`extensions.code = "TOO_MANY_REQUESTS"\` and an
\`extensions.retryAfter\` value in seconds.

| Scope | Limit | Window |
|-------|-------|--------|
| Global (all resolvers) | 100 requests | 60 s (sliding) |
| Per IP | 1 000 requests | 1 hour |
| Per authenticated account | 10 000 requests | 1 hour |
| \`createCampaign\` | 5 campaigns | 1 hour per wallet |
| \`recordContribution\` | 20 contributions | 10 minutes per wallet |

Wallet-keyed limits fall back to the client IP for unauthenticated calls.

> An additional request-level limiter for the whole public endpoint
> (per IP / per \`X-API-Key\`, env-configurable via \`RATE_LIMIT_*\`) is
> implemented in \`src/middleware/request-rate-limit.ts\` but is **not yet
> mounted** in \`src/index.ts\`. See \`src/middleware/RATE_LIMITING.md\`.

## Usage Examples

### Authentication
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

### Query Campaigns
\`\`\`graphql
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
\`\`\`

### Subscribe to Contributions
\`\`\`graphql
subscription NewContribution($campaignId: ID!) {
  newContribution(campaignId: $campaignId) {
    id
    contributor
    amount
    timestamp
    transactionHash
  }
}
\`\`\`

For complete API documentation including all resolvers, see [docs/api/graphql.md](./graphql.md).
`;

const schemaDocPath = path.resolve(__dirname, "../../../docs/api/graphql-schema.md");
fs.writeFileSync(schemaDocPath, docContent);
console.log(`✅ Schema documentation generated at: ${schemaDocPath}`);

console.log(`\n🎉 Schema export complete! Files generated:
- SDL: ${sdlOutputPath}
- Introspection JSON: ${introspectionOutputPath}  
- Documentation: ${schemaDocPath}`);
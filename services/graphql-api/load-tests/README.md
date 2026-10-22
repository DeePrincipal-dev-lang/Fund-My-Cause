# Load Tests — graphql-api

Artillery-based load tests for the GraphQL API.

## Files

| File | Purpose |
|------|---------|
| `load-test.yml` | Full load test (warm-up → sustained → spike) |
| `load-test-smoke.yml` | Quick smoke test for pre-flight checks |
| `load-test-helpers.js` | Shared helpers (`getEndpoint`, `graphqlHeaders`, `checkHealth`) |

## Usage

Install Artillery (once):

```bash
npm install -g artillery

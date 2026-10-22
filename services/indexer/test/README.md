# Integration Test Organization

This directory contains integration tests and shared test infrastructure for the indexer service.

## Directory Structure

```
test/
├── fixtures/
│   ├── campaign-event-builder.ts     # Reusable event fixture builders
│   └── ...                            # Other fixture builders
├── assertions/
│   ├── campaign-assertions.ts         # Campaign-specific assertions
│   └── ...                            # Other assertion helpers
├── integration-test-base.ts           # Base class for integration tests
├── campaign-consistency.integration.test.ts  # Campaign lifecycle tests
└── README.md                          # This file
```

## Running Tests

### All Tests
```bash
npm run test
```

### Unit Tests Only (Fast)
```bash
npm run test -- --exclude "**/*.integration.test.ts"
```

### Integration Tests Only
```bash
npm run test -- "**/*.integration.test.ts"
```

### Watch Mode
```bash
npm run test -- --watch
```

## Architecture

### Fixtures (`fixtures/`)

**Purpose:** Encapsulate test data creation and reduce repetition across test files.

**Example Usage:**
```typescript
import { createCampaignCreatedEvent, CampaignEventBuilder } from "./fixtures/campaign-event-builder";

// Quick event creation
const event = createCampaignCreatedEvent("CONTRACT_ID", {
  title: "My Campaign",
  goal: BigInt(10000),
});

// Flexible builder pattern
const customEvent = new CampaignEventBuilder()
  .withContractId("CONTRACT_ID")
  .withType("DonationReceived")
  .withData({ donor: "ADDRESS", amount: BigInt(1000) })
  .build();
```

### Assertions (`assertions/`)

**Purpose:** Separate assertion logic from test code for clarity and reusability.

**Example Usage:**
```typescript
import { assertCampaignCreatedEvent, assertCampaignState } from "./assertions/campaign-assertions";

// Single event assertion
assertCampaignCreatedEvent(event, {
  title: "Expected Title",
  creator: "CREATOR_ADDRESS",
});

// Campaign state after events
assertCampaignState(events, {
  totalRaised: BigInt(100000),
  contributorCount: 5,
});
```

### Base Class (`integration-test-base.ts`)

**Purpose:** Provide common setup/teardown and utilities for integration tests.

**Key Methods:**
- `setupTestEnvironment()` - Initialize test fixtures (EventStore, Dispatcher, etc.)
- `teardownTestEnvironment()` - Clean up after tests
- `submitAndProcess(events)` - Submit events and wait for processing
- `assertEventProcessed(eventId, type)` - Verify an event was processed
- `assertEventSequence(ids, types)` - Verify events were processed in order

**Example Usage:**
```typescript
describe("My Integration Test", () => {
  let testBase: IntegrationTestBase;

  beforeEach(async () => {
    testBase = new IntegrationTestBase();
    await testBase.setupTestEnvironment();
  });

  afterEach(async () => {
    await testBase.teardownTestEnvironment();
  });

  it("should process events correctly", async () => {
    const events = [/* ... */];
    await testBase.submitAndProcess(events);
    // Assert results
  });
});
```

## Test File Naming

- **Unit tests:** `*.test.ts` (in `src/`)
- **Integration tests:** `*.integration.test.ts` (in `test/`)

This naming convention allows CI to:
- Run fast unit tests for quick feedback
- Run slow integration tests separately
- Generate separate coverage reports

## CI/CD Integration

### GitHub Actions Example
```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test -- --exclude "**/*.integration.test.ts"

  integration-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test -- "**/*.integration.test.ts"
```

## Best Practices

1. **Use Fixtures for Repetitive Data**
   - Don't repeat event creation logic
   - Use builders for complex objects
   - Extract common patterns into fixtures

2. **Separate Assertions from Tests**
   - Move assertion logic to `assertions/` directory
   - Reuse assertions across multiple tests
   - Keep test files focused on flow, not verification

3. **Mark Integration Tests**
   - Use `.integration.test.ts` naming convention
   - Consider using `describe("[Integration] ...")` for clarity
   - Add `@slow` or similar tags if framework supports it

4. **Test One Thing Per Test**
   - Each test should verify one behavior
   - Use `describe` blocks to group related tests
   - Use descriptive test names: `"should process..."`

5. **Keep Setup Isolated**
   - Each test gets fresh fixtures
   - Use `beforeEach` for per-test setup
   - Use `beforeAll` only for expensive shared setup

## Example: Adding a New Integration Test

1. **Create Fixture Builder** (if needed)
   ```typescript
   // test/fixtures/my-fixture-builder.ts
   export function createMyEvent(...) { ... }
   ```

2. **Create Assertions** (if needed)
   ```typescript
   // test/assertions/my-assertions.ts
   export function assertMyCondition(...) { ... }
   ```

3. **Write Integration Test**
   ```typescript
   // test/my-feature.integration.test.ts
   import { IntegrationTestBase } from "./integration-test-base";
   import { createMyEvent } from "./fixtures/my-fixture-builder";
   import { assertMyCondition } from "./assertions/my-assertions";

   describe("[Integration] My Feature", () => {
     let testBase: IntegrationTestBase;

     beforeEach(async () => {
       testBase = new IntegrationTestBase();
       await testBase.setupTestEnvironment();
     });

     afterEach(async () => {
       await testBase.teardownTestEnvironment();
     });

     it("should do something", async () => {
       const event = createMyEvent(...);
       await testBase.submitAndProcess([event]);
       assertMyCondition(...);
     });
   });
   ```

## Troubleshooting

### Tests Timeout
- Integration tests may be slower than unit tests
- Increase timeout for integration test files:
  ```bash
  npm run test -- "**/*.integration.test.ts" --testTimeout=30000
  ```

### Setup/Teardown Not Running
- Ensure `beforeEach` and `afterEach` hooks are defined
- Check that async operations complete properly
- Add error logging to identify setup issues

### Fixture Not Recognized
- Verify import paths are correct
- Check that fixture functions are exported
- Ensure fixture builder is in `fixtures/` directory

## Related Documentation

- `../src/` - Indexer service implementation
- `../../docs/` - General project documentation
- `../README.md` - Indexer service README

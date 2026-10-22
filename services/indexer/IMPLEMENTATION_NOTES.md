# Issue #1136: Circuit Breaker & Retry Policy Implementation

**Status**: ✅ Fully Implemented  
**Date Completed**: August 30, 2026

## Overview

Implemented resilient error handling for the indexer service's RPC calls to the Stellar network using a circuit breaker pattern and exponential backoff retry logic.

## Implementation Details

### 1. Circuit Breaker Pattern (Issue #1136, Requirement 2)

**Location**: `packages/rpc-client/src/circuit-breaker.ts`

The `CircuitBreaker` class implements the three-state circuit breaker pattern:

- **CLOSED** (normal operation): Every call is forwarded immediately. After `failureThreshold` consecutive failures, the breaker trips to OPEN.
- **OPEN** (tripped): Calls are rejected immediately with `CircuitOpenError`. After `cooldownMs` milliseconds, the breaker transitions to HALF_OPEN.
- **HALF_OPEN** (probing): One trial call is allowed through to test if the service has recovered.

**Configuration**:
```typescript
interface CircuitBreakerOptions {
  failureThreshold?: number;  // Default: 5 consecutive failures
  cooldownMs?: number;         // Default: 30,000 ms (30 seconds)
  now?: () => number;          // Injectable clock for testing
}
```

**Usage in Indexer**:
```typescript
// services/indexer/src/rpc-client.ts
this.circuitBreaker = new CircuitBreaker(config.circuitBreaker ?? {});

async fetchEvents(ledgerSequence: number): Promise<IndexerEvent[]> {
  const client = createHttpClient(RPC_HTTP_OPTIONS);
  try {
    const result = await this.circuitBreaker.call(() =>
      client.fetch<...>(this.config.url, { ... })
    );
    // Process events
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // Circuit is open - return empty array to skip this ledger
      return [];
    }
    throw error;
  }
}
```

### 2. Retry Logic with Exponential Backoff (Issue #1136, Requirement 1)

**Location**: `services/indexer/src/http-client.ts`

The HTTP client implements automatic retry with exponential backoff:

**Default Configuration**:
```typescript
export const HTTP_CLIENT_DEFAULTS = {
  requestTimeoutMs: 30_000,      // Per-attempt timeout
  maxRetries: 3,                  // 4 total attempts
  initialBackoffMs: 500,          // First delay: 500ms
  backoffMultiplier: 2,           // Exponential growth
  maxBackoffMs: 30_000,           // Cap on delay
};
```

**Backoff Calculation**:
- Attempt 0 (first failure): wait 500ms
- Attempt 1 (second failure): wait 1,000ms (500 × 2)
- Attempt 2 (third failure): wait 2,000ms (1,000 × 2)
- Attempt 3 (fourth failure): wait 4,000ms (2,000 × 2)

**Retry Policy**:
- **Retried**: Network/timeout errors, HTTP 429 (Too Many Requests), HTTP 5xx (server errors)
- **Not retried**: HTTP 4xx errors except 429 (these are caller errors)

**Implementation**:
```typescript
export async function httpFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
  overrides: Partial<HttpClientOptions> = {},
  traceId?: string,
  _sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<HttpClientResult<T>> {
  // ... setup ...
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    const signal = AbortSignal.timeout(opts.requestTimeoutMs);
    
    try {
      const response = await fetch(url, { ...initWithTrace, signal });
      
      if (!isRetryable(undefined, response.status)) {
        return { ok: response.ok, status: response.status, data, attempts: attempt + 1 };
      }
      // HTTP 429 or 5xx - retry
    } catch (err) {
      if (!isRetryable(err)) {
        throw err; // Non-retryable error
      }
    }
    
    // Sleep before next attempt
    if (attempt < opts.maxRetries) {
      const delay = calcBackoff(attempt, opts);
      await _sleep(delay);
    }
  }
  
  // All attempts exhausted
  throw lastError ?? new Error(`HTTP request failed after ${opts.maxRetries + 1} attempts`);
}
```

### 3. Stream-Level Error Handling

**Location**: `services/indexer/src/rpc-client.ts`

The event stream implements a coarse outer error handler:

```typescript
async *streamEvents(): AsyncGenerator<IndexerEvent[]> {
  let currentLedger = this.lastLedger;
  
  while (true) {
    try {
      const events = await this.fetchEvents(currentLedger);
      
      if (events.length > 0) {
        yield events;
      }
      
      currentLedger += 1;
      this.lastLedger = currentLedger;
      await this._sleep(POLL_INTERVAL_MS); // 5 seconds
    } catch (error) {
      // Stream-level error - wait before next poll
      await this._sleep(STREAM_RETRY_DELAY_MS); // 10 seconds
    }
  }
}
```

**Error Handling Layers**:
1. **Per-attempt**: HTTP client timeout (30s) with automatic retry
2. **Per-request**: Circuit breaker with configurable failure threshold
3. **Per-stream**: Coarse error handler with 10s backoff between polls

## Test Coverage (Issue #1136, Requirement 3)

### Circuit Breaker Tests
**File**: `services/indexer/src/__tests__/circuit-breaker.test.ts`

Comprehensive test suite covering:
- Initial state (CLOSED)
- CLOSED state behavior (success, failures, reset)
- OPEN state behavior (rejections, cooldown transitions)
- HALF_OPEN state behavior (trial calls, recovery)
- Sustained outage simulation
- Metrics reporting

```bash
# Run tests
npm -w indexer-service test circuit-breaker.test.ts
```

### HTTP Client Tests
Retry and backoff behavior validated through:
- Individual call retry tests
- Exponential backoff calculation tests
- Per-attempt timeout tests

### RPC Client Integration Tests
**File**: `packages/rpc-client/src/__tests__/rpc-client.test.ts`

Tests verify:
- Circuit breaker integration with RPC calls
- Failure scenarios and recovery
- Metrics tracking

## Monitoring & Observability

The circuit breaker exposes detailed metrics:

```typescript
interface CircuitBreakerMetrics {
  state: CircuitState;                  // Current state
  failureCount: number;                 // Consecutive failures
  openedAt: number | null;              // Timestamp when tripped
  totalCalls: number;                   // All invocations
  successfulCalls: number;              // Successful calls
  failedCalls: number;                  // Failed calls
  circuitOpenRejections: number;        // Calls rejected due to OPEN state
}
```

These metrics can be exposed via a `/metrics` endpoint for Prometheus scraping or included in request logging.

## Configuration

**Environment Variables**:
```bash
# Circuit breaker tuning (optional, uses defaults if not set)
RPC_CIRCUIT_BREAKER_FAILURE_THRESHOLD=5      # Default: 5
RPC_CIRCUIT_BREAKER_COOLDOWN_MS=30000        # Default: 30,000

# HTTP client tuning (optional)
RPC_TIMEOUT_MS=30000                         # Default: 30,000
RPC_MAX_RETRIES=3                            # Default: 3
RPC_INITIAL_BACKOFF_MS=500                   # Default: 500
```

## Benefits

1. **Prevents Cascading Failures**: Circuit breaker stops hammering a failing RPC endpoint
2. **Resilient to Transient Errors**: Automatic retry with exponential backoff
3. **Fast Failure Detection**: Rapid failover to HALF_OPEN state after cooldown
4. **Service Recovery Support**: Graceful recovery when RPC endpoint becomes healthy again
5. **Observability**: Detailed metrics for monitoring and alerting

## Related Issues

- #906: Initial circuit breaker implementation
- #1125: Multiple contract IDs support
- #1136: This implementation

## References

- Circuit Breaker Pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- Exponential Backoff: https://en.wikipedia.org/wiki/Exponential_backoff

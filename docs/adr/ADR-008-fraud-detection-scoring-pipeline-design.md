# ADR-008: Fraud-detection scoring pipeline design

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** backend team

## Context

The fraud-detection system must identify suspicious contribution patterns across campaigns and wallets while maintaining idempotency for request deduplication. The system needs:

1. Multiple independent heuristics that can detect different fraud patterns
2. Idempotency guarantees for requests within a TTL window (24 hours default)
3. Clear separation between HTTP handling and scoring logic for testability
4. Rate-limiting of expensive O(N²) operations
5. Comprehensive edge-case handling (boundary conditions, missing signals, conflicting indicators)

The system processes contribution events asynchronously through a job queue to avoid blocking HTTP responses.

## Decision

Implement a three-layer fraud-detection scoring pipeline with the following architecture:

### Layer 1: Wash Contribution Detection
Identifies wallets that repeatedly contribute and then refund the same campaign within a short time window.

**Threshold parameters:**
- Window: 3600 seconds (1 hour)
- Minimum occurrences: 3 wash cycles
- Severity: HIGH

**Idempotency guarantee:** The same wallet/campaign pair flagged within the TTL window will not generate duplicate flags for identical patterns.

**Known edge cases:**
- Missing signals: campaigns with no refunds are never flagged
- Boundary conditions: contributions exactly at the 1-hour mark are included
- Conflicting signals: a wallet contributing to multiple campaigns only gets flagged per campaign

### Layer 2: Contribution Spike Detection
Detects sudden spikes in contribution volume to a single campaign within a rolling window.

**Threshold parameters:**
- Rolling window: 600 seconds (10 minutes)
- Spike threshold: > 50 contributions
- Severity: MEDIUM

**Idempotency guarantee:** The same campaign flagged for a spike will not generate multiple spike flags for the same time window.

**Known edge cases:**
- Missing signals: campaigns with < 50 contributions are never flagged
- Boundary conditions: the rolling window is inclusive on both ends
- Conflicting signals: only one spike flag per campaign per scan (early exit after first spike detected)

### Layer 3: Duplicate Content Detection
Identifies campaigns with near-identical titles using Jaccard similarity scoring.

**Threshold parameters:**
- Jaccard similarity threshold: 0.8 (80% token overlap)
- Scan interval: 30 seconds (rate-limited for O(N²) cost)
- Severity: LOW

**Idempotency guarantee:** The O(N²) content comparison is rate-limited to run at most once per 30 seconds, preventing redundant duplicate flag generation during burst loads.

**Known edge cases:**
- Missing signals: campaigns with very short titles have higher similarity rates
- Boundary conditions: empty string titles are 100% similar to other empty strings
- Conflicting signals: a pair of campaigns may both be flagged (as A~B and B~A), but each flag references one as primary

## Alternatives considered

| Option | Pros | Cons |
|--------|------|------|
| Single monolithic scoring function | Simpler codebase | Hard to test individual rules, difficult to tune thresholds |
| Separate services per heuristic | Maximum decoupling | Operational complexity, eventual consistency issues |
| Three independent layers (chosen) | Easily testable, tuneable thresholds, clear separation | Requires documenting layer ordering and dependencies |

## Consequences

**Good:**
- Scoring logic has zero FastAPI/asyncio dependencies, enabling unit tests without HTTP server setup
- Each heuristic can be tuned independently (thresholds in one place: `scoring.py`)
- Clear idempotency semantics: the same input within a TTL window produces the same flags
- Edge cases are captured and tested explicitly in `tests_scoring_edge_cases.py`
- Async job queue prevents HTTP response blocking while maintaining FIFO ordering
- Rate-limiting of expensive operations keeps CPU usage bounded

**Bad / trade-offs:**
- Three separate heuristics means a wallet can evade detection by varying patterns (cycling between heuristics)
- Threshold tuning requires understanding contribution distribution across campaigns
- O(N²) duplicate detection requires periodic batching or sampling for very large campaign counts
- The in-memory idempotency store does not persist across restarts; production should use Redis

## Implementation notes

### Module structure
- `repository.py`: In-process state (event store, flag queue)
- `scoring.py`: Pure heuristic functions, imports from repository only
- `pipeline.py`: FastAPI app, async job queue, HTTP handlers and state re-exports

### Idempotency enforcement
- `IdempotencyStore` maintains an LRU with TTL-based expiry
- Duplicate requests return the original 202 Accepted response without re-processing
- The store interface allows replacement with Redis for production

### Testing strategy
- `tests_idempotency.py`: HTTP-level idempotency tests (concurrent requests, TTL expiry, validation)
- `tests_scoring_edge_cases.py`: Pure-function edge case tests (boundary conditions, missing signals, conflicting patterns)
- `tests_scoring_layers.py`: Per-heuristic validation
- `tests_pipeline.py`: Integration tests and dead-code audits

## References

- Issue #1273: Document ADR for fraud-detection scoring pipeline design
- Issue #636: Fraud / Anomaly Detection Pipeline
- Issue #904: Async job queue for fraud detection
- Issue #1122: Clean split between HTTP handling and scoring logic
- Issue #1171: Edge case coverage
- Issue #1203: Idempotency key support
- `docs/fraud-detection-heuristics.md`: Threshold rationale
- `backend/fraud_detection/pipeline.py`: Architecture comments
- `backend/fraud_detection/scoring.py`: Layer implementations

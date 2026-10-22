# Structured Logging Standard

All backend services (`fraud_detection`, `recommendations`, and `shared` modules) use structured logging via the `structured_logger` module.

## Quick Start

```python
from backend.shared.structured_logger import get_logger, log_info, log_error

logger = get_logger(__name__)
log_info(logger, "Campaign processed", campaign_id="c123", score=0.85)
log_error(logger, "Processing failed", campaign_id="c123", reason="timeout")
```

## Log Levels

- **DEBUG**: Detailed diagnostic information
  - Function entry/exit
  - Variable values at key decision points
  - Loop iterations and internal calculations
  - Use sparingly in production

- **INFO**: General informational messages
  - Service startup/shutdown
  - Configuration loading
  - Significant state changes
  - Completed operations

- **WARNING**: Warning messages for potentially problematic situations
  - Recovered errors
  - Deprecated usage
  - Threshold violations
  - Unexpected but handled conditions

- **ERROR**: Error conditions requiring attention
  - Failed operations
  - Unrecovered exceptions
  - Critical configuration issues

## Structured Context

Always include relevant context as keyword arguments:

```python
log_info(logger, "Flag enqueued", 
         flag_id="FLAG-123", 
         campaign_id="camp_45", 
         severity="HIGH",
         reason="WASH_CONTRIBUTION")
```

Context fields help with:
- Debugging issues
- Monitoring and alerting
- Performance analysis
- Audit trails

## Fraud Detection Fields

Request-scoped fraud-detection logs include `trace_id` from the active request
context. The trace ID is merged into events by `configure_structlog()` and is
also returned in the `x-trace-id` response header. Background worker and
startup events include a request trace ID only when it is explicitly
propagated to that work.

The `event` field contains the event name. Fraud events use these additional
fields where applicable:

| Event or event group | Fields |
| --- | --- |
| `request_started`, `request_completed` | `method`, `path`; completion also has `status_code` |
| `contribution_queued`, `job_processed` | `campaign_id`, `contributor`; queued events also have `amount`, `tx_hash`, `queue_depth`; processed events also have `new_flags`, `processing_latency_ms`, `queue_depth_after`, `total_jobs_processed` |
| `contributions_idempotency_*` | `idempotency_key` or `key_length`, depending on the event |
| `contributions_ingest_invalid_payload`, `job_processing_error` | `error`; worker errors also have `campaign_id` |
| `scan_completed` | `new_flags`, `queue_depth` |
| `moderation_queue_queried` | `returned`, `total` |
| `flag_marked_reviewed`, `flag_not_found` | `flag_id` |

Other event-specific fields include `component`, `operation`, `store_size`,
and resolved database-pool settings. Do not add secrets or credentials to log
context.

## Configuration

The structured logging is configured once at startup. Services should call
`configure_structlog()` during initialization:

```python
from backend.shared.structured_logger import configure_structlog

configure_structlog()
```

## Migration from print()

Replace `print()` statements with structured logging:

```python
# Before
print(f"Processing campaign {campaign_id}")
print("Error:", str(error))

# After
log_info(logger, "Processing campaign", campaign_id=campaign_id)
log_error(logger, "Processing failed", error=str(error))
```

## Zero Bare print() Calls

The backend has zero bare `print()` calls. All logging uses the structured
logger for consistency, traceability, and operational visibility.

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

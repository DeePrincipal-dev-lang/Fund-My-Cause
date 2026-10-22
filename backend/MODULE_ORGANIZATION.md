# Backend Module Organization

**Status**: ✓ Fully organized as of 2026-09-28

## Overview

The Fund-My-Cause backend is organized with clear separation of concerns:

- **`backend/shared/`** — Shared utilities with no internal dependencies (safe to import everywhere)
- **`backend/fraud_detection/`** — Fraud detection service and heuristics
- **`backend/recommendations/`** — Campaign recommendation service

## Directory Structure

```
backend/
├── shared/                      # Shared utilities (no internal deps)
│   ├── __init__.py
│   ├── shared_math_utils.py      # Common math/scoring utilities
│   ├── test_shared_math_utils.py # Tests for math utilities
│   ├── structured_logger.py      # Logging configuration
│   ├── error_schema.py           # Error models
│   ├── config_validator.py       # Environment config validation
│   ├── db_config.py              # Database connection pooling
│   └── test_*.py                 # Unit tests
├── fraud_detection/             # Fraud detection service
│   ├── pipeline.py               # FastAPI HTTP handlers + async job queue
│   ├── scoring.py                # Heuristic logic (pure functions)
│   ├── repository.py             # Mutable in-process state (event store)
│   ├── stages/                   # Pipeline stages
│   │   ├── __init__.py
│   │   ├── idempotency.py        # Idempotency tracking
│   │   └── test_*.py
│   └── test_*.py                 # Unit tests
└── recommendations/             # Recommendation service
    ├── service.py                # FastAPI HTTP handlers + caching
    ├── scoring_config.py         # Recommendation config/scoring
    ├── error_schema.py           # Error models
    └── test_*.py                 # Unit tests
```

## Import Hierarchy

### Layer 1: Shared Utilities (No Internal Dependencies)

**Module**: `backend.shared.*`

**Exports**:
- `shared_math_utils` — Mathematical utilities (Jaccard similarity, normalization, weighted scoring, percentile ranking, etc.)
- `structured_logger` — Structured logging with `get_logger()`, `log_info()`, `log_error()`
- `error_schema` — Error response types
- `config_validator` — Environment variable validation
- `db_config` — Database connection pooling

**Dependencies**: Only standard library and third-party packages (no backend.* imports)

### Layer 2: Service Modules (Import from Shared)

**fraud_detection.pipeline**
- Imports: `backend.shared.shared_math_utils` (for `jaccard_similarity`)
- Pattern: Uses Jaccard similarity to detect near-duplicate campaign titles

**recommendations.service**
- Imports: None from backend.shared (isolated service)
- Includes local error_schema

## Import Statements

### By Service

#### `backend.fraud_detection.pipeline`
```python
from backend.shared.shared_math_utils import jaccard_similarity
```
Used in: `scan_duplicate_content()` heuristic to detect suspicious campaigns with near-duplicate titles

#### `backend.shared.test_shared_math_utils`
```python
from .shared_math_utils import (
    jaccard_similarity,
    normalize,
    weighted_score,
    logarithmic_scale,
    exponential_moving_average,
    percentile_rank,
)
```
**Pattern**: Relative import (`.shared_math_utils`) — standard for test files in the same package

#### `backend.recommendations.service`
No internal backend imports (self-contained)

## Circular Dependencies

**Status**: ✓ **No circular dependencies detected**

**Analysis**:
- `backend.shared.*` modules have **zero internal dependencies** — safe to import from anywhere
- `backend.fraud_detection.*` → `backend.shared.*` (one-way dependency)
- `backend.recommendations.*` has no internal dependencies (isolated)
- Import graph is acyclic and does not create cycles

## Files at Backend Root

**Status**: ✓ **No loose utility modules in backend/ root**

All Python files are properly organized within their service modules:
- `backend/shared/` — utility files
- `backend/fraud_detection/` — service files
- `backend/recommendations/` — service files

No `*.py` files exist directly in `/backend/`.

## Test Organization

All test files follow the naming convention `test_*.py`:

**Unit Tests**:
- `backend/shared/test_shared_math_utils.py`
- `backend/shared/test_error_schema.py`
- `backend/shared/test_config_validator.py`
- `backend/fraud_detection/test_scoring_comprehensive.py`
- `backend/fraud_detection/tests_pipeline.py`
- `backend/fraud_detection/stages/test_*.py`
- `backend/recommendations/tests_*.py`

**Import Pattern**: Tests use relative imports within their package:
```python
# backend/shared/test_shared_math_utils.py
from .shared_math_utils import jaccard_similarity
```

## Verification Checklist

- ✓ `shared_math_utils.py` located in `backend/shared/` (not in backend root)
- ✓ `test_shared_math_utils.py` located in `backend/shared/` (not in backend root)
- ✓ All imports use correct paths (`backend.shared.*` for absolute, `.` for relative)
- ✓ No circular dependencies detected
- ✓ No loose utility modules in `backend/` root
- ✓ Shared utilities have no internal backend.* dependencies
- ✓ Service layers can safely import from shared layer

## Future Considerations

If adding new shared utilities:
1. Place in `backend/shared/`
2. Ensure **no imports from `backend.fraud_detection.*` or `backend.recommendations.*`**
3. Use absolute paths for imports between services: `from backend.shared.X import Y`
4. Use relative paths within the same package: `from .module import Y`
5. Add corresponding test file with `test_` prefix

If adding new services:
1. Create new module under `backend/`
2. Import from `backend.shared.*` as needed
3. Do not import from other services (to maintain isolation)
4. Use absolute path: `from backend.shared.error_schema import ...`

"""
Shared pytest fixtures for the fraud_detection test suite.

The ``isolated_state`` fixture (autouse) resets all in-process stores between
tests so that tests are fully independent and ordering-agnostic.
"""
from __future__ import annotations

import asyncio

import pytest

import scoring
from repository import clear_all


@pytest.fixture(autouse=True)
def isolated_state():
    """Reset all shared in-process state before and after every test."""
    # -- setup --
    clear_all()
    scoring._last_duplicate_scan_at = 0.0

    # Clear the idempotency store (routes-level singleton) if pipeline has
    # been imported.  Import is deferred so that tests that never touch the
    # HTTP layer don't pay the FastAPI startup cost.
    try:
        from stages.routes import _IDEMPOTENCY_STORE
        _IDEMPOTENCY_STORE._store.clear()
        _IDEMPOTENCY_STORE._expiry_queue.clear()
    except Exception:  # pragma: no cover
        pass

    # Drain the async scoring queue if it has been imported.
    try:
        from stages.scoring_worker import scoring_queue
        while not scoring_queue.empty():
            try:
                scoring_queue.get_nowait()
                scoring_queue.task_done()
            except asyncio.QueueEmpty:
                break
    except Exception:  # pragma: no cover
        pass

    yield

    # -- teardown (mirror of setup) --
    clear_all()
    scoring._last_duplicate_scan_at = 0.0

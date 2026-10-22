"""
Fraud-detection data-access / repository layer (#1122).

This module owns all in-process event-store state and exposes a clean
repository interface consumed by the scoring layer (scoring.py) and the
HTTP handlers (pipeline.py).

Design goals
────────────
* All mutable state lives here — scoring.py and pipeline.py contain zero
  module-level lists or dicts.
* The interface is synchronous and dependency-free (no FastAPI, no asyncio).
  This makes scoring-rule unit tests trivial: just call repository functions
  directly without spinning up an HTTP server.
* In production this layer would be replaced by a real database adapter; only
  this file needs to change.

Public API
──────────
append_contribution(event)  – store a ContributionEvent
append_refund(event)        – store a RefundEvent
append_campaign(record)     – store a CampaignRecord
enqueue_flag(flag)          – add a Flag to the moderation queue

get_contributions()         – read-only view of contribution events
get_refunds()               – read-only view of refund events
get_campaign_records()      – read-only view of campaign records
get_flags(reviewed, reason) – filtered read of the moderation queue

next_flag_id()              – thread-safe, monotonic flag ID generator
clear_all()                 – reset all stores (used in tests only)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Domain types (shared by repository and scoring layers)
# ---------------------------------------------------------------------------

class FlagReason(str, Enum):
    WASH_CONTRIBUTION = "wash_contribution"
    CONTRIBUTION_SPIKE = "contribution_spike"
    DUPLICATE_CONTENT = "duplicate_content"


class FlagSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class Flag:
    id: str
    reason: FlagReason
    severity: FlagSeverity
    campaign_id: str
    wallet: Optional[str]
    detail: str
    flagged_at: float = field(default_factory=__import__("time").time)
    reviewed: bool = False


@dataclass
class ContributionEvent:
    campaign_id: str
    wallet: str
    amount: int
    timestamp: float


@dataclass
class RefundEvent:
    campaign_id: str
    wallet: str
    timestamp: float


@dataclass
class CampaignRecord:
    id: str
    title: str
    description: str


# ---------------------------------------------------------------------------
# In-process stores (replace with DB calls in production)
# ---------------------------------------------------------------------------

_CONTRIBUTIONS: list[ContributionEvent] = []
_REFUNDS: list[RefundEvent] = []
_CAMPAIGN_RECORDS: list[CampaignRecord] = []
_QUEUE: list[Flag] = []
_FLAG_COUNTER: int = 0


# ---------------------------------------------------------------------------
# Repository write operations
# ---------------------------------------------------------------------------

def append_contribution(event: ContributionEvent) -> None:
    """Persist a new contribution event."""
    _CONTRIBUTIONS.append(event)


def append_refund(event: RefundEvent) -> None:
    """Persist a new refund event."""
    _REFUNDS.append(event)


def append_campaign(record: CampaignRecord) -> None:
    """Persist a new campaign record."""
    _CAMPAIGN_RECORDS.append(record)


def enqueue_flag(flag: Flag) -> None:
    """Append a fraud flag to the moderation queue."""
    _QUEUE.append(flag)


def next_flag_id() -> str:
    """Return a monotonically increasing, human-readable flag ID."""
    global _FLAG_COUNTER
    _FLAG_COUNTER += 1
    return f"FLAG-{_FLAG_COUNTER:05d}"


# ---------------------------------------------------------------------------
# Repository read operations
# ---------------------------------------------------------------------------

def get_contributions() -> list[ContributionEvent]:
    """Return the full list of stored contribution events."""
    return _CONTRIBUTIONS


def get_refunds() -> list[RefundEvent]:
    """Return the full list of stored refund events."""
    return _REFUNDS


def get_campaign_records() -> list[CampaignRecord]:
    """Return the full list of stored campaign records."""
    return _CAMPAIGN_RECORDS


def get_flags(
    reviewed: Optional[bool] = None,
    reason: Optional[FlagReason] = None,
    limit: int = 50,
) -> list[Flag]:
    """
    Return flags from the moderation queue with optional filters.

    Parameters
    ----------
    reviewed:
        When ``True`` return only reviewed flags; ``False`` returns only
        unreviewed flags; ``None`` (default) returns all flags.
    reason:
        When provided, return only flags with this reason.
    limit:
        Maximum number of flags to return (newest first).
    """
    items: list[Flag] = list(_QUEUE)
    if reviewed is not None:
        items = [f for f in items if f.reviewed == reviewed]
    if reason is not None:
        items = [f for f in items if f.reason == reason]
    return items[-limit:]


def total_flag_count() -> int:
    """Return the total number of flags ever enqueued."""
    return len(_QUEUE)


def mark_flag_reviewed(flag_id: str) -> bool:
    """
    Set ``reviewed = True`` on the flag with the given ID.

    Returns ``True`` if the flag was found and updated, ``False`` otherwise.
    """
    for flag in _QUEUE:
        if flag.id == flag_id:
            flag.reviewed = True
            return True
    return False


# ---------------------------------------------------------------------------
# Test-only helper
# ---------------------------------------------------------------------------

def clear_all() -> None:
    """
    Reset all in-process stores to an empty state.

    Should only be called from test fixtures — never from production code.
    """
    global _FLAG_COUNTER
    _CONTRIBUTIONS.clear()
    _REFUNDS.clear()
    _CAMPAIGN_RECORDS.clear()
    _QUEUE.clear()
    _FLAG_COUNTER = 0

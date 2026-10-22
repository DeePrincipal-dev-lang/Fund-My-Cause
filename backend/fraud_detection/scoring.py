"""
Fraud-detection scoring layer (#1122, #1527).

This module contains the pure heuristic logic that detects suspicious
patterns over contribution and campaign data.  It has NO dependency on
a web framework, asyncio, or HTTP — it only reads from the repository layer via the
functions exposed in ``repository.py``.

This separation means that every scoring rule can be unit-tested without
starting an HTTP server, mocking request contexts, or touching asyncio.

Configuration
──────────────
Thresholds are loaded from FraudDetectionConfig at module import time via
the pipeline module (see pipeline.py). This ensures all configuration is
validated before any service starts processing requests.

Public API
──────────
scan_wash_contributions()   – detect wash-contribution patterns
scan_contribution_spikes()  – detect sudden-spike patterns
scan_duplicate_content()    – detect near-duplicate campaign titles

run_full_scan(*)            – run all heuristics, enqueue flags, return new flags

Thresholds and their rationale are documented in
``docs/fraud-detection-heuristics.md``.

Design rationale
────────────────
The layer ordering, idempotency guarantees, and known edge cases are
recorded in ADR-008 (``docs/adr/ADR-008-fraud-detection-scoring-pipeline-design.md``).
Read that ADR before modifying a scoring layer — the order of the three
scanners is load-bearing.
"""

from __future__ import annotations

import time

import structlog

from repository import (
    CampaignRecord,
    ContributionEvent,
    Flag,
    FlagReason,
    FlagSeverity,
    RefundEvent,
    enqueue_flag,
    get_campaign_records,
    get_contributions,
    get_refunds,
    next_flag_id,
)

log: structlog.BoundLogger = structlog.get_logger("fraud_detection.scoring")

# Configuration is loaded at module import time by pipeline.py
# These module-level variables are initialized when the module is imported
# and can be updated for testing via the pipeline module's configuration
WASH_WINDOW_SECONDS: int = 3600
WASH_MIN_OCCURRENCES: int = 3
SPIKE_WINDOW_SECONDS: int = 600
SPIKE_MAX_CONTRIBUTIONS: int = 50
DUPLICATE_JACCARD_THRESHOLD: float = 0.8
DUPLICATE_SCAN_MIN_INTERVAL_SECONDS: int = 30

#: Unix timestamp of the last time scan_duplicate_content() actually ran.
_last_duplicate_scan_at: float = 0.0


# ---------------------------------------------------------------------------
# Heuristic implementations
# ---------------------------------------------------------------------------

def _jaccard(a: str, b: str) -> float:
    """Token-level Jaccard similarity between two strings."""
    sa = set(a.lower().split())
    sb = set(b.lower().split())
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / len(sa | sb)


def scan_wash_contributions() -> list[Flag]:
    """
    Wash contribution heuristic.

    A wallet that contributes then refunds the *same campaign* within
    WASH_WINDOW_SECONDS, and does so WASH_MIN_OCCURRENCES or more times,
    is flagged as a potential wash contributor.
    """
    flags: list[Flag] = []
    contributions = get_contributions()
    refunds = get_refunds()

    # Group refunds by (campaign, wallet)
    refund_lookup: dict[tuple[str, str], list[float]] = {}
    for r in refunds:
        key = (r.campaign_id, r.wallet)
        refund_lookup.setdefault(key, []).append(r.timestamp)

    wash_count: dict[tuple[str, str], int] = {}
    for c in contributions:
        key = (c.campaign_id, c.wallet)
        refund_times = refund_lookup.get(key, [])
        if any(0 < rt - c.timestamp <= WASH_WINDOW_SECONDS for rt in refund_times):
            wash_count[key] = wash_count.get(key, 0) + 1

    for (campaign_id, wallet), count in wash_count.items():
        if count >= WASH_MIN_OCCURRENCES:
            flags.append(Flag(
                id=next_flag_id(),
                reason=FlagReason.WASH_CONTRIBUTION,
                severity=FlagSeverity.HIGH,
                campaign_id=campaign_id,
                wallet=wallet,
                detail=f"Wallet performed {count} wash cycles within {WASH_WINDOW_SECONDS}s",
            ))
    return flags


def scan_contribution_spikes() -> list[Flag]:
    """
    Sudden-spike heuristic.

    If a campaign receives more than SPIKE_MAX_CONTRIBUTIONS in any
    SPIKE_WINDOW_SECONDS rolling window, flag it as a potential sybil attack.
    """
    flags: list[Flag] = []
    contributions = get_contributions()

    by_campaign: dict[str, list[float]] = {}
    for c in contributions:
        by_campaign.setdefault(c.campaign_id, []).append(c.timestamp)

    for campaign_id, timestamps in by_campaign.items():
        ts = sorted(timestamps)
        for i, t_start in enumerate(ts):
            window = [t for t in ts[i:] if t - t_start <= SPIKE_WINDOW_SECONDS]
            if len(window) > SPIKE_MAX_CONTRIBUTIONS:
                flags.append(Flag(
                    id=next_flag_id(),
                    reason=FlagReason.CONTRIBUTION_SPIKE,
                    severity=FlagSeverity.MEDIUM,
                    campaign_id=campaign_id,
                    wallet=None,
                    detail=(
                        f"{len(window)} contributions in "
                        f"{SPIKE_WINDOW_SECONDS}s window "
                        f"(threshold: {SPIKE_MAX_CONTRIBUTIONS})"
                    ),
                ))
                break  # one flag per campaign per scan
    return flags


def scan_duplicate_content() -> list[Flag]:
    """
    Duplicate-content heuristic.

    Compares every pair of campaigns by title Jaccard similarity.
    Pairs above DUPLICATE_JACCARD_THRESHOLD are flagged.
    """
    flags: list[Flag] = []
    records: list[CampaignRecord] = get_campaign_records()

    for i in range(len(records)):
        for j in range(i + 1, len(records)):
            a, b = records[i], records[j]
            sim = _jaccard(a.title, b.title)
            if sim >= DUPLICATE_JACCARD_THRESHOLD:
                flags.append(Flag(
                    id=next_flag_id(),
                    reason=FlagReason.DUPLICATE_CONTENT,
                    severity=FlagSeverity.LOW,
                    campaign_id=b.id,
                    wallet=None,
                    detail=(
                        f"Title Jaccard similarity {sim:.2f} with campaign {a.id} "
                        f"(threshold: {DUPLICATE_JACCARD_THRESHOLD})"
                    ),
                ))
    return flags


def run_full_scan(*, force_duplicate_scan: bool = False) -> list[Flag]:
    """
    Execute all heuristics and append new flags to the moderation queue.

    The O(N²) duplicate-content pass is rate-limited (see
    DUPLICATE_SCAN_MIN_INTERVAL_SECONDS) so that calling this once per
    contribution — as the async scoring worker does — does not re-run the full
    campaign-content scan on every single donation.  Pass
    force_duplicate_scan=True (used by the manual POST /scan trigger) to
    bypass the rate limit and always run it.
    """
    global _last_duplicate_scan_at

    scan_log = log.bind(operation="run_full_scan")
    scan_log.info("scan_started")

    new_flags: list[Flag] = []
    new_flags.extend(scan_wash_contributions())
    new_flags.extend(scan_contribution_spikes())

    now = time.time()
    if force_duplicate_scan or (now - _last_duplicate_scan_at) >= DUPLICATE_SCAN_MIN_INTERVAL_SECONDS:
        new_flags.extend(scan_duplicate_content())
        _last_duplicate_scan_at = now

    for flag in new_flags:
        enqueue_flag(flag)

    scan_log.info(
        "scan_completed",
        new_flags=len(new_flags),
        queue_depth=len(get_contributions()),  # proxy for activity volume
    )
    return new_flags

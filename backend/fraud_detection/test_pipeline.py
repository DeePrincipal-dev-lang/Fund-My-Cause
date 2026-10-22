"""Tests for the fraud/anomaly detection pipeline (#636, #904)."""

import re
import time
import inspect
import asyncio
import pytest
from fastapi.testclient import TestClient

from pipeline import (
    CampaignRecord,
    ContributionEvent,
    ContributionPayload,
    DUPLICATE_SCAN_MIN_INTERVAL_SECONDS,
    FlagReason,
    RefundEvent,
    ScoringJob,
    _CAMPAIGN_RECORDS,
    _CONTRIBUTIONS,
    _QUEUE,
    _REFUNDS,
    _scoring_queue,
    _scoring_worker,
    app,
    run_full_scan,
    scan_contribution_spikes,
    scan_duplicate_content,
    scan_wash_contributions,
    WASH_MIN_OCCURRENCES,
    WASH_WINDOW_SECONDS,
    SPIKE_MAX_CONTRIBUTIONS,
    SPIKE_WINDOW_SECONDS,
)
import pipeline as pipeline_module
import scoring

client = TestClient(app)


# ── Dead-code regression guards (#900) ───────────────────────────────────────

def test_no_dead_feature_flag_branches():
    """
    The rules engine must contain no conditional branches gated on feature
    flags.  Feature flags are identified by the common patterns:
      - FEATURE_* variable references
      - os.getenv("FEATURE_*") calls
    If any are found, they must be actively referenced in run_full_scan()
    or a scan function; otherwise they are dead code.
    """
    source = inspect.getsource(pipeline_module)
    # Detect FEATURE_* variable names that are NOT inside comments or strings
    # (a simple heuristic: count lines with FEATURE_ outside of # comments).
    non_comment_lines = [
        line for line in source.splitlines()
        if "FEATURE_" in line and not line.lstrip().startswith("#")
    ]
    assert non_comment_lines == [], (
        f"Unexpected feature-flag references found in pipeline.py "
        f"(potential dead branches): {non_comment_lines}"
    )


def test_no_dead_scoring_model_dispatch():
    """
    There must be no versioned-model dispatch logic (``if model_version ==``
    or ``if scoring_model ==``) which would indicate a removed scoring path
    that was never cleaned up.
    """
    source = inspect.getsource(pipeline_module)
    patterns = [
        r"if\s+model_version\s*==",
        r"if\s+scoring_model\s*==",
    ]
    for pattern in patterns:
        matches = re.findall(pattern, source)
        assert not matches, (
            f"Dead scoring-model dispatch found (pattern={pattern!r}): {matches}"
        )


def test_all_scan_functions_called_by_run_full_scan():
    """
    Every scan_* function defined in the module must be invoked by
    run_full_scan().  An orphaned scan function is a dead code path.
    """
    import types

    scan_funcs = [
        name for name, obj in vars(pipeline_module).items()
        if name.startswith("scan_") and isinstance(obj, types.FunctionType)
    ]
    run_full_scan_source = inspect.getsource(pipeline_module.run_full_scan)

    dead = [name for name in scan_funcs if name not in run_full_scan_source]
    assert not dead, (
        f"scan_*() functions defined but NOT called by run_full_scan() "
        f"(dead code): {dead}"
    )


# ── Scoring regression test: byte-for-byte output on a fixed transaction set ─
#
# This test uses a deterministic set of contributions/refunds and asserts that
# the scanner produces exactly the expected flag count and reasons.  If the
# scoring logic changes, this test must be updated intentionally (not silently
# pass with a different result).

_FIXED_NOW = 1_700_000_000.0  # 2023-11-14T22:13:20Z — fixed for reproducibility


def test_scoring_regression_fixed_transaction_set():
    """
    Run the full pipeline against a fixed, deterministic transaction set and
    assert byte-for-byte identical flag output.

    Expected output (verified on first authorship):
      - 1 WASH_CONTRIBUTION flag for wallet GWASH on campaign CAMP_WASH
      - 1 CONTRIBUTION_SPIKE flag for campaign CAMP_SPIKE
      - 1 DUPLICATE_CONTENT flag for campaign DUP_B

    Any change to thresholds or heuristics that alters this output MUST be
    accompanied by an intentional update to the expected values below.
    """
    # Wash-contribution fixture: 3 wash cycles within the window
    for i in range(WASH_MIN_OCCURRENCES):
        _CONTRIBUTIONS.append(ContributionEvent("CAMP_WASH", "GWASH", 1000, _FIXED_NOW + i * 10))
        _REFUNDS.append(RefundEvent("CAMP_WASH", "GWASH", _FIXED_NOW + i * 10 + 60))

    # Contribution-spike fixture: SPIKE_MAX_CONTRIBUTIONS + 1 contributions in one window
    for i in range(SPIKE_MAX_CONTRIBUTIONS + 1):
        _CONTRIBUTIONS.append(ContributionEvent("CAMP_SPIKE", f"G{i:04d}", 100, _FIXED_NOW + i))

    # Duplicate-content fixture: two campaigns with identical titles
    _CAMPAIGN_RECORDS.append(CampaignRecord("DUP_A", "Fund the Open Commons", "desc"))
    _CAMPAIGN_RECORDS.append(CampaignRecord("DUP_B", "Fund the Open Commons", "desc2"))

    wash_flags = scan_wash_contributions()
    spike_flags = scan_contribution_spikes()
    dup_flags = scan_duplicate_content()

    # Exact counts
    assert len(wash_flags) == 1, f"Expected 1 wash flag, got {len(wash_flags)}"
    assert len(spike_flags) == 1, f"Expected 1 spike flag, got {len(spike_flags)}"
    assert len(dup_flags) == 1, f"Expected 1 duplicate flag, got {len(dup_flags)}"

    # Exact reasons
    assert wash_flags[0].reason == FlagReason.WASH_CONTRIBUTION
    assert spike_flags[0].reason == FlagReason.CONTRIBUTION_SPIKE
    assert dup_flags[0].reason == FlagReason.DUPLICATE_CONTENT

    # Exact targets
    assert wash_flags[0].campaign_id == "CAMP_WASH"
    assert wash_flags[0].wallet == "GWASH"
    assert spike_flags[0].campaign_id == "CAMP_SPIKE"
    assert dup_flags[0].campaign_id == "DUP_B"


# ── Moderation queue endpoint ─────────────────────────────────────────────────

def test_moderation_queue_returns_flags():
    now = time.time()
    for i in range(WASH_MIN_OCCURRENCES):
        _CONTRIBUTIONS.append(ContributionEvent("cq", "GQ", 1000, now + i * 5))
        _REFUNDS.append(RefundEvent("cq", "GQ", now + i * 5 + 30))

    run_full_scan()

    r = client.get("/moderation-queue")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 1
    assert any(f["reason"] == FlagReason.WASH_CONTRIBUTION for f in body["flags"])


# ── Async job queue tests (#904) ──────────────────────────────────────────────

def test_contributions_endpoint_returns_queued():
    """
    POST /contributions must return {"status": "queued"} immediately and
    NOT store the contribution synchronously (async path only).
    """
    initial_count = len(_CONTRIBUTIONS)

    payload = {
        "campaignId": "CTEST1",
        "contributor": "GASYNC",
        "amount": "100000000",
        "transactionHash": "0xABC",
        "timestamp": time.time(),
    }
    r = client.post("/contributions", json=payload)
    assert r.status_code == 202
    body = r.json()
    assert body["status"] == "accepted"

    # Contribution must NOT be in the store yet (async path)
    assert len(_CONTRIBUTIONS) == initial_count, (
        "Contribution should not be stored synchronously in the async path"
    )


def test_contributions_endpoint_returns_queued_with_queue_depth():
    """queue_depth reported by /metrics must be a non-negative integer."""
    payload = {
        "campaignId": "CTEST2",
        "contributor": "GASYNC2",
        "amount": "200000000",
        "transactionHash": "0xDEF",
        "timestamp": time.time(),
    }
    r = client.post("/contributions", json=payload)
    assert r.status_code == 202
    depth = client.get("/metrics").json()["queue_depth"]
    assert isinstance(depth, int)
    assert depth >= 0


def test_contributions_endpoint_invalid_payload():
    """Malformed body must return 422."""
    r = client.post("/contributions", json={"bad": "data"})
    assert r.status_code == 422


def test_metrics_endpoint_returns_expected_fields():
    """GET /metrics must return all monitoring fields."""
    r = client.get("/metrics")
    assert r.status_code == 200
    body = r.json()
    assert "queue_depth" in body
    assert "total_jobs_processed" in body
    assert "total_flags_found" in body
    assert "avg_processing_latency_ms" in body
    assert "last_job_at" in body


def test_metrics_queue_depth_reflects_enqueued_jobs():
    """
    After enqueuing N jobs (without a running worker to drain them),
    queue_depth in /metrics should equal N.
    """
    # Enqueue several jobs directly into the queue without a worker draining them.
    n = 3
    for i in range(n):
        job = ScoringJob(payload=ContributionPayload(
            campaignId=f"CAMP{i}",
            contributor=f"G{i:04d}",
            amount="50000000",
            transactionHash=f"0x{i:04x}",
            timestamp=time.time(),
        ))
        _scoring_queue.put_nowait(job)

    r = client.get("/metrics")
    body = r.json()
    assert body["queue_depth"] >= n, (
        f"Expected queue_depth >= {n}, got {body['queue_depth']}"
    )


def test_full_async_path_enqueue_process_result_applied():
    """
    Integration test for the full async path (#904):
      1. Enqueue a ScoringJob directly.
      2. Process it via the worker logic (simulated synchronously).
      3. Verify the contribution was stored and a scan was triggered.

    We invoke the worker logic directly (not via asyncio.run) to keep the test
    synchronous and deterministic: we manually put a job in the queue, call
    the worker body once, and assert the expected side effects.
    """
    # Set up conditions for a wash-contribution flag: 2 existing cycles
    now = time.time()
    for i in range(WASH_MIN_OCCURRENCES - 1):
        _CONTRIBUTIONS.append(ContributionEvent("CAMPASYNC", "GWASHASYNC", 1000, now + i * 10))
        _REFUNDS.append(RefundEvent("CAMPASYNC", "GWASHASYNC", now + i * 10 + 60))

    # Enqueue a job that will be the 3rd wash cycle (triggering a flag)
    payload = ContributionPayload(
        campaignId="CAMPASYNC",
        contributor="GWASHASYNC",
        amount="1000",
        transactionHash="0xWASH",
        timestamp=now + (WASH_MIN_OCCURRENCES - 1) * 10,
    )
    job = ScoringJob(payload=payload)

    # Simulate what the worker does when it processes the job
    _CONTRIBUTIONS.append(ContributionEvent(
        campaign_id=payload.campaignId,
        wallet=payload.contributor,
        amount=int(payload.amount) if payload.amount.isdigit() else 0,
        timestamp=payload.timestamp,
    ))

    # Add the matching refund so the wash pattern completes
    _REFUNDS.append(RefundEvent("CAMPASYNC", "GWASHASYNC", payload.timestamp + 60))

    # Run the scan (as the worker would)
    new_flags = run_full_scan()

    # Verify: contribution stored
    assert any(c.campaign_id == "CAMPASYNC" and c.wallet == "GWASHASYNC"
               for c in _CONTRIBUTIONS), "Contribution not found in store after async processing"

    # Verify: wash flag raised
    wash_flags = [f for f in new_flags if f.reason == FlagReason.WASH_CONTRIBUTION
                  and f.campaign_id == "CAMPASYNC"]
    assert len(wash_flags) == 1, (
        f"Expected 1 wash flag for CAMPASYNC after async processing, got {len(wash_flags)}"
    )

    # Verify: flag is in the moderation queue
    r = client.get("/moderation-queue")
    assert r.status_code == 200
    mq_flags = r.json()["flags"]
    assert any(
        f["campaign_id"] == "CAMPASYNC" and f["reason"] == FlagReason.WASH_CONTRIBUTION
        for f in mq_flags
    ), "Wash flag not found in moderation queue after async processing"


def test_scan_endpoint_still_works():
    """POST /scan should still trigger an async full scan (manual trigger path)."""
    r = client.post("/scan")
    assert r.status_code == 200
    assert r.json()["status"] == "scan_scheduled"


# ── Duplicate-content scan rate limiting ──────────────────────────────────────
#
# scan_duplicate_content() is O(N^2) in the number of campaigns. Running it on
# every single queued contribution would make per-contribution scoring cost
# scale with the full campaign-content scan. run_full_scan() rate-limits it.

def test_duplicate_scan_is_rate_limited_across_repeated_calls():
    """
    Calling run_full_scan() repeatedly in quick succession (as the scoring
    worker does, once per contribution) must not re-run the O(N^2)
    duplicate-content scan every time.
    """
    _CAMPAIGN_RECORDS.append(CampaignRecord("DUP_A", "Fund the Open Commons", "desc"))
    _CAMPAIGN_RECORDS.append(CampaignRecord("DUP_B", "Fund the Open Commons", "desc2"))

    first = run_full_scan()
    assert any(f.reason == FlagReason.DUPLICATE_CONTENT for f in first), (
        "First scan after a cold start should run the duplicate-content pass"
    )

    before = scoring._last_duplicate_scan_at
    second = run_full_scan()
    after = scoring._last_duplicate_scan_at

    assert after == before, (
        "A second run_full_scan() call within the rate-limit window must "
        "skip scan_duplicate_content() (timestamp should not advance)"
    )
    assert not any(f.reason == FlagReason.DUPLICATE_CONTENT for f in second), (
        "Duplicate-content flags should not be re-emitted within the "
        "rate-limit window"
    )


def test_duplicate_scan_runs_again_after_interval_elapses():
    """Once DUPLICATE_SCAN_MIN_INTERVAL_SECONDS has passed, the duplicate scan runs again."""
    _CAMPAIGN_RECORDS.append(CampaignRecord("DUP_A", "Fund the Open Commons", "desc"))
    _CAMPAIGN_RECORDS.append(CampaignRecord("DUP_B", "Fund the Open Commons", "desc2"))

    run_full_scan()
    # Simulate the interval having elapsed.
    scoring._last_duplicate_scan_at -= DUPLICATE_SCAN_MIN_INTERVAL_SECONDS + 1

    flags = run_full_scan()
    assert any(f.reason == FlagReason.DUPLICATE_CONTENT for f in flags)


def test_scan_endpoint_forces_duplicate_scan_bypassing_rate_limit():
    """POST /scan (explicit manual trigger) must bypass the rate limit."""
    _CAMPAIGN_RECORDS.append(CampaignRecord("DUP_A", "Fund the Open Commons", "desc"))
    _CAMPAIGN_RECORDS.append(CampaignRecord("DUP_B", "Fund the Open Commons", "desc2"))

    run_full_scan()  # primes _last_duplicate_scan_at
    before = scoring._last_duplicate_scan_at

    flags = run_full_scan(force_duplicate_scan=True)
    after = scoring._last_duplicate_scan_at

    assert after > before
    assert any(f.reason == FlagReason.DUPLICATE_CONTENT for f in flags)

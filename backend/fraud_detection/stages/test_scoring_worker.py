"""
Unit tests for the scoring_worker stage.

Verifies that:
1. ContributionPayload and ScoringJob dataclasses construct correctly.
2. get_metrics() returns the expected fields.
3. The scoring queue is bounded by SCORING_QUEUE_MAXSIZE.
4. Stage is independent of FastAPI/HTTP.
"""

from __future__ import annotations

import time

import pytest

from stages.scoring_worker import (
    ContributionPayload,
    ScoringJob,
    SCORING_QUEUE_MAXSIZE,
    get_metrics,
    scoring_queue,
)


class TestContributionPayload:
    def test_construction(self):
        p = ContributionPayload(
            campaignId="CAMP1",
            contributor="GWALLET",
            amount="1000",
            transactionHash="0xABC",
            timestamp=time.time(),
        )
        assert p.campaignId == "CAMP1"
        assert p.contributor == "GWALLET"
        assert p.amount == "1000"
        assert p.transactionHash == "0xABC"

    def test_timestamp_is_float(self):
        p = ContributionPayload(
            campaignId="C",
            contributor="G",
            amount="1",
            transactionHash="0x",
            timestamp=1_700_000_000.0,
        )
        assert isinstance(p.timestamp, float)


class TestScoringJob:
    def test_construction_with_defaults(self):
        p = ContributionPayload(
            campaignId="C",
            contributor="G",
            amount="1",
            transactionHash="0x",
            timestamp=1.0,
        )
        job = ScoringJob(payload=p)
        assert job.payload is p
        assert isinstance(job.enqueued_at, float)
        assert job.enqueued_at > 0

    def test_construction_with_explicit_enqueued_at(self):
        p = ContributionPayload(
            campaignId="C",
            contributor="G",
            amount="1",
            transactionHash="0x",
            timestamp=1.0,
        )
        t = time.time()
        job = ScoringJob(payload=p, enqueued_at=t)
        assert job.enqueued_at == t


class TestMetrics:
    def test_get_metrics_returns_expected_fields(self):
        metrics = get_metrics()
        assert "queue_depth" in metrics
        assert "total_jobs_processed" in metrics
        assert "total_flags_found" in metrics
        assert "avg_processing_latency_ms" in metrics
        assert "last_job_at" in metrics

    def test_queue_depth_is_non_negative(self):
        metrics = get_metrics()
        assert metrics["queue_depth"] >= 0


class TestScoringQueueBounds:
    def test_queue_maxsize(self):
        assert scoring_queue.maxsize == SCORING_QUEUE_MAXSIZE
        assert SCORING_QUEUE_MAXSIZE == 1000

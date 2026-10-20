"""
Comprehensive unit tests for fraud-detection scoring.

Consolidates and deduplicates coverage from:
- tests_scoring.py (Issue #943)
- tests_scoring_edge_cases.py (Issue #1171)
- tests_scoring_layers.py (Issue #1122)

Targets ≥ 85% branch coverage of scoring.py and repository.py.
Fixes shared mutable state to eliminate flaky tests.

Closes #1309
"""
from __future__ import annotations

import time
import inspect
from unittest.mock import patch
import pytest

import repository
import scoring
from repository import (
    CampaignRecord,
    ContributionEvent,
    Flag,
    FlagReason,
    FlagSeverity,
    RefundEvent,
    append_campaign,
    append_contribution,
    append_refund,
    clear_all,
    enqueue_flag,
    get_campaign_records,
    get_contributions,
    get_flags,
    get_refunds,
    mark_flag_reviewed,
    next_flag_id,
    total_flag_count,
)
from scoring import (
    DUPLICATE_JACCARD_THRESHOLD,
    DUPLICATE_SCAN_MIN_INTERVAL_SECONDS,
    SPIKE_MAX_CONTRIBUTIONS,
    SPIKE_WINDOW_SECONDS,
    WASH_MIN_OCCURRENCES,
    WASH_WINDOW_SECONDS,
    _jaccard,
    run_full_scan,
    scan_contribution_spikes,
    scan_duplicate_content,
    scan_wash_contributions,
)


@pytest.fixture(autouse=True)
def isolated_state():
    """Isolate each test with clean state, fixing the shared mutable state issues."""
    clear_all()
    scoring._last_duplicate_scan_at = 0.0
    yield
    clear_all()
    scoring._last_duplicate_scan_at = 0.0


def _wash(campaign: str, wallet: str, cycles: int, delay: float = 60.0) -> None:
    """Add wash cycles with safe spacing to prevent cross-pairing."""
    gap = WASH_WINDOW_SECONDS * 3
    for i in range(cycles):
        t = 1_700_000_000.0 + i * gap
        append_contribution(ContributionEvent(campaign, wallet, 1_000, t))
        append_refund(RefundEvent(campaign, wallet, t + delay))


def _spike(campaign: str, count: int, spread: float = 0.1) -> None:
    """Add contributions tightly packed inside one spike window."""
    t = 1_700_000_000.0
    for i in range(count):
        append_contribution(ContributionEvent(campaign, f"GW{i}", 100, t + i * spread))


# ---------------------------------------------------------------------------
# Layer boundary tests (#1122)
# ---------------------------------------------------------------------------

class TestLayerBoundaries:
    """Verify scoring.py and repository.py layers are properly separated."""

    def test_scoring_module_has_no_fastapi_import(self):
        """scoring.py must be HTTP-independent."""
        source = inspect.getsource(scoring)
        assert "fastapi" not in source.lower()

    def test_scoring_module_has_no_asyncio_import(self):
        """Scoring functions are synchronous."""
        source = inspect.getsource(scoring)
        assert "import asyncio" not in source

    def test_repository_has_no_scan_functions(self):
        """repository.py must not contain heuristic logic."""
        source = inspect.getsource(repository)
        assert "scan_wash" not in source
        assert "jaccard" not in source.lower()

    def test_scoring_functions_callable_without_http(self):
        """Scoring functions must work without HTTP imports."""
        result = scan_wash_contributions()
        assert isinstance(result, list)


# ---------------------------------------------------------------------------
# Repository layer unit tests (#1122)
# ---------------------------------------------------------------------------

class TestRepositoryLayer:
    """Tests for the repository storage and retrieval layer."""

    def test_append_and_read_contributions(self):
        append_contribution(ContributionEvent("c1", "GW1", 1000, 1.0))
        append_contribution(ContributionEvent("c2", "GW2", 2000, 2.0))
        contribs = get_contributions()
        assert len(contribs) == 2
        assert contribs[0].campaign_id == "c1"
        assert contribs[1].campaign_id == "c2"

    def test_append_and_read_refunds(self):
        append_refund(RefundEvent("c1", "GW1", 60.0))
        refunds = get_refunds()
        assert len(refunds) == 1
        assert refunds[0].wallet == "GW1"

    def test_append_and_read_campaign_records(self):
        append_campaign(CampaignRecord("id1", "Title A", "desc"))
        records = get_campaign_records()
        assert len(records) == 1
        assert records[0].title == "Title A"

    def test_enqueue_and_read_flags(self):
        flag = Flag(
            id=next_flag_id(),
            reason=FlagReason.WASH_CONTRIBUTION,
            severity=FlagSeverity.HIGH,
            campaign_id="c1",
            wallet="GW1",
            detail="test",
        )
        enqueue_flag(flag)
        flags = get_flags()
        assert len(flags) == 1
        assert flags[0].reason == FlagReason.WASH_CONTRIBUTION

    def test_get_flags_filter_by_reviewed(self):
        f1 = Flag(id=next_flag_id(), reason=FlagReason.WASH_CONTRIBUTION,
                  severity=FlagSeverity.HIGH, campaign_id="c1", wallet="G1", detail="")
        f2 = Flag(id=next_flag_id(), reason=FlagReason.CONTRIBUTION_SPIKE,
                  severity=FlagSeverity.MEDIUM, campaign_id="c2", wallet=None, detail="")
        f2.reviewed = True
        enqueue_flag(f1)
        enqueue_flag(f2)

        unreviewed = get_flags(reviewed=False)
        assert len(unreviewed) == 1
        assert unreviewed[0].id == f1.id

        reviewed = get_flags(reviewed=True)
        assert len(reviewed) == 1
        assert reviewed[0].id == f2.id

    def test_get_flags_filter_by_reason(self):
        f1 = Flag(id=next_flag_id(), reason=FlagReason.WASH_CONTRIBUTION,
                  severity=FlagSeverity.HIGH, campaign_id="c1", wallet="G1", detail="")
        f2 = Flag(id=next_flag_id(), reason=FlagReason.DUPLICATE_CONTENT,
                  severity=FlagSeverity.LOW, campaign_id="c2", wallet=None, detail="")
        enqueue_flag(f1)
        enqueue_flag(f2)

        wash_flags = get_flags(reason=FlagReason.WASH_CONTRIBUTION)
        assert len(wash_flags) == 1
        assert wash_flags[0].reason == FlagReason.WASH_CONTRIBUTION

    def test_mark_flag_reviewed(self):
        flag_id = next_flag_id()
        flag = Flag(id=flag_id, reason=FlagReason.WASH_CONTRIBUTION,
                    severity=FlagSeverity.HIGH, campaign_id="c1", wallet="G1", detail="")
        enqueue_flag(flag)
        result = mark_flag_reviewed(flag_id)
        assert result is True
        assert get_flags(reviewed=True)[0].id == flag_id

    def test_mark_flag_reviewed_missing(self):
        result = mark_flag_reviewed("FLAG-99999")
        assert result is False

    def test_total_flag_count(self):
        for i in range(3):
            enqueue_flag(Flag(
                id=next_flag_id(),
                reason=FlagReason.WASH_CONTRIBUTION,
                severity=FlagSeverity.HIGH,
                campaign_id=f"c{i}",
                wallet="G1",
                detail="",
            ))
        assert total_flag_count() == 3

    def test_next_flag_id_is_monotonic(self):
        ids = [next_flag_id() for _ in range(5)]
        assert len(set(ids)) == 5
        nums = [int(fid.split("-")[1]) for fid in ids]
        assert nums == sorted(nums)

    def test_clear_all_resets_everything(self):
        append_contribution(ContributionEvent("c1", "G1", 100, 1.0))
        append_refund(RefundEvent("c1", "G1", 60.0))
        append_campaign(CampaignRecord("c1", "T", ""))
        enqueue_flag(Flag(id=next_flag_id(), reason=FlagReason.WASH_CONTRIBUTION,
                          severity=FlagSeverity.HIGH, campaign_id="c1", wallet="G1", detail=""))

        clear_all()

        assert get_contributions() == []
        assert get_refunds() == []
        assert get_campaign_records() == []
        assert get_flags() == []
        assert total_flag_count() == 0


# ---------------------------------------------------------------------------
# Flag severity and field completeness
# ---------------------------------------------------------------------------

class TestFlagSeverity:
    """Tests for correct flag severity assignment."""

    def test_wash_is_high_severity(self):
        _wash("c1", "GW", WASH_MIN_OCCURRENCES)
        flags = scan_wash_contributions()
        assert len(flags) == 1
        assert flags[0].severity == FlagSeverity.HIGH
        assert flags[0].reason == FlagReason.WASH_CONTRIBUTION

    def test_spike_is_medium_severity(self):
        _spike("c2", SPIKE_MAX_CONTRIBUTIONS + 1)
        flags = scan_contribution_spikes()
        assert len(flags) == 1
        assert flags[0].severity == FlagSeverity.MEDIUM
        assert flags[0].reason == FlagReason.CONTRIBUTION_SPIKE

    def test_duplicate_is_low_severity(self):
        append_campaign(CampaignRecord("d1", "Save the Ocean Initiative", ""))
        append_campaign(CampaignRecord("d2", "Save the Ocean Initiative", ""))
        flags = scan_duplicate_content()
        assert len(flags) == 1
        assert flags[0].severity == FlagSeverity.LOW
        assert flags[0].reason == FlagReason.DUPLICATE_CONTENT


class TestFlagFields:
    """Tests for flag object structure and content."""

    def test_wash_flag_has_wallet_set(self):
        _wash("fw1", "GBAD", WASH_MIN_OCCURRENCES)
        flags = scan_wash_contributions()
        assert all(f.wallet is not None for f in flags)
        assert all(f.campaign_id is not None for f in flags)

    def test_spike_flag_has_no_wallet(self):
        """Spike flags are campaign-level."""
        _spike("fs1", SPIKE_MAX_CONTRIBUTIONS + 1)
        flags = scan_contribution_spikes()
        assert all(f.wallet is None for f in flags)

    def test_duplicate_flag_has_no_wallet(self):
        """Duplicate-content flags are campaign-level."""
        t = "Matching Title"
        append_campaign(CampaignRecord("fd1", t, ""))
        append_campaign(CampaignRecord("fd2", t, ""))
        flags = scan_duplicate_content()
        assert all(f.wallet is None for f in flags)

    def test_all_flags_have_unique_ids(self):
        """Every flag must have a unique ID."""
        for w in ["GW0", "GW1", "GW2"]:
            _wash("id_camp", w, WASH_MIN_OCCURRENCES)

        flags = scan_wash_contributions()
        ids = [f.id for f in flags]
        assert len(ids) == len(set(ids))

    def test_flag_detail_is_non_empty_string(self):
        """All heuristics must provide detail."""
        _wash("detail1", "GBAD", WASH_MIN_OCCURRENCES)
        wash_flags = scan_wash_contributions()
        assert all(isinstance(f.detail, str) and len(f.detail) > 0 for f in wash_flags)

        _spike("detail2", SPIKE_MAX_CONTRIBUTIONS + 1)
        spike_flags = scan_contribution_spikes()
        assert all(isinstance(f.detail, str) and len(f.detail) > 0 for f in spike_flags)

        append_campaign(CampaignRecord("dc1", "Same Title Here", ""))
        append_campaign(CampaignRecord("dc2", "Same Title Here", ""))
        dup_flags = scan_duplicate_content()
        assert all(isinstance(f.detail, str) and len(f.detail) > 0 for f in dup_flags)


# ---------------------------------------------------------------------------
# Risk profiles
# ---------------------------------------------------------------------------

class TestRiskProfiles:
    """Tests for correct risk classification across profiles."""

    def test_low_risk_no_flags(self):
        t = 1_700_000_000.0
        for i in range(10):
            append_contribution(ContributionEvent("clean", f"G{i}", 5_000, t + i * 3600))
        assert scan_wash_contributions() == []
        assert scan_contribution_spikes() == []

    def test_low_risk_dissimilar_titles_no_duplicate_flag(self):
        append_campaign(CampaignRecord("lr1", "Community Garden Project", ""))
        append_campaign(CampaignRecord("lr2", "Open Source Dev Fund", ""))
        assert scan_duplicate_content() == []

    def test_medium_risk_spike_profile(self):
        _spike("med", SPIKE_MAX_CONTRIBUTIONS + 5)
        flags = scan_contribution_spikes()
        assert len(flags) == 1
        assert flags[0].severity == FlagSeverity.MEDIUM

    def test_high_risk_wash_profile(self):
        _wash("hi", "GBAD", WASH_MIN_OCCURRENCES + 2)
        flags = scan_wash_contributions()
        assert len(flags) == 1
        assert flags[0].severity == FlagSeverity.HIGH

    def test_high_risk_detail_contains_cycle_count(self):
        cycles = WASH_MIN_OCCURRENCES + 1
        _wash("hi2", "GBAD2", cycles)
        flags = scan_wash_contributions()
        assert len(flags) == 1
        assert str(cycles) in flags[0].detail


# ---------------------------------------------------------------------------
# Threshold boundaries
# ---------------------------------------------------------------------------

class TestThresholdBoundaries:
    """Tests for exact threshold semantics."""

    def test_wash_exactly_at_threshold_is_flagged(self):
        _wash("wb1", "GB1", WASH_MIN_OCCURRENCES)
        assert len(scan_wash_contributions()) == 1

    def test_wash_one_below_threshold_is_not_flagged(self):
        _wash("wb2", "GB2", WASH_MIN_OCCURRENCES - 1)
        assert scan_wash_contributions() == []

    def test_wash_refund_at_exact_window_edge_is_flagged(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("wb3", "GB3", 1_000, t))
            append_refund(RefundEvent("wb3", "GB3", t + WASH_WINDOW_SECONDS))
        assert len(scan_wash_contributions()) == 1

    def test_wash_refund_just_outside_window_is_not_flagged(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("wb4", "GB4", 1_000, t))
            append_refund(RefundEvent("wb4", "GB4", t + WASH_WINDOW_SECONDS + 1))
        assert scan_wash_contributions() == []

    def test_refund_at_t_plus_zero_is_not_a_wash(self):
        """Refund at exactly the contribution timestamp."""
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("bw6", "G4", 500, t))
            append_refund(RefundEvent("bw6", "G4", t))
        assert scan_wash_contributions() == []

    def test_spike_exactly_at_max_not_flagged(self):
        _spike("sb1", SPIKE_MAX_CONTRIBUTIONS)
        assert scan_contribution_spikes() == []

    def test_spike_one_over_max_is_flagged(self):
        _spike("sb2", SPIKE_MAX_CONTRIBUTIONS + 1)
        assert len(scan_contribution_spikes()) == 1

    def test_spike_spread_past_window_not_flagged(self):
        t = time.time()
        for i in range(SPIKE_MAX_CONTRIBUTIONS + 1):
            append_contribution(
                ContributionEvent("sb3", f"G{i}", 100, t + i * (SPIKE_WINDOW_SECONDS + 10))
            )
        assert scan_contribution_spikes() == []

    def test_jaccard_at_threshold_is_flagged(self):
        # 4 shared / 5 union = 0.80 == DUPLICATE_JACCARD_THRESHOLD
        append_campaign(CampaignRecord("jb1", "alpha beta gamma delta", ""))
        append_campaign(CampaignRecord("jb2", "alpha beta gamma delta epsilon", ""))
        assert len(scan_duplicate_content()) == 1

    def test_jaccard_well_below_threshold_not_flagged(self):
        append_campaign(CampaignRecord("jb3", "clean water access rural areas", ""))
        append_campaign(CampaignRecord("jb4", "support local school renovation project", ""))
        assert scan_duplicate_content() == []


# ---------------------------------------------------------------------------
# Malformed / incomplete input
# ---------------------------------------------------------------------------

class TestMalformedInput:
    """Tests for handling invalid or incomplete data."""

    def test_zero_amount_contribution_no_crash(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("mf1", "GZR", 0, t))
            append_refund(RefundEvent("mf1", "GZR", t + 30))
        scan_wash_contributions()

    def test_empty_title_no_crash(self):
        append_campaign(CampaignRecord("mf2", "", ""))
        append_campaign(CampaignRecord("mf3", "", ""))
        scan_duplicate_content()

    def test_refund_before_contribution_not_flagged(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("mf4", "GBACK", 1_000, t + 100))
            append_refund(RefundEvent("mf4", "GBACK", t))
        assert scan_wash_contributions() == []

    def test_unknown_campaign_spike_no_crash(self):
        append_contribution(ContributionEvent("ghost_camp", "GANON", 500, time.time()))
        scan_contribution_spikes()

    def test_single_contribution_no_refund_not_wash(self):
        append_contribution(ContributionEvent("mf5", "GSOLO", 5_000, time.time()))
        assert scan_wash_contributions() == []

    def test_negative_timestamp_no_crash(self):
        append_contribution(ContributionEvent("mf6", "GNEG", 1_000, -1.0))
        append_refund(RefundEvent("mf6", "GNEG", 3600.0))
        scan_wash_contributions()


# ---------------------------------------------------------------------------
# Missing signals (absent / partial data)
# ---------------------------------------------------------------------------

class TestMissingSignals:
    """Tests for scenarios with absent or incomplete input data."""

    def test_no_contributions_no_wash_flags(self):
        append_refund(RefundEvent("camp1", "GWALLET", 1_700_010_000.0))
        assert scan_wash_contributions() == []

    def test_no_refunds_no_wash_flags(self):
        for i in range(WASH_MIN_OCCURRENCES + 5):
            append_contribution(ContributionEvent("camp2", "GWALLET", 1_000, 1_700_000_000.0 + i))
        assert scan_wash_contributions() == []

    def test_contribution_with_no_matching_campaign_refund(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("camp_A", "GWALLET", 1_000, t))
            append_refund(RefundEvent("camp_B", "GWALLET", t + 30))
        assert scan_wash_contributions() == []

    def test_contribution_with_no_matching_wallet_refund(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("camp3", "GWALLET_A", 1_000, t))
            append_refund(RefundEvent("camp3", "GWALLET_B", t + 30))
        assert scan_wash_contributions() == []

    def test_single_campaign_no_duplicate_flag(self):
        append_campaign(CampaignRecord("solo", "The One Campaign", ""))
        assert scan_duplicate_content() == []

    def test_zero_campaigns_no_duplicate_flag(self):
        assert scan_duplicate_content() == []

    def test_contribution_with_zero_amount_still_counts(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("camp_z", "GZERO", 0, t))
            append_refund(RefundEvent("camp_z", "GZERO", t + 30))
        assert len(scan_wash_contributions()) == 1

    def test_single_contribution_no_spike(self):
        append_contribution(ContributionEvent("solo_spike", "GW1", 100, 1_700_000_000.0))
        assert scan_contribution_spikes() == []

    def test_empty_string_campaign_title_no_crash(self):
        append_campaign(CampaignRecord("e1", "", ""))
        append_campaign(CampaignRecord("e2", "", ""))
        result = scan_duplicate_content()
        assert isinstance(result, list)

    def test_whitespace_only_title_no_crash(self):
        append_campaign(CampaignRecord("ws1", "   ", ""))
        append_campaign(CampaignRecord("ws2", "  \t ", ""))
        scan_duplicate_content()

    def test_no_stores_full_scan_returns_empty(self):
        assert run_full_scan() == []


# ---------------------------------------------------------------------------
# Conflicting signals
# ---------------------------------------------------------------------------

class TestConflictingSignals:
    """Tests where multiple heuristics are triggered or patterns nearly match."""

    def test_wash_and_spike_detected_independently(self):
        _wash("multi_flag", "GWASH", WASH_MIN_OCCURRENCES)
        t = 1_700_900_000.0
        for i in range(SPIKE_MAX_CONTRIBUTIONS + 1):
            append_contribution(ContributionEvent("multi_flag", f"GSPIKE{i}", 100, t + i * 0.1))

        wash_flags = scan_wash_contributions()
        spike_flags = scan_contribution_spikes()

        assert any(f.reason == FlagReason.WASH_CONTRIBUTION for f in wash_flags)
        assert any(f.reason == FlagReason.CONTRIBUTION_SPIKE for f in spike_flags)

    def test_wash_pattern_from_multiple_wallets_on_same_campaign(self):
        wallets = ["GW_BAD1", "GW_BAD2", "GW_BAD3"]
        for w in wallets:
            _wash("multi_wallet_camp", w, WASH_MIN_OCCURRENCES)

        flags = scan_wash_contributions()
        flagged_wallets = {f.wallet for f in flags}
        assert flagged_wallets == set(wallets)

    def test_wash_pattern_on_multiple_campaigns_by_same_wallet(self):
        campaigns = ["camp_X", "camp_Y"]
        for c in campaigns:
            _wash(c, "GBAD_WALLET", WASH_MIN_OCCURRENCES)

        flags = scan_wash_contributions()
        flagged_campaigns = {f.campaign_id for f in flags}
        assert flagged_campaigns == set(campaigns)

    def test_high_volume_legitimate_contributions_not_a_spike_when_spread_out(self):
        t = 1_700_000_000.0
        for i in range(200):
            append_contribution(
                ContributionEvent("legit", f"GW{i}", 100, t + i * (SPIKE_WINDOW_SECONDS + 60))
            )
        assert scan_contribution_spikes() == []

    def test_near_duplicate_titles_just_below_threshold_not_flagged(self):
        append_campaign(CampaignRecord("nd1", "fund the open source commons today", ""))
        append_campaign(CampaignRecord("nd2", "help rebuild urban community commons spaces", ""))
        flags = scan_duplicate_content()
        sim = _jaccard("fund the open source commons today", "help rebuild urban community commons spaces")
        if sim < DUPLICATE_JACCARD_THRESHOLD:
            assert all(f.reason != FlagReason.DUPLICATE_CONTENT for f in flags)

    def test_refund_before_contribution_does_not_count_as_wash(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("backwards", "GBWD", 500, t + 100))
            append_refund(RefundEvent("backwards", "GBWD", t))
        assert scan_wash_contributions() == []

    def test_mixed_legitimate_and_wash_contributions_flags_only_bad_wallet(self):
        t = 1_700_000_000.0
        for i in range(20):
            append_contribution(ContributionEvent("mixed_camp", f"GLEGIT{i}", 5_000, t + i * 3600))
        _wash("mixed_camp", "GBAD_ONLY", WASH_MIN_OCCURRENCES)

        flags = scan_wash_contributions()
        assert len(flags) == 1
        assert flags[0].wallet == "GBAD_ONLY"

    def test_duplicate_content_scan_three_similar_campaigns_flags_all_pairs(self):
        title = "Save the Local River"
        for k in range(3):
            append_campaign(CampaignRecord(f"triple_{k}", title, ""))

        flags = scan_duplicate_content()
        assert len([f for f in flags if f.reason == FlagReason.DUPLICATE_CONTENT]) == 3

    def test_single_spike_window_straddled_by_two_campaigns_flags_both(self):
        t = 1_700_000_000.0
        for i in range(SPIKE_MAX_CONTRIBUTIONS + 1):
            append_contribution(ContributionEvent("spike_A", f"GWA{i}", 100, t + i * 0.1))
            append_contribution(ContributionEvent("spike_B", f"GWB{i}", 100, t + i * 0.1))

        flags = scan_contribution_spikes()
        flagged_campaigns = {f.campaign_id for f in flags}
        assert "spike_A" in flagged_campaigns
        assert "spike_B" in flagged_campaigns

    def test_wash_flag_detail_contains_threshold_reference(self):
        _wash("detail_camp", "GDETAIL", WASH_MIN_OCCURRENCES)
        flags = scan_wash_contributions()
        assert len(flags) == 1
        detail = flags[0].detail.lower()
        assert any(token in detail for token in [
            str(WASH_MIN_OCCURRENCES),
            str(WASH_WINDOW_SECONDS),
            "wash",
        ])

    def test_spike_flag_detail_contains_count_and_threshold(self):
        _spike("detail_spike", SPIKE_MAX_CONTRIBUTIONS + 5)
        flags = scan_contribution_spikes()
        assert len(flags) == 1
        detail = flags[0].detail
        assert str(SPIKE_MAX_CONTRIBUTIONS) in detail

    def test_duplicate_flag_detail_contains_similarity_score(self):
        title = "Open Source Fund Initiative"
        append_campaign(CampaignRecord("dup_d1", title, ""))
        append_campaign(CampaignRecord("dup_d2", title, ""))
        flags = scan_duplicate_content()
        assert len(flags) == 1
        assert "1.00" in flags[0].detail or "1.0" in flags[0].detail


# ---------------------------------------------------------------------------
# Jaccard helper edge cases
# ---------------------------------------------------------------------------

class TestJaccardEdgeCases:
    """Direct tests for the _jaccard() helper's edge cases."""

    def test_identical_strings_return_one(self):
        assert _jaccard("hello world", "hello world") == 1.0

    def test_disjoint_strings_return_zero(self):
        assert _jaccard("alpha beta", "gamma delta") == 0.0

    def test_empty_strings_return_one(self):
        """Both empty → special case returns 1.0."""
        assert _jaccard("", "") == 1.0

    def test_one_empty_string_returns_zero(self):
        assert _jaccard("", "hello world") == 0.0
        assert _jaccard("hello world", "") == 0.0

    def test_case_insensitive_comparison(self):
        """Jaccard is case-insensitive."""
        assert _jaccard("HELLO WORLD", "hello world") == 1.0

    def test_partial_overlap(self):
        """2 shared / 3 union = 2/3."""
        result = _jaccard("alpha beta", "alpha gamma")
        assert abs(result - (1 / 3)) < 1e-9

    def test_subset_relationship(self):
        """'alpha' is a subset of 'alpha beta gamma'."""
        result = _jaccard("alpha", "alpha beta gamma")
        assert abs(result - (1 / 3)) < 1e-9


# ---------------------------------------------------------------------------
# Rate-limiting edge cases
# ---------------------------------------------------------------------------

class TestDuplicateScanRateLimiting:
    """Verify DUPLICATE_SCAN_MIN_INTERVAL_SECONDS gate in run_full_scan."""

    def test_second_run_within_interval_skips_duplicate_scan(self):
        append_campaign(CampaignRecord("rl1", "Identical Title", ""))
        append_campaign(CampaignRecord("rl2", "Identical Title", ""))

        first_flags = run_full_scan()
        before = scoring._last_duplicate_scan_at

        second_flags = run_full_scan()
        after = scoring._last_duplicate_scan_at

        assert after == before
        assert not any(f.reason == FlagReason.DUPLICATE_CONTENT for f in second_flags)

    def test_force_duplicate_scan_bypasses_rate_limit(self):
        append_campaign(CampaignRecord("bp1", "Identical Title", ""))
        append_campaign(CampaignRecord("bp2", "Identical Title", ""))

        run_full_scan()
        flags = run_full_scan(force_duplicate_scan=True)
        assert any(f.reason == FlagReason.DUPLICATE_CONTENT for f in flags)

    def test_run_after_interval_reruns_duplicate_scan(self):
        append_campaign(CampaignRecord("iv1", "Identical Title", ""))
        append_campaign(CampaignRecord("iv2", "Identical Title", ""))

        run_full_scan()
        scoring._last_duplicate_scan_at -= (DUPLICATE_SCAN_MIN_INTERVAL_SECONDS + 1)

        flags = run_full_scan()
        assert any(f.reason == FlagReason.DUPLICATE_CONTENT for f in flags)


# ---------------------------------------------------------------------------
# Full-scan integration
# ---------------------------------------------------------------------------

class TestFullScanIntegration:
    """Tests for run_full_scan integration."""

    def test_all_three_risk_tiers_detected(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("fs_w", "GWASH", 1_000, t))
            append_refund(RefundEvent("fs_w", "GWASH", t + 60))
        _spike("fs_s", SPIKE_MAX_CONTRIBUTIONS + 1)
        append_campaign(CampaignRecord("fs_d1", "Identical Campaign Title Here", ""))
        append_campaign(CampaignRecord("fs_d2", "Identical Campaign Title Here", ""))

        flags = run_full_scan()
        severities = {f.severity for f in flags}
        assert FlagSeverity.HIGH in severities
        assert FlagSeverity.MEDIUM in severities
        assert FlagSeverity.LOW in severities

    def test_flags_appended_to_queue(self):
        gap = WASH_WINDOW_SECONDS * 3
        for i in range(WASH_MIN_OCCURRENCES):
            t = 1_700_000_000.0 + i * gap
            append_contribution(ContributionEvent("fs_q", "GQW", 1_000, t))
            append_refund(RefundEvent("fs_q", "GQW", t + 60))
        flags = run_full_scan()
        queue_ids = {f.id for f in get_flags()}
        for flag in flags:
            assert flag.id in queue_ids

    def test_clean_activity_no_flags(self):
        t = 1_700_000_000.0
        for i in range(5):
            append_contribution(ContributionEvent("fs_c", f"GC{i}", 2_000, t + i * 7200))
        assert run_full_scan() == []

    def test_empty_stores_no_flags(self):
        assert run_full_scan() == []

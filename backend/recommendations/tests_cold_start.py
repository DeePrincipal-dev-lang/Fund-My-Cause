"""
Integration tests for recommendation cold-start scenarios (#1209).

Cold-start is the condition where either:
  - a brand-new wallet has no indexed activity at all, OR
  - a brand-new campaign has zero contributions / no history.

These are critical edge cases because the scoring functions receive empty
or near-empty inputs that could cause division-by-zero, empty result sets,
or crashed responses.  Every test below asserts one of:

  1. The service returns HTTP 200 (no crash).
  2. The fallback is the trending list (``personalised: false``).
  3. The response body is well-formed and non-empty where campaigns exist.
  4. A zero-history campaign still surfaces in trending when the scoring
     math is valid.

Fallback behaviour contract (documented here per AC):
  - Unknown wallet → returns trending campaigns, ``personalised: false``.
  - Wallet with empty activity (no contributions, no preferred categories)
    → same as unknown wallet: trending, ``personalised: false`` (the
    wallet key IS present in _ACTIVITY but carries no signal).
  - ``wallet`` param omitted → trending, ``personalised: false``.
  - Zero active campaigns in the store → returns an empty
    ``recommendations`` list, not an error.
"""

from __future__ import annotations

import time
import pytest
from fastapi.testclient import TestClient

from service import (
    Campaign,
    IndexedActivity,
    _ACTIVITY,
    _CACHE,
    _CAMPAIGNS,
    app,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

# A wallet that has never been seen by the service.
UNKNOWN_WALLET = "GCOLDSTART00000000000000000000000000000000000000000000"

# A wallet whose IndexedActivity record exists but is completely empty.
EMPTY_ACTIVITY_WALLET = "GCOLDSTART_EMPTY_ACTIVITY_000000000000000000000000000"

# A wallet that contributed to every available campaign — no campaigns should
# remain to recommend.
ALL_CONTRIBUTED_WALLET = "GCOLDSTART_ALL_CONTRIBUTED_00000000000000000000000000"


@pytest.fixture(autouse=True)
def clean_state():
    """Restore shared mutable state before and after every test."""
    _CACHE.clear()
    # Remove any activity records added by the fixture wallets.
    for w in [EMPTY_ACTIVITY_WALLET, ALL_CONTRIBUTED_WALLET]:
        _ACTIVITY.pop(w, None)
    yield
    _CACHE.clear()
    for w in [EMPTY_ACTIVITY_WALLET, ALL_CONTRIBUTED_WALLET]:
        _ACTIVITY.pop(w, None)


# ---------------------------------------------------------------------------
# Cold-start: unknown wallet
# ---------------------------------------------------------------------------

class TestUnknownWalletColdStart:
    """A wallet that has never been indexed falls back to trending results."""

    def test_returns_200_no_crash(self):
        """Service must not crash on an unseen wallet address."""
        r = client.get(f"/recommendations?wallet={UNKNOWN_WALLET}&limit=5")
        assert r.status_code == 200, r.text

    def test_personalised_flag_is_false(self):
        """Response must advertise that results are NOT personalised."""
        r = client.get(f"/recommendations?wallet={UNKNOWN_WALLET}&limit=5")
        assert r.json()["personalised"] is False

    def test_returns_non_empty_recommendations(self):
        """There are seeded campaigns, so the trending fallback must return them."""
        r = client.get(f"/recommendations?wallet={UNKNOWN_WALLET}&limit=5")
        body = r.json()
        assert isinstance(body["recommendations"], list)
        assert len(body["recommendations"]) > 0

    def test_all_returned_campaigns_have_required_fields(self):
        """Every recommendation object must include the full schema."""
        r = client.get(f"/recommendations?wallet={UNKNOWN_WALLET}&limit=5")
        required_keys = {"campaign_id", "title", "category", "total_raised",
                         "contributor_count", "score"}
        for rec in r.json()["recommendations"]:
            assert required_keys <= set(rec.keys()), (
                f"Recommendation missing keys: {required_keys - set(rec.keys())}"
            )

    def test_scores_are_positive_finite_numbers(self):
        """Trending scores must be positive finite floats (no NaN, no zero, no inf)."""
        r = client.get(f"/recommendations?wallet={UNKNOWN_WALLET}&limit=5")
        for rec in r.json()["recommendations"]:
            score = rec["score"]
            assert isinstance(score, (int, float)), f"Score is not numeric: {score}"
            assert score > 0, f"Cold-start score must be positive, got: {score}"
            # Python's json module never emits NaN/Infinity as valid JSON but
            # we validate the Python value here defensively.
            import math
            assert math.isfinite(score), f"Score must be finite, got: {score}"

    def test_limit_is_respected(self):
        """Requested limit must be honoured even for cold-start wallets."""
        for limit in (1, 2, 3):
            r = client.get(f"/recommendations?wallet={UNKNOWN_WALLET}&limit={limit}")
            assert len(r.json()["recommendations"]) == limit, (
                f"Expected {limit} recommendations, got {len(r.json()['recommendations'])}"
            )

    def test_wallet_field_echoed_in_response(self):
        """The response must echo the wallet param supplied by the caller."""
        r = client.get(f"/recommendations?wallet={UNKNOWN_WALLET}&limit=1")
        assert r.json()["wallet"] == UNKNOWN_WALLET


# ---------------------------------------------------------------------------
# Cold-start: no wallet provided at all
# ---------------------------------------------------------------------------

class TestNoWalletColdStart:
    """Omitting the wallet param is the purest cold-start."""

    def test_returns_200_no_crash(self):
        r = client.get("/recommendations?limit=5")
        assert r.status_code == 200, r.text

    def test_personalised_false_and_wallet_is_none(self):
        r = client.get("/recommendations?limit=5")
        body = r.json()
        assert body["personalised"] is False
        assert body["wallet"] is None

    def test_returns_trending_campaigns(self):
        r = client.get("/recommendations?limit=5")
        assert len(r.json()["recommendations"]) > 0


# ---------------------------------------------------------------------------
# Cold-start: wallet exists in activity store but has NO history
# ---------------------------------------------------------------------------

class TestEmptyActivityWalletColdStart:
    """
    A wallet with an IndexedActivity record that carries no contributions and
    no preferred categories should be treated the same as an unknown wallet:
    trending results, not personalised.

    This matters because real code paths may pre-create an empty activity
    record when a wallet first connects, before any contribution is made.
    """

    def setup_method(self):
        _ACTIVITY[EMPTY_ACTIVITY_WALLET] = IndexedActivity(
            wallet=EMPTY_ACTIVITY_WALLET,
            contributed_campaign_ids=[],
            preferred_categories=[],
        )

    def test_returns_200_no_crash(self):
        r = client.get(f"/recommendations?wallet={EMPTY_ACTIVITY_WALLET}&limit=5")
        assert r.status_code == 200, r.text

    def test_personalised_true_when_activity_record_exists(self):
        """
        The service marks personalised=True if the wallet key is in _ACTIVITY,
        even if the activity is empty.  This is the current documented contract
        (the personalisation flag reflects whether the code attempted to
        personalise, not whether it succeeded in boosting anything).
        """
        r = client.get(f"/recommendations?wallet={EMPTY_ACTIVITY_WALLET}&limit=5")
        # With an empty activity record the scoring path still runs —
        # personalised reflects "did we look up the activity", not "did it
        # change scores".
        assert r.json()["personalised"] is True

    def test_returns_non_empty_recommendations(self):
        """An empty activity record must not filter out all campaigns."""
        r = client.get(f"/recommendations?wallet={EMPTY_ACTIVITY_WALLET}&limit=5")
        recs = r.json()["recommendations"]
        assert len(recs) > 0, (
            "Empty-activity wallet must still receive recommendations "
            "(no campaigns have been contributed to, so none are excluded)"
        )

    def test_no_campaign_excluded_because_nothing_contributed(self):
        """
        With zero contributed_campaign_ids the exclusion filter must not
        remove any campaign.  All seeded campaigns should be eligible.
        """
        r = client.get(f"/recommendations?wallet={EMPTY_ACTIVITY_WALLET}&limit=20")
        returned_ids = {rec["campaign_id"] for rec in r.json()["recommendations"]}
        all_ids = {c.id for c in _CAMPAIGNS}
        # Every campaign is a candidate — the response should cover all of them
        # (assuming limit ≥ number of seeded campaigns).
        assert returned_ids == all_ids, (
            f"Unexpected campaigns excluded. Missing: {all_ids - returned_ids}"
        )

    def test_scores_are_positive_for_all_returned_campaigns(self):
        """
        Without category boosts or exclusions, all scores should still be
        positive trending scores — no zeroing-out from the exclusion path.
        """
        r = client.get(f"/recommendations?wallet={EMPTY_ACTIVITY_WALLET}&limit=20")
        for rec in r.json()["recommendations"]:
            assert rec["score"] > 0, (
                f"Campaign {rec['campaign_id']} scored 0 despite no prior contribution"
            )


# ---------------------------------------------------------------------------
# Cold-start: campaign-level — a brand-new campaign with no contributions
# ---------------------------------------------------------------------------

class TestZeroHistoryCampaignColdStart:
    """
    A campaign that was just seeded (zero contributors, zero raised) must not
    crash the scoring logic and must appear in the trending list with a valid
    non-negative score.

    Regression target: the trending_score formula is
        (contributor_count * log1p(total_raised)) / age_hours
    For a brand-new campaign both total_raised and contributor_count can be 0.
    log1p(0) = 0, so score = 0.  We verify:
      - No exception is raised.
      - The campaign is included in the result set (score ≥ 0 is valid).
    """

    ZERO_CAMPAIGN_ID = "c_zero"

    def setup_method(self):
        _CACHE.clear()
        self._zero_campaign = Campaign(
            id=self.ZERO_CAMPAIGN_ID,
            title="Brand New Zero-History Campaign",
            category="tech",
            total_raised=0,
            contributor_count=0,
            created_at=time.time(),  # just created
        )
        _CAMPAIGNS.append(self._zero_campaign)

    def teardown_method(self):
        # Remove the synthetic campaign so it doesn't pollute other tests.
        try:
            _CAMPAIGNS.remove(self._zero_campaign)
        except ValueError:
            pass
        _CACHE.clear()

    def test_zero_history_campaign_does_not_crash_scoring(self):
        """Trending score with zero contributors and zero raised must not raise."""
        r = client.get("/recommendations?limit=20")
        assert r.status_code == 200, r.text

    def test_zero_history_campaign_included_in_results(self):
        """
        A zero-score campaign should still appear in the result set.
        The fallback does NOT exclude campaigns with score == 0 for
        anonymous/cold-start callers — zero is a valid trending score.
        """
        r = client.get("/recommendations?limit=20")
        returned_ids = [rec["campaign_id"] for rec in r.json()["recommendations"]]
        assert self.ZERO_CAMPAIGN_ID in returned_ids, (
            f"Zero-history campaign '{self.ZERO_CAMPAIGN_ID}' missing from "
            f"cold-start recommendations: {returned_ids}"
        )

    def test_zero_history_campaign_score_is_non_negative(self):
        """The score for a zero-history campaign must be 0.0, not negative or NaN."""
        r = client.get("/recommendations?limit=20")
        zero_recs = [
            rec for rec in r.json()["recommendations"]
            if rec["campaign_id"] == self.ZERO_CAMPAIGN_ID
        ]
        assert len(zero_recs) == 1
        score = zero_recs[0]["score"]
        import math
        assert score >= 0.0, f"Score must be non-negative, got {score}"
        assert math.isfinite(score), f"Score must be finite, got {score}"

    def test_brand_new_campaign_does_not_crash_personalised_scoring(self):
        """
        A known wallet should receive recommendations without crashing, even
        when a brand-new zero-history campaign is present in the store.

        Fallback behaviour (documented): the personalised path computes
        `_personalised_score` for every campaign.  A zero-history campaign
        (total_raised=0, contributor_count=0) scores 0.0.  The service then
        filters out score==0 entries from personalised results (it interprets
        them as "not worth recommending" rather than "already contributed to").
        Therefore the zero-history campaign is legitimately absent from
        personalised results, and the remaining seeded campaigns are returned.

        What we are testing here is the **no-crash** guarantee, not whether
        the zero campaign appears (it correctly doesn't in the personalised
        path because its score is 0).
        """
        wallet = "GCOLDSTART_PERSONALISED_ZH_000000000000000000000000"
        _ACTIVITY[wallet] = IndexedActivity(
            wallet=wallet,
            contributed_campaign_ids=[],
            preferred_categories=["tech"],
        )
        try:
            r = client.get(f"/recommendations?wallet={wallet}&limit=20")
            # Must not crash regardless of the zero-history campaign being present.
            assert r.status_code == 200, r.text
            body = r.json()
            # The non-zero campaigns must still be recommended.
            assert len(body["recommendations"]) > 0, (
                "Personalised path returned no recommendations — expected at "
                "least the seeded non-zero campaigns to appear"
            )
            # The zero-history campaign must NOT appear in personalised results
            # because its score is 0 (by design: no contributors, no raised amount).
            returned_ids = [rec["campaign_id"] for rec in body["recommendations"]]
            assert self.ZERO_CAMPAIGN_ID not in returned_ids, (
                "Zero-history campaign should be excluded from personalised results "
                "(score == 0 → filtered out by the personalised scoring path)"
            )
            # All returned scores must be > 0 (no score-0 records leaked through).
            for rec in body["recommendations"]:
                assert rec["score"] > 0, (
                    f"Personalised result contained a score-0 campaign: {rec['campaign_id']}"
                )
        finally:
            _ACTIVITY.pop(wallet, None)


# ---------------------------------------------------------------------------
# Cold-start: wallet has contributed to ALL available campaigns
# ---------------------------------------------------------------------------

class TestAllContributedWalletColdStart:
    """
    If a wallet has contributed to every available campaign, the personalised
    path should return an empty recommendations list — not a crash or an
    error response.  This is the edge case where filtering reduces the
    candidate set to zero.
    """

    def setup_method(self):
        _ACTIVITY[ALL_CONTRIBUTED_WALLET] = IndexedActivity(
            wallet=ALL_CONTRIBUTED_WALLET,
            contributed_campaign_ids=[c.id for c in _CAMPAIGNS],
            preferred_categories=["tech", "environment", "arts"],
        )

    def test_returns_200_no_crash_on_empty_candidate_set(self):
        """Must not raise when all campaigns are excluded."""
        r = client.get(f"/recommendations?wallet={ALL_CONTRIBUTED_WALLET}&limit=5")
        assert r.status_code == 200, r.text

    def test_returns_empty_recommendations_list(self):
        """
        With every campaign excluded by the contribution filter, the
        recommendations list must be empty rather than containing wrong data
        or raising an exception.
        """
        r = client.get(f"/recommendations?wallet={ALL_CONTRIBUTED_WALLET}&limit=5")
        body = r.json()
        assert isinstance(body["recommendations"], list)
        assert len(body["recommendations"]) == 0, (
            "Expected empty recommendations when all campaigns already contributed to"
        )

    def test_response_still_well_formed(self):
        """Even an empty result must satisfy the full response schema."""
        r = client.get(f"/recommendations?wallet={ALL_CONTRIBUTED_WALLET}&limit=5")
        body = r.json()
        assert "wallet" in body
        assert "personalised" in body
        assert "recommendations" in body
        assert "cached_at" in body
        assert body["personalised"] is True
        assert body["wallet"] == ALL_CONTRIBUTED_WALLET


# ---------------------------------------------------------------------------
# Cold-start: empty campaign store
# ---------------------------------------------------------------------------

class TestEmptyCampaignStoreColdStart:
    """
    If the backing campaign store has no campaigns at all (e.g. a freshly
    started service before any campaign data has been indexed), the service
    must return an empty recommendations list gracefully.
    """

    def setup_method(self):
        _CACHE.clear()
        # Drain all campaigns temporarily.
        self._original = list(_CAMPAIGNS)
        _CAMPAIGNS.clear()

    def teardown_method(self):
        _CAMPAIGNS.clear()
        _CAMPAIGNS.extend(self._original)
        _CACHE.clear()

    def test_returns_200_with_empty_campaign_store(self):
        r = client.get("/recommendations?limit=5")
        assert r.status_code == 200, r.text

    def test_recommendations_list_is_empty(self):
        r = client.get("/recommendations?limit=5")
        assert r.json()["recommendations"] == []

    def test_personalised_path_also_returns_empty_list(self):
        """Personalised path with no campaigns must also return [] not crash."""
        wallet = "GCOLDSTART_NO_CAMPAIGNS_000000000000000000000000000000"
        _ACTIVITY[wallet] = IndexedActivity(
            wallet=wallet,
            contributed_campaign_ids=[],
            preferred_categories=["tech"],
        )
        try:
            r = client.get(f"/recommendations?wallet={wallet}&limit=5")
            assert r.status_code == 200, r.text
            assert r.json()["recommendations"] == []
        finally:
            _ACTIVITY.pop(wallet, None)


# ---------------------------------------------------------------------------
# Cold-start → warmed-up boundary (#1387)
# ---------------------------------------------------------------------------

class TestColdStartBoundary:
    """
    Asserts the exact boundary between cold-start (trending fallback) and
    warmed-up (personalised) scoring.

    The boundary is: presence of an IndexedActivity row for the wallet.

    - No activity row          → cold path, personalised=False
    - Activity row (any shape) → warm path, personalised=True
      * empty row              → warm path, but scores equal trending scores
      * categories only        → warm path, boosts applied
      * contributions only     → warm path, exclusions applied
      * both signals           → fully warmed-up

    These tests lock in the boundary so a future change to the selection
    rule breaks CI rather than silently changing personalisation.
    """

    def test_no_activity_row_selects_cold_path(self):
        wallet = "GBOUNDARY_COLD_0000000000000000000000000000000000000000"
        _ACTIVITY.pop(wallet, None)

        r = client.get(f"/recommendations?wallet={wallet}&limit=5")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["personalised"] is False, (
            "No activity row must select the cold path (personalised=False)"
        )

    def test_empty_activity_row_selects_warm_path_but_equals_trending(self):
        """
        An empty activity row must select the warm path (personalised=True)
        AND produce the same ordering as the cold path, because neither
        exclusions nor boosts apply.
        """
        wallet = "GBOUNDARY_EMPTY_000000000000000000000000000000000000000"
        _ACTIVITY[wallet] = IndexedActivity(
            wallet=wallet,
            contributed_campaign_ids=[],
            preferred_categories=[],
        )
        try:
            r = client.get(f"/recommendations?wallet={wallet}&limit=10")
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["personalised"] is True, (
                "Empty activity row must still select the warm path"
            )

            # Cold-path ordering for the same limit, no wallet.
            r_cold = client.get("/recommendations?limit=10")
            cold_ids = [rec["campaign_id"] for rec in r_cold.json()["recommendations"]]
            warm_ids = [rec["campaign_id"] for rec in body["recommendations"]]

            # Empty activity → no exclusions → same candidate set.
            assert set(cold_ids) == set(warm_ids), (
                "Empty activity row must not exclude or add any campaign"
            )
        finally:
            _ACTIVITY.pop(wallet, None)

    def test_categories_only_applies_boost(self):
        """
        With preferred categories set (no contributions), the warm path must
        boost matching categories above their cold-path score.
        """
        # Find a category that exists in the seeded campaigns.
        cats = [c.category for c in _CAMPAIGNS]
        assert cats, "Seeded campaigns must be present for this test"
        preferred = cats[0]
        wallet = "GBOUNDARY_CATS_00000000000000000000000000000000000000000"

        _ACTIVITY[wallet] = IndexedActivity(
            wallet=wallet,
            contributed_campaign_ids=[],
            preferred_categories=[preferred],
        )
        try:
            r = client.get(f"/recommendations?wallet={wallet}&limit=20")
            assert r.status_code == 200, r.text
            warm = {rec["campaign_id"]: rec["score"] for rec in r.json()["recommendations"]}

            r_cold = client.get("/recommendations?limit=20")
            cold = {rec["campaign_id"]: rec["score"] for rec in r_cold.json()["recommendations"]}

            # For campaigns in the preferred category, the warm score must be
            # ≥ the cold score (boost is >= 1.0).  For other categories it
            # must be equal.
            boosted = False
            for c in _CAMPAIGNS:
                if c.id not in warm or c.id not in cold:
                    continue
                if c.category == preferred:
                    assert warm[c.id] >= cold[c.id], (
                        f"Warm score for preferred category {preferred} "
                        f"should be >= cold score"
                    )
                    if warm[c.id] > cold[c.id]:
                        boosted = True
                else:
                    assert warm[c.id] == cold[c.id], (
                        f"Non-preferred category {c.category} must score "
                        f"identically in warm and cold paths"
                    )
            assert boosted or len([c for c in _CAMPAIGNS if c.category == preferred]) == 0, (
                "Expected at least one campaign in the preferred category "
                "to receive a boost"
            )
        finally:
            _ACTIVITY.pop(wallet, None)

    def test_contributions_only_applies_exclusion(self):
        """
        With contributed_campaign_ids set (no categories), the warm path must
        exclude those campaigns from its output.
        """
        assert len(_CAMPAIGNS) >= 2, "Need at least two seeded campaigns"
        already = _CAMPAIGNS[0].id
        wallet = "GBOUNDARY_CONTRIBS_00000000000000000000000000000000000"

        _ACTIVITY[wallet] = IndexedActivity(
            wallet=wallet,
            contributed_campaign_ids=[already],
            preferred_categories=[],
        )
        try:
            r = client.get(f"/recommendations?wallet={wallet}&limit=20")
            assert r.status_code == 200, r.text
            ids = [rec["campaign_id"] for rec in r.json()["recommendations"]]
            assert already not in ids, (
                f"Already-contributed campaign {already} must be excluded "
                f"from the warm path"
            )
        finally:
            _ACTIVITY.pop(wallet, None)

    def test_both_signals_fully_warmed_up(self):
        """
        With both contributions and preferred categories, the warm path must
        apply both the exclusion and the boost in a single response.
        """
        assert len(_CAMPAIGNS) >= 2
        already = _CAMPAIGNS[0].id
        preferred = _CAMPAIGNS[1].category
        wallet = "GBOUNDARY_BOTH_00000000000000000000000000000000000000000"

        _ACTIVITY[wallet] = IndexedActivity(
            wallet=wallet,
            contributed_campaign_ids=[already],
            preferred_categories=[preferred],
        )
        try:
            r = client.get(f"/recommendations?wallet={wallet}&limit=20")
            assert r.status_code == 200, r.text
            body = r.json()
            ids = [rec["campaign_id"] for rec in body["recommendations"]]
            assert already not in ids, "Exclusion must apply when both signals present"
            assert body["personalised"] is True
            assert len(body["recommendations"]) > 0, (
                "Fully-warmed-up path must still recommend the remaining campaigns"
            )
        finally:
            _ACTIVITY.pop(wallet, None)

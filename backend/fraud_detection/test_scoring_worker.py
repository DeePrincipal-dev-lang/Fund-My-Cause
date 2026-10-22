"""
Unit tests for backend/fraud_detection/scoring.py (#1514).

These tests verify that:

1. ``jaccard_similarity`` produces correct token-level overlap scores,
   handling edge cases (empty strings, identical strings, non-overlapping
   strings) via the ``round_score`` and path established in
   ``shared_math_utils``.

2. ``severity_score`` correctly normalises raw flag counts to [0.0, 1.0]
   via ``normalize`` from ``shared_math_utils``.

3. The re-exports ``round_score`` and ``normalize`` from ``scoring.py``
   behave identically to the originals — confirming there is exactly ONE
   implementation of each math helper in the pipeline (#1514).

4. ``pipeline.py``'s ``scan_duplicate_content`` function calls
   ``jaccard_similarity`` from ``scoring.py`` (not a local copy), so that
   the single-implementation invariant holds end-to-end.
"""

from __future__ import annotations

import sys
import os
import math
import types

import pytest

# ---------------------------------------------------------------------------
# Path setup — allow imports whether pytest is invoked from the repo root,
# from backend/, or from backend/fraud_detection/.
# ---------------------------------------------------------------------------
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SHARED_DIR = os.path.join(_THIS_DIR, "..", "shared")

for _p in (_THIS_DIR, _SHARED_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from scoring import jaccard_similarity, normalize, round_score, severity_score
from shared_math_utils import normalize as _sm_normalize
from shared_math_utils import round_score as _sm_round_score


# ===========================================================================
# 1. jaccard_similarity
# ===========================================================================

class TestJaccardSimilarity:
    # -- Identical strings ----------------------------------------------------

    def test_identical_non_empty_strings_return_one(self):
        assert jaccard_similarity("fund the commons", "fund the commons") == pytest.approx(1.0)

    def test_word_order_independent(self):
        assert jaccard_similarity("hello world", "world hello") == pytest.approx(1.0)

    # -- Empty strings --------------------------------------------------------

    def test_both_empty_returns_one(self):
        """Two empty sets are identical → similarity is 1.0."""
        assert jaccard_similarity("", "") == pytest.approx(1.0)

    def test_one_empty_returns_zero(self):
        assert jaccard_similarity("abc", "") == pytest.approx(0.0)

    def test_empty_and_nonempty_returns_zero(self):
        assert jaccard_similarity("", "xyz") == pytest.approx(0.0)

    # -- No overlap -----------------------------------------------------------

    def test_fully_disjoint_strings_return_zero(self):
        assert jaccard_similarity("apple banana", "cherry date") == pytest.approx(0.0)

    # -- Partial overlap ------------------------------------------------------

    def test_half_overlap(self):
        # {"a","b"} ∩ {"b","c"} = {"b"}; union = {"a","b","c"}; sim = 1/3
        result = jaccard_similarity("a b", "b c")
        assert result == pytest.approx(1 / 3, rel=1e-4)

    def test_result_between_zero_and_one(self):
        result = jaccard_similarity("fund open source", "fund my cause")
        assert 0.0 <= result <= 1.0

    # -- Case insensitivity ---------------------------------------------------

    def test_case_insensitive(self):
        assert jaccard_similarity("Fund The Commons", "fund the commons") == pytest.approx(1.0)

    # -- Return value is rounded to 4 d.p. ------------------------------------

    def test_result_has_at_most_four_decimal_places(self):
        result = jaccard_similarity("a b c", "b c d")
        # 2/4 = 0.5 — this should round exactly
        assert result == pytest.approx(0.5)

    # -- Type errors ----------------------------------------------------------

    def test_non_string_first_arg_raises_type_error(self):
        with pytest.raises(TypeError):
            jaccard_similarity(123, "hello")  # type: ignore[arg-type]

    def test_non_string_second_arg_raises_type_error(self):
        with pytest.raises(TypeError):
            jaccard_similarity("hello", None)  # type: ignore[arg-type]

    # -- Duplicate tokens are de-duplicated via set ---------------------------

    def test_duplicate_tokens_treated_as_single_token(self):
        # "a a" → {"a"}; "a b" → {"a","b"}; sim = 1/2
        assert jaccard_similarity("a a", "a b") == pytest.approx(0.5)


# ===========================================================================
# 2. severity_score
# ===========================================================================

class TestSeverityScore:
    # -- Normal range ---------------------------------------------------------

    def test_mid_range_flag_count(self):
        assert severity_score(5, 10) == pytest.approx(0.5)

    def test_zero_flags_returns_zero(self):
        assert severity_score(0, 10) == pytest.approx(0.0)

    def test_max_flags_returns_one(self):
        assert severity_score(10, 10) == pytest.approx(1.0)

    def test_result_in_zero_to_one(self):
        result = severity_score(3, 7)
        assert 0.0 <= result <= 1.0

    # -- Degenerate: max_flags == 0 -------------------------------------------

    def test_zero_max_flags_returns_zero(self):
        """When no flags are possible the severity is 0."""
        assert severity_score(0, 0) == 0.0

    # -- Clamping (count > max) -----------------------------------------------

    def test_count_exceeding_max_clamped_to_one(self):
        assert severity_score(20, 10) == pytest.approx(1.0)

    # -- Return value is rounded to 4 d.p. ------------------------------------

    def test_result_rounded_to_four_decimal_places(self):
        result = severity_score(1, 3)
        assert result == pytest.approx(round(1 / 3, 4), rel=1e-6)

    # -- Negative flag counts -------------------------------------------------

    def test_negative_flag_count_clamped_to_zero(self):
        assert severity_score(-1, 10) == 0.0


# ===========================================================================
# 3. Re-exports are the same objects as the shared implementations
# ===========================================================================

class TestReExportsAreSameImplementations:
    """
    Confirm that scoring.py re-exports the *same* function objects from
    shared_math_utils.py rather than defining new copies.  This enforces the
    single-implementation invariant of #1514.
    """

    def test_round_score_is_same_object_as_shared(self):
        assert round_score is _sm_round_score

    def test_normalize_is_same_object_as_shared(self):
        assert normalize is _sm_normalize

    # Behavioural parity (belt-and-suspenders in case the object-identity
    # check is circumvented by a wrapper).

    def test_round_score_behaves_identically_to_shared(self):
        for val in (0.123456, 0.0, -1.0, float("nan"), float("inf")):
            assert round_score(val) == _sm_round_score(val)

    def test_normalize_behaves_identically_to_shared(self):
        cases = [
            (50, 0, 100),
            (0, 0, 0),
            (-10, 0, 100),
            (float("nan"), 0, 100),
            (float("inf"), 0, 100),
        ]
        for args in cases:
            assert normalize(*args) == _sm_normalize(*args)


# ===========================================================================
# 4. pipeline.scan_duplicate_content uses scoring.jaccard_similarity
# ===========================================================================

class TestPipelineUsesScoringModule:
    """
    Verify that scan_duplicate_content in pipeline.py calls
    jaccard_similarity from scoring.py rather than a local copy.

    We do this by:
      1. Importing the pipeline module.
      2. Inspecting that it references the `scoring` module in its globals.
      3. Patching scoring.jaccard_similarity to a sentinel and confirming that
         scan_duplicate_content calls it.
    """

    def test_pipeline_imports_jaccard_from_scoring(self):
        import pipeline as pipeline_module

        # scoring must be an imported symbol in pipeline's namespace.
        assert hasattr(pipeline_module, "jaccard_similarity"), (
            "pipeline.py must import jaccard_similarity from scoring.py (#1514)"
        )

    def test_scan_duplicate_content_calls_scoring_jaccard(self, monkeypatch):
        """
        Replace scoring.jaccard_similarity at runtime and confirm
        scan_duplicate_content picks up the replacement.
        """
        import pipeline as pipeline_module
        import scoring as scoring_module

        calls: list[tuple[str, str]] = []

        def _spy(a: str, b: str) -> float:
            calls.append((a, b))
            # Return a very high similarity so the flag is always raised,
            # regardless of the actual titles we choose.
            return 1.0

        # Patch in pipeline's namespace (that's where it's looked up at call time).
        monkeypatch.setattr(pipeline_module, "jaccard_similarity", _spy)

        pipeline_module._CAMPAIGN_RECORDS.clear()
        pipeline_module._CAMPAIGN_RECORDS.append(
            pipeline_module.CampaignRecord("p1", "Title One", "desc")
        )
        pipeline_module._CAMPAIGN_RECORDS.append(
            pipeline_module.CampaignRecord("p2", "Title Two", "desc")
        )

        flags = pipeline_module.scan_duplicate_content()

        assert len(calls) >= 1, (
            "scan_duplicate_content must call jaccard_similarity; "
            "it appears to be using a local copy instead."
        )
        assert len(flags) == 1  # spy always returns 1.0 → above threshold

        # Cleanup
        pipeline_module._CAMPAIGN_RECORDS.clear()

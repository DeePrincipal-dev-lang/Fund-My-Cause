"""
Unit tests for shared_math_utils module.
"""

import math
import pytest
from .shared_math_utils import (
    jaccard_similarity,
    normalize,
    weighted_score,
    logarithmic_scale,
    exponential_moving_average,
    percentile_rank,
)


class TestJaccardSimilarity:
    def test_identical_strings(self):
        assert jaccard_similarity("hello world", "hello world") == 1.0

    def test_empty_strings(self):
        assert jaccard_similarity("", "") == 1.0

    def test_no_overlap(self):
        assert jaccard_similarity("hello", "world") == 0.0

    def test_partial_overlap(self):
        result = jaccard_similarity("hello world", "hello python")
        expected = 1.0 / 3.0  # {hello} / {hello, world, python}
        assert abs(result - expected) < 1e-6

    def test_case_insensitive(self):
        assert jaccard_similarity("Hello World", "hello world") == 1.0


class TestNormalize:
    def test_clamp_below_range(self):
        assert normalize(-1.0, min_val=0.0, max_val=1.0) == 0.0

    def test_clamp_above_range(self):
        assert normalize(2.0, min_val=0.0, max_val=1.0) == 1.0

    def test_within_range(self):
        assert normalize(0.5, min_val=0.0, max_val=1.0) == 0.5

    def test_custom_range(self):
        assert normalize(15.0, min_val=10.0, max_val=20.0) == 15.0

    def test_invalid_range(self):
        with pytest.raises(ValueError):
            normalize(0.5, min_val=1.0, max_val=1.0)


class TestWeightedScore:
    def test_unit_weight(self):
        assert weighted_score(10.0, weight=1.0) == 10.0

    def test_boost_weight(self):
        assert weighted_score(10.0, weight=2.0) == 20.0

    def test_min_weight_enforced(self):
        result = weighted_score(10.0, weight=0.5, min_weight=1.0)
        assert result == 10.0  # weight clamped to min_weight

    def test_zero_score(self):
        assert weighted_score(0.0, weight=5.0) == 0.0


class TestLogarithmicScale:
    def test_zero(self):
        assert logarithmic_scale(0.0) == 0.0

    def test_positive_value(self):
        result = logarithmic_scale(math.e - 1)  # log1p(e-1) = log(e) = 1
        assert abs(result - 1.0) < 1e-6

    def test_negative_raises(self):
        with pytest.raises(ValueError):
            logarithmic_scale(-1.0)

    def test_base_10(self):
        result = logarithmic_scale(9.0, base=10)
        expected = math.log10(10.0)
        assert abs(result - expected) < 1e-6


class TestExponentialMovingAverage:
    def test_first_update(self):
        result = exponential_moving_average(current=0.0, new_value=100.0, alpha=0.3)
        expected = 0.3 * 100.0
        assert abs(result - expected) < 1e-6

    def test_stable_state(self):
        result = exponential_moving_average(current=100.0, new_value=100.0, alpha=0.3)
        assert abs(result - 100.0) < 1e-6

    def test_alpha_zero(self):
        result = exponential_moving_average(current=100.0, new_value=50.0, alpha=0.0)
        assert abs(result - 100.0) < 1e-6

    def test_alpha_one(self):
        result = exponential_moving_average(current=100.0, new_value=50.0, alpha=1.0)
        assert abs(result - 50.0) < 1e-6

    def test_invalid_alpha(self):
        with pytest.raises(ValueError):
            exponential_moving_average(100.0, 50.0, alpha=1.5)


class TestPercentileRank:
    def test_empty_sequence(self):
        assert percentile_rank(5.0, []) == 0.0

    def test_all_lower(self):
        assert percentile_rank(10.0, [1.0, 2.0, 3.0]) == 1.0

    def test_all_higher(self):
        assert percentile_rank(0.0, [1.0, 2.0, 3.0]) == 0.0

    def test_middle_value(self):
        result = percentile_rank(5.0, [1.0, 3.0, 5.0, 7.0, 9.0])
        assert abs(result - 0.6) < 1e-6  # 3/5 values <= 5

    def test_duplicates(self):
        result = percentile_rank(5.0, [5.0, 5.0, 5.0])
        assert abs(result - 1.0) < 1e-6

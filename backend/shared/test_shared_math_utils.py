"""
Unit tests for backend/shared/shared_math_utils.py (#1514).

Covers
------
round_score
  - Normal positive values are rounded to the requested precision.
  - Default precision is 4 decimal places.
  - Custom ndigits work correctly.
  - Zero input returns 0.0.
  - Negative input is clamped to 0.0.
  - NaN input returns 0.0.
  - +Inf / -Inf inputs return 0.0.
  - Non-numeric input (str, None) returns 0.0.

normalize
  - Mid-range value normalises to the expected fraction.
  - Value at the minimum normalises to 0.0.
  - Value at the maximum normalises to 1.0.
  - Value below the minimum is clamped to 0.0.
  - Value above the maximum is clamped to 1.0.
  - Degenerate range (minimum == maximum) returns 0.0.
  - NaN in any argument returns 0.0.
  - ±Inf in any argument returns 0.0.
  - Negative minimum is handled correctly.
  - Negative value within a negative range normalises correctly.
"""

import math
import sys
import os

import pytest

# Allow running this file directly from backend/shared/ or from the repo root.
sys.path.insert(0, os.path.dirname(__file__))

from shared_math_utils import normalize, round_score


# ===========================================================================
# round_score
# ===========================================================================

class TestRoundScore:
    # -- Normal / happy path --------------------------------------------------

    def test_rounds_to_default_four_decimal_places(self):
        assert round_score(0.123456) == pytest.approx(0.1235)

    def test_rounds_to_custom_ndigits(self):
        assert round_score(0.123456, ndigits=2) == pytest.approx(0.12)

    def test_integer_input_works(self):
        assert round_score(3) == pytest.approx(3.0)

    def test_zero_returns_zero(self):
        assert round_score(0.0) == 0.0

    def test_exactly_representable_value_unchanged(self):
        assert round_score(1.0) == pytest.approx(1.0)

    def test_large_value_rounds_correctly(self):
        assert round_score(9999.99999, ndigits=2) == pytest.approx(10000.0)

    def test_ndigits_zero_returns_integer_like_float(self):
        assert round_score(3.7, ndigits=0) == pytest.approx(4.0)

    # -- Negative inputs ------------------------------------------------------

    def test_negative_value_clamped_to_zero(self):
        assert round_score(-1.0) == 0.0

    def test_negative_zero_accepted_as_zero(self):
        # -0.0 is equal to 0.0 in Python; must not be treated as negative.
        assert round_score(-0.0) == 0.0

    def test_negative_large_value_returns_zero(self):
        assert round_score(-9999.0) == 0.0

    # -- Non-finite inputs ----------------------------------------------------

    def test_nan_returns_zero(self):
        assert round_score(float("nan")) == 0.0

    def test_positive_inf_returns_zero(self):
        assert round_score(float("inf")) == 0.0

    def test_negative_inf_returns_zero(self):
        assert round_score(float("-inf")) == 0.0

    # -- Non-numeric inputs ---------------------------------------------------

    def test_string_input_returns_zero(self):
        assert round_score("3.14") == 0.0  # type: ignore[arg-type]

    def test_none_input_returns_zero(self):
        assert round_score(None) == 0.0  # type: ignore[arg-type]

    def test_list_input_returns_zero(self):
        assert round_score([1, 2]) == 0.0  # type: ignore[arg-type]


# ===========================================================================
# normalize
# ===========================================================================

class TestNormalize:
    # -- Normal / happy path --------------------------------------------------

    def test_mid_range_value(self):
        assert normalize(50, 0, 100) == pytest.approx(0.5)

    def test_value_at_minimum(self):
        assert normalize(0, 0, 100) == pytest.approx(0.0)

    def test_value_at_maximum(self):
        assert normalize(100, 0, 100) == pytest.approx(1.0)

    def test_fractional_result(self):
        assert normalize(25, 0, 100) == pytest.approx(0.25)

    def test_non_zero_minimum(self):
        assert normalize(150, 100, 200) == pytest.approx(0.5)

    def test_float_arguments(self):
        assert normalize(0.75, 0.0, 1.0) == pytest.approx(0.75)

    def test_result_is_between_zero_and_one_for_in_range_value(self):
        result = normalize(37, 10, 90)
        assert 0.0 <= result <= 1.0

    # -- Clamping -------------------------------------------------------------

    def test_value_below_minimum_clamped_to_zero(self):
        assert normalize(-10, 0, 100) == 0.0

    def test_value_above_maximum_clamped_to_one(self):
        assert normalize(150, 0, 100) == 1.0

    def test_value_far_below_minimum_clamped_to_zero(self):
        assert normalize(-1_000_000, 0, 100) == 0.0

    def test_value_far_above_maximum_clamped_to_one(self):
        assert normalize(1_000_000, 0, 100) == 1.0

    # -- Degenerate range (minimum == maximum) --------------------------------

    def test_zero_width_range_returns_zero(self):
        assert normalize(5, 5, 5) == 0.0

    def test_zero_width_range_with_zero_bounds_returns_zero(self):
        assert normalize(0, 0, 0) == 0.0

    # -- Negative ranges / values ---------------------------------------------

    def test_negative_minimum(self):
        assert normalize(0, -100, 100) == pytest.approx(0.5)

    def test_fully_negative_range(self):
        assert normalize(-50, -100, -10) == pytest.approx(0.555555, rel=1e-4)

    def test_negative_value_within_negative_range(self):
        assert normalize(-75, -100, 0) == pytest.approx(0.25)

    def test_value_at_negative_minimum(self):
        assert normalize(-100, -100, 0) == pytest.approx(0.0)

    def test_value_at_negative_maximum(self):
        assert normalize(0, -100, 0) == pytest.approx(1.0)

    # -- Non-finite inputs ----------------------------------------------------

    def test_nan_value_returns_zero(self):
        assert normalize(float("nan"), 0, 100) == 0.0

    def test_nan_minimum_returns_zero(self):
        assert normalize(50, float("nan"), 100) == 0.0

    def test_nan_maximum_returns_zero(self):
        assert normalize(50, 0, float("nan")) == 0.0

    def test_inf_value_returns_zero(self):
        assert normalize(float("inf"), 0, 100) == 0.0

    def test_negative_inf_value_returns_zero(self):
        assert normalize(float("-inf"), 0, 100) == 0.0

    def test_inf_minimum_returns_zero(self):
        assert normalize(50, float("-inf"), 100) == 0.0

    def test_inf_maximum_returns_zero(self):
        assert normalize(50, 0, float("inf")) == 0.0

    # -- Non-numeric inputs ---------------------------------------------------

    def test_string_value_returns_zero(self):
        assert normalize("50", 0, 100) == 0.0  # type: ignore[arg-type]

    def test_none_value_returns_zero(self):
        assert normalize(None, 0, 100) == 0.0  # type: ignore[arg-type]

"""
Unit tests for the scoring-weights config module.

Covers
------
- Valid full-config load produces the expected weight values.
- Partial config (some env vars absent) falls back to defaults.
- Empty env dict produces pure defaults.
- Missing required weights are rejected at startup with a specific error.
- Out-of-range values are rejected at startup with a specific error:
    * category_boost < 1.0
    * age_divisor_min <= 0
    * any field is negative
- Malformed (non-numeric) env vars are rejected with a specific error.
- validate_scoring_config passes silently on a valid config and raises on
  every domain violation.
- DEFAULT_SCORING_CONFIG has the expected sentinel values.
- Returned config is frozen (immutable via the frozen dataclass).
"""

import math

import pytest

from scoring_config import (
    DEFAULT_SCORING_CONFIG,
    ScoringWeightsConfig,
    load_scoring_config,
    validate_scoring_config,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _full_env(**overrides: str) -> dict[str, str]:
    """Return a complete env dict (defaults expressed as strings), plus any overrides."""
    base = {
        "RECOMMENDATION_WEIGHT_CATEGORY_BOOST": "2.0",
        "RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN": "1.0",
    }
    return {**base, **overrides}


# ---------------------------------------------------------------------------
# Valid-config load path
# ---------------------------------------------------------------------------

class TestLoadScoringConfigValid:
    def test_category_boost_loaded_correctly(self):
        cfg = load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_CATEGORY_BOOST="3.5"))
        assert cfg.category_boost == pytest.approx(3.5)

    def test_age_divisor_min_loaded_correctly(self):
        cfg = load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN="2.0"))
        assert cfg.age_divisor_min == pytest.approx(2.0)

    def test_full_env_matching_defaults_returns_defaults(self):
        cfg = load_scoring_config(_full_env())
        assert cfg == DEFAULT_SCORING_CONFIG

    def test_fractional_values_parsed_correctly(self):
        cfg = load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_CATEGORY_BOOST="1.25"))
        assert cfg.category_boost == pytest.approx(1.25)

    def test_config_is_frozen(self):
        cfg = load_scoring_config(_full_env())
        with pytest.raises((AttributeError, TypeError)):
            cfg.category_boost = 99.0  # type: ignore[misc]

    def test_returns_ScoringWeightsConfig_instance(self):
        cfg = load_scoring_config(_full_env())
        assert isinstance(cfg, ScoringWeightsConfig)


# ---------------------------------------------------------------------------
# Default fallback (partial / empty env)
# ---------------------------------------------------------------------------

class TestLoadScoringConfigPartial:
    def test_empty_env_produces_all_defaults(self):
        cfg = load_scoring_config({})
        assert cfg == DEFAULT_SCORING_CONFIG

    def test_absent_category_boost_falls_back_to_default(self):
        cfg = load_scoring_config({"RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN": "2.0"})
        assert cfg.category_boost == DEFAULT_SCORING_CONFIG.category_boost
        assert cfg.age_divisor_min == pytest.approx(2.0)

    def test_absent_age_divisor_min_falls_back_to_default(self):
        cfg = load_scoring_config({"RECOMMENDATION_WEIGHT_CATEGORY_BOOST": "3.0"})
        assert cfg.age_divisor_min == DEFAULT_SCORING_CONFIG.age_divisor_min
        assert cfg.category_boost == pytest.approx(3.0)

    def test_empty_string_value_treated_as_absent(self):
        cfg = load_scoring_config({"RECOMMENDATION_WEIGHT_CATEGORY_BOOST": ""})
        assert cfg.category_boost == DEFAULT_SCORING_CONFIG.category_boost


# ---------------------------------------------------------------------------
# Missing / malformed weight rejection
# ---------------------------------------------------------------------------

class TestLoadScoringConfigMalformed:
    def test_non_numeric_category_boost_raises(self):
        with pytest.raises(ValueError, match="RECOMMENDATION_WEIGHT_CATEGORY_BOOST"):
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_CATEGORY_BOOST="banana"))

    def test_non_numeric_age_divisor_raises(self):
        with pytest.raises(ValueError, match="RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN"):
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN="not-a-float"))

    def test_nan_string_raises(self):
        """'nan' parses to float('nan') but must be rejected as non-finite."""
        with pytest.raises(ValueError, match="RECOMMENDATION_WEIGHT_CATEGORY_BOOST"):
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_CATEGORY_BOOST="nan"))

    def test_inf_string_raises(self):
        """'inf' parses to float('inf') but must be rejected as non-finite."""
        with pytest.raises(ValueError, match="RECOMMENDATION_WEIGHT_CATEGORY_BOOST"):
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_CATEGORY_BOOST="inf"))

    def test_error_message_contains_env_var_name(self):
        with pytest.raises(ValueError) as exc_info:
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN="oops"))
        assert "RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Out-of-range value rejection
# ---------------------------------------------------------------------------

class TestLoadScoringConfigOutOfRange:
    def test_category_boost_below_one_raises(self):
        with pytest.raises(ValueError, match="category_boost"):
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_CATEGORY_BOOST="0.5"))

    def test_category_boost_exactly_one_is_allowed(self):
        """Boost of exactly 1.0 is valid — it means no boost is applied."""
        cfg = load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_CATEGORY_BOOST="1.0"))
        assert cfg.category_boost == pytest.approx(1.0)

    def test_age_divisor_zero_raises(self):
        with pytest.raises(ValueError, match="age_divisor_min"):
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN="0"))

    def test_age_divisor_negative_raises(self):
        with pytest.raises(ValueError, match="age_divisor_min"):
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN="-1"))

    def test_category_boost_zero_raises(self):
        """Zero category boost is below the minimum of 1.0."""
        with pytest.raises(ValueError, match="category_boost"):
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_CATEGORY_BOOST="0"))

    def test_negative_category_boost_raises(self):
        with pytest.raises(ValueError, match="category_boost"):
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_CATEGORY_BOOST="-2.0"))

    def test_error_message_is_specific_about_field(self):
        """Error for out-of-range must name the offending field."""
        with pytest.raises(ValueError) as exc_info:
            load_scoring_config(_full_env(RECOMMENDATION_WEIGHT_CATEGORY_BOOST="0.1"))
        assert "category_boost" in str(exc_info.value)


# ---------------------------------------------------------------------------
# validate_scoring_config direct tests
# ---------------------------------------------------------------------------

class TestValidateScoringConfig:
    def test_valid_config_passes_silently(self):
        validate_scoring_config(DEFAULT_SCORING_CONFIG)  # must not raise

    def test_category_boost_below_one_raises(self):
        cfg = ScoringWeightsConfig(category_boost=0.9, age_divisor_min=1.0)
        with pytest.raises(ValueError, match="category_boost"):
            validate_scoring_config(cfg)

    def test_age_divisor_zero_raises(self):
        cfg = ScoringWeightsConfig(category_boost=2.0, age_divisor_min=0)
        with pytest.raises(ValueError, match="age_divisor_min"):
            validate_scoring_config(cfg)

    def test_age_divisor_negative_raises(self):
        cfg = ScoringWeightsConfig(category_boost=2.0, age_divisor_min=-0.5)
        with pytest.raises(ValueError, match="age_divisor_min"):
            validate_scoring_config(cfg)

    def test_non_finite_category_boost_raises(self):
        cfg = ScoringWeightsConfig(category_boost=math.nan, age_divisor_min=1.0)
        with pytest.raises(ValueError, match="category_boost"):
            validate_scoring_config(cfg)

    def test_non_finite_age_divisor_raises(self):
        cfg = ScoringWeightsConfig(category_boost=2.0, age_divisor_min=math.inf)
        with pytest.raises(ValueError, match="age_divisor_min"):
            validate_scoring_config(cfg)

    def test_error_message_names_the_field(self):
        cfg = ScoringWeightsConfig(category_boost=0.5, age_divisor_min=1.0)
        with pytest.raises(ValueError) as exc_info:
            validate_scoring_config(cfg)
        assert "category_boost" in str(exc_info.value)

    def test_valid_non_default_values_pass(self):
        cfg = ScoringWeightsConfig(category_boost=5.0, age_divisor_min=0.5)
        validate_scoring_config(cfg)  # must not raise


# ---------------------------------------------------------------------------
# DEFAULT_SCORING_CONFIG integrity
# ---------------------------------------------------------------------------

class TestDefaultScoringConfig:
    def test_passes_validation(self):
        validate_scoring_config(DEFAULT_SCORING_CONFIG)  # must not raise

    def test_category_boost_greater_than_one(self):
        """Default boost must be > 1 to actually boost preferred categories."""
        assert DEFAULT_SCORING_CONFIG.category_boost > 1.0

    def test_age_divisor_min_positive(self):
        """Default age divisor must prevent division by zero."""
        assert DEFAULT_SCORING_CONFIG.age_divisor_min > 0

    def test_category_boost_default_value(self):
        assert DEFAULT_SCORING_CONFIG.category_boost == pytest.approx(2.0)

    def test_age_divisor_min_default_value(self):
        assert DEFAULT_SCORING_CONFIG.age_divisor_min == pytest.approx(1.0)

    def test_is_frozen(self):
        """ScoringWeightsConfig is a frozen dataclass — mutation must fail."""
        with pytest.raises((AttributeError, TypeError)):
            DEFAULT_SCORING_CONFIG.category_boost = 99.0  # type: ignore[misc]


# ---------------------------------------------------------------------------
# #912 regression guard: default config == historical hardcoded values
# ---------------------------------------------------------------------------

class TestDefaultConfigMatchesHardcodedValues:
    """
    Guard that the built-in defaults in ScoringWeightsConfig exactly match
    the constants that were previously hardcoded inline in service.py before
    issue #912 extracted them into this config module.

    If either default value changes the scoring output will differ from the
    pre-#912 behaviour, which would be a breaking change.  Any intentional
    change to the defaults must also update this test.
    """

    # Historical hardcoded values from service.py (pre-#912):
    _LEGACY_CATEGORY_BOOST: float = 2.0
    _LEGACY_AGE_DIVISOR_MIN: float = 1.0

    def test_category_boost_matches_legacy_hardcoded_value(self):
        assert DEFAULT_SCORING_CONFIG.category_boost == pytest.approx(
            self._LEGACY_CATEGORY_BOOST
        )

    def test_age_divisor_min_matches_legacy_hardcoded_value(self):
        assert DEFAULT_SCORING_CONFIG.age_divisor_min == pytest.approx(
            self._LEGACY_AGE_DIVISOR_MIN
        )

    def test_load_with_empty_env_matches_legacy_values(self):
        """Loading from an empty environment must reproduce the legacy constants."""
        cfg = load_scoring_config({})
        assert cfg.category_boost == pytest.approx(self._LEGACY_CATEGORY_BOOST)
        assert cfg.age_divisor_min == pytest.approx(self._LEGACY_AGE_DIVISOR_MIN)


# ---------------------------------------------------------------------------
# Startup hook (#1386)
# ---------------------------------------------------------------------------

class TestAssertStartupConfig:
    """
    The service bootstrap should call assert_startup_config() so that any
    misconfiguration in the deployment environment fails fast with a clear
    error before serving requests.
    """

    def test_valid_env_returns_config(self, monkeypatch):
        from scoring_config import assert_startup_config

        monkeypatch.setenv("RECOMMENDATION_WEIGHT_CATEGORY_BOOST", "2.5")
        monkeypatch.setenv("RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN", "1.0")

        cfg = assert_startup_config()
        assert isinstance(cfg, ScoringWeightsConfig)
        assert cfg.category_boost == pytest.approx(2.5)

    def test_invalid_env_raises_clear_error(self, monkeypatch):
        from scoring_config import assert_startup_config

        monkeypatch.setenv("RECOMMENDATION_WEIGHT_CATEGORY_BOOST", "0.1")
        with pytest.raises(ValueError) as exc_info:
            assert_startup_config()
        assert "category_boost" in str(exc_info.value)

    def test_malformed_env_raises_clear_error(self, monkeypatch):
        from scoring_config import assert_startup_config

        monkeypatch.setenv("RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN", "banana")
        with pytest.raises(ValueError) as exc_info:
            assert_startup_config()
        assert "RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN" in str(exc_info.value)

    def test_non_finite_env_raises_clear_error(self, monkeypatch):
        from scoring_config import assert_startup_config

        monkeypatch.setenv("RECOMMENDATION_WEIGHT_CATEGORY_BOOST", "inf")
        with pytest.raises(ValueError) as exc_info:
            assert_startup_config()
        assert "RECOMMENDATION_WEIGHT_CATEGORY_BOOST" in str(exc_info.value)

    def test_empty_env_uses_defaults(self, monkeypatch):
        from scoring_config import assert_startup_config

        monkeypatch.delenv("RECOMMENDATION_WEIGHT_CATEGORY_BOOST", raising=False)
        monkeypatch.delenv("RECOMMENDATION_WEIGHT_AGE_DIVISOR_MIN", raising=False)

        cfg = assert_startup_config()
        assert cfg == DEFAULT_SCORING_CONFIG

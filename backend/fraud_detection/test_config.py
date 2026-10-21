"""
Unit tests for fraud detection configuration validation (#1527).

Tests that:
- Configuration is loaded from environment variables
- Invalid values are rejected with clear error messages
- All invalid keys are reported at once (fail-fast)
- Defaults are used when values are not provided
- Type conversion works correctly
"""

import pytest
from config import load_fraud_detection_config, FraudDetectionConfig


class TestFraudDetectionConfig:
    """Tests for FraudDetectionConfig data class."""

    def test_init_stores_all_parameters(self):
        """Should store all configuration parameters."""
        config = FraudDetectionConfig(
            wash_window_seconds=7200,
            wash_min_occurrences=5,
            spike_window_seconds=1200,
            spike_max_contributions=100,
            duplicate_jaccard_threshold=0.75,
            duplicate_scan_min_interval_seconds=60,
        )

        assert config.wash_window_seconds == 7200
        assert config.wash_min_occurrences == 5
        assert config.spike_window_seconds == 1200
        assert config.spike_max_contributions == 100
        assert config.duplicate_jaccard_threshold == 0.75
        assert config.duplicate_scan_min_interval_seconds == 60

    def test_repr_includes_all_values(self):
        """Should have a useful repr."""
        config = FraudDetectionConfig(
            wash_window_seconds=3600,
            wash_min_occurrences=3,
            spike_window_seconds=600,
            spike_max_contributions=50,
            duplicate_jaccard_threshold=0.8,
            duplicate_scan_min_interval_seconds=30,
        )

        repr_str = repr(config)
        assert "FraudDetectionConfig" in repr_str
        assert "3600" in repr_str
        assert "0.8" in repr_str


class TestLoadFraudDetectionConfig:
    """Tests for load_fraud_detection_config function."""

    def test_uses_defaults_when_env_is_empty(self):
        """Should use default values when environment variables are not set."""
        config = load_fraud_detection_config({})

        assert config.wash_window_seconds == 3600
        assert config.wash_min_occurrences == 3
        assert config.spike_window_seconds == 600
        assert config.spike_max_contributions == 50
        assert config.duplicate_jaccard_threshold == 0.8
        assert config.duplicate_scan_min_interval_seconds == 30

    def test_loads_all_values_from_env(self):
        """Should load all configuration values from environment."""
        env = {
            "FRAUD_DETECTION_WASH_WINDOW_SECONDS": "7200",
            "FRAUD_DETECTION_WASH_MIN_OCCURRENCES": "5",
            "FRAUD_DETECTION_SPIKE_WINDOW_SECONDS": "1200",
            "FRAUD_DETECTION_SPIKE_MAX_CONTRIBUTIONS": "100",
            "FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD": "0.75",
            "FRAUD_DETECTION_DUPLICATE_SCAN_MIN_INTERVAL_SECONDS": "60",
        }

        config = load_fraud_detection_config(env)

        assert config.wash_window_seconds == 7200
        assert config.wash_min_occurrences == 5
        assert config.spike_window_seconds == 1200
        assert config.spike_max_contributions == 100
        assert config.duplicate_jaccard_threshold == 0.75
        assert config.duplicate_scan_min_interval_seconds == 60

    def test_rejects_negative_wash_window(self):
        """Should reject negative wash window seconds."""
        env = {"FRAUD_DETECTION_WASH_WINDOW_SECONDS": "-100"}

        with pytest.raises(ValueError) as exc_info:
            load_fraud_detection_config(env)

        assert "FRAUD_DETECTION_WASH_WINDOW_SECONDS" in str(exc_info.value)

    def test_rejects_zero_wash_window(self):
        """Should reject zero wash window seconds."""
        env = {"FRAUD_DETECTION_WASH_WINDOW_SECONDS": "0"}

        with pytest.raises(ValueError) as exc_info:
            load_fraud_detection_config(env)

        assert "FRAUD_DETECTION_WASH_WINDOW_SECONDS" in str(exc_info.value)

    def test_rejects_non_integer_wash_window(self):
        """Should reject non-integer wash window."""
        env = {"FRAUD_DETECTION_WASH_WINDOW_SECONDS": "not-an-int"}

        with pytest.raises(ValueError) as exc_info:
            load_fraud_detection_config(env)

        assert "FRAUD_DETECTION_WASH_WINDOW_SECONDS" in str(exc_info.value)

    def test_rejects_threshold_below_zero(self):
        """Should reject threshold below 0.0."""
        env = {"FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD": "-0.1"}

        with pytest.raises(ValueError) as exc_info:
            load_fraud_detection_config(env)

        assert "FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD" in str(exc_info.value)

    def test_rejects_threshold_above_one(self):
        """Should reject threshold above 1.0."""
        env = {"FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD": "1.5"}

        with pytest.raises(ValueError) as exc_info:
            load_fraud_detection_config(env)

        assert "FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD" in str(exc_info.value)

    def test_accepts_threshold_at_boundaries(self):
        """Should accept threshold at 0.0 and 1.0."""
        config_min = load_fraud_detection_config(
            {"FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD": "0.0"}
        )
        assert config_min.duplicate_jaccard_threshold == 0.0

        config_max = load_fraud_detection_config(
            {"FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD": "1.0"}
        )
        assert config_max.duplicate_jaccard_threshold == 1.0

    def test_rejects_non_numeric_threshold(self):
        """Should reject non-numeric threshold."""
        env = {"FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD": "invalid"}

        with pytest.raises(ValueError) as exc_info:
            load_fraud_detection_config(env)

        assert "FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD" in str(exc_info.value)

    def test_reports_all_invalid_keys_at_once(self):
        """Should report ALL invalid keys in one error message."""
        env = {
            "FRAUD_DETECTION_WASH_WINDOW_SECONDS": "-100",  # invalid
            "FRAUD_DETECTION_SPIKE_MAX_CONTRIBUTIONS": "abc",  # invalid
            "FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD": "2.5",  # invalid
        }

        with pytest.raises(ValueError) as exc_info:
            load_fraud_detection_config(env)

        error_msg = str(exc_info.value)
        # All three should be mentioned
        assert "FRAUD_DETECTION_WASH_WINDOW_SECONDS" in error_msg
        assert "FRAUD_DETECTION_SPIKE_MAX_CONTRIBUTIONS" in error_msg
        assert "FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD" in error_msg

    def test_partial_override_uses_defaults_for_rest(self):
        """Should use defaults for values not provided in environment."""
        env = {"FRAUD_DETECTION_WASH_WINDOW_SECONDS": "7200"}

        config = load_fraud_detection_config(env)

        assert config.wash_window_seconds == 7200  # overridden
        assert config.wash_min_occurrences == 3  # default
        assert config.spike_window_seconds == 600  # default
        assert config.spike_max_contributions == 50  # default
        assert config.duplicate_jaccard_threshold == 0.8  # default

    def test_accepts_large_integer_values(self):
        """Should accept large integer values within reason."""
        env = {
            "FRAUD_DETECTION_WASH_WINDOW_SECONDS": "86400",  # 1 day
            "FRAUD_DETECTION_SPIKE_MAX_CONTRIBUTIONS": "10000",
        }

        config = load_fraud_detection_config(env)

        assert config.wash_window_seconds == 86400
        assert config.spike_max_contributions == 10000

    def test_accepts_various_valid_thresholds(self):
        """Should accept various valid threshold values."""
        test_values = ["0.0", "0.5", "0.75", "0.9", "1.0"]

        for threshold_str in test_values:
            config = load_fraud_detection_config(
                {"FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD": threshold_str}
            )
            assert config.duplicate_jaccard_threshold == float(threshold_str)

    def test_type_conversion_to_int(self):
        """Should convert string integers to int type."""
        config = load_fraud_detection_config(
            {"FRAUD_DETECTION_WASH_WINDOW_SECONDS": "7200"}
        )

        assert isinstance(config.wash_window_seconds, int)
        assert config.wash_window_seconds == 7200

    def test_type_conversion_to_float(self):
        """Should convert string floats to float type."""
        config = load_fraud_detection_config(
            {"FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD": "0.85"}
        )

        assert isinstance(config.duplicate_jaccard_threshold, float)
        assert config.duplicate_jaccard_threshold == 0.85

    def test_returns_fraud_detection_config_instance(self):
        """Should return a FraudDetectionConfig instance."""
        config = load_fraud_detection_config({})

        assert isinstance(config, FraudDetectionConfig)

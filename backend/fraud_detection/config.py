"""
Fraud detection configuration validation (#1527).

Defines the schema for fraud detection settings and validates them at startup.
This ensures all required settings are present and valid before the service
starts processing, with a complete error report for any misconfiguration.

Configuration sources (in order of precedence):
1. Environment variables (FRAUD_DETECTION_*)
2. Defaults defined in this module

See docs/fraud-detection-config.md for configuration reference.
"""

from __future__ import annotations

import sys
import os
from typing import Optional

import structlog

# Add shared directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared"))
from config_validator import ConfigValidator, ConfigRule, get_env_int, get_env_bool  # noqa: E402

logger = structlog.get_logger(__name__)


class FraudDetectionConfig:
    """Fraud detection configuration holder."""

    def __init__(
        self,
        wash_window_seconds: int,
        wash_min_occurrences: int,
        spike_window_seconds: int,
        spike_max_contributions: int,
        duplicate_jaccard_threshold: float,
        duplicate_scan_min_interval_seconds: int,
    ):
        self.wash_window_seconds = wash_window_seconds
        self.wash_min_occurrences = wash_min_occurrences
        self.spike_window_seconds = spike_window_seconds
        self.spike_max_contributions = spike_max_contributions
        self.duplicate_jaccard_threshold = duplicate_jaccard_threshold
        self.duplicate_scan_min_interval_seconds = duplicate_scan_min_interval_seconds

    def __repr__(self) -> str:
        return (
            f"FraudDetectionConfig("
            f"wash_window={self.wash_window_seconds}s, "
            f"wash_min={self.wash_min_occurrences}, "
            f"spike_window={self.spike_window_seconds}s, "
            f"spike_max={self.spike_max_contributions}, "
            f"duplicate_threshold={self.duplicate_jaccard_threshold}, "
            f"duplicate_interval={self.duplicate_scan_min_interval_seconds}s)"
        )


def _validate_positive_int(value: str) -> bool:
    """Validate that a string is a positive integer."""
    try:
        return int(value) > 0
    except (ValueError, TypeError):
        return False


def _validate_threshold(value: str) -> bool:
    """Validate that a string is a float between 0.0 and 1.0."""
    try:
        f = float(value)
        return 0.0 <= f <= 1.0
    except (ValueError, TypeError):
        return False


def load_fraud_detection_config(env: Optional[dict[str, str]] = None) -> FraudDetectionConfig:
    """
    Load and validate fraud detection configuration from environment variables.

    Raises ValueError with a complete list of invalid keys if validation fails.
    This ensures the service never starts with partial or misconfigured settings.

    Args:
        env: Optional environment dict for testing. Defaults to os.environ.

    Returns:
        FraudDetectionConfig instance with validated values.

    Raises:
        ValueError: If any required or optional setting is invalid.
    """
    if env is None:
        env = os.environ

    schema = {
        "wash_window_seconds": ConfigRule(
            env="FRAUD_DETECTION_WASH_WINDOW_SECONDS",
            required=False,
            default=3600,
            description="Time window for wash contribution detection (seconds)",
            validate=_validate_positive_int,
            type_=int,
        ),
        "wash_min_occurrences": ConfigRule(
            env="FRAUD_DETECTION_WASH_MIN_OCCURRENCES",
            required=False,
            default=3,
            description="Minimum wash cycles required to flag a contributor",
            validate=_validate_positive_int,
            type_=int,
        ),
        "spike_window_seconds": ConfigRule(
            env="FRAUD_DETECTION_SPIKE_WINDOW_SECONDS",
            required=False,
            default=600,
            description="Time window for contribution spike detection (seconds)",
            validate=_validate_positive_int,
            type_=int,
        ),
        "spike_max_contributions": ConfigRule(
            env="FRAUD_DETECTION_SPIKE_MAX_CONTRIBUTIONS",
            required=False,
            default=50,
            description="Maximum contributions allowed in spike window before flagging",
            validate=_validate_positive_int,
            type_=int,
        ),
        "duplicate_jaccard_threshold": ConfigRule(
            env="FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD",
            required=False,
            default=0.8,
            description="Jaccard similarity threshold for duplicate campaign detection (0.0-1.0)",
            validate=_validate_threshold,
            type_=float,
        ),
        "duplicate_scan_min_interval_seconds": ConfigRule(
            env="FRAUD_DETECTION_DUPLICATE_SCAN_MIN_INTERVAL_SECONDS",
            required=False,
            default=30,
            description="Minimum interval between duplicate content scans (seconds)",
            validate=_validate_positive_int,
            type_=int,
        ),
    }

    # Validate using schema-based validator
    validator = ConfigValidator(schema, env)
    try:
        config_dict = validator.validate()
    except ValueError as e:
        logger.error("fraud_detection_config_validation_failed", error=str(e))
        raise

    # Convert float default back to float type (ConfigValidator may convert to int)
    if "duplicate_jaccard_threshold" in config_dict:
        threshold_value = config_dict["duplicate_jaccard_threshold"]
        if isinstance(threshold_value, (int, str)):
            try:
                config_dict["duplicate_jaccard_threshold"] = float(threshold_value)
            except (ValueError, TypeError):
                msg = (
                    f'Invalid float value for FRAUD_DETECTION_DUPLICATE_JACCARD_THRESHOLD: '
                    f'"{threshold_value}"'
                )
                logger.error("fraud_detection_config_validation_failed", error=msg)
                raise ValueError(msg)

    return FraudDetectionConfig(
        wash_window_seconds=config_dict["wash_window_seconds"],
        wash_min_occurrences=config_dict["wash_min_occurrences"],
        spike_window_seconds=config_dict["spike_window_seconds"],
        spike_max_contributions=config_dict["spike_max_contributions"],
        duplicate_jaccard_threshold=config_dict["duplicate_jaccard_threshold"],
        duplicate_scan_min_interval_seconds=config_dict[
            "duplicate_scan_min_interval_seconds"
        ],
    )

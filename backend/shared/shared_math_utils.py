"""
Shared mathematical and statistical utilities used across backend services.

This module provides common functions for scoring, normalization, and similarity
calculations used by both the recommendations and fraud_detection services.
"""

import math
from typing import Sequence


def jaccard_similarity(a: str, b: str) -> float:
    """
    Compute token-level Jaccard similarity between two strings.

    Strings are lowercased, split on whitespace, and compared as sets.
    If both strings are empty, returns 1.0 (perfect match).

    Args:
        a: First string to compare
        b: Second string to compare

    Returns:
        Float between 0.0 (no overlap) and 1.0 (identical)
    """
    sa = set(a.lower().split())
    sb = set(b.lower().split())
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / len(sa | sb)


def normalize(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """
    Normalize a value to a range [min_val, max_val].

    Used for scaling scores and metrics to a consistent range.

    Args:
        value: Value to normalize
        min_val: Lower bound of output range (default 0.0)
        max_val: Upper bound of output range (default 1.0)

    Returns:
        Normalized value clamped to [min_val, max_val]
    """
    if max_val <= min_val:
        raise ValueError(f"max_val ({max_val}) must be > min_val ({min_val})")
    return max(min_val, min(max_val, value))


def weighted_score(
    base_score: float,
    weight: float = 1.0,
    min_weight: float = 1.0,
) -> float:
    """
    Apply a weight multiplier to a base score.

    The weight is clamped to at least min_weight to avoid demoting scores
    below their natural value.

    Args:
        base_score: The base score before weighting
        weight: Multiplier to apply (default 1.0 = no change)
        min_weight: Minimum weight allowed (default 1.0)

    Returns:
        Weighted score: base_score * max(weight, min_weight)
    """
    effective_weight = max(weight, min_weight)
    return base_score * effective_weight


def logarithmic_scale(value: float, base: float = math.e) -> float:
    """
    Apply logarithmic scaling to a value.

    Used for dampening the influence of large values (e.g., total_raised).
    Uses log1p(value) to avoid log(0) and smooth the curve for small values.

    Args:
        value: Value to scale
        base: Logarithm base (default e)

    Returns:
        log_base(1 + value)
    """
    if value < 0:
        raise ValueError(f"value must be non-negative, got {value}")
    # log1p = log(1 + x), numerically stable for small x
    return math.log1p(value) / math.log(base) if base != math.e else math.log1p(value)


def exponential_moving_average(
    current: float,
    new_value: float,
    alpha: float = 0.3,
) -> float:
    """
    Calculate exponential moving average.

    Used for tracking metrics like average latency or processing time.
    EMA = alpha * new_value + (1 - alpha) * current

    Args:
        current: Current average
        new_value: New observation
        alpha: Smoothing factor between 0 and 1 (default 0.3)

    Returns:
        Updated exponential moving average
    """
    if not 0 <= alpha <= 1:
        raise ValueError(f"alpha must be in [0, 1], got {alpha}")
    return alpha * new_value + (1 - alpha) * current


def percentile_rank(
    value: float,
    values: Sequence[float],
) -> float:
    """
    Calculate the percentile rank of a value within a sequence.

    Useful for scoring relative to a distribution (e.g., campaign performance).

    Args:
        value: Value to rank
        values: Sequence of all values

    Returns:
        Percentile (0.0 to 1.0) — fraction of values less than or equal to `value`
    """
    if not values:
        return 0.0
    count = sum(1 for v in values if v <= value)
    return count / len(values)

"""
Shared math utilities used across the fraud-detection and recommendations
pipelines (#1514).

Centralising these helpers ensures that rounding and normalisation produce
identical results in every service that uses them.  Before this module the
same logic existed independently in:

  - ``backend/fraud_detection/scoring.py``
  - inline inside ``backend/recommendations/service.py``

Single implementations live here; every other module imports from here.

Functions
---------
round_score(value, ndigits)
    Round *value* to *ndigits* decimal places.
    Handles ``NaN`` and ``±Inf`` by returning ``0.0`` so callers never
    propagate non-finite floats into serialised API responses.

normalize(value, minimum, maximum)
    Map *value* from [minimum, maximum] onto [0.0, 1.0].
    Edge cases:
      * ``minimum == maximum``  → returns 0.0 (avoids zero-division).
      * ``value < minimum``     → clamped to 0.0.
      * ``value > maximum``     → clamped to 1.0.
      * Non-finite input        → returns 0.0.
"""

from __future__ import annotations

import math


def round_score(value: float, ndigits: int = 4) -> float:
    """
    Round *value* to *ndigits* decimal places.

    Non-finite inputs (``NaN``, ``+Inf``, ``-Inf``) and negative scores are
    coerced to ``0.0`` so that API responses never carry sentinel floats.

    Parameters
    ----------
    value:
        The raw score to round.
    ndigits:
        Number of decimal places (default 4).

    Returns
    -------
    float
        A finite, rounded score in the range [0.0, …].

    Examples
    --------
    >>> round_score(0.123456)
    0.1235
    >>> round_score(float('nan'))
    0.0
    >>> round_score(-3.5)
    0.0
    """
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        return 0.0
    if value < 0:
        return 0.0
    return round(float(value), ndigits)


def normalize(value: float, minimum: float, maximum: float) -> float:
    """
    Min-max normalise *value* onto [0.0, 1.0].

    Parameters
    ----------
    value:
        The raw value to normalise.
    minimum:
        The lower bound of the expected range.
    maximum:
        The upper bound of the expected range.

    Returns
    -------
    float
        A normalised score in ``[0.0, 1.0]``.

    Edge-case behaviour (all return ``0.0``)
    ----------------------------------------
    * Any non-finite argument (NaN, ±Inf).
    * ``minimum == maximum`` (zero-width range — avoids division by zero).
    * ``value < minimum`` is clamped to 0.0.
    * ``value > maximum`` is clamped to 1.0.

    Examples
    --------
    >>> normalize(50, 0, 100)
    0.5
    >>> normalize(0, 0, 0)   # degenerate range
    0.0
    >>> normalize(-10, 0, 100)
    0.0
    >>> normalize(150, 0, 100)
    1.0
    """
    # Reject any non-finite argument before doing arithmetic.
    for arg in (value, minimum, maximum):
        if not isinstance(arg, (int, float)) or not math.isfinite(arg):
            return 0.0

    span = maximum - minimum
    if span == 0.0:
        # Degenerate range — every value is the same; pick the neutral output.
        return 0.0

    raw = (float(value) - float(minimum)) / span
    # Clamp to [0.0, 1.0]
    return max(0.0, min(1.0, raw))

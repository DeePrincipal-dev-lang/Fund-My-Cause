"""
Fraud-detection scoring helpers (#1514).

This module provides the numeric scoring utilities used by the fraud-detection
pipeline.  All rounding and normalisation are delegated to
``backend/shared/shared_math_utils.py`` so that there is exactly ONE
implementation of each math helper across the entire backend.

Before #1514 the rounding and normalisation logic was duplicated between this
module (previously inlined inside pipeline.py) and shared_math_utils.py.
The duplication has been eliminated: this module re-exports the shared
helpers and adds fraud-specific wrappers on top of them.

Public API
----------
round_score(value, ndigits)
    Thin re-export of ``shared_math_utils.round_score``.

normalize(value, minimum, maximum)
    Thin re-export of ``shared_math_utils.normalize``.

jaccard_similarity(a, b)
    Token-level Jaccard similarity between two strings.
    Returns a float in [0.0, 1.0] rounded to 4 d.p.

severity_score(flag_count, max_flags)
    Normalise a raw flag count into a [0.0, 1.0] severity score.
    Delegates entirely to ``normalize``.
"""

from __future__ import annotations

import sys
import os

# ---------------------------------------------------------------------------
# Allow importing shared_math_utils regardless of how Python resolves paths.
# In a proper package layout this would be handled by the package installer
# or PYTHONPATH.  We add the directory to sys.path at import time so that
# both the test runner (pytest invoked from backend/shared/) and the service
# runner (uvicorn invoked from backend/fraud_detection/) find the module.
# ---------------------------------------------------------------------------
_SHARED_DIR = os.path.join(os.path.dirname(__file__), "..", "shared")
if _SHARED_DIR not in sys.path:
    sys.path.insert(0, os.path.abspath(_SHARED_DIR))

from shared_math_utils import normalize, round_score  # noqa: E402  (path insertion above)

__all__ = [
    "round_score",
    "normalize",
    "jaccard_similarity",
    "severity_score",
]


def jaccard_similarity(a: str, b: str) -> float:
    """
    Compute token-level Jaccard similarity between strings *a* and *b*.

    Tokenises each string by lowercasing and splitting on whitespace, then
    returns ``|intersection| / |union|``.  The result is rounded to 4
    decimal places via :func:`round_score`.

    Edge cases
    ----------
    * Both strings empty → returns 1.0 (identical empty sets).
    * One string empty  → returns 0.0 (no overlap).
    * Non-string input  → raises :class:`TypeError`.

    Parameters
    ----------
    a, b:
        Input strings to compare.

    Returns
    -------
    float
        Similarity in [0.0, 1.0].

    Examples
    --------
    >>> jaccard_similarity("fund the commons", "fund the commons")
    1.0
    >>> jaccard_similarity("hello world", "world hello")
    1.0
    >>> jaccard_similarity("", "")
    1.0
    >>> jaccard_similarity("abc", "")
    0.0
    """
    if not isinstance(a, str) or not isinstance(b, str):
        raise TypeError(
            f"jaccard_similarity expects two str arguments, "
            f"got {type(a).__name__!r} and {type(b).__name__!r}"
        )

    sa = set(a.lower().split())
    sb = set(b.lower().split())

    if not sa and not sb:
        return 1.0

    union = sa | sb
    if not union:
        return 0.0

    raw = len(sa & sb) / len(union)
    return round_score(raw, 4)


def severity_score(flag_count: int, max_flags: int) -> float:
    """
    Normalise *flag_count* into a [0.0, 1.0] severity score.

    Uses :func:`normalize` from ``shared_math_utils`` so that the
    normalisation logic is not duplicated here.

    Parameters
    ----------
    flag_count:
        The number of flags raised for a given entity.
    max_flags:
        The upper bound used for normalisation (e.g. the highest observed
        flag count across all entities in the current scan, or a configured
        ceiling).

    Returns
    -------
    float
        Severity in [0.0, 1.0], rounded to 4 d.p.

    Examples
    --------
    >>> severity_score(5, 10)
    0.5
    >>> severity_score(0, 10)
    0.0
    >>> severity_score(10, 10)
    1.0
    >>> severity_score(0, 0)  # degenerate: no flags possible
    0.0
    """
    raw = normalize(float(flag_count), 0.0, float(max_flags))
    return round_score(raw, 4)

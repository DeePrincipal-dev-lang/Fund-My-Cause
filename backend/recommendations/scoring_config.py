"""
Scoring-weights configuration for the recommendation service.

All weights are loaded once at module initialisation from environment
variables, validated against a strict schema, and stored as a frozen
dataclass instance.  Any missing or out-of-range value raises a clear
``ValueError`` at startup so misconfiguration is never silently ignored.

Environment variable names follow the pattern::

    RECOMMENDATION_WEIGHT_<FIELD_UPPER_SNAKE>

When a variable is absent the built-in default is used silently, so a
partial configuration is safe for local development while still allowing
production overrides.

Usage::

    from scoring_config import SCORING_CONFIG

    boost = SCORING_CONFIG.category_boost
"""

from __future__ import annotations

import os
from dataclasses import dataclass, fields
from typing import Optional


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ScoringWeightsConfig:
    """
    All numeric factors used by the recommendation scoring functions.

    Attributes
    ----------
    category_boost:
        Multiplier applied to a campaign whose category matches one of the
        user's preferred categories.  Must be ≥ 1.0 (a value below 1 would
        demote preferred categories).
    age_divisor_min:
        Lower bound (hours) used in the age denominator of the trending
        score.  The raw age is clamped to ``max(age_hours, age_divisor_min)``
        to avoid division by a near-zero value for brand-new campaigns.
        Must be > 0.
    """

    category_boost: float = 2.0
    age_divisor_min: float = 1.0


# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

#: Canonical default config — use this when you just need the plain defaults.
DEFAULT_SCORING_CONFIG = ScoringWeightsConfig()

# Collect all field names once so they can be used in validation and loading.
_FIELD_NAMES: tuple[str, ...] = tuple(f.name for f in fields(ScoringWeightsConfig))


# ---------------------------------------------------------------------------
# Validator
# ---------------------------------------------------------------------------

def validate_scoring_config(cfg: ScoringWeightsConfig) -> None:
    """
    Validate *cfg* and raise :class:`ValueError` with a specific message if
    any field is missing, non-finite, negative, or violates its domain rule.

    Checks
    ------
    * All fields must be present and finite floats.
    * All fields must be ≥ 0.
    * ``category_boost`` must be ≥ 1.0.
    * ``age_divisor_min`` must be > 0.

    Raises
    ------
    ValueError
        With a message that names the offending field and explains the
        constraint, so callers can surface it as a clear startup error.
    """
    import math

    for name in _FIELD_NAMES:
        val = getattr(cfg, name, None)
        if val is None:
            raise ValueError(
                f"[scoring-config] Missing required weight: '{name}'. "
                f"Set RECOMMENDATION_WEIGHT_{name.upper()} or rely on the built-in default."
            )
        if not isinstance(val, (int, float)) or math.isnan(val) or math.isinf(val):
            raise ValueError(
                f"[scoring-config] Weight '{name}' must be a finite number, got: {val!r}"
            )
        if val < 0:
            raise ValueError(
                f"[scoring-config] Weight '{name}' must be ≥ 0, got: {val}"
            )

    # Domain-specific range checks
    if cfg.category_boost < 1.0:
        raise ValueError(
            f"[scoring-config] 'category_boost' must be ≥ 1.0 "
            f"(a value < 1 demotes preferred-category results), got: {cfg.category_boost}"
        )

    if cfg.age_divisor_min <= 0:
        raise ValueError(
            f"[scoring-config] 'age_divisor_min' must be > 0 to prevent "
            f"division by zero in the trending score, got: {cfg.age_divisor_min}"
        )


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

def load_scoring_config(
    env: Optional[dict[str, str]] = None,
) -> ScoringWeightsConfig:
    """
    Build a :class:`ScoringWeightsConfig` from an optional env-var mapping.

    For every field the function looks for::

        RECOMMENDATION_WEIGHT_<FIELD_NAME_UPPER>

    If the variable is absent the default value is used silently.  If it is
    present but not a valid finite number a ``ValueError`` is raised
    immediately.  After merging defaults with overrides the full config is
    validated and returned as a frozen dataclass.

    Parameters
    ----------
    env:
        Mapping of environment variables.  Defaults to ``os.environ``.

    Returns
    -------
    ScoringWeightsConfig
        Frozen, fully-validated configuration.

    Raises
    ------
    ValueError
        If an env var is present but malformed, or if any resolved value
        violates the domain constraints checked by
        :func:`validate_scoring_config`.
    """
    import math

    if env is None:
        env = dict(os.environ)

    resolved: dict[str, float] = {}

    for field_info in fields(ScoringWeightsConfig):
        name = field_info.name
        env_key = f"RECOMMENDATION_WEIGHT_{name.upper()}"
        raw = env.get(env_key)

        if raw is None or raw == "":
            # Fall back to the built-in default — partial config is valid.
            resolved[name] = field_info.default  # type: ignore[arg-type]
        else:
            try:
                parsed = float(raw)
            except ValueError:
                raise ValueError(
                    f"[scoring-config] Environment variable {env_key} must be a "
                    f"finite number, got: {raw!r}"
                ) from None

            if math.isnan(parsed) or math.isinf(parsed):
                raise ValueError(
                    f"[scoring-config] Environment variable {env_key} must be a "
                    f"finite number, got: {raw!r}"
                )

            resolved[name] = parsed

    cfg = ScoringWeightsConfig(**resolved)
    validate_scoring_config(cfg)
    return cfg


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

#: Application-wide scoring weights resolved once at module load time.
#:
#: Import this constant wherever you need weights rather than calling
#: :func:`load_scoring_config` on every request.
SCORING_CONFIG: ScoringWeightsConfig = load_scoring_config()


# ---------------------------------------------------------------------------
# Startup hook
# ---------------------------------------------------------------------------

def assert_startup_config() -> ScoringWeightsConfig:
    """
    Explicit startup hook: reload and validate the scoring config from the
    current process environment, raising :class:`ValueError` on any invalid
    value.

    Services should call this once during bootstrap (e.g. inside
    ``service.start()`` or ``main()``) so misconfiguration fails fast,
    independently of the module-level ``SCORING_CONFIG`` import side effect.

    Returns the validated config so the caller can cache it.

    Raises
    ------
    ValueError
        If the current environment produces an invalid scoring config.
    """
    cfg = load_scoring_config()
    validate_scoring_config(cfg)
    return cfg

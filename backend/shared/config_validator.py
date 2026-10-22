"""
Configuration validation utilities for standardized environment variable loading
across Python backend services. Provides schema-based validation that fails fast
with descriptive error messages for missing or invalid settings.
"""

import os
from typing import Any, Callable, Dict, List, Optional, Union
import structlog

logger = structlog.get_logger(__name__)


class ConfigRule:
    """Definition of a single configuration parameter"""

    def __init__(
        self,
        env: str,
        required: bool = False,
        default: Optional[Union[str, int, bool]] = None,
        description: Optional[str] = None,
        enum: Optional[List[str]] = None,
        validate: Optional[Callable[[str], bool]] = None,
        type_: type = str,
    ):
        self.env = env
        self.required = required
        self.default = default
        self.description = description
        self.enum = enum
        self.validate = validate
        self.type_ = type_


class ConfigValidator:
    """Validates configuration against a schema"""

    def __init__(self, schema: Dict[str, ConfigRule], env: Optional[Dict[str, str]] = None):
        """Initialize validator with schema and optional env dict"""
        self.schema = schema
        self.env = env or os.environ

    def validate(self) -> Dict[str, Any]:
        """
        Validate configuration against schema
        Raises ValueError if validation fails
        """
        config = {}
        errors = []

        for key, rule in self.schema.items():
            value = self.env.get(rule.env)

            # Check if required
            if not value and rule.required and rule.default is None:
                error_msg = f"Missing required environment variable: {rule.env}"
                if rule.description:
                    error_msg += f" ({rule.description})"
                errors.append(error_msg)
                continue

            # Use default if not provided
            if value is None:
                if rule.default is not None:
                    config[key] = rule.default
                continue

            # Validate enum values
            if rule.enum and value not in rule.enum:
                error_msg = f'Invalid value for {rule.env}: "{value}". Must be one of: {", ".join(rule.enum)}'
                if rule.description:
                    error_msg += f" ({rule.description})"
                errors.append(error_msg)
                continue

            # Custom validation
            if rule.validate and not rule.validate(value):
                error_msg = f'Invalid value for {rule.env}: "{value}"'
                if rule.description:
                    error_msg += f" ({rule.description})"
                errors.append(error_msg)
                continue

            # Type conversion
            try:
                if rule.type_ == int:
                    config[key] = int(value)
                elif rule.type_ == bool:
                    config[key] = value.lower() in ("true", "1", "yes", "on")
                else:
                    config[key] = value
            except (ValueError, TypeError) as e:
                error_msg = f'Failed to convert {rule.env} to {rule.type_.__name__}: "{value}"'
                if rule.description:
                    error_msg += f" ({rule.description})"
                errors.append(error_msg)

        if errors:
            error_text = "\n".join(f"  ✗ {e}" for e in errors)
            raise ValueError(f"Configuration validation failed:\n{error_text}")

        return config


def require_env(
    name: str,
    description: Optional[str] = None,
    enum: Optional[List[str]] = None,
    validate: Optional[Callable[[str], bool]] = None,
) -> str:
    """
    Require an environment variable and validate it at startup
    Fails immediately with a descriptive error if missing or invalid
    """
    value = os.environ.get(name, "").strip()

    if not value:
        error_msg = f"Required environment variable missing: {name}"
        if description:
            error_msg += f" ({description})"
        logger.error(error_msg)
        raise ValueError(error_msg)

    if enum and value not in enum:
        error_msg = f'Invalid value for {name}: "{value}". Must be one of: {", ".join(enum)}'
        if description:
            error_msg += f" ({description})"
        logger.error(error_msg)
        raise ValueError(error_msg)

    if validate and not validate(value):
        error_msg = f'Invalid value for {name}: "{value}"'
        if description:
            error_msg += f" ({description})"
        logger.error(error_msg)
        raise ValueError(error_msg)

    return value


def get_optional_env(
    name: str,
    default: Optional[str] = None,
    description: Optional[str] = None,
    enum: Optional[List[str]] = None,
    validate: Optional[Callable[[str], bool]] = None,
) -> Optional[str]:
    """Get optional environment variable with validation"""
    value = os.environ.get(name, "").strip()

    if not value:
        return default

    if enum and value not in enum:
        error_msg = f'Invalid value for {name}: "{value}". Must be one of: {", ".join(enum)}'
        if description:
            error_msg += f" ({description})"
        logger.error(error_msg)
        raise ValueError(error_msg)

    if validate and not validate(value):
        error_msg = f'Invalid value for {name}: "{value}"'
        if description:
            error_msg += f" ({description})"
        logger.error(error_msg)
        raise ValueError(error_msg)

    return value


def get_env_int(
    name: str,
    required: bool = False,
    default: Optional[int] = None,
    min_value: Optional[int] = None,
    max_value: Optional[int] = None,
    description: Optional[str] = None,
) -> Optional[int]:
    """Validate an integer environment variable"""
    value = os.environ.get(name, "").strip()

    if not value:
        if required:
            error_msg = f"Required integer environment variable missing: {name}"
            if description:
                error_msg += f" ({description})"
            logger.error(error_msg)
            raise ValueError(error_msg)
        return default

    try:
        int_value = int(value)
    except ValueError:
        error_msg = f'Invalid integer value for {name}: "{value}"'
        if description:
            error_msg += f" ({description})"
        logger.error(error_msg)
        raise ValueError(error_msg)

    if min_value is not None and int_value < min_value:
        error_msg = f"Value for {name} is too small: {int_value} < {min_value}"
        if description:
            error_msg += f" ({description})"
        logger.error(error_msg)
        raise ValueError(error_msg)

    if max_value is not None and int_value > max_value:
        error_msg = f"Value for {name} is too large: {int_value} > {max_value}"
        if description:
            error_msg += f" ({description})"
        logger.error(error_msg)
        raise ValueError(error_msg)

    return int_value


def get_env_bool(
    name: str,
    default: bool = False,
    description: Optional[str] = None,
) -> bool:
    """Validate a boolean environment variable"""
    value = os.environ.get(name, "").strip()

    if not value:
        return default

    if value.lower() in ("true", "1", "yes", "on"):
        return True

    if value.lower() in ("false", "0", "no", "off"):
        return False

    error_msg = f'Invalid boolean value for {name}: "{value}"'
    if description:
        error_msg += f" ({description})"
    logger.error(error_msg)
    raise ValueError(error_msg)

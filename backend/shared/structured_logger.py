"""
Structured logging standard for backend services.

Provides a centralized logger configuration that ensures consistent
logging across fraud_detection, recommendations, and shared modules.
Replaces ad-hoc print statements and inconsistent logging calls.

Log levels follow this convention:
- DEBUG: Detailed diagnostic information (function entry/exit, variable values)
- INFO: General informational messages (service startup, configuration details)
- WARNING: Warning messages (recovered errors, deprecated usage, potential issues)
- ERROR: Error conditions (failed operations, exceptions)
"""

import structlog
from typing import Any, Dict, Optional


def get_logger(name: str) -> structlog.BoundLogger:
    """
    Get a configured logger for a module.

    Replaces logging.getLogger() with structlog configuration.
    Use this in any module that needs to log.

    Args:
        name: Module name (typically __name__)

    Returns:
        Configured structlog logger with consistent formatting
    """
    return structlog.get_logger(name)


def configure_structlog() -> None:
    """
    Configure structlog with standard processors and formatting.

    Should be called once at application startup, typically in the
    main entry point or initialization module.
    """
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def log_debug(logger: structlog.BoundLogger, message: str, **kwargs: Any) -> None:
    """
    Log a debug message with structured context.

    Args:
        logger: Logger instance from get_logger()
        message: Human-readable message
        **kwargs: Additional context fields
    """
    logger.debug(message, **kwargs)


def log_info(logger: structlog.BoundLogger, message: str, **kwargs: Any) -> None:
    """
    Log an info message with structured context.

    Args:
        logger: Logger instance from get_logger()
        message: Human-readable message
        **kwargs: Additional context fields
    """
    logger.info(message, **kwargs)


def log_warning(logger: structlog.BoundLogger, message: str, **kwargs: Any) -> None:
    """
    Log a warning message with structured context.

    Args:
        logger: Logger instance from get_logger()
        message: Human-readable message
        **kwargs: Additional context fields
    """
    logger.warning(message, **kwargs)


def log_error(logger: structlog.BoundLogger, message: str, **kwargs: Any) -> None:
    """
    Log an error message with structured context.

    Args:
        logger: Logger instance from get_logger()
        message: Human-readable message
        **kwargs: Additional context fields
    """
    logger.error(message, **kwargs)


def log_exception(
    logger: structlog.BoundLogger,
    message: str,
    exc: Optional[Exception] = None,
    **kwargs: Any
) -> None:
    """
    Log an exception with structured context.

    Args:
        logger: Logger instance from get_logger()
        message: Human-readable message
        exc: Exception instance (auto-captured if None)
        **kwargs: Additional context fields
    """
    logger.exception(message, exc_info=exc, **kwargs)

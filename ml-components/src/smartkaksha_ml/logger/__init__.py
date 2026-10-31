"""SmartKaksha ML Logging Subsystem.

Provides structured logging under 'smartkaksha.*' with:
1. Console and rotating file handlers.
2. Text format (development) and JSON format (production/service).
3. Request ID tracking via contextvars.
4. Strict privacy filter preventing biometric leakage (embeddings, raw images, names).
"""

import contextvars
import json
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional


# Context variable for tracing request IDs across async/threads
request_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "request_id", default=None
)

# Forbidden field keys that must never be emitted to logs
FORBIDDEN_LOG_KEYS = {
    "embedding",
    "embeddings",
    "image",
    "image_bytes",
    "photo_bytes",
    "student_name",
    "face_crop",
    "crops",
}

STANDARD_RECORD_ATTRS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
    "asctime",
}


def set_request_id(request_id: Optional[str]) -> None:
    """Set the current request ID in the context."""
    request_id_ctx.set(request_id)


def get_request_id() -> Optional[str]:
    """Retrieve the current request ID from context."""
    return request_id_ctx.get()


class PrivacyFilter(logging.Filter):
    """Enforces strict DPDP privacy compliance by stripping biometric and PII attributes."""

    def filter(self, record: logging.LogRecord) -> bool:
        # Check attributes and strip any sensitive keys added via extra
        for key in list(record.__dict__.keys()):
            if key not in STANDARD_RECORD_ATTRS and key.lower() in FORBIDDEN_LOG_KEYS:
                delattr(record, key)

        # Inject request_id if not explicitly present
        if not hasattr(record, "request_id"):
            record.request_id = get_request_id() or "-"

        return True


class JSONLogFormatter(logging.Formatter):
    """JSON formatter for production environments and centralized ingestion."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
            "module": record.module,
            "line": record.lineno,
        }

        # Include custom extra fields if they are safe
        for key, value in record.__dict__.items():
            if (
                key not in log_entry
                and not key.startswith("_")
                and key not in logging.LogRecord.__dict__
                and key.lower() not in FORBIDDEN_LOG_KEYS
            ):
                try:
                    # Test JSON serializability
                    json.dumps(value)
                    log_entry[key] = value
                except (TypeError, OverflowError):
                    log_entry[key] = str(value)

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)


class TextLogFormatter(logging.Formatter):
    """Clean text formatter for local development and CLI stages."""

    DEFAULT_FORMAT = (
        "[%(asctime)s] [%(levelname)s] [%(name)s] [req:%(request_id)s]: %(message)s"
    )

    def __init__(self, fmt: Optional[str] = None, datefmt: Optional[str] = None) -> None:
        super().__init__(fmt=fmt or self.DEFAULT_FORMAT, datefmt=datefmt)


def setup_logging(
    log_dir: Optional[Path] = None,
    log_level: str = "INFO",
    json_format: bool = False,
    max_bytes: int = 10 * 1024 * 1024,  # 10 MB
    backup_count: int = 5,
) -> None:
    """Initialize root smartkaksha logger with handlers and filters."""
    root_logger = logging.getLogger("smartkaksha")
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    # Avoid duplicate handlers if setup_logging is called multiple times
    root_logger.handlers.clear()

    privacy_filter = PrivacyFilter()

    # Formatter selection
    formatter = JSONLogFormatter() if json_format else TextLogFormatter()

    # 1. Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(formatter)
    console_handler.addFilter(privacy_filter)
    root_logger.addHandler(console_handler)

    # 2. Rotating File Handler (if log_dir provided)
    if log_dir is not None:
        log_dir_path = Path(log_dir)
        log_dir_path.mkdir(parents=True, exist_ok=True)
        file_path = log_dir_path / "smartkaksha.log"
        file_handler = RotatingFileHandler(
            filename=file_path,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8",
        )
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(formatter)
        file_handler.addFilter(privacy_filter)
        root_logger.addHandler(file_handler)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Get a namespaced logger under 'smartkaksha.<name>'."""
    if not name:
        return logging.getLogger("smartkaksha")
    if name.startswith("smartkaksha."):
        return logging.getLogger(name)
    return logging.getLogger(f"smartkaksha.{name}")

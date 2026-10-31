"""Unit tests for SmartKaksha ML Logging and Privacy Filters."""

import logging
from pathlib import Path

from smartkaksha_ml.logger import (
    JSONLogFormatter,
    PrivacyFilter,
    get_logger,
    get_request_id,
    set_request_id,
    setup_logging,
)


def test_request_id_propagation():
    """Test that request ID is tracked via context and injected into log records."""
    set_request_id("req-12345")
    assert get_request_id() == "req-12345"

    filter_ = PrivacyFilter()
    record = logging.LogRecord(
        name="smartkaksha.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="Test message",
        args=(),
        exc_info=None,
    )
    filter_.filter(record)
    assert getattr(record, "request_id", None) == "req-12345"
    set_request_id(None)


def test_privacy_filter_strips_forbidden_keys():
    """Test that biometric data and PII fields are strictly deleted from log records."""
    filter_ = PrivacyFilter()
    record = logging.LogRecord(
        name="smartkaksha.privacy",
        level=logging.INFO,
        pathname=__file__,
        lineno=20,
        msg="Processing student attendance",
        args=(),
        exc_info=None,
    )
    # Inject sensitive attributes directly
    record.embedding = [0.12, 0.45, 0.89]
    record.student_name = "Jane Doe"
    record.photo_bytes = b"fake_bytes"
    record.safe_student_id = "std_9999"

    filter_.filter(record)

    # Sensitive attributes must be stripped
    assert not hasattr(record, "embedding")
    assert not hasattr(record, "student_name")
    assert not hasattr(record, "photo_bytes")
    # Safe attributes remain
    assert getattr(record, "safe_student_id", None) == "std_9999"


def test_json_formatter_serialization():
    """Test JSON log formatting and exclusion of non-serializable objects."""
    formatter = JSONLogFormatter()
    record = logging.LogRecord(
        name="smartkaksha.service",
        level=logging.WARNING,
        pathname=__file__,
        lineno=30,
        msg="High review load warning",
        args=(),
        exc_info=None,
    )
    record.request_id = "req-abc"
    record.faces_count = 55

    output = formatter.format(record)
    assert '"level": "WARNING"' in output
    assert '"faces_count": 55' in output
    assert '"request_id": "req-abc"' in output


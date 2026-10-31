"""Unit tests for SmartKaksha ML Exception Hierarchy."""

import pytest

from smartkaksha_ml.exception import (
    ConfigurationException,
    DataValidationException,
    InvalidImageException,
    ModelChecksumMismatchException,
    ModelLoadingException,
    SmartKakshaException,
    StoreAccessException,
    VersionMismatchException,
)


def test_base_exception_formatting():
    """Test string representation and dictionary serialization of SmartKakshaException."""
    cause = ValueError("Original error cause")
    exc = SmartKakshaException(
        message="Face detection pipeline failed",
        error_code="DETECTION_FAILURE",
        context={"image_width": 1920, "image_height": 1080},
        cause=cause,
    )

    text = str(exc)
    assert "[DETECTION_FAILURE]" in text
    assert "Face detection pipeline failed" in text
    assert "1920" in text
    assert "ValueError" in text

    d = exc.to_dict()
    assert d["error_code"] == "DETECTION_FAILURE"
    assert d["message"] == "Face detection pipeline failed"
    assert d["context"]["image_width"] == 1920
    assert "ValueError" in d["cause"]


def test_subtype_error_codes():
    """Test that specialized exception subtypes carry correct default error codes."""
    assert ConfigurationException("test").error_code == "CONFIG_ERROR"
    assert DataValidationException("test").error_code == "DATA_VALIDATION_ERROR"
    assert InvalidImageException("test").error_code == "INVALID_IMAGE_ERROR"
    assert ModelLoadingException("test").error_code == "MODEL_LOAD_ERROR"
    assert ModelChecksumMismatchException("test").error_code == "CHECKSUM_MISMATCH_ERROR"
    assert VersionMismatchException("test").error_code == "VERSION_MISMATCH_ERROR"
    assert StoreAccessException("test").error_code == "STORE_ACCESS_ERROR"


def test_exception_inheritance():
    """Ensure all custom exceptions inherit from SmartKakshaException."""
    assert issubclass(ModelChecksumMismatchException, ModelLoadingException)
    assert issubclass(ModelLoadingException, SmartKakshaException)
    assert issubclass(ConfigurationException, SmartKakshaException)


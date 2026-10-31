"""SmartKaksha ML Exceptions Hierarchy.

Structured exceptions carrying error codes, contextual data dictionaries,
and chained causes for traceable error handling.
"""

from typing import Any, Optional


class SmartKakshaException(Exception):
    """Base exception for all errors raised by the SmartKaksha ML library."""

    def __init__(
        self,
        message: str,
        error_code: str = "SMARTKAKSHA_ERROR",
        context: Optional[dict[str, Any]] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.context = context or {}
        self.cause = cause
        if cause is not None:
            self.__cause__ = cause

    def to_dict(self) -> dict[str, Any]:
        """Convert exception details to dictionary representation."""
        data: dict[str, Any] = {
            "error_code": self.error_code,
            "message": self.message,
            "context": self.context,
        }
        if self.cause:
            data["cause"] = f"{type(self.cause).__name__}: {self.cause}"
        return data

    def __str__(self) -> str:
        base = f"[{self.error_code}] {self.message}"
        if self.context:
            base += f" | context: {self.context}"
        if self.cause:
            base += f" | caused by: {type(self.cause).__name__}({self.cause})"
        return base


class ConfigurationException(SmartKakshaException):
    """Raised when configuration files or environment parameters are invalid or missing."""

    def __init__(
        self,
        message: str,
        context: Optional[dict[str, Any]] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code="CONFIG_ERROR",
            context=context,
            cause=cause,
        )


class DataValidationException(SmartKakshaException):
    """Raised when training/evaluation dataset structure or manifests fail validation."""

    def __init__(
        self,
        message: str,
        context: Optional[dict[str, Any]] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code="DATA_VALIDATION_ERROR",
            context=context,
            cause=cause,
        )


class InvalidImageException(SmartKakshaException):
    """Raised when an uploaded/loaded image cannot be decoded, is corrupted, or fails formats."""

    def __init__(
        self,
        message: str,
        context: Optional[dict[str, Any]] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code="INVALID_IMAGE_ERROR",
            context=context,
            cause=cause,
        )


class ModelLoadingException(SmartKakshaException):
    """Raised when ONNX models cannot be loaded into memory or execution providers fail."""

    def __init__(
        self,
        message: str,
        context: Optional[dict[str, Any]] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code="MODEL_LOAD_ERROR",
            context=context,
            cause=cause,
        )


class ModelChecksumMismatchException(ModelLoadingException):
    """Raised when model weights on disk fail verification against models/MANIFEST."""

    def __init__(
        self,
        message: str,
        context: Optional[dict[str, Any]] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(
            message=message,
            context=context,
            cause=cause,
        )
        self.error_code = "CHECKSUM_MISMATCH_ERROR"


class VersionMismatchException(SmartKakshaException):
    """Raised when model version, preprocessing version, gallery version or thresholds conflict."""

    def __init__(
        self,
        message: str,
        context: Optional[dict[str, Any]] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code="VERSION_MISMATCH_ERROR",
            context=context,
            cause=cause,
        )


class StoreAccessException(SmartKakshaException):
    """Raised when vector database (Qdrant) or local file store fails to read/write."""

    def __init__(
        self,
        message: str,
        context: Optional[dict[str, Any]] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code="STORE_ACCESS_ERROR",
            context=context,
            cause=cause,
        )


class EnrollmentException(SmartKakshaException):
    """Raised when an enrollment batch violates structural constraints (e.g. wrong count)."""

    def __init__(
        self,
        message: str,
        context: Optional[dict[str, Any]] = None,
        cause: Optional[BaseException] = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code="ENROLLMENT_ERROR",
            context=context,
            cause=cause,
        )

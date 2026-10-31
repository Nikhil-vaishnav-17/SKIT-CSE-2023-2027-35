"""SmartKaksha ML Library.

Measured, reproducible face detection, alignment, embedding, and roster-based
attendance inference pipeline for college classrooms.
"""

__version__ = "0.1.0"

from smartkaksha_ml.config import ConfigurationManager
from smartkaksha_ml.constants import (
    APP_NAME,
    FaceStatus,
    SessionStudentStatus,
)
from smartkaksha_ml.exception import (
    ConfigurationException,
    DataValidationException,
    InvalidImageException,
    ModelChecksumMismatchException,
    ModelLoadingException,
    SmartKakshaException,
    VersionMismatchException,
)
from smartkaksha_ml.logger import get_logger, setup_logging

__all__ = [
    "__version__",
    "APP_NAME",
    "ConfigurationManager",
    "SmartKakshaException",
    "ConfigurationException",
    "DataValidationException",
    "InvalidImageException",
    "ModelLoadingException",
    "ModelChecksumMismatchException",
    "VersionMismatchException",
    "FaceStatus",
    "SessionStudentStatus",
    "get_logger",
    "setup_logging",
]


"""SmartKaksha ML Constants.

Centralized definitions for pipeline constants, status codes, default file paths,
and standard dimensions.
"""

from enum import Enum
from pathlib import Path


# Application identity
APP_NAME: str = "SmartKaksha ML"
PACKAGE_NAME: str = "smartkaksha_ml"
DEFAULT_LOGGER_NAME: str = "smartkaksha"

# Default configuration paths relative to ml-components root
DEFAULT_CONFIG_PATH: Path = Path("config/config.yaml")
DEFAULT_PARAMS_PATH: Path = Path("config/params.yaml")
DEFAULT_MANIFEST_PATH: Path = Path("models/MANIFEST")

# InsightFace buffalo_l defaults
BUFFALO_L_PACK_VERSION: str = "buffalo_l"
DETECTOR_MODEL_FILE: str = "det_10g.onnx"
RECOGNIZER_MODEL_FILE: str = "w600k_r50.onnx"
DEFAULT_PREPROCESSING_VERSION: str = "align1"
GALLERY_COLLECTION_PREFIX: str = "gallery__"

# Biometric & Model Constraints
ARCFACE_INPUT_SIZE: tuple[int, int] = (112, 112)
ARCFACE_EMBEDDING_DIM: int = 512
IMAGE_COLOR_FORMAT: str = "BGR"
ENROLLMENT_REQUIRED_PHOTO_COUNT: int = 5
MAX_SESSION_PHOTOS_PER_REQUEST: int = 3


class FaceStatus(str, Enum):
    """Status assigned to a detected face in a classroom image."""
    MATCHED = "matched"
    UNCERTAIN = "uncertain"
    UNKNOWN = "unknown"
    SKIPPED = "skipped"


class SessionStudentStatus(str, Enum):
    """Overall status assigned to a student on the session roster."""
    MATCHED = "matched"
    UNCERTAIN = "uncertain"
    NOT_SEEN = "not_seen"
    NOT_ENROLLED = "not_enrolled"


class AttendanceDecision(str, Enum):
    """Pre-filled attendance status for instructor review."""
    PRESENT = "Present"
    ABSENT = "Absent"
    UNSET = "Unset"


# Mapping from SessionStudentStatus to AttendanceDecision
STATUS_TO_ATTENDANCE: dict[SessionStudentStatus, AttendanceDecision] = {
    SessionStudentStatus.MATCHED: AttendanceDecision.PRESENT,
    SessionStudentStatus.UNCERTAIN: AttendanceDecision.UNSET,
    SessionStudentStatus.NOT_SEEN: AttendanceDecision.ABSENT,
    SessionStudentStatus.NOT_ENROLLED: AttendanceDecision.UNSET,
}


class EmbeddingKind(str, Enum):
    """Kind of embedding stored in vector store."""
    PHOTO = "photo"
    MEAN = "mean"


class SkipReason(str, Enum):
    """Reasons why a detected face is skipped from recognition."""
    FACE_TOO_SMALL = "face_too_small"
    LOW_DETECTION_CONFIDENCE = "low_detection_confidence"
    EXTREME_POSE = "extreme_pose"
    POOR_LANDMARKS = "poor_landmarks"
    BORDER_CUTOFF = "border_cutoff"
    EXCESSIVE_BLUR = "excessive_blur"
    ABNORMAL_BRIGHTNESS = "abnormal_brightness"


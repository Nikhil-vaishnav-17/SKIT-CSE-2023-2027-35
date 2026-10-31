"""SmartKaksha ML Entity Definitions.

Strongly typed dataclasses and Pydantic models for configuration, parameter
tunables, and pipeline result data structures.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from smartkaksha_ml.constants import (
    ARCFACE_EMBEDDING_DIM,
    ARCFACE_INPUT_SIZE,
    BUFFALO_L_PACK_VERSION,
    DEFAULT_PREPROCESSING_VERSION,
    FaceStatus,
    SessionStudentStatus,
)


# ==============================================================================
# Configuration Entities
# ==============================================================================

@dataclass
class PathsConfig:
    """Filesystem paths for datasets, models, artifacts, and reports."""
    root_dir: Path
    data_dir: Path
    raw_data_dir: Path
    interim_data_dir: Path
    processed_data_dir: Path
    manifests_dir: Path
    models_dir: Path
    manifest_file: Path
    artifacts_dir: Path
    reports_dir: Path
    logs_dir: Path


@dataclass
class ModelItemConfig:
    """Configuration for an individual ONNX model file."""
    filename: str
    model_name: str
    framework: str
    sha256: str
    role: str


@dataclass
class ModelRegistryConfig:
    """Settings governing Buffalo_l models, execution providers, and threading."""
    pack_version: str
    detector: ModelItemConfig
    recognizer: ModelItemConfig
    device: str  # "cpu" or "gpu"
    intra_op_threads: int
    inter_op_threads: int


@dataclass
class StoreConfig:
    """Vector database or local file store configuration."""
    backend: str  # "file" or "qdrant"
    collection_name: str
    local_store_path: Path
    qdrant_host: Optional[str] = None
    qdrant_port: Optional[int] = 6333
    qdrant_api_key: Optional[str] = None
    qdrant_https: bool = False


@dataclass
class LoggingConfig:
    """Logging destination, rotation, and formatting parameters."""
    level: str
    json_format: bool
    max_bytes: int
    backup_count: int


@dataclass
class ServiceLimitsConfig:
    """HTTP transport restrictions and concurrency thresholds."""
    max_photos_per_request: int
    max_file_size_mb: int
    allowed_extensions: list[str]
    max_concurrent_requests: int


@dataclass
class AppConfig:
    """Composite root application configuration loaded from config.yaml."""
    environment: str
    paths: PathsConfig
    models: ModelRegistryConfig
    store: StoreConfig
    logging: LoggingConfig
    limits: ServiceLimitsConfig


# ==============================================================================
# Parameter Tunables Entities
# ==============================================================================

@dataclass
class DetectionParams:
    """Tunables for SCRFD-10GF face detection and back-row tiling."""
    input_size: tuple[int, int]
    score_threshold: float
    nms_threshold: float
    min_face_size: int
    enable_tiling: bool
    tile_size: tuple[int, int]
    tile_overlap: float


@dataclass
class AlignmentParams:
    """Tunables for face landmark alignment and quality filters."""
    target_size: tuple[int, int]
    min_blur_score: float
    min_brightness: float
    max_brightness: float
    min_eye_distance: float
    max_yaw_degrees: float
    max_pitch_degrees: float
    max_roll_degrees: float


@dataclass
class EnrollmentParams:
    """Strict pre-approval checks for student 5-photo enrollment."""
    required_photo_count: int
    consistency_min: float
    dedup_threshold: float


@dataclass
class ThresholdParams:
    """Tuned cosine similarity thresholds versioned with models."""
    threshold_version: str
    model_version: str
    preprocessing_version: str
    accept_threshold: float
    review_threshold: float
    margin_threshold: float


@dataclass
class PipelineParams:
    """Composite parameters loaded from params.yaml."""
    seed: int
    detection: DetectionParams
    alignment: AlignmentParams
    enrollment: EnrollmentParams
    thresholds: ThresholdParams


# ==============================================================================
# Pipeline Result & Biometric Entities
# ==============================================================================

@dataclass
class BoundingBox:
    """2D Bounding box for a detected face [x1, y1, x2, y2]."""
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def width(self) -> float:
        return max(0.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        return max(0.0, self.y2 - self.y1)

    @property
    def area(self) -> float:
        return self.width * self.height


@dataclass
class Point2D:
    """A 2D coordinate on an image."""
    x: float
    y: float


@dataclass
class Landmarks5:
    """Five facial landmarks in original image coordinates."""
    left_eye: Point2D
    right_eye: Point2D
    nose: Point2D
    left_mouth: Point2D
    right_mouth: Point2D

    def as_list(self) -> list[tuple[float, float]]:
        return [
            (self.left_eye.x, self.left_eye.y),
            (self.right_eye.x, self.right_eye.y),
            (self.nose.x, self.nose.y),
            (self.left_mouth.x, self.left_mouth.y),
            (self.right_mouth.x, self.right_mouth.y),
        ]


@dataclass
class QualityFlags:
    """Quality assessment output for an aligned face crop."""
    is_valid: bool
    face_height_px: float
    blur_score: float
    brightness: float
    skip_reason: Optional[str] = None


@dataclass
class DetectedFace:
    """Face detected by SCRFD in a classroom or enrollment photo."""
    face_id: str
    photo_index: int
    bbox: BoundingBox
    confidence: float
    landmarks: Landmarks5
    quality: Optional[QualityFlags] = None


@dataclass
class FaceEmbedding:
    """ArcFace 512-dimensional normalized embedding."""
    face_id: str
    vector: list[float]  # 512 floats
    raw_norm: float
    model_version: str = BUFFALO_L_PACK_VERSION
    preprocessing_version: str = DEFAULT_PREPROCESSING_VERSION


@dataclass
class CandidateMatch:
    """Candidate match with cosine similarity score."""
    student_id: str
    similarity: float


@dataclass
class FaceMatchResult:
    """Matching verdict for an individual detected face."""
    face_id: str
    photo_index: int
    bbox: BoundingBox
    status: FaceStatus
    student_id: Optional[str] = None
    similarity: Optional[float] = None
    top_candidates: list[CandidateMatch] = field(default_factory=list)
    skip_reason: Optional[str] = None


@dataclass
class StudentSessionSummary:
    """Overall attendance verdict for a single student on the roster."""
    student_id: str
    status: SessionStudentStatus
    best_similarity: Optional[float] = None
    matched_photo_index: Optional[int] = None
    matched_face_id: Optional[str] = None


@dataclass
class SessionInferenceResult:
    """Complete result returned by the service facade for an attendance session."""
    session_id: str
    face_decisions: list[FaceMatchResult]
    roster_summaries: list[StudentSessionSummary]
    model_version: str
    gallery_version: str
    threshold_version: str
    timings_ms: dict[str, float]
    counts: dict[str, int]
    request_id: str


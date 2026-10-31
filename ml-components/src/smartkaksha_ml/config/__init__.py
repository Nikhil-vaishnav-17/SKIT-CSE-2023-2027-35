"""SmartKaksha ML Configuration Manager.

Loads, validates, and exposes typed application configuration and tunable parameters
from config.yaml and params.yaml with environment variable overrides.
"""

import os
from pathlib import Path
from typing import Any, Optional
import yaml

from smartkaksha_ml.constants import (
    DEFAULT_CONFIG_PATH,
    DEFAULT_MANIFEST_PATH,
    DEFAULT_PARAMS_PATH,
)
from smartkaksha_ml.entity import (
    AlignmentParams,
    AppConfig,
    DetectionParams,
    EnrollmentParams,
    LoggingConfig,
    ModelItemConfig,
    ModelRegistryConfig,
    PathsConfig,
    PipelineParams,
    ServiceLimitsConfig,
    StoreConfig,
    ThresholdParams,
)
from smartkaksha_ml.exception import (
    ConfigurationException,
    VersionMismatchException,
)
from smartkaksha_ml.logger import get_logger

logger = get_logger("config")


class ConfigurationManager:
    """Manages typed configuration and parameters for the SmartKaksha ML pipeline."""

    def __init__(
        self,
        config_path: Optional[Path] = None,
        params_path: Optional[Path] = None,
    ) -> None:
        self.config_path = Path(
            config_path
            or os.getenv("SMARTKAKSHA_CONFIG_PATH")
            or DEFAULT_CONFIG_PATH
        )
        self.params_path = Path(
            params_path
            or os.getenv("SMARTKAKSHA_PARAMS_PATH")
            or DEFAULT_PARAMS_PATH
        )

        self._app_config: Optional[AppConfig] = None
        self._pipeline_params: Optional[PipelineParams] = None

        self._load_configurations()

    def _read_yaml(self, file_path: Path) -> dict[str, Any]:
        """Read and parse a YAML file."""
        if not file_path.exists():
            raise ConfigurationException(
                f"Configuration file not found: {file_path}",
                context={"path": str(file_path)},
            )
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = yaml.safe_load(f)
                return content or {}
        except Exception as e:
            raise ConfigurationException(
                f"Failed to parse YAML file {file_path}: {e}",
                context={"path": str(file_path)},
                cause=e,
            )

    def _load_configurations(self) -> None:
        """Parse raw YAML dictionaries into strongly typed dataclasses."""
        raw_config = self._read_yaml(self.config_path)
        raw_params = self._read_yaml(self.params_path)

        # ----------------------------------------------------------------------
        # Parse AppConfig
        # ----------------------------------------------------------------------
        env = os.getenv("SMARTKAKSHA_ENV", raw_config.get("environment", "development"))
        raw_paths = raw_config.get("paths", {})
        root_dir = Path(raw_paths.get("root_dir", "."))

        paths_config = PathsConfig(
            root_dir=root_dir,
            data_dir=root_dir / raw_paths.get("data_dir", "data"),
            raw_data_dir=root_dir / raw_paths.get("raw_data_dir", "data/raw"),
            interim_data_dir=root_dir / raw_paths.get("interim_data_dir", "data/interim"),
            processed_data_dir=root_dir / raw_paths.get("processed_data_dir", "data/processed"),
            manifests_dir=root_dir / raw_paths.get("manifests_dir", "data/manifests"),
            models_dir=root_dir / raw_paths.get("models_dir", "models"),
            manifest_file=root_dir / raw_paths.get("manifest_file", "models/MANIFEST"),
            artifacts_dir=root_dir / raw_paths.get("artifacts_dir", "artifacts"),
            reports_dir=root_dir / raw_paths.get("reports_dir", "reports"),
            logs_dir=root_dir / raw_paths.get("logs_dir", "logs"),
        )

        raw_models = raw_config.get("models", {})
        raw_detector = raw_models.get("detector", {})
        raw_recognizer = raw_models.get("recognizer", {})

        models_config = ModelRegistryConfig(
            pack_version=raw_models.get("pack_version", "buffalo_l"),
            detector=ModelItemConfig(
                filename=raw_detector.get("filename", "det_10g.onnx"),
                model_name=raw_detector.get("model_name", "SCRFD-10GF"),
                framework=raw_detector.get("framework", "onnx"),
                sha256=raw_detector.get("sha256", ""),
                role=raw_detector.get("role", "face_detection"),
            ),
            recognizer=ModelItemConfig(
                filename=raw_recognizer.get("filename", "w600k_r50.onnx"),
                model_name=raw_recognizer.get("model_name", "ArcFace-ResNet50"),
                framework=raw_recognizer.get("framework", "onnx"),
                sha256=raw_recognizer.get("sha256", ""),
                role=raw_recognizer.get("role", "face_recognition"),
            ),
            device=raw_models.get("device", "cpu"),
            intra_op_threads=int(raw_models.get("intra_op_threads", 4)),
            inter_op_threads=int(raw_models.get("inter_op_threads", 2)),
        )

        raw_store = raw_config.get("store", {})
        store_config = StoreConfig(
            backend=raw_store.get("backend", "file"),
            collection_name=raw_store.get("collection_name", "gallery__w600k_r50__align1"),
            local_store_path=root_dir / raw_store.get("local_store_path", "artifacts/gallery_store.json"),
            qdrant_host=os.getenv("QDRANT_HOST", raw_store.get("qdrant_host", "localhost")),
            qdrant_port=int(os.getenv("QDRANT_PORT", raw_store.get("qdrant_port", 6333))),
            qdrant_api_key=os.getenv("QDRANT_API_KEY", raw_store.get("qdrant_api_key", "")),
            qdrant_https=bool(raw_store.get("qdrant_https", False)),
        )

        raw_logging = raw_config.get("logging", {})
        logging_config = LoggingConfig(
            level=os.getenv("SMARTKAKSHA_LOG_LEVEL", raw_logging.get("level", "INFO")),
            json_format=bool(raw_logging.get("json_format", False)),
            max_bytes=int(raw_logging.get("max_bytes", 10485760)),
            backup_count=int(raw_logging.get("backup_count", 5)),
        )

        raw_limits = raw_config.get("limits", {})
        limits_config = ServiceLimitsConfig(
            max_photos_per_request=int(raw_limits.get("max_photos_per_request", 3)),
            max_file_size_mb=int(raw_limits.get("max_file_size_mb", 20)),
            allowed_extensions=list(raw_limits.get("allowed_extensions", [".jpg", ".jpeg", ".png"])),
            max_concurrent_requests=int(raw_limits.get("max_concurrent_requests", 2)),
        )

        self._app_config = AppConfig(
            environment=env,
            paths=paths_config,
            models=models_config,
            store=store_config,
            logging=logging_config,
            limits=limits_config,
        )

        # ----------------------------------------------------------------------
        # Parse PipelineParams
        # ----------------------------------------------------------------------
        seed = int(raw_params.get("seed", 42))

        raw_detection = raw_params.get("detection", {})
        detection_params = DetectionParams(
            input_size=tuple(raw_detection.get("input_size", [640, 640])),
            score_threshold=float(raw_detection.get("score_threshold", 0.5)),
            nms_threshold=float(raw_detection.get("nms_threshold", 0.4)),
            min_face_size=int(raw_detection.get("min_face_size", 24)),
            enable_tiling=bool(raw_detection.get("enable_tiling", True)),
            tile_size=tuple(raw_detection.get("tile_size", [640, 640])),
            tile_overlap=float(raw_detection.get("tile_overlap", 0.2)),
        )

        raw_alignment = raw_params.get("alignment", {})
        alignment_params = AlignmentParams(
            target_size=tuple(raw_alignment.get("target_size", [112, 112])),
            min_blur_score=float(raw_alignment.get("min_blur_score", 50.0)),
            min_brightness=float(raw_alignment.get("min_brightness", 40.0)),
            max_brightness=float(raw_alignment.get("max_brightness", 220.0)),
            min_eye_distance=float(raw_alignment.get("min_eye_distance", 14.0)),
            max_yaw_degrees=float(raw_alignment.get("max_yaw_degrees", 35.0)),
            max_pitch_degrees=float(raw_alignment.get("max_pitch_degrees", 30.0)),
            max_roll_degrees=float(raw_alignment.get("max_roll_degrees", 25.0)),
        )

        raw_enrollment = raw_params.get("enrollment", {})
        enrollment_params = EnrollmentParams(
            required_photo_count=int(raw_enrollment.get("required_photo_count", 5)),
            consistency_min=float(raw_enrollment.get("consistency_min", 0.45)),
            dedup_threshold=float(raw_enrollment.get("dedup_threshold", 0.60)),
        )

        raw_thresholds = raw_params.get("thresholds", {})
        threshold_params = ThresholdParams(
            threshold_version=str(raw_thresholds.get("threshold_version", "v0.1.0-baseline")),
            model_version=str(raw_thresholds.get("model_version", "buffalo_l")),
            preprocessing_version=str(raw_thresholds.get("preprocessing_version", "align1")),
            accept_threshold=float(raw_thresholds.get("accept_threshold", 0.40)),
            review_threshold=float(raw_thresholds.get("review_threshold", 0.32)),
            margin_threshold=float(raw_thresholds.get("margin_threshold", 0.08)),
        )

        self._pipeline_params = PipelineParams(
            seed=seed,
            detection=detection_params,
            alignment=alignment_params,
            enrollment=enrollment_params,
            thresholds=threshold_params,
        )

    def get_app_config(self) -> AppConfig:
        """Return the validated application configuration."""
        if self._app_config is None:
            raise ConfigurationException("Application configuration has not been loaded.")
        return self._app_config

    def get_pipeline_params(self) -> PipelineParams:
        """Return the validated pipeline tunables."""
        if self._pipeline_params is None:
            raise ConfigurationException("Pipeline parameters have not been loaded.")
        return self._pipeline_params

    def validate_versions(self) -> None:
        """Verify that model pack version, threshold model version, and store version match."""
        app_cfg = self.get_app_config()
        params = self.get_pipeline_params()

        model_version = app_cfg.models.pack_version
        param_model_version = params.thresholds.model_version

        if model_version != param_model_version:
            raise VersionMismatchException(
                f"Model pack version '{model_version}' does not match "
                f"params threshold model version '{param_model_version}'.",
                context={
                    "configured_model_pack": model_version,
                    "threshold_model_version": param_model_version,
                },
            )
        logger.info(
            f"Version validation successful: model='{model_version}', "
            f"threshold_version='{params.thresholds.threshold_version}'"
        )


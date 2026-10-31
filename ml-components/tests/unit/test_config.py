"""Unit tests for SmartKaksha ML Configuration Management."""

import os
from pathlib import Path
import pytest

from smartkaksha_ml.config import ConfigurationManager
from smartkaksha_ml.exception import ConfigurationException, VersionMismatchException


def test_configuration_loading(tmp_path: Path):
    """Test loading valid config and params YAML files."""
    config_file = tmp_path / "config.yaml"
    params_file = tmp_path / "params.yaml"

    config_file.write_text("""
environment: "testing"
paths:
  root_dir: "."
  data_dir: "data"
  raw_data_dir: "data/raw"
  interim_data_dir: "data/interim"
  processed_data_dir: "data/processed"
  manifests_dir: "data/manifests"
  models_dir: "models"
  manifest_file: "models/MANIFEST"
  artifacts_dir: "artifacts"
  reports_dir: "reports"
  logs_dir: "logs"
models:
  pack_version: "buffalo_l"
  device: "cpu"
  intra_op_threads: 2
  inter_op_threads: 1
  detector:
    filename: "det_10g.onnx"
    model_name: "SCRFD-10GF"
    framework: "onnx"
    sha256: "dummy_sha"
    role: "face_detection"
  recognizer:
    filename: "w600k_r50.onnx"
    model_name: "ArcFace-ResNet50"
    framework: "onnx"
    sha256: "dummy_sha2"
    role: "face_recognition"
store:
  backend: "file"
  collection_name: "gallery__w600k_r50__align1"
  local_store_path: "artifacts/test_store.json"
logging:
  level: "DEBUG"
  json_format: false
  max_bytes: 1048576
  backup_count: 2
limits:
  max_photos_per_request: 3
  max_file_size_mb: 15
  allowed_extensions: [".jpg", ".png"]
  max_concurrent_requests: 1
""", encoding="utf-8")

    params_file.write_text("""
seed: 123
detection:
  input_size: [640, 640]
  score_threshold: 0.6
  nms_threshold: 0.45
  min_face_size: 20
  enable_tiling: false
  tile_size: [640, 640]
  tile_overlap: 0.1
alignment:
  target_size: [112, 112]
  min_blur_score: 40.0
  min_brightness: 30.0
  max_brightness: 230.0
  min_eye_distance: 12.0
  max_yaw_degrees: 30.0
  max_pitch_degrees: 25.0
  max_roll_degrees: 20.0
enrollment:
  required_photo_count: 5
  consistency_min: 0.50
  dedup_threshold: 0.65
thresholds:
  threshold_version: "v0.1.0-test"
  model_version: "buffalo_l"
  preprocessing_version: "align1"
  accept_threshold: 0.42
  review_threshold: 0.33
  margin_threshold: 0.09
""", encoding="utf-8")

    mgr = ConfigurationManager(config_path=config_file, params_path=params_file)
    app_cfg = mgr.get_app_config()
    params = mgr.get_pipeline_params()

    assert app_cfg.environment == "testing"
    assert app_cfg.models.pack_version == "buffalo_l"
    assert app_cfg.store.backend == "file"
    assert params.seed == 123
    assert params.detection.min_face_size == 20
    assert params.thresholds.accept_threshold == 0.42

    # Verify version matching
    mgr.validate_versions()


def test_version_mismatch_detection(tmp_path: Path):
    """Test that a mismatch between models and thresholds raises VersionMismatchException."""
    config_file = tmp_path / "config.yaml"
    params_file = tmp_path / "params.yaml"

    config_file.write_text("""
environment: "testing"
models:
  pack_version: "buffalo_m"
""", encoding="utf-8")

    params_file.write_text("""
thresholds:
  model_version: "buffalo_l"
""", encoding="utf-8")

    mgr = ConfigurationManager(config_path=config_file, params_path=params_file)
    with pytest.raises(VersionMismatchException):
        mgr.validate_versions()


def test_missing_config_file():
    """Test that missing config file raises ConfigurationException."""
    with pytest.raises(ConfigurationException):
        ConfigurationManager(config_path=Path("non_existent_config.yaml"))


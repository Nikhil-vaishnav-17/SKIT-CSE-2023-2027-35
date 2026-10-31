"""Unit tests for ModelManifest, Checksum Calculation, and ModelVerifier."""

import hashlib
from pathlib import Path
import pytest

from smartkaksha_ml.components.model_loader import (
    ModelManifest,
    ModelVerifier,
    compute_sha256,
)
from smartkaksha_ml.exception import (
    ModelChecksumMismatchException,
    ModelLoadingException,
)


def test_compute_sha256(tmp_path: Path):
    """Test SHA-256 calculation on a known payload."""
    test_file = tmp_path / "dummy.bin"
    payload = b"SmartKaksha Buffalo_L Test Payload 2026"
    test_file.write_bytes(payload)

    expected = hashlib.sha256(payload).hexdigest()
    assert compute_sha256(test_file) == expected


def test_model_manifest_parsing(tmp_path: Path):
    """Test parsing a valid models/MANIFEST file."""
    manifest_file = tmp_path / "MANIFEST"
    manifest_file.write_text("""
pack_version: "buffalo_l"
models:
  detector:
    filename: "det_10g.onnx"
    model_name: "SCRFD-10GF"
    role: "face_detection"
    framework: "onnx"
    sha256: "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91"
  recognizer:
    filename: "w600k_r50.onnx"
    model_name: "ArcFace-ResNet50"
    role: "face_recognition"
    framework: "onnx"
    sha256: "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43"
""", encoding="utf-8")

    manifest = ModelManifest(manifest_file)
    assert manifest.pack_version == "buffalo_l"
    detector_entry = manifest.get_model_entry("detector")
    assert detector_entry["filename"] == "det_10g.onnx"
    assert detector_entry["sha256"].startswith("5838f7fe")


def test_model_verifier_checksum_match_and_mismatch(tmp_path: Path):
    """Test ModelVerifier correctly validates matching and mismatching files."""
    models_dir = tmp_path / "models"
    models_dir.mkdir()

    # Create dummy model with known content
    det_file = models_dir / "det_10g.onnx"
    content = b"fake weights for detector"
    det_file.write_bytes(content)
    actual_hash = hashlib.sha256(content).hexdigest()

    manifest_file = tmp_path / "MANIFEST"
    manifest_file.write_text(f"""
pack_version: "buffalo_l"
models:
  detector:
    filename: "det_10g.onnx"
    role: "face_detection"
    sha256: "{actual_hash}"
    required: true
  recognizer:
    filename: "w600k_r50.onnx"
    role: "face_recognition"
    sha256: "wrong_or_mismatched_hash"
    required: false
""", encoding="utf-8")

    verifier = ModelVerifier(manifest_path=manifest_file, models_dir=models_dir)

    # Detector should match
    assert verifier.verify_model("detector") is True

    # Missing file should raise ModelLoadingException when raise_on_error=True
    with pytest.raises(ModelLoadingException):
        verifier.verify_model("recognizer", raise_on_error=True)

    # Checksum mismatch
    fake_rec = models_dir / "w600k_r50.onnx"
    fake_rec.write_bytes(b"different weights")
    with pytest.raises(ModelChecksumMismatchException):
        verifier.verify_model("recognizer", raise_on_error=True)


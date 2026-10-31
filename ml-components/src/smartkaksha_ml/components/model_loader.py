"""SmartKaksha Model Loader and Manifest Verifier.

Handles manifest reading, model file resolution, and SHA-256 checksum verification
against models/MANIFEST for strict supply chain security.
"""

import hashlib
from pathlib import Path
from typing import Any, Optional
import yaml

from smartkaksha_ml.constants import DEFAULT_MANIFEST_PATH
from smartkaksha_ml.exception import (
    ModelChecksumMismatchException,
    ModelLoadingException,
)
from smartkaksha_ml.logger import get_logger

logger = get_logger("model_loader")


def compute_sha256(file_path: Path, chunk_size: int = 65536) -> str:
    """Compute SHA-256 checksum of a file in streaming chunks."""
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(chunk_size), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest().lower()
    except Exception as e:
        raise ModelLoadingException(
            f"Failed to read file for checksum calculation: {file_path}",
            context={"file_path": str(file_path)},
            cause=e,
        )


class ModelManifest:
    """Parses and holds the committed models/MANIFEST."""

    def __init__(self, manifest_path: Optional[Path] = None) -> None:
        self.manifest_path = Path(manifest_path or DEFAULT_MANIFEST_PATH)
        self.pack_version: str = ""
        self.models: dict[str, dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if not self.manifest_path.exists():
            raise ModelLoadingException(
                f"Model manifest not found at {self.manifest_path}",
                context={"manifest_path": str(self.manifest_path)},
            )
        try:
            with open(self.manifest_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                self.pack_version = data.get("pack_version", "")
                self.models = data.get("models", {})
        except Exception as e:
            raise ModelLoadingException(
                f"Failed to parse manifest at {self.manifest_path}: {e}",
                context={"manifest_path": str(self.manifest_path)},
                cause=e,
            )

    def get_model_entry(self, role: str) -> dict[str, Any]:
        """Get model metadata entry for a given role (e.g. 'detector', 'recognizer')."""
        if role not in self.models:
            raise ModelLoadingException(
                f"Role '{role}' not declared in model manifest.",
                context={"available_roles": list(self.models.keys())},
            )
        return self.models[role]


class ModelVerifier:
    """Verifies that model weight files on disk exist and match their declared checksums."""

    def __init__(
        self,
        manifest_path: Optional[Path] = None,
        models_dir: Optional[Path] = None,
    ) -> None:
        self.manifest = ModelManifest(manifest_path)
        self.models_dir = Path(models_dir or "models")

    def verify_model(self, role: str, raise_on_error: bool = True) -> bool:
        """Verify an individual model by role against its manifest entry."""
        entry = self.manifest.get_model_entry(role)
        filename = entry.get("filename", "")
        expected_sha256 = entry.get("sha256", "").strip().lower()
        file_path = self.models_dir / filename

        if not file_path.exists():
            msg = f"Model file for role '{role}' not found at: {file_path}"
            if raise_on_error:
                raise ModelLoadingException(msg, context={"role": role, "path": str(file_path)})
            logger.warning(msg)
            return False

        actual_sha256 = compute_sha256(file_path)
        if actual_sha256 != expected_sha256:
            msg = (
                f"Checksum mismatch for '{role}' ({filename}). "
                f"Expected: {expected_sha256}, Got: {actual_sha256}"
            )
            if raise_on_error:
                raise ModelChecksumMismatchException(
                    msg,
                    context={
                        "role": role,
                        "filename": filename,
                        "expected_sha256": expected_sha256,
                        "actual_sha256": actual_sha256,
                    },
                )
            logger.error(msg)
            return False

        logger.info(f"Model '{role}' ({filename}) verified successfully against manifest.")
        return True

    def verify_all(self, raise_on_error: bool = True) -> dict[str, bool]:
        """Verify all models declared in the manifest."""
        results: dict[str, bool] = {}
        for role, entry in self.manifest.models.items():
            if entry.get("required", True):
                results[role] = self.verify_model(role, raise_on_error=raise_on_error)
        return results

    def get_verified_path(self, role: str) -> Path:
        """Return the path to a model after verifying its existence and checksum."""
        self.verify_model(role, raise_on_error=True)
        filename = self.manifest.get_model_entry(role)["filename"]
        return self.models_dir / filename


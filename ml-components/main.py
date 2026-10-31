"""SmartKaksha ML CLI Entry Point.

Command-line orchestrator for offline stages (data validation, preprocessing,
enrollment, evaluation, threshold selection, student erasure, and smoke test).
Does NOT run an HTTP server.
"""

import argparse
import sys
from pathlib import Path

# Add src to sys.path if running directly from script directory
sys.path.insert(0, str(Path(__file__).parent / "src"))

from smartkaksha_ml.config import ConfigurationManager
from smartkaksha_ml.components.model_loader import ModelVerifier
from smartkaksha_ml.constants import APP_NAME
from smartkaksha_ml.exception import SmartKakshaException
from smartkaksha_ml.logger import get_logger, setup_logging

logger = get_logger("cli")


def cmd_smoke_test(args: argparse.Namespace) -> int:
    """Run sanity checks on configuration, version matching, and directory layout."""
    logger.info("Executing Phase 0 smoke test...")
    try:
        config_mgr = ConfigurationManager(
            config_path=args.config,
            params_path=args.params,
        )
        app_cfg = config_mgr.get_app_config()
        params = config_mgr.get_pipeline_params()

        logger.info(f"Loaded config: environment='{app_cfg.environment}', store='{app_cfg.store.backend}'")
        logger.info(f"Loaded params: seed={params.seed}, model_version='{params.thresholds.model_version}'")

        config_mgr.validate_versions()
        logger.info("Configuration and version checks passed.")

        # Check directory layout
        for path_name, path_val in [
            ("data_dir", app_cfg.paths.data_dir),
            ("models_dir", app_cfg.paths.models_dir),
            ("artifacts_dir", app_cfg.paths.artifacts_dir),
            ("reports_dir", app_cfg.paths.reports_dir),
            ("logs_dir", app_cfg.paths.logs_dir),
        ]:
            path_val.mkdir(parents=True, exist_ok=True)
            logger.info(f"Directory confirmed: {path_name} -> {path_val}")

        print("\n✅ Smoke test passed: Configuration loaded and environment ready.\n")
        return 0
    except SmartKakshaException as e:
        logger.error(f"Smoke test failed: {e}")
        print(f"\n❌ Smoke test failed: {e}\n", file=sys.stderr)
        return 1


def cmd_verify_models(args: argparse.Namespace) -> int:
    """Verify local model weights against committed models/MANIFEST."""
    try:
        config_mgr = ConfigurationManager(config_path=args.config, params_path=args.params)
        app_cfg = config_mgr.get_app_config()

        logger.info(f"Verifying models against manifest: {app_cfg.paths.manifest_file}")
        verifier = ModelVerifier(
            manifest_path=app_cfg.paths.manifest_file,
            models_dir=app_cfg.paths.models_dir,
        )
        results = verifier.verify_all(raise_on_error=False)

        all_ok = True
        for role, status in results.items():
            if status:
                print(f"  [OK] {role}")
            else:
                print(f"  [MISSING/INVALID] {role}")
                all_ok = False

        if all_ok:
            print("\n✅ All declared models verified against checksums.")
            return 0
        else:
            print("\n⚠️  Some models are missing or failed checksum verification.")
            return 1
    except SmartKakshaException as e:
        logger.error(f"Model verification failed: {e}")
        print(f"\n❌ Error during model verification: {e}", file=sys.stderr)
        return 1


def main() -> int:
    """CLI parser setup and dispatch."""
    parser = argparse.ArgumentParser(
        prog="smartkaksha-ml",
        description=f"{APP_NAME} - Offline Pipeline CLI",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Path to config.yaml (default: config/config.yaml)",
    )
    parser.add_argument(
        "--params",
        type=Path,
        default=None,
        help="Path to params.yaml (default: config/params.yaml)",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available offline stages")

    # smoke-test
    subparsers.add_parser("smoke-test", help="Run local configuration and structure sanity check")

    # verify-models
    subparsers.add_parser("verify-models", help="Verify models against models/MANIFEST")

    # validate
    subparsers.add_parser("validate", help="Validate raw dataset structure and consent")

    # preprocess
    subparsers.add_parser("preprocess", help="Run image preprocessing and split manifests")

    # enroll
    enroll_parser = subparsers.add_parser("enroll", help="Enroll approved student photos into gallery")
    enroll_parser.add_argument("--student-id", type=str, help="Target student id")

    # evaluate
    subparsers.add_parser("evaluate", help="Run detection, recognition, and session evaluation")

    # select-thresholds
    subparsers.add_parser("select-thresholds", help="Run joint threshold sweep on validation split")

    # remove-student
    rm_parser = subparsers.add_parser("remove-student", help="Erase student embeddings and data (DPDP)")
    rm_parser.add_argument("--student-id", type=str, required=True, help="Student ID to erase")

    args = parser.parse_args()

    # Initialize basic logging
    setup_logging(log_dir=Path("logs"), log_level="INFO")

    if not args.command:
        parser.print_help()
        return 0

    if args.command == "smoke-test":
        return cmd_smoke_test(args)
    elif args.command == "verify-models":
        return cmd_verify_models(args)
    elif args.command in ["validate", "preprocess", "enroll", "evaluate", "select-thresholds", "remove-student"]:
        logger.info(f"Stage '{args.command}' scheduled for subsequent phases.")
        print(f"Stage '{args.command}' is defined in the roadmap and will be activated in its respective phase.")
        return 0
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())

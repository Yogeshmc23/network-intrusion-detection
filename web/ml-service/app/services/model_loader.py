"""Model and artifact loader service.

Loads and caches the selected scikit-learn pipeline (currently a Decision Tree;
see results/model_metadata.json), model metadata, metrics,
and feature importance artifacts in memory for low-latency inference and inspection.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Optional

import joblib
import pandas as pd

logger = logging.getLogger("ids.model_loader")


class ModelLoader:
    """Singleton service to locate, load, and manage ML artifacts."""

    def __init__(self, results_dir: Optional[str | Path] = None) -> None:
        self.results_dir: Path = self._resolve_results_dir(results_dir)
        self.model: Any = None
        self.metadata: dict[str, Any] = {}
        self.metrics_df: Optional[pd.DataFrame] = None
        self.cv_df: Optional[pd.DataFrame] = None
        self.run_metadata: dict[str, Any] = {}
        self._is_loaded: bool = False

    def _resolve_results_dir(self, explicit_dir: Optional[str | Path]) -> Path:
        """Resolve results directory across container mounts, env vars, and local paths."""
        candidates: list[Path] = []

        if explicit_dir:
            candidates.append(Path(explicit_dir))

        env_results = os.getenv("RESULTS_DIR")
        if env_results:
            candidates.append(Path(env_results))

        # Docker default volume mount
        candidates.append(Path("/app/data/results"))

        # Relative to this file: ml-service/app/services/model_loader.py -> ids-study/results
        current_file = Path(__file__).resolve()
        candidates.append(current_file.parent.parent.parent.parent / "results")
        candidates.append(current_file.parent.parent.parent / "results")

        # Relative to current working directory
        candidates.append(Path.cwd() / "results")
        candidates.append(Path.cwd().parent / "results")
        candidates.append(Path.cwd().parent.parent / "results")

        # Absolute default fallback
        candidates.append(Path(r"c:\Users\yogesh gowda mc\Music\ids-study\results"))

        for candidate in candidates:
            if candidate.exists() and (candidate / "model_metadata.json").exists():
                logger.info(f"Resolved results directory: {candidate.resolve()}")
                return candidate.resolve()

        # Fallback to the first existing candidate or default
        fallback = candidates[0] if candidates else Path("/app/data/results")
        logger.warning(
            f"Could not find model_metadata.json in standard locations. Using fallback: {fallback}"
        )
        return fallback

    def load_artifacts(self) -> None:
        """Load model pipeline, metadata, metrics, and run configurations."""
        logger.info(f"Loading ML artifacts from {self.results_dir}...")

        # 1. Load model metadata
        metadata_path = self.results_dir / "model_metadata.json"
        if metadata_path.exists():
            try:
                self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                logger.info(f"Loaded metadata for model: {self.metadata.get('model_name')}")
            except Exception as exc:
                logger.error(f"Error parsing model_metadata.json: {exc}")
        else:
            logger.warning(f"Metadata file missing: {metadata_path}")

        # 2. Load trained pipeline
        artifact_name = self.metadata.get("artifact", "ids_model.joblib")
        model_path = self.results_dir / artifact_name
        if not model_path.exists():
            model_path = self.results_dir / "ids_model.joblib"

        if model_path.exists():
            try:
                self.model = joblib.load(model_path)
                logger.info(f"Successfully loaded model artifact from {model_path}")
            except Exception as exc:
                logger.error(f"Error loading model {model_path}: {exc}")
                raise
        else:
            logger.error(f"Model artifact not found at {model_path}")

        # 3. Load metrics CSV
        metrics_path = self.results_dir / "metrics.csv"
        if metrics_path.exists():
            try:
                self.metrics_df = pd.read_csv(metrics_path)
                logger.info(f"Loaded metrics.csv ({len(self.metrics_df)} rows)")
            except Exception as exc:
                logger.error(f"Error reading metrics.csv: {exc}")
        else:
            logger.warning(f"metrics.csv not found at {metrics_path}")

        # 4. Load cross validation CSV
        cv_path = self.results_dir / "cross_validation.csv"
        if cv_path.exists():
            try:
                self.cv_df = pd.read_csv(cv_path)
                logger.info(f"Loaded cross_validation.csv ({len(self.cv_df)} rows)")
            except Exception as exc:
                logger.error(f"Error reading cross_validation.csv: {exc}")
        else:
            logger.warning(f"cross_validation.csv not found at {cv_path}")

        # 5. Load run metadata
        run_meta_path = self.results_dir / "run_metadata.json"
        if run_meta_path.exists():
            try:
                self.run_metadata = json.loads(run_meta_path.read_text(encoding="utf-8"))
                logger.info("Loaded run_metadata.json")
            except Exception as exc:
                logger.error(f"Error parsing run_metadata.json: {exc}")
        else:
            logger.warning(f"run_metadata.json not found at {run_meta_path}")

        self._is_loaded = True

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded and self.model is not None

    def get_model(self) -> Any:
        if not self._is_loaded or self.model is None:
            self.load_artifacts()
        return self.model

    def get_metadata(self) -> dict[str, Any]:
        if not self._is_loaded:
            self.load_artifacts()
        return self.metadata

    def get_threshold(self) -> float:
        """Returns the saved operating threshold, defaulting to 0.5."""
        return float(self.metadata.get("threshold", 0.5))

    def get_feature_columns(self) -> list[str]:
        return self.metadata.get("feature_columns", [])

    def get_categorical_columns(self) -> list[str]:
        return self.metadata.get("categorical_columns", ["protocol_type", "service", "flag"])

    def get_numeric_columns(self) -> list[str]:
        return self.metadata.get("numeric_columns", [])

    def get_categorical_options(self) -> dict[str, list[str]]:
        return self.metadata.get("categorical_options", {})

    def get_demo_samples(self) -> dict[str, dict[str, Any]]:
        return self.metadata.get("demo_samples", {})

    def get_metrics_df(self) -> pd.DataFrame:
        if self.metrics_df is None:
            self.load_artifacts()
        return self.metrics_df.copy() if self.metrics_df is not None else pd.DataFrame()

    def get_cv_df(self) -> pd.DataFrame:
        if self.cv_df is None:
            self.load_artifacts()
        return self.cv_df.copy() if self.cv_df is not None else pd.DataFrame()

    def get_run_metadata(self) -> dict[str, Any]:
        if not self._is_loaded:
            self.load_artifacts()
        return self.run_metadata

    def get_permutation_importance(self) -> dict[str, float]:
        """Returns dictionary of raw permutation feature importances."""
        run_meta = self.get_run_metadata()
        return run_meta.get("best_model_permutation_importance", {})

    def check_health(self) -> tuple[bool, dict[str, Any]]:
        """Validate service readiness and model state."""
        status: dict[str, Any] = {
            "model_loaded": self.model is not None,
            "metadata_loaded": bool(self.metadata),
            "metrics_loaded": self.metrics_df is not None,
            "results_dir": str(self.results_dir),
            "model_name": self.metadata.get("model_name", "Unknown"),
            "threshold": self.get_threshold(),
        }

        # Dry run prediction test if model is loaded and demo normal record is available
        demo_samples = self.get_demo_samples()
        healthy = self.model is not None
        if healthy and "normal" in demo_samples:
            try:
                sample_df = pd.DataFrame([demo_samples["normal"]], columns=self.get_feature_columns())
                if hasattr(self.model, "predict_proba"):
                    _ = self.model.predict_proba(sample_df)
                status["self_test"] = "passed"
            except Exception as exc:
                logger.error(f"Self-test prediction failed: {exc}")
                status["self_test"] = f"failed: {exc}"
                healthy = False
        else:
            status["self_test"] = "skipped (no sample)"

        return healthy, status


# Global singleton instance
model_loader = ModelLoader()

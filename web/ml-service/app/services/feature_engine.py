"""Feature engine and data transformation service for NSL-KDD network intrusion records.

Provides canonical feature schema, data validation, preprocessing, CSV batch parsing,
and model score computation.
"""
from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("ids.feature_engine")

# Canonical 41 NSL-KDD features in their standard evaluation order
FEATURE_COLUMNS = [
    "duration",
    "protocol_type",
    "service",
    "flag",
    "src_bytes",
    "dst_bytes",
    "land",
    "wrong_fragment",
    "urgent",
    "hot",
    "num_failed_logins",
    "logged_in",
    "num_compromised",
    "root_shell",
    "su_attempted",
    "num_root",
    "num_file_creations",
    "num_shells",
    "num_access_files",
    "num_outbound_cmds",
    "is_host_login",
    "is_guest_login",
    "count",
    "srv_count",
    "serror_rate",
    "srv_serror_rate",
    "rerror_rate",
    "srv_rerror_rate",
    "same_srv_rate",
    "diff_srv_rate",
    "srv_diff_host_rate",
    "dst_host_count",
    "dst_host_srv_count",
    "dst_host_same_srv_rate",
    "dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate",
    "dst_host_srv_diff_host_rate",
    "dst_host_serror_rate",
    "dst_host_srv_serror_rate",
    "dst_host_rerror_rate",
    "dst_host_srv_rerror_rate",
]

CATEGORICAL_COLUMNS = ["protocol_type", "service", "flag"]
NUMERIC_COLUMNS = [col for col in FEATURE_COLUMNS if col not in CATEGORICAL_COLUMNS]

# Explanatory descriptions for all 41 NSL-KDD connection features
FEATURE_DESCRIPTIONS: dict[str, str] = {
    "duration": "Length of the connection in seconds",
    "protocol_type": "Transport layer protocol (e.g. tcp, udp, icmp)",
    "service": "Network service on destination (e.g. http, telnet, ftp, csnet_ns)",
    "flag": "Normal or error status flag of the connection (e.g. SF, S0, REJ)",
    "src_bytes": "Number of data bytes from source to destination",
    "dst_bytes": "Number of data bytes from destination to source",
    "land": "1 if connection is from/to the same host/port; 0 otherwise",
    "wrong_fragment": "Number of wrong fragments",
    "urgent": "Number of urgent packets",
    "hot": "Number of 'hot' indicators (e.g. accessing system dirs, programs)",
    "num_failed_logins": "Number of failed login attempts",
    "logged_in": "1 if successfully logged in; 0 otherwise",
    "num_compromised": "Number of compromised conditions",
    "root_shell": "1 if root shell is obtained; 0 otherwise",
    "su_attempted": "1 if 'su root' command attempted; 0 otherwise",
    "num_root": "Number of 'root' accesses",
    "num_file_creations": "Number of file creation operations",
    "num_shells": "Number of shell prompts",
    "num_access_files": "Number of operations on access control files",
    "num_outbound_cmds": "Number of outbound commands in an ftp session",
    "is_host_login": "1 if the login belongs to the 'hot' list; 0 otherwise",
    "is_guest_login": "1 if the login is a 'guest' login; 0 otherwise",
    "count": "Number of connections to the same host as current in past 2 seconds",
    "srv_count": "Number of connections to the same service as current in past 2 seconds",
    "serror_rate": "Percentage of connections that have 'SYN' errors",
    "srv_serror_rate": "Percentage of connections that have 'SYN' errors for same service",
    "rerror_rate": "Percentage of connections that have 'REJ' errors",
    "srv_rerror_rate": "Percentage of connections that have 'REJ' errors for same service",
    "same_srv_rate": "Percentage of connections to the same service",
    "diff_srv_rate": "Percentage of connections to different services",
    "srv_diff_host_rate": "Percentage of connections to different hosts for same service",
    "dst_host_count": "Number of connections to the destination host (window 100)",
    "dst_host_srv_count": "Number of connections to destination host with same service",
    "dst_host_same_srv_rate": "Percentage of connections to destination host with same service",
    "dst_host_diff_srv_rate": "Percentage of connections to destination host with different services",
    "dst_host_same_src_port_rate": "Percentage of connections to destination host from same source port",
    "dst_host_srv_diff_host_rate": "Percentage of connections to destination host with different services",
    "dst_host_serror_rate": "Percentage of connections to destination host with 'SYN' errors",
    "dst_host_srv_serror_rate": "Percentage of connections to destination host with 'SYN' errors for same service",
    "dst_host_rerror_rate": "Percentage of connections to destination host with 'REJ' errors",
    "dst_host_srv_rerror_rate": "Percentage of connections to destination host with 'REJ' errors for same service",
}


class FeatureEngine:
    """Service to normalize, clean, and validate NSL-KDD records."""

    def normalize_single_input(self, raw_input: dict[str, Any]) -> pd.DataFrame:
        """Converts raw request dictionary to a single-row DataFrame with all 41 features."""
        # Check if the dictionary has a nested 'features' key (as sent by some clients)
        data = raw_input.get("features", raw_input) if isinstance(raw_input, dict) else {}
        if not isinstance(data, dict):
            data = {}

        # Case-insensitive map for input features
        input_lower = {str(k).strip().lower(): v for k, v in data.items()}

        row: dict[str, Any] = {}

        # 1. Process categorical features
        for col in CATEGORICAL_COLUMNS:
            val = input_lower.get(col)
            if val is not None and not pd.isna(val):
                row[col] = str(val).strip().lower()
            else:
                row[col] = "__missing__"

        # 2. Process numeric features
        for col in NUMERIC_COLUMNS:
            val = input_lower.get(col)
            if val is not None and not pd.isna(val):
                try:
                    row[col] = float(val)
                except (ValueError, TypeError):
                    row[col] = np.nan
            else:
                # Default to 0.0 for missing numerical inputs to prevent pipeline crashes
                row[col] = 0.0

        # Construct DataFrame in canonical column order
        df = pd.DataFrame([row], columns=FEATURE_COLUMNS)
        return df

    def parse_csv_batch(self, file_bytes: bytes) -> tuple[pd.DataFrame, list[str]]:
        """Parses an uploaded CSV file (with or without headers) into a canonical 41-feature DataFrame."""
        try:
            # Decode file bytes, tolerating minor encoding anomalies
            text_stream = io.StringIO(file_bytes.decode("utf-8", errors="replace"))
            # Peek at first line
            first_line = text_stream.readline().strip()
            text_stream.seek(0)

            # Determine if header exists
            first_items = [item.strip().lower() for item in first_line.split(",")]
            has_header = any(
                item in {"duration", "protocol_type", "src_bytes", "service", "flag"}
                for item in first_items
            )

            if has_header:
                raw_df = pd.read_csv(text_stream, header=0, low_memory=False)
            else:
                raw_df = pd.read_csv(text_stream, header=None, low_memory=False)

        except Exception as exc:
            raise ValueError(f"Failed to read CSV content: {exc}") from exc

        if raw_df.empty:
            raise ValueError("Uploaded CSV file contains no data rows.")

        total_cols = raw_df.shape[1]
        cleaned_df = pd.DataFrame()
        row_ids: list[str] = []

        if has_header:
            # Normalize column names
            col_map = {str(c).strip().lower(): c for c in raw_df.columns}

            # Check for row ID / index column if present
            id_col_key = next((k for k in ("id", "_id", "record_id", "row_id") if k in col_map), None)
            if id_col_key:
                row_ids = raw_df[col_map[id_col_key]].astype(str).tolist()
            else:
                row_ids = [f"row_{i}" for i in range(len(raw_df))]

            # Extract features
            for col in FEATURE_COLUMNS:
                if col in col_map:
                    cleaned_df[col] = raw_df[col_map[col]]
                else:
                    cleaned_df[col] = "__missing__" if col in CATEGORICAL_COLUMNS else 0.0

        else:
            # No header: match by standard NSL-KDD column counts
            row_ids = [f"row_{i}" for i in range(len(raw_df))]
            if total_cols == 43:
                # 41 features + attack + difficulty
                cols = FEATURE_COLUMNS + ["attack", "difficulty"]
                raw_df.columns = cols
                cleaned_df = raw_df[FEATURE_COLUMNS].copy()
            elif total_cols == 42:
                # 41 features + attack
                cols = FEATURE_COLUMNS + ["attack"]
                raw_df.columns = cols
                cleaned_df = raw_df[FEATURE_COLUMNS].copy()
            elif total_cols == 41:
                # Exactly 41 features
                raw_df.columns = FEATURE_COLUMNS
                cleaned_df = raw_df.copy()
            elif total_cols > 41:
                # Take first 41 columns as predictors
                cleaned_df = raw_df.iloc[:, :41].copy()
                cleaned_df.columns = FEATURE_COLUMNS
            else:
                raise ValueError(
                    f"CSV without headers must have at least 41 columns. Found {total_cols} columns."
                )

        # Enforce types on all 41 columns
        for col in CATEGORICAL_COLUMNS:
            cleaned_df[col] = (
                cleaned_df[col].astype(str).str.strip().str.lower().replace({"nan": "__missing__"})
            )

        for col in NUMERIC_COLUMNS:
            cleaned_df[col] = pd.to_numeric(cleaned_df[col], errors="coerce").fillna(0.0)

        # Re-ensure exact column order
        cleaned_df = cleaned_df[FEATURE_COLUMNS]
        return cleaned_df, row_ids

    def score_records(self, model: Any, df: pd.DataFrame) -> np.ndarray:
        """Returns continuous anomaly scores (probabilities for class 1) for the input DataFrame."""
        if hasattr(model, "predict_proba"):
            probs = np.asarray(model.predict_proba(df))
            classes = list(getattr(model, "classes_", [0, 1]))
            if 1 in classes:
                pos_idx = classes.index(1)
            else:
                pos_idx = -1
            return probs[:, pos_idx]

        if hasattr(model, "decision_function"):
            scores = np.asarray(model.decision_function(df))
            if scores.ndim == 2:
                return scores[:, -1]
            return scores

        return np.asarray(model.predict(df), dtype=float)

    def format_prediction_result(
        self,
        score: float,
        threshold: float,
        row_id: Optional[str] = None,
        features: Optional[dict[str, Any]] = None,
        inference_time_ms: Optional[float] = None,
        model_name: str = "Decision Tree",
        score_type: Optional[str] = None,
    ) -> dict[str, Any]:
        """Formats single prediction dictionary conforming to the API response schema."""
        is_anomaly = bool(score >= threshold)
        prediction_label = "anomaly" if is_anomaly else "normal"
        # Confidence reflects conviction in the predicted class. Probability
        # scores (Decision Tree / Naive Bayes) map directly; unbounded SVM
        # decision scores are squashed with a logistic on the margin size
        # (uncalibrated display value in [0.5, 1); anomaly_score stays raw).
        if score_type == "decision_function" or not (0.0 <= float(score) <= 1.0):
            confidence = float(1.0 / (1.0 + np.exp(-abs(float(score)))))
        else:
            confidence = score if is_anomaly else (1.0 - score)

        res: dict[str, Any] = {
            "prediction": prediction_label,
            "confidence": round(float(confidence), 5),
            "anomaly_score": round(float(score), 5),
            "threshold": round(float(threshold), 5),
            "is_anomaly": is_anomaly,
            "model_name": model_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if row_id is not None:
            res["id"] = row_id

        if inference_time_ms is not None:
            res["inference_time_ms"] = round(inference_time_ms, 3)

        if features is not None:
            res["features"] = features

        return res


# Global singleton instance
feature_engine = FeatureEngine()

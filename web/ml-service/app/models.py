"""Pydantic request and response schemas for the IDS ML microservice."""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


# ==============================================================================
# Prediction Schemas
# ==============================================================================

class PredictionRequest(BaseModel):
    """Single connection record prediction request.

    Accepts either an explicit `features` dictionary or top-level 41 NSL-KDD fields.
    Also accepts optional `threshold` and `model` overrides.
    """
    model_config = ConfigDict(extra="allow")

    features: Optional[dict[str, Any]] = Field(
        default=None,
        description="Dictionary of 41 NSL-KDD connection features.",
    )
    threshold: Optional[float] = Field(
        default=None,
        description="Optional custom anomaly threshold override (defaults to the saved model threshold; 0.5 for the deployed Decision Tree).",
    )
    model: Optional[str] = Field(
        default=None,
        description="Optional model identifier override (e.g. 'Decision Tree').",
    )

    @model_validator(mode="before")
    @classmethod
    def assemble_features(cls, data: Any) -> Any:
        """Consolidates fields into `features` if sent at the top level."""
        if not isinstance(data, dict):
            return data

        # If 'features' dict is already explicitly provided, leave it intact
        if "features" in data and isinstance(data["features"], dict):
            return data

        # Otherwise, extract any recognized NSL-KDD features or extra fields into 'features'
        reserved = {"threshold", "model"}
        extracted_features = {k: v for k, v in data.items() if k not in reserved}
        result = {k: v for k, v in data.items() if k in reserved}
        result["features"] = extracted_features
        return result


class PredictionResult(BaseModel):
    """Structured response for a single prediction."""
    id: Optional[str] = Field(default=None, description="Identifier for this prediction record.")
    prediction: str = Field(description="Classification result: 'normal' or 'anomaly'.")
    confidence: float = Field(description="Confidence in the predicted class [0.0 - 1.0]. For SVM decision scores this is a logistic-squashed margin (uncalibrated).")
    anomaly_score: float = Field(description="Raw continuous anomaly score: probability for Decision Tree/Naive Bayes, decision-function value for SVM (see metadata score_type).")
    threshold: float = Field(description="Operating decision threshold used for classification.")
    is_anomaly: bool = Field(description="True if score >= threshold (flagged as attack/anomaly).")
    model_name: str = Field(description="Name of the machine learning model used.")
    timestamp: str = Field(description="ISO-8601 UTC timestamp of prediction.")
    inference_time_ms: Optional[float] = Field(default=None, description="Inference latency in milliseconds.")
    features: Optional[dict[str, Any]] = Field(default=None, description="Echo of input features.")


class BatchSummary(BaseModel):
    """Aggregate statistics for batch predictions."""
    total: int = Field(description="Total connection records processed.")
    normal: int = Field(description="Count of records classified as normal.")
    anomaly: int = Field(description="Count of records classified as anomaly.")
    anomaly_rate: float = Field(description="Proportion of connections flagged as anomaly.")


class BatchPredictionResponse(BaseModel):
    """Batch prediction response containing an array of predictions and summary."""
    predictions: list[PredictionResult] = Field(description="Array of individual prediction results.")
    summary: BatchSummary = Field(description="Statistical summary of batch predictions.")
    total: int = Field(description="Total count of evaluated records.")
    model_name: str = Field(description="Model used for evaluation.")
    threshold: float = Field(description="Decision threshold applied across the batch.")
    processing_time_ms: float = Field(description="Total server processing time in milliseconds.")


# ==============================================================================
# Model Metrics & Comparison Schemas
# ==============================================================================

class ModelMetricItem(BaseModel):
    """Single evaluation entry from metrics.csv."""
    dataset: str
    model: str
    family: str
    feature_set: Optional[str] = None
    threshold_mode: str
    threshold_note: str
    threshold: float
    tn: int
    fp: int
    fn: int
    tp: int
    accuracy: float
    precision: float
    recall: float
    f1: float
    f2: Optional[float] = None
    roc_auc: float
    fit_seconds: Optional[float] = None
    inference_seconds: Optional[float] = None
    cv_seconds: Optional[float] = None
    cv_accuracy_mean: Optional[float] = None
    cv_accuracy_std: Optional[float] = None
    cv_precision_mean: Optional[float] = None
    cv_precision_std: Optional[float] = None
    cv_recall_mean: Optional[float] = None
    cv_recall_std: Optional[float] = None
    cv_f1_mean: Optional[float] = None
    cv_f1_std: Optional[float] = None
    cv_f2_mean: Optional[float] = None
    cv_f2_std: Optional[float] = None
    cv_roc_auc_mean: Optional[float] = None
    cv_roc_auc_std: Optional[float] = None


class ModelMetricsResponse(BaseModel):
    """Complete parsed metrics response."""
    total: int = Field(description="Total metric entries available.")
    models: list[ModelMetricItem] = Field(description="List of model evaluation rows.")
    metrics: list[ModelMetricItem] = Field(description="Alias for models list for client compatibility.")


class ModelComparisonResponse(BaseModel):
    """All-features vs top-30 feature-selected models comparison response (legacy field names retained)."""
    paper_baselines: list[ModelMetricItem] = Field(
        description="All-features candidates (legacy field name retained for compatibility)."
    )
    improved_models: list[ModelMetricItem] = Field(
        description="Top-30 correlated-features candidates (legacy field name retained for compatibility)."
    )
    best_model: str = Field(description="Deployed model selected by cross-validated F1.")
    reference_rf_holdout: Optional[ModelMetricItem] = Field(
        default=None,
        description="Selected deployed model holdout metric row (legacy field name retained).",
    )
    summary: dict[str, Any] = Field(
        description="Comparative insights, metric improvements, and methodology details."
    )


class AvailableModelItem(BaseModel):
    """Information on an evaluated or available machine learning model."""
    id: str
    name: str
    family: str
    feature_set: Optional[str] = None
    is_best: bool
    threshold: float
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    f2: Optional[float] = None
    roc_auc: Optional[float] = None
    fit_time_s: Optional[float] = None
    inference_time_s: Optional[float] = None
    description: str


class AvailableModelsResponse(BaseModel):
    """List of all available models in the IDS benchmark."""
    total: int
    models: list[AvailableModelItem]


# ==============================================================================
# Feature Importance & Metadata Schemas
# ==============================================================================

class FeatureImportanceItem(BaseModel):
    """Feature importance ranking entry."""
    feature: str = Field(description="Feature column name.")
    importance: float = Field(description="Mean decrease in F1 score when permuted.")
    rank: int = Field(description="1-based importance ranking.")
    description: Optional[str] = Field(default=None, description="Human-readable description of feature.")


class FeatureImportanceResponse(BaseModel):
    """Permutation importance analysis response."""
    model_name: str
    importance: dict[str, float] = Field(description="Key-value mapping of feature name to importance score.")
    sorted: list[FeatureImportanceItem] = Field(description="Ranked list of features by importance.")
    top_features: list[str] = Field(description="Names of top contributing features.")
    total_features_evaluated: int = Field(description="Number of permuted features.")


class ModelMetadataResponse(BaseModel):
    """Detailed metadata for the active ML model."""
    model_name: str
    artifact: str
    threshold: float
    threshold_note: str
    score_type: str
    feature_set: Optional[str] = None
    positive_class: str
    feature_columns: list[str]
    categorical_columns: list[str]
    numeric_columns: list[str]
    categorical_options: dict[str, list[str]]
    demo_samples: dict[str, dict[str, Any]]


# ==============================================================================
# Health Check Schema
# ==============================================================================

class HealthResponse(BaseModel):
    """Microservice health check response."""
    status: str = Field(description="Service status ('healthy' or 'degraded').")
    model_loaded: bool = Field(description="Whether the ML model pipeline is loaded in memory.")
    model_name: str = Field(description="Name of the active model.")
    threshold: float = Field(description="Active decision threshold.")
    version: str = Field(description="ML microservice software version.")
    timestamp: str = Field(description="ISO-8601 UTC timestamp.")
    details: Optional[dict[str, Any]] = Field(default=None, description="Diagnostic details.")

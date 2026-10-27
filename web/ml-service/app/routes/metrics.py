"""Metrics and model comparison API routes.

Updated for the ids_results.py model set: Decision Tree, Gaussian Naive
Bayes and SVM (RBF), each evaluated with all encoded features and with the
top-30 correlated features. metrics.csv therefore has one row per
(model x feature_set x dataset) plus a ``feature_set`` column.

The /models/comparison response keeps its historical field names for API
compatibility: ``paper_baselines`` carries the all-features candidates and
``improved_models`` carries the top-30 feature-selected candidates, while
``reference_rf_holdout`` carries the CV-selected (deployed) model's holdout
row. The mapping is also spelled out inside ``summary``.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Query

from ..models import (
    AvailableModelItem,
    AvailableModelsResponse,
    ModelComparisonResponse,
    ModelMetricItem,
    ModelMetricsResponse,
)
from ..services.model_loader import model_loader

logger = logging.getLogger("ids.routes.metrics")

router = APIRouter(tags=["Metrics & Comparison"])

HOLDOUT_DATASET = "paper-like holdout"
EXTERNAL_DATASET = "official KDDTest+ external"

MODEL_DESCRIPTIONS: dict[str, str] = {
    "Decision Tree": (
        "Unpruned CART decision tree (random_state=42) on one-hot encoded, "
        "standard-scaled features; selected when it wins on CV F1."
    ),
    "Naive Bayes": (
        "Gaussian Naive Bayes on one-hot encoded, standard-scaled features. "
        "Very weak with all features on this data; far better with the top-30 set."
    ),
    "SVM (RBF)": (
        "Support Vector Classifier with RBF kernel (C=1.0) on one-hot encoded, "
        "standard-scaled features; scores are decision-function values."
    ),
}


def _row_to_metric_item(row: dict[str, Any]) -> ModelMetricItem:
    """Converts a pandas DataFrame row dict to a strongly-typed ModelMetricItem."""

    def to_float(val: Any) -> Optional[float]:
        if val is None or str(val).strip() in ("", "nan", "None"):
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    def to_int(val: Any) -> int:
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return 0

    return ModelMetricItem(
        dataset=str(row.get("dataset", "")),
        model=str(row.get("model", "")),
        family=str(row.get("family", "")),
        feature_set=(str(row["feature_set"]) if row.get("feature_set") else None),
        threshold_mode=str(row.get("threshold_mode", "")),
        threshold_note=str(row.get("threshold_note", "")),
        threshold=float(row.get("threshold", 0.5)),
        tn=to_int(row.get("tn")),
        fp=to_int(row.get("fp")),
        fn=to_int(row.get("fn")),
        tp=to_int(row.get("tp")),
        accuracy=float(row.get("accuracy", 0.0)),
        precision=float(row.get("precision", 0.0)),
        recall=float(row.get("recall", 0.0)),
        f1=float(row.get("f1", 0.0)),
        f2=to_float(row.get("f2")),
        roc_auc=float(row.get("roc_auc", 0.0)),
        fit_seconds=to_float(row.get("fit_seconds")),
        inference_seconds=to_float(row.get("inference_seconds")),
        cv_seconds=to_float(row.get("cv_seconds")),
        cv_accuracy_mean=to_float(row.get("cv_accuracy_mean")),
        cv_accuracy_std=to_float(row.get("cv_accuracy_std")),
        cv_precision_mean=to_float(row.get("cv_precision_mean")),
        cv_precision_std=to_float(row.get("cv_precision_std")),
        cv_recall_mean=to_float(row.get("cv_recall_mean")),
        cv_recall_std=to_float(row.get("cv_recall_std")),
        cv_f1_mean=to_float(row.get("cv_f1_mean")),
        cv_f1_std=to_float(row.get("cv_f1_std")),
        cv_f2_mean=to_float(row.get("cv_f2_mean")),
        cv_f2_std=to_float(row.get("cv_f2_std")),
        cv_roc_auc_mean=to_float(row.get("cv_roc_auc_mean")),
        cv_roc_auc_std=to_float(row.get("cv_roc_auc_std")),
    )


def _selected_model() -> tuple[str, Optional[str]]:
    """Return (selected model name, feature_set) from run/model metadata."""
    run_meta = model_loader.get_run_metadata()
    metadata = model_loader.get_metadata()
    name = (
        run_meta.get("selected_model")
        or run_meta.get("best_model_by_cv_f1")
        or metadata.get("model_name")
        or "Decision Tree"
    )
    feature_set = run_meta.get("selected_feature_set") or metadata.get("feature_set")
    return str(name), (str(feature_set) if feature_set else None)


@router.get(
    "/api/model-metrics",
    response_model=ModelMetricsResponse,
    summary="Get detailed evaluation metrics",
    description=(
        "Returns per-candidate metrics (3 models x 2 feature sets) on the "
        "stratified holdout and, when present, the official KDDTest+ external set."
    ),
)
@router.get("/metrics", response_model=ModelMetricsResponse, include_in_schema=False)
@router.get("/models/metrics", response_model=ModelMetricsResponse, include_in_schema=False)
async def get_model_metrics(
    dataset: Optional[str] = Query(None, description="Filter by dataset ('paper-like holdout' or 'official KDDTest+ external')"),
    family: Optional[str] = Query(None, description="Filter by family ('ids_results model')"),
    feature_set: Optional[str] = Query(None, description="Filter by feature set ('All features' or 'Top-30 correlated features')"),
    threshold_mode: Optional[str] = Query(None, description="Filter by threshold mode ('default')"),
    model: Optional[str] = Query(None, description="Filter by model name substring"),
) -> ModelMetricsResponse:
    """Retrieve filtered benchmark metrics from metrics.csv."""
    df = model_loader.get_metrics_df()
    if df.empty:
        return ModelMetricsResponse(total=0, models=[], metrics=[])

    filtered = df.copy()

    if dataset:
        filtered = filtered[filtered["dataset"].str.lower() == dataset.strip().lower()]
    if family and "family" in filtered.columns:
        filtered = filtered[filtered["family"].str.lower() == family.strip().lower()]
    if feature_set and "feature_set" in filtered.columns:
        filtered = filtered[filtered["feature_set"].str.lower() == feature_set.strip().lower()]
    if threshold_mode:
        filtered = filtered[filtered["threshold_mode"].str.lower() == threshold_mode.strip().lower()]
    if model:
        filtered = filtered[filtered["model"].str.lower().str.contains(model.strip().lower(), regex=False)]

    items: list[ModelMetricItem] = [
        _row_to_metric_item(row) for row in filtered.to_dict(orient="records")
    ]

    return ModelMetricsResponse(
        total=len(items),
        models=items,
        metrics=items,
    )


@router.get(
    "/api/model-comparison",
    response_model=ModelComparisonResponse,
    summary="Compare all-features vs top-30 feature-selected models",
    description=(
        "Contrasts the all-features candidates (legacy field: paper_baselines) with the "
        "top-30 correlated-features candidates (legacy field: improved_models) for the "
        "three ids_results.py models, and identifies the CV-selected deployed model."
    ),
)
@router.get("/models/comparison", response_model=ModelComparisonResponse, include_in_schema=False)
async def get_model_comparison() -> ModelComparisonResponse:
    """Compare feature-set variants of the three IDS models on both datasets."""
    df = model_loader.get_metrics_df()
    cv_df = model_loader.get_cv_df()
    selected_name, selected_feature_set = _selected_model()
    if df.empty:
        return ModelComparisonResponse(
            paper_baselines=[],
            improved_models=[],
            best_model=selected_name,
            reference_rf_holdout=None,
            summary={},
        )

    has_feature_set = "feature_set" in df.columns
    if has_feature_set:
        all_features_df = df[df["feature_set"] == "All features"]
        topk_df = df[df["feature_set"] != "All features"]
    else:  # very old metrics.csv without the column
        all_features_df, topk_df = df, df.iloc[0:0]

    def find_row(model: str, feature_set: Optional[str], dataset: str) -> dict[str, Any]:
        sub = df[(df["model"] == model) & (df["dataset"] == dataset)]
        if feature_set and has_feature_set:
            exact = sub[sub["feature_set"] == feature_set]
            if not exact.empty:
                sub = exact
        return sub.iloc[0].to_dict() if not sub.empty else {}

    selected_holdout = find_row(selected_name, selected_feature_set, HOLDOUT_DATASET)
    selected_external = find_row(selected_name, selected_feature_set, EXTERNAL_DATASET)
    reference_item = _row_to_metric_item(selected_holdout) if selected_holdout else None

    def brief(row: dict[str, Any]) -> dict[str, Any]:
        if not row:
            return {}
        return {
            "model": row.get("model"),
            "feature_set": row.get("feature_set"),
            "accuracy": round(float(row.get("accuracy", 0)), 4),
            "precision": round(float(row.get("precision", 0)), 4),
            "recall": round(float(row.get("recall", 0)), 4),
            "f1": round(float(row.get("f1", 0)), 4),
            "roc_auc": round(float(row.get("roc_auc", 0)), 4),
            "tn_fp_fn_tp": [int(row.get(k, 0)) for k in ("tn", "fp", "fn", "tp")],
        }

    holdout_rows = df[df["dataset"] == HOLDOUT_DATASET]
    external_rows = df[df["dataset"] == EXTERNAL_DATASET]

    cv_ranking: list[dict[str, Any]] = []
    if not cv_df.empty and "cv_f1_mean" in cv_df.columns:
        ranked = cv_df.sort_values("cv_f1_mean", ascending=False)
        for rank, (_, row) in enumerate(ranked.iterrows(), start=1):
            cv_ranking.append(
                {
                    "rank": rank,
                    "model": str(row.get("model", "")),
                    "feature_set": str(row.get("feature_set", "")) or None,
                    "cv_f1_mean": round(float(row.get("cv_f1_mean", 0)), 4),
                    "cv_accuracy_mean": round(float(row.get("cv_accuracy_mean", 0)), 4),
                    "cv_roc_auc_mean": round(float(row.get("cv_roc_auc_mean", 0)), 4),
                }
            )

    selected_label = selected_name + (f" [{selected_feature_set}]" if selected_feature_set else "")
    summary_data = {
        "field_mapping_note": (
            "Legacy schema kept for compatibility: paper_baselines = all-features candidates, "
            "improved_models = top-30 correlated-features candidates, "
            "reference_rf_holdout = selected deployed model's holdout row."
        ),
        "models": sorted(df["model"].unique().tolist()),
        "selected_model": selected_name,
        "selected_feature_set": selected_feature_set,
        "selection_metric": "cv_f1_mean (5-fold CV on the fit subset; holdout excluded)",
        "key_takeaway": (
            f"{selected_label} had the highest cross-validated F1 and was refit on all "
            f"labeled rows as ids_model.joblib. Holdout accuracy/F1: "
            f"{float(selected_holdout.get('accuracy', 0)):.4f}/{float(selected_holdout.get('f1', 0)):.4f}. "
            "Gaussian Naive Bayes with all features misses most attacks (very low recall) "
            "but recovers strongly with the top-30 correlated features."
        ) if selected_holdout else "",
        "holdout": [brief(r) for r in holdout_rows.to_dict(orient="records")],
        "generalization_shift_kddtest_plus": {
            "description": (
                "On official KDDTest+ (which contains attack categories absent from the "
                "training subset) every candidate drops substantially versus the random "
                "holdout; holdout scores must not be read as novel-attack detection rates."
            ),
            "selected_model_external": brief(selected_external),
            "external": [brief(r) for r in external_rows.to_dict(orient="records")],
        },
        "cv_ranking": cv_ranking,
    }

    return ModelComparisonResponse(
        paper_baselines=[_row_to_metric_item(r) for r in all_features_df.to_dict(orient="records")],
        improved_models=[_row_to_metric_item(r) for r in topk_df.to_dict(orient="records")],
        best_model=selected_name,
        reference_rf_holdout=reference_item,
        summary=summary_data,
    )


@router.get(
    "/api/available-models",
    response_model=AvailableModelsResponse,
    summary="List available ML models",
    description=(
        "Lists the three evaluated IDS models (Decision Tree, Naive Bayes, SVM-RBF). "
        "Each entry reports that model's better feature-set variant by CV F1; the "
        "deployed entry matches results/model_metadata.json."
    ),
)
@router.get("/available-models", response_model=AvailableModelsResponse, include_in_schema=False)
@router.get("/models/available", response_model=AvailableModelsResponse, include_in_schema=False)
async def get_available_models() -> AvailableModelsResponse:
    """Return the three IDS models with holdout performance stats."""
    metrics_df = model_loader.get_metrics_df()
    cv_df = model_loader.get_cv_df()
    metadata = model_loader.get_metadata()
    selected_name, selected_feature_set = _selected_model()

    unique_models: list[str] = []
    if not cv_df.empty and "model" in cv_df.columns:
        unique_models = list(dict.fromkeys(cv_df["model"].astype(str).tolist()))
    elif not metrics_df.empty and "model" in metrics_df.columns:
        unique_models = list(dict.fromkeys(metrics_df["model"].astype(str).tolist()))
    else:
        unique_models = list(MODEL_DESCRIPTIONS.keys())

    items: list[AvailableModelItem] = []

    for name in unique_models:
        model_id = name.lower().replace(" ", "_").replace("(", "").replace(")", "")
        is_best = name == selected_name

        row_dict: dict[str, Any] = {}
        if not metrics_df.empty:
            sub = metrics_df[
                (metrics_df["model"] == name) & (metrics_df["dataset"] == HOLDOUT_DATASET)
            ]
            if not sub.empty:
                if is_best and selected_feature_set and "feature_set" in sub.columns:
                    exact = sub[sub["feature_set"] == selected_feature_set]
                    if not exact.empty:
                        sub = exact
                # Prefer the better CV-F1 variant (cv columns are repeated per row).
                if "cv_f1_mean" in sub.columns and len(sub) > 1:
                    sub = sub.sort_values("cv_f1_mean", ascending=False)
                row_dict = sub.iloc[0].to_dict()

        family = str(row_dict.get("family", "ids_results model"))
        if is_best and metadata.get("threshold") is not None:
            th = float(metadata["threshold"])
        else:
            th = float(row_dict.get("threshold", 0.5))

        def opt(key: str, digits: int) -> Optional[float]:
            val = row_dict.get(key)
            if val is None or str(val) in ("", "nan"):
                return None
            try:
                return round(float(val), digits)
            except (ValueError, TypeError):
                return None

        items.append(
            AvailableModelItem(
                id=model_id,
                name=name,
                family=family,
                feature_set=(str(row_dict["feature_set"]) if row_dict.get("feature_set") else None),
                is_best=is_best,
                threshold=round(th, 5),
                accuracy=opt("accuracy", 4),
                precision=opt("precision", 4),
                recall=opt("recall", 4),
                f1=opt("f1", 4),
                f2=opt("f2", 4),
                roc_auc=opt("roc_auc", 4),
                fit_time_s=opt("fit_seconds", 3),
                inference_time_s=opt("inference_seconds", 4),
                description=MODEL_DESCRIPTIONS.get(name, f"{name} classification model."),
            )
        )

    # Sort so the deployed model is first, then by F1.
    items.sort(key=lambda m: (not m.is_best, -(m.f1 or 0)))

    return AvailableModelsResponse(total=len(items), models=items)

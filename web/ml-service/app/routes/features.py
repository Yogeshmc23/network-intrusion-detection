"""Feature metadata, categorical options, and feature importance API routes."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter

from ..models import (
    FeatureImportanceItem,
    FeatureImportanceResponse,
    ModelMetadataResponse,
)
from ..services.feature_engine import FEATURE_DESCRIPTIONS
from ..services.model_loader import model_loader

logger = logging.getLogger("ids.routes.features")

router = APIRouter(tags=["Features & Metadata"])


@router.get(
    "/api/model-metadata",
    response_model=ModelMetadataResponse,
    summary="Get model schema and metadata",
    description="Returns the 41 feature columns, allowed categorical values, decision threshold, and demo samples.",
)
@router.get("/metadata", response_model=ModelMetadataResponse, include_in_schema=False)
@router.get("/models/metadata", response_model=ModelMetadataResponse, include_in_schema=False)
async def get_model_metadata() -> ModelMetadataResponse:
    """Retrieve active model metadata, feature schema, and validation constraints."""
    metadata = model_loader.get_metadata()

    return ModelMetadataResponse(
        model_name=metadata.get("model_name", "Decision Tree"),
        artifact=metadata.get("artifact", "ids_model.joblib"),
        threshold=float(metadata.get("threshold", 0.5)),
        threshold_note=metadata.get("threshold_note", "probability threshold 0.5"),
        score_type=metadata.get("score_type", "probability"),
        feature_set=metadata.get("feature_set"),
        positive_class=metadata.get("positive_class", "anomaly"),
        feature_columns=metadata.get("feature_columns", []),
        categorical_columns=metadata.get("categorical_columns", ["protocol_type", "service", "flag"]),
        numeric_columns=metadata.get("numeric_columns", []),
        categorical_options=metadata.get("categorical_options", {}),
        demo_samples=metadata.get("demo_samples", {}),
    )


@router.get(
    "/api/feature-importance",
    response_model=FeatureImportanceResponse,
    summary="Get permutation feature importance",
    description="Returns empirical permutation importance scores (mean decrease in F1 on holdout) for the best model.",
)
@router.get("/models/feature-importance", response_model=FeatureImportanceResponse, include_in_schema=False)
async def get_feature_importance() -> FeatureImportanceResponse:
    """Retrieve permutation importance values ranking feature contributions to intrusion detection."""
    raw_importance = model_loader.get_permutation_importance()
    model_name = model_loader.get_metadata().get("model_name", "Decision Tree")

    # Sort descending by importance score
    sorted_pairs = sorted(raw_importance.items(), key=lambda item: item[1], reverse=True)

    sorted_items: list[FeatureImportanceItem] = []
    for rank, (feat, score) in enumerate(sorted_pairs, start=1):
        desc = FEATURE_DESCRIPTIONS.get(feat, f"NSL-KDD network traffic feature: {feat}")
        sorted_items.append(
            FeatureImportanceItem(
                feature=feat,
                importance=round(float(score), 6),
                rank=rank,
                description=desc,
            )
        )

    top_feature_names = [feat for feat, _ in sorted_pairs[:10]]

    return FeatureImportanceResponse(
        model_name=model_name,
        importance={k: round(float(v), 6) for k, v in raw_importance.items()},
        sorted=sorted_items,
        top_features=top_feature_names,
        total_features_evaluated=len(raw_importance),
    )

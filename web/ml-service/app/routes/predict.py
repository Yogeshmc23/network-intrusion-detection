"""Prediction routes for single connection classification and CSV batch evaluation."""

from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from ..models import BatchPredictionResponse, BatchSummary, PredictionRequest, PredictionResult
from ..services.feature_engine import feature_engine
from ..services.model_loader import model_loader

logger = logging.getLogger("ids.routes.predict")

router = APIRouter(tags=["Prediction"])


@router.post(
    "/api/predict",
    response_model=PredictionResult,
    summary="Predict single connection record",
    description="Classifies a single NSL-KDD network connection as 'normal' or 'anomaly'.",
)
@router.post(
    "/predict",
    response_model=PredictionResult,
    include_in_schema=False,
)
async def predict_single(request: PredictionRequest) -> PredictionResult:
    """Classify a single network traffic record using the calibrated ML model."""
    start_time = time.perf_counter()

    model = model_loader.get_model()
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Machine learning model artifact is not loaded.",
        )

    # Determine threshold
    default_th = model_loader.get_threshold()
    threshold = float(request.threshold) if request.threshold is not None else default_th

    # Model name
    model_name = request.model or model_loader.get_metadata().get("model_name", "Decision Tree")

    try:
        # Prepare feature DataFrame (41 features in canonical order)
        raw_dict = request.features if request.features is not None else request.model_dump()
        input_df = feature_engine.normalize_single_input(raw_dict)

        # Generate score
        scores = feature_engine.score_records(model, input_df)
        score = float(scores[0])

        inference_time_ms = (time.perf_counter() - start_time) * 1000.0

        result_dict = feature_engine.format_prediction_result(
            score=score,
            threshold=threshold,
            inference_time_ms=inference_time_ms,
            model_name=model_name,
            score_type=model_loader.get_metadata().get("score_type"),
        )

        return PredictionResult(**result_dict)

    except Exception as exc:
        logger.error(f"Prediction failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process connection record: {exc}",
        ) from exc


@router.post(
    "/api/predict-batch",
    response_model=BatchPredictionResponse,
    summary="Batch predict via CSV upload",
    description="Processes an uploaded CSV file containing multiple connection records and returns predictions.",
)
@router.post(
    "/predict-batch",
    response_model=BatchPredictionResponse,
    include_in_schema=False,
)
async def predict_batch(
    file: UploadFile = File(..., description="CSV file containing network connection records"),
    threshold: Optional[float] = Form(None, description="Optional custom anomaly threshold override"),
    model: Optional[str] = Form(None, description="Optional model identifier override"),
) -> BatchPredictionResponse:
    """Classify a batch of connection records uploaded as a CSV file."""
    start_time = time.perf_counter()

    if not file.filename or not file.filename.lower().endswith((".csv", ".txt")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a .csv or .txt file.",
        )

    trained_model = model_loader.get_model()
    if trained_model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Machine learning model artifact is not loaded.",
        )

    # Determine threshold
    default_th = model_loader.get_threshold()
    operating_threshold = float(threshold) if threshold is not None else default_th
    active_model_name = model or model_loader.get_metadata().get("model_name", "Decision Tree")

    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        # Parse CSV into canonical 41-feature DataFrame
        df, row_ids = feature_engine.parse_csv_batch(content)
        total_records = len(df)

        # Batch scoring in a single vectorized pass
        scores = feature_engine.score_records(trained_model, df)

        predictions: list[PredictionResult] = []
        normal_count = 0
        anomaly_count = 0

        for idx, (score_val, row_id) in enumerate(zip(scores, row_ids)):
            score_float = float(score_val)
            is_anomaly = score_float >= operating_threshold

            if is_anomaly:
                anomaly_count += 1
            else:
                normal_count += 1

            pred_item = feature_engine.format_prediction_result(
                score=score_float,
                threshold=operating_threshold,
                row_id=row_id,
                model_name=active_model_name,
                score_type=model_loader.get_metadata().get("score_type"),
            )
            predictions.append(PredictionResult(**pred_item))

        total_time_ms = (time.perf_counter() - start_time) * 1000.0
        anomaly_rate = round(anomaly_count / max(total_records, 1), 4)

        return BatchPredictionResponse(
            predictions=predictions,
            summary=BatchSummary(
                total=total_records,
                normal=normal_count,
                anomaly=anomaly_count,
                anomaly_rate=anomaly_rate,
            ),
            total=total_records,
            model_name=active_model_name,
            threshold=operating_threshold,
            processing_time_ms=round(total_time_ms, 2),
        )

    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        ) from val_err
    except Exception as exc:
        logger.error(f"Batch prediction failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch prediction failed: {exc}",
        ) from exc

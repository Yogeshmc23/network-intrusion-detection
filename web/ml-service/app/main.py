"""FastAPI application entry point for the Intrusion Detection System (IDS) ML Microservice."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import HealthResponse
from .routes.features import router as features_router
from .routes.metrics import router as metrics_router
from .routes.predict import router as predict_router
from .services.model_loader import model_loader

# Configure logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ids.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager that loads ML models and artifacts during application startup."""
    logger.info("Starting up IDS ML microservice...")
    try:
        model_loader.load_artifacts()
        healthy, status_info = model_loader.check_health()
        if healthy:
            logger.info(
                f"Model pipeline initialized successfully. Model='{status_info.get('model_name')}' "
                f"Threshold={status_info.get('threshold'):.5f}"
            )
        else:
            logger.warning(f"Model initialized with warnings: {status_info}")
    except Exception as exc:
        logger.error(f"Critical error during model startup load: {exc}", exc_info=True)

    yield

    logger.info("Shutting down IDS ML microservice...")


# Initialize FastAPI application
app = FastAPI(
    title="CyberShield IDS — Machine Learning Serving Microservice",
    description=(
        "High-performance REST API for network intrusion detection and security analytics. "
        "Serves the selected scikit-learn IDS pipeline (Decision Tree / Naive Bayes / SVM-RBF "
        "benchmark; see results/model_metadata.json) trained on NSL-KDD benchmark traffic, "
        "delivering single-record inference, batch CSV scoring, benchmark comparison, "
        "and permutation importance analytics."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS Middleware allowing all origins for local and cross-container development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(predict_router)
app.include_router(metrics_router)
app.include_router(features_router)


@app.get(
    "/api/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Microservice health check",
    description="Returns the operational readiness, loaded model name, and threshold status.",
)
@app.get("/health", response_model=HealthResponse, include_in_schema=False)
async def health_check() -> HealthResponse:
    """Verifies service responsiveness and model loading status."""
    healthy, details = model_loader.check_health()
    metadata = model_loader.get_metadata()

    return HealthResponse(
        status="healthy" if healthy else "degraded",
        model_loaded=model_loader.is_loaded,
        model_name=metadata.get("model_name", "Decision Tree"),
        threshold=model_loader.get_threshold(),
        version="1.0.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        details=details,
    )


@app.get(
    "/",
    tags=["Root"],
    summary="Root service information",
)
async def root() -> dict[str, str]:
    """Provides service introduction and links to interactive API documentation."""
    metadata = model_loader.get_metadata()
    return {
        "service": "CyberShield IDS Machine Learning Serving Microservice",
        "version": "1.0.0",
        "status": "online",
        "model_name": metadata.get("model_name", "Decision Tree"),
        "positive_class": "anomaly",
        "threshold": str(model_loader.get_threshold()),
        "documentation": "/docs",
        "healthcheck": "/api/health",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catches unhandled exceptions and returns standardized JSON response."""
    logger.error(f"Unhandled error processing {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": str(exc),
            "path": request.url.path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

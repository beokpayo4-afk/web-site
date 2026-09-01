"""Nexora FastAPI application (mounted at /api/v2)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi_app.routers import health


def create_fastapi_app() -> FastAPI:
    app = FastAPI(
        title="Nexora FastAPI",
        version="0.1.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    return app

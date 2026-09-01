"""Nexora FastAPI application (mounted at /api/v2)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.cors_origins import build_cors_origin_regexes, build_cors_origins
from fastapi_app.routers import health


def create_fastapi_app() -> FastAPI:
    app = FastAPI(
        title="Nexora FastAPI",
        version="0.1.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    cors_kwargs: dict = {
        "allow_origins": build_cors_origins(),
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    regexes = build_cors_origin_regexes()
    if regexes:
        cors_kwargs["allow_origin_regex"] = "|".join(regexes)
    app.add_middleware(CORSMiddleware, **cors_kwargs)
    app.include_router(health.router)
    return app

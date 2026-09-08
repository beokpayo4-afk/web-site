"""Shared CORS origin lists for Django and FastAPI."""

from __future__ import annotations

import os

LOCAL_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]


def _split_env_list(value: str) -> list[str]:
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


def build_cors_origins() -> list[str]:
    origins = list(LOCAL_DEV_ORIGINS)
    for origin in _split_env_list(os.environ.get("DJANGO_CORS_ALLOWED_ORIGINS", "")):
        if origin not in origins:
            origins.append(origin)
    frontend = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")
    if frontend and frontend not in origins:
        origins.append(frontend)
    return origins


def build_cors_origin_regexes() -> list[str]:
    regexes: list[str] = []
    for pattern in _split_env_list(os.environ.get("DJANGO_CORS_ALLOWED_ORIGIN_REGEXES", "")):
        if pattern and pattern not in regexes:
            regexes.append(pattern)
    on_render = bool(
        os.environ.get("RENDER")
        or os.environ.get("RENDER_EXTERNAL_HOSTNAME")
        or os.environ.get("RENDER_EXTERNAL_URL")
    )
    if on_render:
        for pattern in (
            r"^https://[\w-]+\.vercel\.app$",
            r"^https://[\w-]+\.netlify\.app$",
        ):
            if pattern not in regexes:
                regexes.append(pattern)
    return regexes

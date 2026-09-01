"""ASGI entrypoint: FastAPI at /api/v2, Django (including /api/v1) at /."""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI, Response

from config.asgi import application as django_asgi
from fastapi_app.main import create_fastapi_app

fastapi_app = create_fastapi_app()

app = FastAPI(title="Nexora", docs_url=None, redoc_url=None)


@app.api_route("/", methods=["GET", "HEAD"])
def root() -> dict[str, str]:
    """Health/root for platform probes (Render uses HEAD /). Do not fall through to Django."""
    return {
        "status": "ok",
        "django": "/api/v1/",
        "fastapi": "/api/v2/",
        "fastapi_docs": "/api/v2/docs",
    }


@app.api_route("/favicon.ico", methods=["GET", "HEAD"])
def favicon() -> Response:
    return Response(status_code=204)


app.mount("/api/v2", fastapi_app)
app.mount("/", django_asgi)

__all__ = ["app"]

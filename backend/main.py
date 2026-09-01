"""ASGI entrypoint: FastAPI at /api/v2, Django (including /api/v1) at /."""

from fastapi import FastAPI

from config.asgi import application as django_asgi
from fastapi_app.main import create_fastapi_app

fastapi_app = create_fastapi_app()

app = FastAPI(title="Nexora")
app.mount("/api/v2", fastapi_app)
app.mount("/", django_asgi)

__all__ = ["app"]

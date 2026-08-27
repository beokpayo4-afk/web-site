"""ASGI entrypoint so `uvicorn main:app` loads Django."""

from config.asgi import application as app

__all__ = ["app"]

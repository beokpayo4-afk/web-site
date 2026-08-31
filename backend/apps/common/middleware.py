import os

from django.db import connection
from django.http import JsonResponse


class VercelDatabaseGuardMiddleware:
    """Block API traffic on Vercel when Postgres was not configured at runtime."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            os.environ.get("VERCEL")
            and request.path.startswith("/api/")
            and connection.settings_dict["ENGINE"].endswith("sqlite3")
        ):
            return JsonResponse(
                {
                    "detail": (
                        "DATABASE_URL is not configured. "
                        "Add a Postgres DATABASE_URL (or POSTGRES_URL) in Vercel project settings."
                    )
                },
                status=503,
            )
        return self.get_response(request)

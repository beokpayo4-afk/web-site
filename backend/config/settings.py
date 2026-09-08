"""Django settings for the Nexora e-commerce platform."""

from datetime import timedelta
from pathlib import Path
import os
import sys

import dj_database_url
import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    DJANGO_CORS_ALLOWED_ORIGINS=(list, ["http://localhost:5173", "http://localhost:5174"]),
    JWT_ACCESS_MINUTES=(int, 30),
    JWT_REFRESH_DAYS=(int, 7),
    DATABASE_ENGINE=(str, "postgres"),
    PAYMENT_PROVIDER=(str, "mock"),
)

_ON_VERCEL = bool(
    os.environ.get("VERCEL")
    or os.environ.get("VERCEL_ENV")
    or os.environ.get("VERCEL_URL")
    or os.environ.get("NOW_REGION")
)
_ON_RENDER = bool(
    os.environ.get("RENDER")
    or os.environ.get("RENDER_EXTERNAL_HOSTNAME")
    or os.environ.get("RENDER_EXTERNAL_URL")
)

# Never load local .env files on PaaS (they may point at localhost Postgres).
if not _ON_VERCEL and not _ON_RENDER:
    environ.Env.read_env(ROOT_DIR / ".env")
    environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY", default="unsafe-dev-only-key")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = list(env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"]))

def _append_host(host: str) -> None:
    host = (host or "").strip().rstrip("/")
    if host.startswith("https://"):
        host = host[len("https://") :]
    elif host.startswith("http://"):
        host = host[len("http://") :]
    host = host.split("/")[0].split(":")[0]
    if host and host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(host)


if _ON_VERCEL:
    for host in (".vercel.app", ".now.sh"):
        _append_host(host)

if _ON_RENDER:
    _append_host(".onrender.com")
    _append_host(os.environ.get("RENDER_EXTERNAL_HOSTNAME", ""))
    _append_host(os.environ.get("RENDER_EXTERNAL_URL", ""))

TESTING = "test" in sys.argv or env.bool("DJANGO_TESTING", default=False)


def _sqlite_db():
    return {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(BASE_DIR / "db.sqlite3"),
        }
    }


def _database_url() -> str:
    for key in ("DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"):
        raw = (os.environ.get(key) or "").strip().strip('"').strip("'")
        if raw and raw.lower() not in {"undefined", "null", "none", "nil", "{}"}:
            return raw
    return ""


def _resolve_databases() -> dict:
    if TESTING or env("DATABASE_ENGINE") == "sqlite":
        return _sqlite_db()

    database_url = _database_url()
    if database_url:
        # Render/Vercel Postgres requires SSL; local Docker/Postgres usually does not.
        return {
            "default": dj_database_url.parse(
                database_url,
                conn_max_age=600,
                ssl_require=_ON_RENDER or _ON_VERCEL,
            )
        }

    if _ON_RENDER:
        raise ImproperlyConfigured(
            "DATABASE_URL is not set. On Render, link a PostgreSQL database "
            "or set DATABASE_URL to the Render Postgres connection string."
        )

    if _ON_VERCEL:
        # Vercel imports settings during build/collectstatic before runtime env is wired.
        # Use ephemeral SQLite so deploy can finish; VercelDatabaseGuardMiddleware blocks live API traffic.
        return _sqlite_db()

    # Local development only — never used on Render/Vercel.
    return {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "nexora"),
            "USER": os.getenv("DB_USER", "nexora"),
            "PASSWORD": os.getenv("DB_PASSWORD", "nexora"),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }


DATABASES = _resolve_databases()

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "apps.common.apps.CommonConfig",
    "apps.accounts.apps.AccountsConfig",
    "apps.catalog.apps.CatalogConfig",
    "apps.commerce.apps.CommerceConfig",
    "apps.orders.apps.OrdersConfig",
    "apps.engagement.apps.EngagementConfig",
    "apps.dashboard.apps.DashboardConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.common.middleware.VercelDatabaseGuardMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-in"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

from config.cors_origins import build_cors_origin_regexes, build_cors_origins

CORS_ALLOWED_ORIGINS = build_cors_origins()
CORS_ALLOWED_ORIGIN_REGEXES = build_cors_origin_regexes()
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)
if _ON_RENDER:
    render_url = (os.environ.get("RENDER_EXTERNAL_URL") or "").strip().rstrip("/")
    if render_url and render_url not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(render_url)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.common.authentication.OptionalJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardPagination",
    "PAGE_SIZE": 12,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "120/min",
        "auth": "10/min",
    },
    "EXCEPTION_HANDLER": "apps.common.exceptions.custom_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

if TESTING:
    REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = ()
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {
        "anon": "10000/min",
        "user": "10000/min",
        "auth": "10000/min",
    }

SPECTACULAR_SETTINGS = {
    "TITLE": "Nexora API",
    "DESCRIPTION": "Versioned REST API for the Nexora catalog, commerce, and operations.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env("JWT_ACCESS_MINUTES")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Nexora <noreply@localhost>")

PAYMENT_PROVIDER = env("PAYMENT_PROVIDER")
PAYMENT_WEBHOOK_SECRET = env("PAYMENT_WEBHOOK_SECRET", default="")
PAYMENT_CURRENCY = env("PAYMENT_CURRENCY", default="INR")
RAZORPAY_KEY_ID = env("RAZORPAY_KEY_ID", default="")
RAZORPAY_KEY_SECRET = env("RAZORPAY_KEY_SECRET", default="")
RAZORPAY_WEBHOOK_SECRET = env("RAZORPAY_WEBHOOK_SECRET", default="")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "{levelname} {asctime} {name} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}
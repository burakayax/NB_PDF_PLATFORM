"""NB PDF PLARTFORM web API giris noktasi."""

from __future__ import annotations

import logging
import os

# Nuisance warnings from fontTools / pypdf when PDF font metadata uses odd date encodings
# (e.g. "created timestamp seems very low; regarding as unix timestamp"). They are safe
# to ignore for this API service — keep application logs focused on real issues.
def _configure_third_party_logging() -> None:
    for name in (
        "fontTools",
        "fontTools.ttLib",
        "fontTools.ttLib.tables",
        "PIL.PngImagePlugin",
    ):
        try:
            logging.getLogger(name).setLevel(logging.ERROR)
        except Exception:
            pass


_configure_third_party_logging()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.auth_routes import router as auth_router
from app.api.routes import router
from app.core.result_store import start_ttl_sweeper

# Trial abuse reference routes (disabled by default; see app.auth.registration_workflow_example):
# from app.auth.registration_workflow_example import example_router
from app.limiter import limiter, rate_limit_key_func
from app.security.headers_middleware import SecurityHeadersMiddleware

logger = logging.getLogger(__name__)

app = FastAPI(
    title="NB PDF PLARTFORM Web API",
    version="0.1.0",
    description="Masatüstü PDF aracının web arayüzü için API katmanı.",
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exception_handler(request: Request, exc: RateLimitExceeded):
    logger.warning(
        "security type=rate_limit_exceeded ip=%s path=%s detail=%s",
        rate_limit_key_func(request),
        request.url.path,
        getattr(exc, "detail", exc),
    )
    return _rate_limit_exceeded_handler(request, exc)


# CORS: virgülle ayrılmış kökenler (ör. https://app.example.com) veya boş = yalnızca localhost/127.0.0.1 her port.
_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-SaaS-Gating"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-SaaS-Gating"],
    )

app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


@app.middleware("http")
async def attach_nb_device_id(request: Request, call_next):
    """Expose X-NB-Device-Id on request.state for trial / abuse hooks (desktop already sends this)."""
    raw = request.headers.get("X-NB-Device-Id") or request.headers.get("x-nb-device-id")
    request.state.nb_device_id = raw.strip() if raw and raw.strip() else None
    return await call_next(request)


app.include_router(router)
app.include_router(auth_router, prefix="/api")
# app.include_router(example_router, prefix="/api")


@app.on_event("startup")
async def _launch_result_store_sweeper() -> None:
    """Start the result-store TTL sweeper once per process (idempotent)."""
    start_ttl_sweeper()

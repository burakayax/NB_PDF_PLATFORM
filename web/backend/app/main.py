"""PDF PLATFORM web API giris noktasi."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

# .env dosyasini os.environ'a yukle — pydantic_settings yalnizca kendi
# alanlarini okur, BILLING_PROVIDER gibi alanlari os.environ'a koymaz.
try:
    from dotenv import load_dotenv as _load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    if _env_path.exists():
        _load_dotenv(_env_path, override=False)
except ImportError:
    pass  # python-dotenv yuklu degil; env degiskenleri sistem ortamindan okunur

from app.core.logging_config import configure_logging

configure_logging()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse

from app.core.tool_errors import GENERIC_TOOL_FAILURE_TR
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.auth_routes import router as auth_router
from app.api.routes import router
from app.api.tool_routes_extra import router as tool_routes_extra
from app.api.internal_billing import router as internal_billing_router
from app.core.result_store import start_ttl_sweeper
from app.core.thread_pool import (
    CpuCapacityTimeout,
    init_pdf_thread_pool,
    shutdown_pdf_thread_pool,
)

# Trial abuse reference routes (disabled by default; see app.auth.registration_workflow_example):
# from app.auth.registration_workflow_example import example_router
from app.limiter import limiter, rate_limit_key_func
from app.security.headers_middleware import SecurityHeadersMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def _app_lifespan(app: FastAPI):
    """PDF CPU havuzu + TTL sweeper; kapanışta executor düzgün durdurulur."""
    init_pdf_thread_pool()
    start_ttl_sweeper()
    yield
    shutdown_pdf_thread_pool(wait=True, cancel_futures=False)


app = FastAPI(
    title="PDF PLATFORM Web API",
    version="0.1.0",
    description="Masatüstü PDF aracının web arayüzü için API katmanı.",
    lifespan=_app_lifespan,
)

app.state.limiter = limiter


@app.exception_handler(CpuCapacityTimeout)
async def cpu_capacity_exception_handler(request: Request, exc: CpuCapacityTimeout):
    logger.warning(
        "pdf_cpu_capacity_timeout ip=%s path=%s retry_after=%s",
        rate_limit_key_func(request),
        request.url.path,
        exc.retry_after_sec,
    )
    ra = str(exc.retry_after_sec)
    return JSONResponse(
        status_code=503,
        headers={"Retry-After": ra},
        content={
            "detail": "Sunucu şu an yoğun; lütfen kısa süre sonra yeniden deneyin.",
            "error": "server_busy",
            "retry_after_seconds": exc.retry_after_sec,
        },
    )


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


@app.middleware("http")
async def unhandled_exception_safety_net(request: Request, call_next):
    """En dış katman: yakalanmamış istisnalarda ham yığın / yol sızdırmaz."""
    try:
        return await call_next(request)
    except StarletteHTTPException:
        raise
    except Exception:
        logger.exception("unhandled_request_failure path=%s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": GENERIC_TOOL_FAILURE_TR},
        )


@app.middleware("http")
async def log_incoming_pdf_requests(request: Request, call_next):
    """Son eklenen middleware ilk çalışır — POST /api istekleri hemen loglanır."""
    if request.method == "POST" and request.url.path.startswith("/api/"):
        logger.info("pdf_api_incoming %s %s", request.method, request.url.path)
    return await call_next(request)


app.include_router(router)
app.include_router(tool_routes_extra)
app.include_router(auth_router, prefix="/api")
app.include_router(internal_billing_router, prefix="/api/internal")
# app.include_router(example_router, prefix="/api")

# BirFatura artık doğrudan API çağrısı yapar; ek router gerekmez.


if __name__ == "__main__":
    """`python -m app.main` çalışır (cwd: web/backend). Üretim: uvicorn CLI veya run-pdf-api.mjs."""
    import uvicorn

    _host = (os.getenv("PDF_API_HOST") or "127.0.0.1").strip() or "127.0.0.1"
    _port = int((os.getenv("PDF_API_PORT") or "8000").strip() or "8000")
    uvicorn.run(app, host=_host, port=_port)

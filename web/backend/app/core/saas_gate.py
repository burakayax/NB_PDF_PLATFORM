"""Thin HTTP bridge from the Python tool workers to the Node SaaS API.

Every gate decision now flows through the Node-side entitlement engine
(`web/api/src/modules/subscription/entitlement.engine.ts`) via the HTTP
endpoints ``POST /api/entitlement/check`` and ``POST /api/entitlement/consume``.
The engine is the single source of truth for tool-execution rights; Python
only relays the caller's Bearer token and the ``toolId`` being invoked.

This module intentionally DOES NOT:
  - speak to any payment provider (Stripe / iyzico),
  - maintain its own credit / balance state,
  - enforce any daily usage limit,
  - compute processing tiers or friction banners.

The legacy ``saas_assert_feature`` / ``saas_record_usage`` helpers have been
removed together with the daily-limit system they fed.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Node SaaS API (Express :4000). Açık zaman aşımı + bağlantı süresi — Windows’ta sonsuz beklemeyi önler.
_SAAS_HTTP_TIMEOUT = httpx.Timeout(30.0, connect=5.0, read=25.0)
_SAAS_QUICK_GET_TIMEOUT = httpx.Timeout(15.0, connect=3.0, read=10.0)


def _is_production_like_environment() -> bool:
    """Hosted / prod — ``saas_session_ok`` bypass must NEVER run (SaaS revenue / auth)."""
    vercel = os.getenv("VERCEL", "").strip().lower()
    if vercel in ("1", "true", "yes"):
        return True
    env = (os.getenv("ENV") or os.getenv("ENVIRONMENT") or "").strip().lower()
    if env == "production":
        return True
    node_env = os.getenv("NODE_ENV", "").strip().lower()
    if node_env == "production":
        return True
    railway = os.getenv("RAILWAY_ENVIRONMENT", "").strip().lower()
    if railway == "production":
        return True
    return False


def _saas_session_ok_dev_bypass_enabled() -> bool:
    """Yerel geliştirme: Node'a GET /api/subscription/status gitmeden inspect devam eder.

    Üretimde (Vercel vb.) veya ``NB_PDF_FORCE_SAAS_SESSION`` ile asla aktif olmaz.
    """
    if _is_production_like_environment():
        return False
    force = os.getenv("NB_PDF_FORCE_SAAS_SESSION", "").strip().lower()
    if force in ("1", "true", "yes"):
        return False
    env = (os.getenv("ENV") or os.getenv("ENVIRONMENT") or "").strip().lower()
    if env == "development":
        return True
    debug = os.getenv("DEBUG", "").strip().lower()
    if debug in ("1", "true", "yes"):
        return True
    explicit = os.getenv("NB_PDF_DEV_BYPASS_SAAS_SESSION", "").strip().lower()
    if explicit in ("1", "true", "yes"):
        return True
    return False


def saas_api_base() -> str:
    return os.getenv("NB_SAAS_API_BASE", "http://127.0.0.1:4000").rstrip("/")


def _coerce_httpx_timeout(timeout: httpx.Timeout | float) -> httpx.Timeout:
    if isinstance(timeout, httpx.Timeout):
        return timeout
    return httpx.Timeout(timeout)


async def _httpx_post_json_with_retry(
    url: str,
    *,
    headers: dict[str, str],
    json_body: dict[str, Any] | None,
    timeout: httpx.Timeout | float | None = None,
    attempts: int = 3,
) -> httpx.Response:
    """Retry on transport failure or 5xx from the Node worker.

    ``attempts=1`` for non-idempotent endpoints (e.g. ``entitlement/consume``) so a
    retried POST cannot double-charge credits if the first request committed but the
    response was dropped.
    """
    effective_timeout = _coerce_httpx_timeout(timeout if timeout is not None else _SAAS_HTTP_TIMEOUT)
    last_err: Exception | None = None
    for i in range(attempts):
        try:
            async with httpx.AsyncClient(timeout=effective_timeout) as client:
                r = await client.post(url, headers=headers, json=json_body)
            if r.status_code >= 500 and i < attempts - 1:
                await asyncio.sleep(0.35 * (i + 1))
                continue
            return r
        except (
            httpx.ConnectError,
            httpx.TimeoutException,
            httpx.WriteTimeout,
            httpx.RemoteProtocolError,
        ) as exc:
            last_err = exc
            if i < attempts - 1:
                await asyncio.sleep(0.35 * (i + 1))
    if last_err:
        raise last_err
    raise HTTPException(status_code=502, detail="SaaS isteği tekrar denemelerine rağmen başarısız.")


def _detail_from_response(r: httpx.Response) -> str:
    try:
        data = r.json()
        if isinstance(data, dict) and data.get("message"):
            return str(data["message"])
    except Exception:
        pass
    text = (r.text or "").strip()
    return text or getattr(r, "reason_phrase", None) or "SaaS isteği başarısız."


# ---------------------------------------------------------------------------
# Session / identity helpers (unchanged)
# ---------------------------------------------------------------------------


async def saas_session_ok(token: str) -> None:
    """Validate the bearer token against Node's subscription status endpoint.

    Used by read-only preview-ish paths (e.g. ``inspect-pdf``) that want to
    reject expired / invalid tokens without triggering an entitlement check.

    Development only (see ``_saas_session_ok_dev_bypass_enabled``): the HTTP
    call may be skipped so local PDF inspect is not blocked when Node is slow.
    Production / Vercel: never skipped — subscription check always runs.
    """
    if _saas_session_ok_dev_bypass_enabled():
        logger.debug(
            "saas_session_ok: development bypass (Node GET /api/subscription/status skipped)",
        )
        return

    base = saas_api_base()
    url = f"{base}/api/subscription/status"
    try:
        async with httpx.AsyncClient(timeout=_SAAS_QUICK_GET_TIMEOUT) as client:
            r = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.TimeoutException as exc:
        logger.warning("saas_session_ok timeout url=%s err=%s", url, exc)
        raise HTTPException(
            status_code=502,
            detail=(
                "Kimlik API zaman aşımı (Node :4000). Proje kökünde `npm run dev` ile `[api]` sürecinin "
                "çalıştığını veya `NB_SAAS_API_BASE` adresini doğrulayın."
            ),
        ) from exc
    except httpx.ConnectError as exc:
        logger.warning("saas_session_ok connect_error url=%s err=%s", url, exc)
        raise HTTPException(
            status_code=502,
            detail=(
                "Kimlik API’ye bağlanılamadı (Node :4000). Güvenlik duvarı / `NB_SAAS_API_BASE` "
                "değerini kontrol edin."
            ),
        ) from exc

    if r.status_code == 200:
        return
    if r.status_code == 401:
        raise HTTPException(status_code=401, detail=_detail_from_response(r))
    raise HTTPException(
        status_code=502,
        detail=f"Abonelik durumu alınamadı: {_detail_from_response(r)}",
    )


async def saas_current_user_id(token: str) -> str:
    """Resolve the caller's user id without side effects.

    Wraps ``GET /api/auth/me``. Used by result-store preview/download routes
    to enforce ownership BEFORE any credit-bearing call, so foreign callers
    never decrement another user's credit balance.
    """
    base = saas_api_base()
    url = f"{base}/api/auth/me"
    try:
        async with httpx.AsyncClient(timeout=_SAAS_QUICK_GET_TIMEOUT) as client:
            r = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.TimeoutException as exc:
        logger.warning("saas_current_user_id timeout url=%s err=%s", url, exc)
        raise HTTPException(
            status_code=502,
            detail="Kimlik API zaman aşımı (`/api/auth/me`). Node sürecinin ayakta olduğunu doğrulayın.",
        ) from exc
    except httpx.ConnectError as exc:
        logger.warning("saas_current_user_id connect_error url=%s err=%s", url, exc)
        raise HTTPException(
            status_code=502,
            detail="Kimlik API’ye bağlanılamadı (`/api/auth/me`).",
        ) from exc

    if r.status_code == 401:
        raise HTTPException(status_code=401, detail=_detail_from_response(r))
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Kullanıcı bilgisi alınamadı: {_detail_from_response(r)}",
        )
    try:
        data = r.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Kullanıcı yanıtı okunamadı.") from exc
    user = data.get("user") if isinstance(data, dict) else None
    user_id = user.get("id") if isinstance(user, dict) else None
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=502, detail="Kullanıcı kimliği bulunamadı.")
    return user_id


# ---------------------------------------------------------------------------
# Entitlement engine bridge
# ---------------------------------------------------------------------------
#
# Wire-level shape of a check response (see CanExecuteResult on the Node side):
#   {
#     "allowed": true | false,
#     "reason": "credit_available" | "active_subscription" | "admin_bypass"
#               | "insufficient_credits" | "tool_not_registered" | "user_not_found",
#     "cost": number,
#     "creditsBefore": number,
#     "creditsAfter": number,
#   }
#
# Wire-level shape of a consume response (see ConsumeResult):
#   {
#     "status": "ok" | "denied",
#     "reason": "credit_available" | "active_subscription" | "admin_bypass"
#               | "insufficient_credits" | "tool_not_registered" | "user_not_found"
#               | "race_lost",
#     "transactionId": string | null,
#     "cost": number,
#     "creditsBefore": number,
#     "creditsAfter": number,
#   }
#
# Neither helper maps denial to an HTTPException. The caller holds the policy
# on whether to reject (pre-run 402) or log-and-continue (post-run race).


def _validate_decision(data: Any) -> dict[str, Any]:
    """Minimal shape check; lets malformed Node responses become 502s."""
    if not isinstance(data, dict) or "allowed" not in data or "reason" not in data:
        raise HTTPException(status_code=502, detail="Entitlement response malformed.")
    return data


def _validate_consume(data: Any) -> dict[str, Any]:
    if (
        not isinstance(data, dict)
        or "status" not in data
        or "reason" not in data
    ):
        raise HTTPException(status_code=502, detail="Entitlement consume response malformed.")
    return data


async def entitlement_check(token: str, tool_id: str, file_count: int = 1) -> dict[str, Any]:
    """POST ``/api/entitlement/check`` — pure engine decision, no side effects.

    Raises on transport / auth failure; returns the raw decision dict for
    ``allowed=true`` AND ``allowed=false``. The caller decides whether to
    reject the request (typically ``allowed=false`` → 402).
    """
    base = saas_api_base()
    json_body: dict[str, Any] = {"toolId": tool_id}
    if file_count > 1:
        json_body["fileCount"] = file_count
    r = await _httpx_post_json_with_retry(
        f"{base}/api/entitlement/check",
        headers={"Authorization": f"Bearer {token}"},
        json_body=json_body,
    )
    if r.status_code == 401:
        raise HTTPException(status_code=401, detail=_detail_from_response(r))
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Entitlement check failed: {_detail_from_response(r)}",
        )
    try:
        data = r.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Entitlement response unreadable.") from exc
    return _validate_decision(data)


async def entitlement_consume(token: str, tool_id: str) -> dict[str, Any]:
    """POST ``/api/entitlement/consume`` — race-safe credit decrement + journal.

    On HTTP success returns the raw ConsumeResult dict. A ``status == "denied"``
    body is NOT raised — the caller chooses whether to surface it to the user
    (rare; normally only happens on ``race_lost`` after a successful check).
    """
    base = saas_api_base()
    r = await _httpx_post_json_with_retry(
        f"{base}/api/entitlement/consume",
        headers={"Authorization": f"Bearer {token}"},
        json_body={"toolId": tool_id},
        attempts=1,
    )
    if r.status_code == 401:
        raise HTTPException(status_code=401, detail=_detail_from_response(r))
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Entitlement consume failed: {_detail_from_response(r)}",
        )
    try:
        data = r.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Entitlement consume unreadable.") from exc
    return _validate_consume(data)



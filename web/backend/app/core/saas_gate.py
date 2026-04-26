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


def saas_api_base() -> str:
    return os.getenv("NB_SAAS_API_BASE", "http://127.0.0.1:4000").rstrip("/")


async def _httpx_post_json_with_retry(
    url: str,
    *,
    headers: dict[str, str],
    json_body: dict[str, Any] | None,
    timeout: float = 30.0,
    attempts: int = 3,
) -> httpx.Response:
    """Retry on transport failure or 5xx from the Node worker."""
    last_err: Exception | None = None
    for i in range(attempts):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                r = await client.post(url, headers=headers, json=json_body)
            if r.status_code >= 500 and i < attempts - 1:
                await asyncio.sleep(0.35 * (i + 1))
                continue
            return r
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout, httpx.RemoteProtocolError) as exc:
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
    """
    base = saas_api_base()
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{base}/api/subscription/status",
            headers={"Authorization": f"Bearer {token}"},
        )
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
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{base}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
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


async def entitlement_check(token: str, tool_id: str) -> dict[str, Any]:
    """POST ``/api/entitlement/check`` — pure engine decision, no side effects.

    Raises on transport / auth failure; returns the raw decision dict for
    ``allowed=true`` AND ``allowed=false``. The caller decides whether to
    reject the request (typically ``allowed=false`` → 402).
    """
    base = saas_api_base()
    r = await _httpx_post_json_with_retry(
        f"{base}/api/entitlement/check",
        headers={"Authorization": f"Bearer {token}"},
        json_body={"toolId": tool_id},
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



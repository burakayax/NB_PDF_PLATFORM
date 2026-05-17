"""Dahili fatura tetikleme endpoint'i — Node.js payment callback'inden çağrılır."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.billing.webhook_handler import handle_iyzico_webhook

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/invoice")
async def trigger_invoice(request: Request) -> JSONResponse:
    """
    Node.js payment callback'i ödeme doğrulandıktan sonra bu endpoint'i çağırır.
    Fatura oluşturmayı tetikler; hata olursa bile her zaman HTTP 200 döner —
    fatura hatası asla abonelik aktivasyonunu bloke etmez.
    """
    try:
        payload: dict[str, Any] = await request.json()
        headers = dict(request.headers)
        result = handle_iyzico_webhook(payload, headers)
        return JSONResponse(content=result)
    except Exception:
        logger.exception("internal_billing: beklenmedik hata")
        return JSONResponse(content={"success": False, "error": "internal_error"})

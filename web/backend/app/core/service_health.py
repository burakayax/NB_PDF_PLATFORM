"""Hizmet sağlık bildirimi: PDF API → Auth API (Node).

Amaç: "servis kesildi" iddialarında DIŞ izleyiciye (UptimeRobot) bağımlı kalmadan kendi kaydımız olsun.
  • Her dakika kalp atışı (heartbeat): PDF API'nin ayakta olduğunu Node'a bildirir.
  • 5xx yanıtlar: yol (kimlik parçaları maskeli) + durum kodu ile bildirilir; işlem içeriği ve kullanıcı bilgisi GÖNDERİLMEZ.
Hepsi non-fatal ve arka plandadır: bildirim başarısız olsa bile hiçbir işlem etkilenmez.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any

from app.core import saas_gate

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL_SEC = 60
_THROTTLE_SEC = 30
_last_sent: dict[tuple[str, int], float] = {}

_ID_SEGMENT = re.compile(r"^(?:[0-9a-fA-F]{16,}|[0-9a-fA-F-]{32,}|(?=.*\d)[A-Za-z0-9_-]{24,})$")


def normalize_path(path: str) -> str:
    """Yol içindeki uzun kimlik parçalarını (sonuç no, jeton) ':id' ile maskeler; sorgu dizesi atılır."""
    clean = path.split("?", 1)[0]
    parts = [":id" if _ID_SEGMENT.match(p) else p for p in clean.split("/")]
    return "/".join(parts)[:200]


async def _post(body: dict[str, Any]) -> None:
    secret = saas_gate.internal_service_secret()
    if not secret:
        return
    try:
        r = await saas_gate._httpx_post_json_with_retry(  # noqa: SLF001 — aynı köprü
            f"{saas_gate.saas_api_base()}/api/entitlement/internal/service-event",
            headers={"X-Internal-Secret": secret},
            json_body=body,
            attempts=1,
        )
        if r.status_code not in (200, 201):
            logger.debug("service_event non-2xx: %s", r.status_code)
    except Exception as exc:  # noqa: BLE001
        logger.debug("service_event failed: %s", exc)


async def report_http_failure(path: str, status: int) -> None:
    """5xx yanıtını bildirir (aynı yol+durum için en çok 30 sn'de bir)."""
    p = normalize_path(path)
    key = (p, status)
    now = time.monotonic()
    if now - _last_sent.get(key, 0.0) < _THROTTLE_SEC:
        return
    _last_sent[key] = now
    if len(_last_sent) > 500:  # bellek koruması
        _last_sent.clear()
    await _post({"kind": "http_5xx", "component": "pdf", "path": p, "status": int(status)})


async def heartbeat_loop() -> None:
    """Uygulama ayaktayken her dakika Node'a 'ayaktayım' der."""
    while True:
        started = time.monotonic()
        await _post({"kind": "heartbeat", "component": "pdf", "ok": True})
        elapsed = time.monotonic() - started
        await asyncio.sleep(max(1.0, HEARTBEAT_INTERVAL_SEC - elapsed))

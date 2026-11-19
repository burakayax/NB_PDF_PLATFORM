"""Dış bağımlılıkların sağlık kontrolü (`GET /api/health/deps`).

Neden ayrı: Gotenberg (Word/Excel/PowerPoint → PDF) özel bir Render servisidir; dışarıdan adresi yoktur.
PDF servisi (`nb-pdf-api`) onu iç ağdan görebilir, o yüzden UptimeRobot gibi dışarıdan izleyen araçlar
Gotenberg'in çöktüğünü yalnızca bu uç üzerinden anlayabilir.

Güvenlik: yanıt yalnızca "up" / "down" / "not_configured" döndürür. Adres, sürüm, hata metni vb. ASLA yazılmaz.
Sonuç kısa süre önbelleğe alınır; herkese açık adres Gotenberg'e saldırı yükü bindirmesin.
"""

from __future__ import annotations

import os
import time
from typing import Callable

_CACHE_SECONDS = 10.0
_cache: dict[str, object] = {"at": -1e9, "value": None}


def _http_status(url: str, timeout: float) -> int:
    import requests

    return requests.get(url, timeout=timeout).status_code


def gotenberg_status(
    base_url: str | None = None,
    *,
    getter: Callable[[str, float], int] = _http_status,
    timeout: float = 2.5,
    now: Callable[[], float] = time.monotonic,
    use_cache: bool = True,
) -> str:
    """Gotenberg'in durumunu döndürür: "up", "down" ya da "not_configured"."""
    base = (base_url if base_url is not None else os.environ.get("GOTENBERG_URL", "")).strip().rstrip("/")
    if not base:
        return "not_configured"
    # Render adresi "host:port" olarak verir (şema yok); requests şemasız adresi reddeder.
    if not base.startswith(("http://", "https://")):
        base = f"http://{base}"

    t = now()
    if use_cache and t - float(_cache["at"]) < _CACHE_SECONDS and _cache["value"] is not None:
        return str(_cache["value"])

    try:
        status = "up" if getter(f"{base}/health", timeout) == 200 else "down"
    except Exception:
        status = "down"

    if use_cache:
        _cache["at"] = t
        _cache["value"] = status
    return status

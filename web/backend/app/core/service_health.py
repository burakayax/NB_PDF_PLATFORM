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
import uuid
from typing import Any

from app.core import saas_gate

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL_SEC = 60
# Süreç kimliği: yeniden başlatma (ör. bellek aşımı) Node tarafında bu değerin değişmesinden anlaşılır.
BOOT_ID = uuid.uuid4().hex[:12]
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


# ── Sürmekte olan işlemler + araç çağrısı kaydı ───────────────────────────────────────────────
# Dosya içeriği/adı tutulmaz; yalnız yol (kimlikler maskeli), boyut ve süre. Süreç bellek aşımıyla öldürülürse
# "o sırada hangi işlem sürüyordu" bilgisi son kalp atışından okunur.
_inflight: dict[int, tuple[str, float, int | None]] = {}
_inflight_seq = 0
_last_early_beat = 0.0
_tool_post_sem: asyncio.Semaphore | None = None
_EARLY_BEAT_MIN_KB = 5 * 1024  # 5 MB ve üstü yüklemelerde kalp atışı hemen gönderilir (OOM'dan önce iz kalsın)


def inflight_start(path: str, size_kb: int | None) -> int:
    global _inflight_seq
    _inflight_seq += 1
    _inflight[_inflight_seq] = (normalize_path(path), time.monotonic(), size_kb)
    if len(_inflight) > 200:  # bellek koruması
        _inflight.pop(next(iter(_inflight)), None)
    if size_kb is not None and size_kb >= _EARLY_BEAT_MIN_KB:
        _schedule_early_beat()
    return _inflight_seq


def inflight_end(handle: int) -> None:
    _inflight.pop(handle, None)


def _schedule_early_beat() -> None:
    global _last_early_beat
    now = time.monotonic()
    if now - _last_early_beat < 5.0:
        return
    _last_early_beat = now
    try:
        asyncio.get_running_loop().create_task(_post(_heartbeat_body()))
    except RuntimeError:
        pass


def _rss_mb() -> float | None:
    """Anlık bellek (MB). Linux'ta /proc'tan; yoksa None."""
    try:
        with open("/proc/self/status", encoding="ascii", errors="ignore") as fh:
            for line in fh:
                if line.startswith("VmRSS:"):
                    return round(int(line.split()[1]) / 1024, 1)
    except Exception:  # noqa: BLE001
        return None
    return None


def _heartbeat_body() -> dict[str, Any]:
    now = time.monotonic()
    inflight = [
        {"tool": t, "ageSec": int(now - started), "sizeKb": kb}
        for (t, started, kb) in sorted(_inflight.values(), key=lambda v: v[1])[:10]
    ]
    body: dict[str, Any] = {"kind": "heartbeat", "component": "pdf", "ok": True, "bootId": BOOT_ID, "inflight": inflight}
    rss = _rss_mb()
    if rss is not None:
        body["rssMb"] = rss
    return body


async def report_tool_call(path: str, status: int, duration_ms: float, size_kb: int | None, token: str | None) -> None:
    """Her araç isteği için tek kayıt (kim: oturum anahtarı Node'da doğrulanır, saklanmaz). Başarısızlık sessizce yutulur."""
    global _tool_post_sem
    if _tool_post_sem is None:
        _tool_post_sem = asyncio.Semaphore(20)
    if _tool_post_sem.locked():
        return  # yoğunlukta kayıt atlanır; iş asla yavaşlamaz
    async with _tool_post_sem:
        body: dict[str, Any] = {
            "kind": "tool_call",
            "component": "pdf",
            "path": normalize_path(path),
            "status": int(status),
            "durationMs": int(duration_ms),
        }
        if size_kb is not None:
            body["sizeKb"] = int(size_kb)
        if token:
            body["token"] = token[:4000]
        await _post(body)


async def heartbeat_loop() -> None:
    """Uygulama ayaktayken her dakika Node'a 'ayaktayım' der (süreç kimliği, bellek, sürmekte olan işlemlerle)."""
    while True:
        started = time.monotonic()
        await _post(_heartbeat_body())
        elapsed = time.monotonic() - started
        await asyncio.sleep(max(1.0, HEARTBEAT_INTERVAL_SEC - elapsed))

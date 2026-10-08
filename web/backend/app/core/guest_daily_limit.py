"""Misafir (üye olmayan) kullanıcıların SUNUCUDA çalışan araçlar için günlük hak sayacı.

Neden ayrı bir sayaç: genel abonelik/kota sistemi (Node ``quota.ts``) yalnızca oturum açmış
kullanıcıyı tanır. Üye olmayan ziyaretçiye "1 deneme hakkı" vermek için kimlik başına
(IP özeti) küçük bir SQLite sayaç tutulur. PDF Düzenle'nin ``editor_daily_limit`` modeliyle aynı
yaklaşım; ama ``ad alanı`` (araç) başına ayrı sayar ve haktan GERİ ALMAYI (iade) bilir —
sunucu tarafında işlem hata verirse kullanıcının hakkı yanmasın.

İki kapı vardır:
  • kişi başı: ``consume(ns, key, limit)``
  • toplam: ``GLOBAL_KEY`` ile aynı fonksiyon — tek bir saldırganın / botun sunucuyu
    bedavaya yormasını sınırlar (kimlik kaçırma, IP döndürme durumunda da üst sınır korunur).

Gün sınırı uygulamanın geri kalanıyla tutarlı: Europe/Istanbul.

ASIL SAYAÇ BURADA DEĞİL: Render'da kalıcı disk yoktur; bu dosyadaki yerel SQLite her yeniden dağıtımda
sıfırlanır ve birden fazla örnekte örnek başına ayrı sayar. Bu yüzden sayaç ve panelden ayarlanan değerler
Node/Postgres'te tutulur (dosyanın altındaki KÖPRÜ bölümü). Yerel SQLite yalnızca YEDEKTİR: köprü
(``INTERNAL_SERVICE_SECRET``) tanımsızsa ya da ana sunucuya ulaşılamıyorsa devreye girer.
Ayrıntı: docs/rehber/11-SIKISTIRMA-MISAFIR-HAKKI.md.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import os
import sqlite3
import threading
import time
from pathlib import Path

try:  # Py3.9+ stdlib
    from zoneinfo import ZoneInfo

    _TZ = ZoneInfo("Europe/Istanbul")
except Exception:  # pragma: no cover
    _TZ = None  # type: ignore[assignment]

_SALT = os.getenv("GUEST_LIMIT_SALT", "nb-pdf-guest-daily-v1")
GLOBAL_KEY = "global"

_DB_PATH = Path(
    os.getenv(
        "GUEST_LIMIT_DB",
        str((Path(__file__).resolve().parent.parent.parent / "tmp" / "guest_daily_limit.db")),
    )
)

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute(
            "CREATE TABLE IF NOT EXISTS guest_daily ("
            " ns TEXT NOT NULL, id_key TEXT NOT NULL, day TEXT NOT NULL,"
            " count INTEGER NOT NULL DEFAULT 0,"
            " PRIMARY KEY (ns, id_key, day))"
        )
        _conn.commit()
    return _conn


def reset_for_tests(db_path: str | None = None) -> None:
    """Testler için: bağlantıyı kapatıp (isteğe bağlı) başka bir dosyaya yönlendirir."""
    global _conn, _DB_PATH
    with _lock:
        if _conn is not None:
            _conn.close()
            _conn = None
        if db_path:
            _DB_PATH = Path(db_path)


def _now() -> _dt.datetime:
    return _dt.datetime.now(_TZ) if _TZ else _dt.datetime.now()


def today_key() -> str:
    return _now().strftime("%Y-%m-%d")


def reset_at_iso() -> str:
    """Bir sonraki gece yarısı (Europe/Istanbul) — ISO 8601."""
    nxt = (_now() + _dt.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return nxt.isoformat()


def hash_ip(ip: str) -> str:
    """IP düz metin SAKLANMAZ; tuzlu SHA-256 özeti tutulur."""
    return hashlib.sha256(f"{_SALT}:{ip}".encode()).hexdigest()[:32]


def guest_key(ip: str) -> str:
    return f"g:{hash_ip(ip)}"


def peek(ns: str, key: str) -> int:
    """Bugün kullanılan adet (düşürmeden)."""
    with _lock:
        row = _db().execute(
            "SELECT count FROM guest_daily WHERE ns=? AND id_key=? AND day=?",
            (ns, key, today_key()),
        ).fetchone()
    return int(row[0]) if row else 0


def consume(ns: str, key: str, limit: int) -> tuple[bool, int, int]:
    """Limit dolmadıysa atomik +1. Dönüş: (izin, kullanılan_sonra, limit)."""
    day = today_key()
    with _lock:
        conn = _db()
        row = conn.execute(
            "SELECT count FROM guest_daily WHERE ns=? AND id_key=? AND day=?", (ns, key, day)
        ).fetchone()
        used = int(row[0]) if row else 0
        if limit > 0 and used >= limit:
            return (False, used, limit)
        conn.execute(
            "INSERT INTO guest_daily (ns, id_key, day, count) VALUES (?,?,?,1) "
            "ON CONFLICT(ns, id_key, day) DO UPDATE SET count = count + 1",
            (ns, key, day),
        )
        conn.commit()
    return (True, used + 1, limit)


def refund(ns: str, key: str) -> None:
    """İşlem başarısız olduysa hakkı geri verir (sayaç 0'ın altına inmez)."""
    day = today_key()
    with _lock:
        conn = _db()
        conn.execute(
            "UPDATE guest_daily SET count = MAX(0, count - 1) WHERE ns=? AND id_key=? AND day=?",
            (ns, key, day),
        )
        conn.commit()


# ═════════════════════════════════════════════════════════════════════════════
# KÖPRÜ: ayar + sayaç Node/Postgres'te (panelden yönetilir, deploy'da SIFIRLANMAZ)
# ═════════════════════════════════════════════════════════════════════════════
#
# Neden: Render'da kalıcı disk yok → yukarıdaki yerel SQLite her yeniden dağıtımda/başlatmada
# sıfırlanır ve birden fazla örnekte örnek başına ayrı sayılır. Asıl sayaç ve ayar Node tarafında:
#   GET  /api/entitlement/internal/guest-compress/config   (panelde ayarlanan değerler)
#   POST /api/entitlement/internal/guest-compress/usage    (consume / refund / peek)
# Köprü yalnızca ``INTERNAL_SERVICE_SECRET`` tanımlıysa kullanılır; tanımsızsa ya da Node'a
# ulaşılamazsa YEREL YEDEĞE düşülür (kesinti olmaz; ama sayaç geçicidir). Panel durumu bunu gösterir.

import logging  # noqa: E402
from dataclasses import dataclass  # noqa: E402

logger = logging.getLogger(__name__)

_BRIDGE_TIMEOUT = 3.0
_CONFIG_PATH = "/api/entitlement/internal/guest-compress/config"
_USAGE_PATH = "/api/entitlement/internal/guest-compress/usage"
_CONFIG_TTL = 30.0  # sn: panelde yapılan değişiklik en geç bu kadar sürede uygulanır
_LOCAL_NS = "compress"


@dataclass(frozen=True)
class GuestConfig:
    enabled: bool
    daily_limit: int
    global_limit: int
    max_mb: int
    source: str  # "panel" (Node'dan) | "env" (yedek: ortam değişkeni / varsayılan)

    @property
    def closed(self) -> bool:
        """Misafir kapısı kapalı mı? Ana anahtar kapalı ya da herhangi bir sınır 0 (0 = KAPALI, sınırsız DEĞİL)."""
        return (not self.enabled) or self.daily_limit <= 0 or self.global_limit <= 0


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def env_config() -> GuestConfig:
    """Köprü yokken/ulaşılamazken kullanılan yedek ayar (ortam değişkeni → varsayılan)."""
    return GuestConfig(
        enabled=True,
        daily_limit=_env_int("GUEST_COMPRESS_DAILY_LIMIT", 1),
        global_limit=_env_int("GUEST_COMPRESS_GLOBAL_DAILY_LIMIT", 400),
        max_mb=_env_int("GUEST_COMPRESS_MAX_MB", 20),
        source="env",
    )


def bridge_enabled() -> bool:
    from app.core.saas_gate import internal_service_secret

    return bool(internal_service_secret())


def _bridge_headers() -> dict[str, str]:
    from app.core.saas_gate import internal_service_secret

    return {"X-Internal-Secret": internal_service_secret()}


def _bridge_get(path: str) -> dict | None:
    if not bridge_enabled():
        return None
    import httpx

    from app.core.saas_gate import saas_api_base

    try:
        r = httpx.get(f"{saas_api_base()}{path}", headers=_bridge_headers(), timeout=_BRIDGE_TIMEOUT)
        if r.status_code != 200:
            logger.warning("guest bridge GET %s -> %s", path, r.status_code)
            return None
        data = r.json()
        return data if isinstance(data, dict) else None
    except Exception as exc:  # ağ/sunucu hatası → yerel yedek
        logger.warning("guest bridge GET %s failed: %s", path, exc)
        return None


def _bridge_post(path: str, body: dict) -> dict | None:
    if not bridge_enabled():
        return None
    import httpx

    from app.core.saas_gate import saas_api_base

    try:
        r = httpx.post(f"{saas_api_base()}{path}", headers=_bridge_headers(), json=body, timeout=_BRIDGE_TIMEOUT)
        if r.status_code != 200:
            logger.warning("guest bridge POST %s -> %s", path, r.status_code)
            return None
        data = r.json()
        return data if isinstance(data, dict) else None
    except Exception as exc:
        logger.warning("guest bridge POST %s failed: %s", path, exc)
        return None


_cfg_cache: tuple[float, GuestConfig] | None = None


def clear_config_cache() -> None:
    global _cfg_cache
    _cfg_cache = None


def get_config() -> GuestConfig:
    """Panelden ayarlanan değerler (30 sn önbellek). Köprü yoksa/ulaşılamazsa: son bilinen panel değeri,
    o da yoksa ortam değişkeni/varsayılan. Son bilinen değerin korunması önemli: yönetici kapıyı
    kapattıysa Node'a anlık ulaşılamaması kapıyı yeniden AÇMAMALI."""
    global _cfg_cache
    if not bridge_enabled():
        return env_config()
    now = time.monotonic()
    if _cfg_cache and now - _cfg_cache[0] < _CONFIG_TTL:
        return _cfg_cache[1]
    data = _bridge_get(_CONFIG_PATH)
    if data and all(k in data for k in ("enabled", "dailyLimit", "globalDailyLimit", "maxMB")):
        cfg = GuestConfig(
            enabled=bool(data["enabled"]),
            daily_limit=int(data["dailyLimit"]),
            global_limit=int(data["globalDailyLimit"]),
            max_mb=max(1, int(data["maxMB"])),
            source="panel",
        )
        _cfg_cache = (now, cfg)
        return cfg
    if _cfg_cache:
        return _cfg_cache[1]
    return env_config()


def counter_source() -> str:
    """Sayaç nerede tutuluyor? "database" (kalıcı, panelden) ya da "local" (geçici disk yedeği)."""
    return "database" if bridge_enabled() else "local"


def _usage(action: str, scope: str, key: str | None = None) -> dict | None:
    body: dict = {"action": action, "scope": scope}
    if key is not None:
        body["key"] = key
    return _bridge_post(_USAGE_PATH, body)


def consume_person(key: str, cfg: GuestConfig) -> tuple[bool, int, int]:
    """Kişi başı hakkı düşer. Dönüş: (izin, kullanılan_sonra, limit). Kapalıysa izin YOK."""
    if cfg.closed:
        return (False, 0, cfg.daily_limit)
    data = _usage("consume", "person", key)
    if data is not None and "allowed" in data:
        return (bool(data["allowed"]), int(data.get("used", 0)), int(data.get("limit", cfg.daily_limit)))
    return consume(_LOCAL_NS, key, cfg.daily_limit)


def consume_global(cfg: GuestConfig) -> tuple[bool, int, int]:
    """Toplam günlük kapasiteyi düşer."""
    if cfg.closed:
        return (False, 0, cfg.global_limit)
    data = _usage("consume", "global")
    if data is not None and "allowed" in data:
        return (bool(data["allowed"]), int(data.get("used", 0)), int(data.get("limit", cfg.global_limit)))
    return consume(_LOCAL_NS, GLOBAL_KEY, cfg.global_limit)


def refund_person(key: str) -> None:
    if _usage("refund", "person", key) is None:
        refund(_LOCAL_NS, key)


def refund_global() -> None:
    if _usage("refund", "global") is None:
        refund(_LOCAL_NS, GLOBAL_KEY)


def peek_person(key: str, cfg: GuestConfig) -> int:
    """Bugün kullanılan adet (düşürmeden)."""
    data = _usage("peek", "person", key)
    if data is not None and "used" in data:
        return int(data["used"])
    return peek(_LOCAL_NS, key)

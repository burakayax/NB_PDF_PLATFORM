"""PDF Düzenle aracına ÖZEL günlük indirme limiti (misafir + FREE kullanıcılar).

Neden ayrı: genel abonelik/kota sistemi (Node ``quota.ts``) yalnız oturum açmış
kullanıcıyı ve TÜM araçlar için paylaşılan sayacı yönetir; misafir başına takip yok.
Burada PDF editörü için, indirme anında düşen, kimlik başına (oturum açmış → user_id,
misafir → IP hash) küçük bir SQLite sayaç tutulur. Gelir kotasına dokunmaz.

Politika (bkz. ürün kararı):
  - Misafir           → 2 / gün
  - Oturum açmış FREE → 5 / gün
  - PRO/PLUS/BUSINESS/ADMIN → sınırsız (limiter hiç çağrılmaz)

Gün sınırı, uygulamanın geri kalanıyla tutarlı olması için Europe/Istanbul'a göre.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import os
import sqlite3
import threading
from pathlib import Path

try:  # Py3.9+ stdlib
    from zoneinfo import ZoneInfo

    _TZ = ZoneInfo("Europe/Istanbul")
except Exception:  # pragma: no cover
    _TZ = None  # type: ignore[assignment]

# Limitler — tek yerden yönetilir.
GUEST_DAILY_LIMIT = int(os.getenv("EDITOR_GUEST_DAILY_LIMIT", "2"))
FREE_DAILY_LIMIT = int(os.getenv("EDITOR_FREE_DAILY_LIMIT", "5"))

_SALT = os.getenv("EDITOR_LIMIT_SALT", "nb-pdf-editor-daily-v1")

# SQLite dosyası — results tmp ile aynı köke koyulur (kalıcı disk).
_DB_PATH = Path(
    os.getenv(
        "EDITOR_LIMIT_DB",
        str((Path(__file__).resolve().parent.parent.parent / "tmp" / "editor_daily_limit.db")),
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
            "CREATE TABLE IF NOT EXISTS editor_daily ("
            " id_key TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,"
            " PRIMARY KEY (id_key, day))"
        )
        _conn.commit()
    return _conn


def _now() -> _dt.datetime:
    return _dt.datetime.now(_TZ) if _TZ else _dt.datetime.now()


def today_key() -> str:
    return _now().strftime("%Y-%m-%d")


def reset_at_iso() -> str:
    """Bir sonraki gece yarısı (Europe/Istanbul) — ISO 8601."""
    now = _now()
    nxt = (now + _dt.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return nxt.isoformat()


def hash_ip(ip: str) -> str:
    return hashlib.sha256(f"{_SALT}:{ip}".encode()).hexdigest()[:32]


def guest_key(ip: str) -> str:
    return f"g:{hash_ip(ip)}"


def user_key(user_id: str) -> str:
    return f"u:{user_id}"


def peek(key: str) -> int:
    """Bugün kullanılan adet (düşürmeden)."""
    day = today_key()
    with _lock:
        cur = _db().execute(
            "SELECT count FROM editor_daily WHERE id_key=? AND day=?", (key, day)
        ).fetchone()
    return int(cur[0]) if cur else 0


def consume(key: str, limit: int) -> tuple[bool, int, int]:
    """Limit dolmadıysa atomik +1. Dönüş: (izin, kullanılan_sonra, limit).

    ``limit <= 0`` → sınırsız (her zaman izin, sayaç yine artırılır ki gösterilebilsin)."""
    day = today_key()
    with _lock:
        conn = _db()
        row = conn.execute(
            "SELECT count FROM editor_daily WHERE id_key=? AND day=?", (key, day)
        ).fetchone()
        used = int(row[0]) if row else 0
        if limit > 0 and used >= limit:
            return (False, used, limit)
        new_used = used + 1
        conn.execute(
            "INSERT INTO editor_daily (id_key, day, count) VALUES (?,?,1) "
            "ON CONFLICT(id_key, day) DO UPDATE SET count = count + 1",
            (key, day),
        )
        conn.commit()
    return (True, new_used, limit)

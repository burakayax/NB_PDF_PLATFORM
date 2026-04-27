"""Disk-backed temporary store for processed tool outputs.

Each tool run writes its result here first; the client then fetches it via
``GET /api/pdf/result/{result_id}/download``. Entries auto-expire after
``RESULT_TTL_SECONDS`` via a lightweight background sweeper started from
``main.py`` at app boot.

Layout on disk::

    <root>/
        <uuid>/
            file             # the real payload (streamed to the user)
            meta.json        # filename, mime, size, user_id, created_at
            thumbnail.png    # optional; only when a PDF preview was generated

The store is intentionally self-contained (plain fs + json) so it stays
portable when we later move to object storage.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Default: web/backend/tmp/results (relative to this file's package root).
_DEFAULT_ROOT = (Path(__file__).resolve().parent.parent.parent / "tmp" / "results").resolve()

RESULT_TTL_SECONDS = 30 * 60  # 30 minutes, matches the plan
_SWEEPER_INTERVAL_SECONDS = 5 * 60
_META_FILENAME = "meta.json"
_PAYLOAD_FILENAME = "file"
_THUMBNAIL_FILENAME = "thumbnail.png"


def _root_dir() -> Path:
    override = os.getenv("NB_RESULT_STORE_DIR")
    root = Path(override).expanduser().resolve() if override else _DEFAULT_ROOT
    root.mkdir(parents=True, exist_ok=True)
    return root


@dataclass(frozen=True)
class ResultHandle:
    result_id: str
    filename: str
    mime: str
    size_bytes: int
    has_thumbnail: bool


def _entry_dir(result_id: str) -> Path:
    """Return the per-result directory, validating the id is a bare uuid hex.

    Rejecting anything that isn't hex + correct length makes path traversal
    impossible even if an attacker controls the id on the read path.
    """
    try:
        parsed = uuid.UUID(result_id)
    except (ValueError, AttributeError, TypeError) as exc:
        raise HTTPException(status_code=404, detail="Result not found.") from exc
    return _root_dir() / parsed.hex


def save_result(
    payload: bytes,
    filename: str,
    mime: str,
    *,
    user_id: str,
    thumbnail_png: Optional[bytes] = None,
    tool: str = "compress",
) -> ResultHandle:
    """Persist ``payload`` and return a handle the client can later redeem.

    ``user_id`` is stored in ``meta.json`` so :func:`get_result` can enforce
    ownership without consulting a database.
    ``tool`` names the entitlement key used on
    :func:`download_result` (``entitlement_consume``).
    """
    result_id = uuid.uuid4().hex
    entry = _root_dir() / result_id
    entry.mkdir(parents=True, exist_ok=False)

    payload_path = entry / _PAYLOAD_FILENAME
    payload_path.write_bytes(payload)

    has_thumbnail = False
    if thumbnail_png:
        (entry / _THUMBNAIL_FILENAME).write_bytes(thumbnail_png)
        has_thumbnail = True

    meta = {
        "result_id": result_id,
        "filename": filename,
        "mime": mime,
        "size_bytes": len(payload),
        "user_id": user_id,
        "created_at": time.time(),
        "has_thumbnail": has_thumbnail,
        "tool": tool,
    }
    (entry / _META_FILENAME).write_text(json.dumps(meta), encoding="utf-8")

    return ResultHandle(
        result_id=result_id,
        filename=filename,
        mime=mime,
        size_bytes=len(payload),
        has_thumbnail=has_thumbnail,
    )


def save_result_from_file(
    payload_path: Path,
    filename: str,
    mime: str,
    *,
    user_id: str,
    thumbnail_png: Optional[bytes] = None,
    tool: str = "compress",
) -> ResultHandle:
    """Persist a file from disk without loading the whole payload into RAM."""
    result_id = uuid.uuid4().hex
    entry = _root_dir() / result_id
    entry.mkdir(parents=True, exist_ok=False)

    dest = entry / _PAYLOAD_FILENAME
    shutil.copyfile(payload_path, dest)
    size_bytes = dest.stat().st_size

    has_thumbnail = False
    if thumbnail_png:
        (entry / _THUMBNAIL_FILENAME).write_bytes(thumbnail_png)
        has_thumbnail = True

    meta = {
        "result_id": result_id,
        "filename": filename,
        "mime": mime,
        "size_bytes": size_bytes,
        "user_id": user_id,
        "created_at": time.time(),
        "has_thumbnail": has_thumbnail,
        "tool": tool,
    }
    (entry / _META_FILENAME).write_text(json.dumps(meta), encoding="utf-8")

    return ResultHandle(
        result_id=result_id,
        filename=filename,
        mime=mime,
        size_bytes=size_bytes,
        has_thumbnail=has_thumbnail,
    )


def _read_meta(entry: Path) -> dict:
    try:
        return json.loads((entry / _META_FILENAME).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=404, detail="Result not found.") from exc


def _is_expired(meta: dict) -> bool:
    created = float(meta.get("created_at") or 0.0)
    return (time.time() - created) > RESULT_TTL_SECONDS


@dataclass(frozen=True)
class ResultRead:
    payload_path: Path
    thumbnail_path: Optional[Path]
    filename: str
    mime: str
    size_bytes: int


def get_result(result_id: str, user_id: str) -> ResultRead:
    """Return paths + metadata for a result, enforcing ownership + TTL.

    Raises ``HTTPException(404)`` for missing, expired, or foreign entries —
    the same opaque response keeps the endpoint unguessable.
    """
    entry = _entry_dir(result_id)
    if not entry.is_dir():
        raise HTTPException(status_code=404, detail="Result not found.")

    meta = _read_meta(entry)
    if meta.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Result not found.")
    if _is_expired(meta):
        # Lazily delete on read so we don't leak disk if the sweeper is late.
        _delete_entry(entry)
        raise HTTPException(status_code=404, detail="Result not found.")

    payload_path = entry / _PAYLOAD_FILENAME
    if not payload_path.is_file():
        raise HTTPException(status_code=404, detail="Result not found.")

    thumb_path: Optional[Path] = entry / _THUMBNAIL_FILENAME
    if thumb_path and not thumb_path.is_file():
        thumb_path = None

    return ResultRead(
        payload_path=payload_path,
        thumbnail_path=thumb_path,
        filename=str(meta.get("filename") or "download.bin"),
        mime=str(meta.get("mime") or "application/octet-stream"),
        size_bytes=int(meta.get("size_bytes") or payload_path.stat().st_size),
    )


def read_meta_only(result_id: str) -> dict:
    """Return the parsed ``meta.json`` for ``result_id`` (ownership-check fast path).

    Use this — not :func:`get_result` — when the caller must distinguish a
    foreign owner from a missing entry (e.g. to return 403 vs. 404). It
    never touches the payload and has no side effects.

    Raises ``HTTPException(404)`` for missing or expired entries. The
    expired branch also lazily deletes the directory, matching
    :func:`get_result`.
    """
    entry = _entry_dir(result_id)
    if not entry.is_dir():
        raise HTTPException(status_code=404, detail="Result not found.")
    meta = _read_meta(entry)
    if _is_expired(meta):
        _delete_entry(entry)
        raise HTTPException(status_code=404, detail="Result not found.")
    return meta


def delete_result(result_id: str) -> None:
    """Delete an entry by id. Safe to call repeatedly / on missing ids."""
    try:
        entry = _entry_dir(result_id)
    except HTTPException:
        return
    _delete_entry(entry)


def _delete_entry(entry: Path) -> None:
    if not entry.exists():
        return
    for child in entry.iterdir():
        try:
            child.unlink()
        except OSError:
            logger.warning("result_store: failed to delete %s", child, exc_info=True)
    try:
        entry.rmdir()
    except OSError:
        logger.warning("result_store: failed to remove dir %s", entry, exc_info=True)


def _sweep_once() -> int:
    """Delete expired entries. Returns the number of entries removed."""
    removed = 0
    root = _root_dir()
    for entry in root.iterdir():
        if not entry.is_dir():
            continue
        meta_file = entry / _META_FILENAME
        if not meta_file.is_file():
            # Orphan directory (e.g. interrupted write). Drop it if older than
            # the TTL so we don't eat disk forever.
            try:
                age = time.time() - entry.stat().st_mtime
            except OSError:
                continue
            if age > RESULT_TTL_SECONDS:
                _delete_entry(entry)
                removed += 1
            continue
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            _delete_entry(entry)
            removed += 1
            continue
        if _is_expired(meta):
            _delete_entry(entry)
            removed += 1
    return removed


_sweeper_started = False
_sweeper_lock = threading.Lock()


def start_ttl_sweeper() -> None:
    """Start the background TTL sweeper thread (idempotent).

    Call once from app startup (see ``main.py``). Further calls are no-ops,
    so accidental double-registration is harmless.
    """
    global _sweeper_started
    with _sweeper_lock:
        if _sweeper_started:
            return
        _sweeper_started = True

    def _run() -> None:
        while True:
            try:
                removed = _sweep_once()
                if removed:
                    logger.info("result_store: swept %d expired entries", removed)
            except Exception:
                logger.exception("result_store: sweeper iteration failed")
            time.sleep(_SWEEPER_INTERVAL_SECONDS)

    thread = threading.Thread(
        target=_run,
        name="result-store-ttl-sweeper",
        daemon=True,
    )
    thread.start()

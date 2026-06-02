"""Disk-backed (or S3-compatible cloud-backed) temporary store for processed tool outputs.

Each tool run writes its result here first; the client then fetches it via
``GET /api/pdf/result/{result_id}/download``. Entries auto-expire after
``RESULT_TTL_SECONDS`` via a lightweight background sweeper started from
``main.py`` at app boot.

Storage backend selection (checked at first use):
- If ``S3_BUCKET`` + ``S3_ACCESS_KEY_ID`` + ``S3_SECRET_ACCESS_KEY`` env vars are set
  → uses S3-compatible object storage (AWS S3 or Cloudflare R2).
- Otherwise → falls back to local disk (original behaviour, suitable for dev).

Layout on disk (local mode)::

    <root>/
        <uuid>/
            file             # the real payload (streamed to the user)
            meta.json        # filename, mime, size, user_id, created_at
            thumbnail.png    # optional; only when a PDF preview was generated

Layout on S3 (cloud mode)::

    <uuid>/file
    <uuid>/meta.json
    <uuid>/thumbnail.png      # optional

S3 lifecycle rules handle expiry (configure ``S3_RESULT_TTL_HOURS``, default 24 h
on the bucket). The store also generates presigned download URLs so the download
handler can redirect the browser directly to the object.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# ─── TTL / sweep constants ─────────────────────────────────────────────────────
RESULT_TTL_SECONDS = 30 * 60           # 30 min for local; S3 uses lifecycle rules
_SWEEPER_INTERVAL_SECONDS = 5 * 60
_PRESIGN_TTL_SECONDS = int(os.getenv("S3_PRESIGN_TTL_SECONDS", "3600"))  # 1 hour

# ─── Local-disk constants ──────────────────────────────────────────────────────
_DEFAULT_ROOT = (Path(__file__).resolve().parent.parent.parent / "tmp" / "results").resolve()
_META_FILENAME = "meta.json"
_PAYLOAD_FILENAME = "file"
_THUMBNAIL_FILENAME = "thumbnail.png"


# ══════════════════════════════════════════════════════════════════════════════
# S3 backend (boto3)
# ══════════════════════════════════════════════════════════════════════════════

def _s3_env_complete() -> bool:
    return bool(
        os.getenv("S3_BUCKET")
        and os.getenv("S3_ACCESS_KEY_ID")
        and os.getenv("S3_SECRET_ACCESS_KEY")
    )


_s3_client = None
_s3_client_lock = threading.Lock()
_s3_available: Optional[bool] = None


def _get_s3():
    """Return a boto3 S3 client, or None if S3 env vars are not configured."""
    global _s3_client, _s3_available
    if _s3_available is False:
        return None
    if _s3_client is not None:
        return _s3_client

    with _s3_client_lock:
        if _s3_client is not None:
            return _s3_client
        if not _s3_env_complete():
            _s3_available = False
            logger.info("result_store: S3 env vars not set — using local disk storage")
            return None
        try:
            import boto3  # type: ignore
            kwargs: dict = {
                "service_name": "s3",
                "region_name": os.getenv("S3_REGION", "auto"),
                "aws_access_key_id": os.getenv("S3_ACCESS_KEY_ID"),
                "aws_secret_access_key": os.getenv("S3_SECRET_ACCESS_KEY"),
            }
            endpoint = os.getenv("S3_ENDPOINT")
            if endpoint:
                kwargs["endpoint_url"] = endpoint
            _s3_client = boto3.client(**kwargs)
            _s3_available = True
            logger.info(
                "result_store: S3 backend active — bucket=%s endpoint=%s",
                os.getenv("S3_BUCKET"),
                endpoint or "AWS default",
            )
            return _s3_client
        except ImportError:
            _s3_available = False
            logger.warning("result_store: boto3 not installed — falling back to local disk")
            return None
        except Exception:
            _s3_available = False
            logger.exception("result_store: S3 init failed — falling back to local disk")
            return None


def _s3_bucket() -> str:
    return os.getenv("S3_BUCKET", "")


def _s3_put(key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    s3 = _get_s3()
    s3.put_object(
        Bucket=_s3_bucket(),
        Key=key,
        Body=data,
        ContentType=content_type,
    )


def _s3_get(key: str) -> bytes:
    s3 = _get_s3()
    resp = s3.get_object(Bucket=_s3_bucket(), Key=key)
    return resp["Body"].read()


def _s3_exists(key: str) -> bool:
    s3 = _get_s3()
    try:
        s3.head_object(Bucket=_s3_bucket(), Key=key)
        return True
    except Exception:
        return False


def _s3_presign(key: str) -> str:
    s3 = _get_s3()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": _s3_bucket(), "Key": key},
        ExpiresIn=_PRESIGN_TTL_SECONDS,
    )


def _s3_delete_prefix(prefix: str) -> None:
    s3 = _get_s3()
    bucket = _s3_bucket()
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
        if objects:
            s3.delete_objects(Bucket=bucket, Delete={"Objects": objects})


# ══════════════════════════════════════════════════════════════════════════════
# Local-disk helpers
# ══════════════════════════════════════════════════════════════════════════════

def _root_dir() -> Path:
    override = os.getenv("NB_RESULT_STORE_DIR")
    root = Path(override).expanduser().resolve() if override else _DEFAULT_ROOT
    root.mkdir(parents=True, exist_ok=True)
    return root


def _entry_dir(result_id: str) -> Path:
    try:
        parsed = uuid.UUID(result_id)
    except (ValueError, AttributeError, TypeError) as exc:
        raise HTTPException(status_code=404, detail="Result not found.") from exc
    return _root_dir() / parsed.hex


def _read_meta_local(entry: Path) -> dict:
    try:
        return json.loads((entry / _META_FILENAME).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=404, detail="Result not found.") from exc


def _is_expired(meta: dict) -> bool:
    created = float(meta.get("created_at") or 0.0)
    return (time.time() - created) > RESULT_TTL_SECONDS


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


def _validate_result_id(result_id: str) -> str:
    try:
        return uuid.UUID(result_id).hex
    except (ValueError, AttributeError, TypeError) as exc:
        raise HTTPException(status_code=404, detail="Result not found.") from exc


def _read_meta_s3(result_id: str) -> dict:
    try:
        raw = _s3_get(f"{result_id}/{_META_FILENAME}")
        return json.loads(raw)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Result not found.") from exc


# ══════════════════════════════════════════════════════════════════════════════
# Public dataclasses
# ══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class ResultHandle:
    result_id: str
    filename: str
    mime: str
    size_bytes: int
    has_thumbnail: bool
    presigned_url: Optional[str] = None


@dataclass(frozen=True)
class ResultRead:
    # Local mode: payload_path is set; presigned_url is None.
    # S3 mode: presigned_url is set; payload_path is None.
    payload_path: Optional[Path]
    thumbnail_path: Optional[Path]
    filename: str
    mime: str
    size_bytes: int
    presigned_url: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# Core API
# ══════════════════════════════════════════════════════════════════════════════

def save_result(
    payload: bytes,
    filename: str,
    mime: str,
    *,
    user_id: str,
    thumbnail_png: Optional[bytes] = None,
    tool: str = "compress",
) -> ResultHandle:
    """Persist *payload* and return a handle the client can later redeem."""
    result_id = uuid.uuid4().hex
    meta = {
        "result_id": result_id,
        "filename": filename,
        "mime": mime,
        "size_bytes": len(payload),
        "user_id": user_id,
        "created_at": time.time(),
        "has_thumbnail": bool(thumbnail_png),
        "tool": tool,
    }

    s3 = _get_s3()
    if s3:
        _s3_put(f"{result_id}/{_PAYLOAD_FILENAME}", payload, mime)
        _s3_put(f"{result_id}/{_META_FILENAME}", json.dumps(meta).encode(), "application/json")
        if thumbnail_png:
            _s3_put(f"{result_id}/{_THUMBNAIL_FILENAME}", thumbnail_png, "image/png")
        presigned_url = _s3_presign(f"{result_id}/{_PAYLOAD_FILENAME}")
    else:
        entry = _root_dir() / result_id
        entry.mkdir(parents=True, exist_ok=False)
        (entry / _PAYLOAD_FILENAME).write_bytes(payload)
        (entry / _META_FILENAME).write_text(json.dumps(meta), encoding="utf-8")
        if thumbnail_png:
            (entry / _THUMBNAIL_FILENAME).write_bytes(thumbnail_png)
        presigned_url = None

    return ResultHandle(
        result_id=result_id,
        filename=filename,
        mime=mime,
        size_bytes=len(payload),
        has_thumbnail=bool(thumbnail_png),
        presigned_url=presigned_url,
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

    s3 = _get_s3()
    if s3:
        payload = payload_path.read_bytes()
        size_bytes = len(payload)
        meta = {
            "result_id": result_id,
            "filename": filename,
            "mime": mime,
            "size_bytes": size_bytes,
            "user_id": user_id,
            "created_at": time.time(),
            "has_thumbnail": bool(thumbnail_png),
            "tool": tool,
        }
        _s3_put(f"{result_id}/{_PAYLOAD_FILENAME}", payload, mime)
        _s3_put(f"{result_id}/{_META_FILENAME}", json.dumps(meta).encode(), "application/json")
        if thumbnail_png:
            _s3_put(f"{result_id}/{_THUMBNAIL_FILENAME}", thumbnail_png, "image/png")
        presigned_url = _s3_presign(f"{result_id}/{_PAYLOAD_FILENAME}")
    else:
        entry = _root_dir() / result_id
        entry.mkdir(parents=True, exist_ok=False)
        dest = entry / _PAYLOAD_FILENAME
        shutil.copyfile(payload_path, dest)
        size_bytes = dest.stat().st_size
        meta = {
            "result_id": result_id,
            "filename": filename,
            "mime": mime,
            "size_bytes": size_bytes,
            "user_id": user_id,
            "created_at": time.time(),
            "has_thumbnail": bool(thumbnail_png),
            "tool": tool,
        }
        (entry / _META_FILENAME).write_text(json.dumps(meta), encoding="utf-8")
        if thumbnail_png:
            (entry / _THUMBNAIL_FILENAME).write_bytes(thumbnail_png)
        presigned_url = None

    return ResultHandle(
        result_id=result_id,
        filename=filename,
        mime=mime,
        size_bytes=size_bytes,
        has_thumbnail=bool(thumbnail_png),
        presigned_url=presigned_url,
    )


def get_result(result_id: str, user_id: str) -> ResultRead:
    """Return paths + metadata for a result, enforcing ownership + TTL."""
    _validate_result_id(result_id)

    s3 = _get_s3()
    if s3:
        meta = _read_meta_s3(result_id)
        if meta.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail="Result not found.")
        if _is_expired(meta):
            try:
                _s3_delete_prefix(f"{result_id}/")
            except Exception:
                pass
            raise HTTPException(status_code=404, detail="Result not found.")
        presigned_url = _s3_presign(f"{result_id}/{_PAYLOAD_FILENAME}")
        return ResultRead(
            payload_path=None,
            thumbnail_path=None,
            filename=str(meta.get("filename") or "download.bin"),
            mime=str(meta.get("mime") or "application/octet-stream"),
            size_bytes=int(meta.get("size_bytes") or 0),
            presigned_url=presigned_url,
        )
    else:
        entry = _entry_dir(result_id)
        if not entry.is_dir():
            raise HTTPException(status_code=404, detail="Result not found.")
        meta = _read_meta_local(entry)
        if meta.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail="Result not found.")
        if _is_expired(meta):
            _delete_entry(entry)
            raise HTTPException(status_code=404, detail="Result not found.")
        payload_path = entry / _PAYLOAD_FILENAME
        if not payload_path.is_file():
            raise HTTPException(status_code=404, detail="Result not found.")
        thumb_path: Optional[Path] = entry / _THUMBNAIL_FILENAME
        if not thumb_path.is_file():
            thumb_path = None
        return ResultRead(
            payload_path=payload_path,
            thumbnail_path=thumb_path,
            filename=str(meta.get("filename") or "download.bin"),
            mime=str(meta.get("mime") or "application/octet-stream"),
            size_bytes=int(meta.get("size_bytes") or payload_path.stat().st_size),
        )


def read_meta_only(result_id: str) -> dict:
    """Return the parsed meta.json without touching the payload."""
    _validate_result_id(result_id)

    s3 = _get_s3()
    if s3:
        meta = _read_meta_s3(result_id)
        if _is_expired(meta):
            try:
                _s3_delete_prefix(f"{result_id}/")
            except Exception:
                pass
            raise HTTPException(status_code=404, detail="Result not found.")
        return meta
    else:
        entry = _entry_dir(result_id)
        if not entry.is_dir():
            raise HTTPException(status_code=404, detail="Result not found.")
        meta = _read_meta_local(entry)
        if _is_expired(meta):
            _delete_entry(entry)
            raise HTTPException(status_code=404, detail="Result not found.")
        return meta


def delete_result(result_id: str) -> None:
    """Delete an entry by id. Safe to call repeatedly / on missing ids."""
    try:
        _validate_result_id(result_id)
    except HTTPException:
        return

    s3 = _get_s3()
    if s3:
        try:
            _s3_delete_prefix(f"{result_id}/")
        except Exception:
            logger.warning("result_store: S3 delete failed for %s", result_id, exc_info=True)
    else:
        try:
            entry = _entry_dir(result_id)
            _delete_entry(entry)
        except HTTPException:
            pass


# ══════════════════════════════════════════════════════════════════════════════
# Local-disk TTL sweeper (no-op when S3 is active)
# ══════════════════════════════════════════════════════════════════════════════

def _sweep_once() -> int:
    if _get_s3():
        return 0  # S3 lifecycle rules handle expiry
    removed = 0
    root = _root_dir()
    for entry in root.iterdir():
        if not entry.is_dir():
            continue
        meta_file = entry / _META_FILENAME
        if not meta_file.is_file():
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
    """Start the background TTL sweeper thread (idempotent)."""
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

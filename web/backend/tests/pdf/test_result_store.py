"""result_store — dosya kaydetme, okuma, TTL ve sahiplik kontrol testleri."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pytest
from fastapi import HTTPException

_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

os.environ.setdefault("NB_RESULT_STORE_DIR", "")  # conftest'ten önce set edilmeli


@pytest.fixture(autouse=True)
def _isolated_store(tmp_dir: Path, monkeypatch):
    """Her test için ayrı bir sonuç deposu dizini kullan."""
    store_dir = tmp_dir / "result_store"
    store_dir.mkdir()
    monkeypatch.setenv("NB_RESULT_STORE_DIR", str(store_dir))

    # Modülü yeniden import et veya _root_dir önbelleğini temizle
    import importlib
    import web.backend.app.core.result_store as rs  # type: ignore
    importlib.reload(rs)
    yield rs


def test_save_and_get_result(_isolated_store):
    rs = _isolated_store
    payload = b"%PDF-1.4 test content"
    handle = rs.save_result(
        payload,
        filename="test.pdf",
        mime="application/pdf",
        user_id="user-123",
    )
    assert handle.result_id
    assert handle.size_bytes == len(payload)

    read = rs.get_result(handle.result_id, "user-123")
    assert read.payload_path.read_bytes() == payload
    assert read.filename == "test.pdf"


def test_get_result_wrong_user_raises(_isolated_store):
    rs = _isolated_store
    handle = rs.save_result(b"data", "f.pdf", "application/pdf", user_id="user-A")
    with pytest.raises(HTTPException) as exc:
        rs.get_result(handle.result_id, "user-B")
    assert exc.value.status_code == 404


def test_get_result_invalid_id_raises(_isolated_store):
    rs = _isolated_store
    with pytest.raises(HTTPException) as exc:
        rs.get_result("../../etc/passwd", "user-A")
    assert exc.value.status_code == 404


def test_get_result_path_traversal_blocked(_isolated_store):
    rs = _isolated_store
    # Geçerli UUID formatı olmayan her string 404 dönmeli
    for bad_id in ["../../../tmp", "'; DROP TABLE--", "", "0" * 33]:
        with pytest.raises(HTTPException):
            rs.get_result(bad_id, "any-user")


def test_expired_result_returns_404(_isolated_store, monkeypatch):
    rs = _isolated_store
    handle = rs.save_result(b"data", "f.pdf", "application/pdf", user_id="u1")

    # TTL'yi geçmiş gibi göster
    monkeypatch.setattr(rs, "RESULT_TTL_SECONDS", -1)
    with pytest.raises(HTTPException) as exc:
        rs.get_result(handle.result_id, "u1")
    assert exc.value.status_code == 404


def test_delete_result(_isolated_store):
    rs = _isolated_store
    handle = rs.save_result(b"data", "f.pdf", "application/pdf", user_id="u1")
    rs.delete_result(handle.result_id)

    with pytest.raises(HTTPException):
        rs.get_result(handle.result_id, "u1")


def test_save_result_with_thumbnail(_isolated_store):
    rs = _isolated_store
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20  # minimal PNG header
    handle = rs.save_result(
        b"PDF",
        "out.pdf",
        "application/pdf",
        user_id="u1",
        thumbnail_png=png,
    )
    assert handle.has_thumbnail is True
    read = rs.get_result(handle.result_id, "u1")
    assert read.thumbnail_path is not None
    assert read.thumbnail_path.read_bytes() == png

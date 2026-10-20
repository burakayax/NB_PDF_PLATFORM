"""Önizleme kaynağı: R2/S3 depolamada yerel yol yoktur (payload_path=None).

Eskiden `/preview/pdf` ve `/preview/hero` bu durumda `Path(None)` → TypeError ile 500 veriyordu
(Sentry: "argument should be a str or an os.PathLike object ... not 'NoneType'")."""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api import routes
from app.core import result_store


def test_looks_like_pdf_tolerates_missing_path():
    assert routes._result_payload_looks_like_pdf("application/pdf", "a.bin", None) is True
    assert routes._result_payload_looks_like_pdf("application/octet-stream", "a.pdf", None) is True
    assert routes._result_payload_looks_like_pdf("application/octet-stream", "a.bin", None) is False


def test_local_store_uses_existing_path(tmp_path):
    f = tmp_path / "payload.bin"
    f.write_bytes(b"%PDF-1.4")
    read = SimpleNamespace(payload_path=f, filename="a.pdf")

    async def go():
        async with routes._preview_source("rid", read) as p:
            return p

    assert asyncio.run(go()) == f


def test_s3_store_downloads_to_temp_and_cleans_up(monkeypatch):
    monkeypatch.setattr(result_store, "_s3_get", lambda key: b"%PDF-1.4 icerik")
    read = SimpleNamespace(payload_path=None, filename="cikti.pdf")
    seen: dict[str, Path] = {}

    async def go():
        async with routes._preview_source("rid", read) as p:
            seen["p"] = p
            assert p.read_bytes() == b"%PDF-1.4 icerik"
            assert p.suffix == ".pdf"

    asyncio.run(go())
    assert not seen["p"].exists()


def test_s3_fetch_failure_is_404_not_500(monkeypatch):
    def boom(key):
        raise RuntimeError("r2 down")

    monkeypatch.setattr(result_store, "_s3_get", boom)
    read = SimpleNamespace(payload_path=None, filename="cikti.pdf")

    async def go():
        async with routes._preview_source("rid", read):
            pass

    with pytest.raises(HTTPException) as e:
        asyncio.run(go())
    assert e.value.status_code == 404

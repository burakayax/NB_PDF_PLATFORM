"""Çıktı parmak izi (SHA-256) kaydı: sonuç deposu meta'sı + Node'a non-fatal bildirim."""

from __future__ import annotations

import asyncio
import hashlib

from app.core import result_store, saas_gate


def test_save_result_meta_has_sha256(tmp_path, monkeypatch):
    monkeypatch.setattr(result_store, "_get_s3", lambda: None)
    monkeypatch.setattr(result_store, "_root_dir", lambda: tmp_path)
    payload = b"%PDF-1.4 test cikti"
    h = result_store.save_result(payload, "a.pdf", "application/pdf", user_id="u1", tool="compress")
    meta = result_store.read_meta_only(h.result_id)
    assert meta["sha256"] == hashlib.sha256(payload).hexdigest()
    assert meta["size_bytes"] == len(payload)


def test_save_result_from_file_meta_has_sha256(tmp_path, monkeypatch):
    monkeypatch.setattr(result_store, "_get_s3", lambda: None)
    root = tmp_path / "store"
    root.mkdir()
    monkeypatch.setattr(result_store, "_root_dir", lambda: root)
    src = tmp_path / "in.pdf"
    src.write_bytes(b"%PDF-1.7 dosyadan")
    h = result_store.save_result_from_file(src, "b.pdf", "application/pdf", user_id="u1", tool="merge")
    meta = result_store.read_meta_only(h.result_id)
    assert meta["sha256"] == hashlib.sha256(b"%PDF-1.7 dosyadan").hexdigest()


def test_record_output_proof_posts_expected_body(monkeypatch, tmp_path):
    sent: dict = {}

    class _R:
        status_code = 201
        text = "{}"

    async def fake_post(url, *, headers, json_body, attempts=1):
        sent.update(url=url, headers=headers, body=json_body)
        return _R()

    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "s3cr3t")
    monkeypatch.setattr(saas_gate, "_httpx_post_json_with_retry", fake_post)
    f = tmp_path / "x.pdf"
    f.write_bytes(b"abc")
    asyncio.run(saas_gate.record_output_proof("user1", "merge", "job:1", path=f))
    assert sent["url"].endswith("/api/entitlement/internal/output-record")
    assert sent["headers"]["X-Internal-Secret"] == "s3cr3t"
    assert sent["body"]["sha256"] == hashlib.sha256(b"abc").hexdigest()
    assert sent["body"]["sizeBytes"] == 3
    assert sent["body"]["userId"] == "user1"


def test_record_output_proof_is_non_fatal(monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("ağ yok")

    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "s3cr3t")
    monkeypatch.setattr(saas_gate, "_httpx_post_json_with_retry", boom)
    # Hata fırlatmamalı.
    asyncio.run(saas_gate.record_output_proof("user1", "merge", "r1", sha256="a" * 64, size_bytes=1))


def test_record_output_proof_skips_guest_and_editor_ids(monkeypatch):
    called = []

    async def fake_post(*a, **k):
        called.append(1)

    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "s3cr3t")
    monkeypatch.setattr(saas_gate, "_httpx_post_json_with_retry", fake_post)
    asyncio.run(saas_gate.record_output_proof("ed:abc", "edit", "r1", sha256="a" * 64, size_bytes=1))
    asyncio.run(saas_gate.record_output_proof("", "edit", "r1", sha256="a" * 64, size_bytes=1))
    assert called == []

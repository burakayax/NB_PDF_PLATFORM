"""Hizmet sağlık bildirimi: yol maskeleme, 5xx throttle, non-fatal davranış."""

from __future__ import annotations

import asyncio

from app.core import saas_gate, service_health


def test_normalize_path_masks_ids_but_not_tool_names():
    assert service_health.normalize_path("/api/pdf/result/0123456789abcdef0123456789abcdef/download") == "/api/pdf/result/:id/download"
    assert service_health.normalize_path("/api/extract-images-from-pdfs?x=1") == "/api/extract-images-from-pdfs"


def test_report_http_failure_throttles_and_sends_only_path_and_status(monkeypatch):
    sent: list[dict] = []

    class _R:
        status_code = 200
        text = "{}"

    async def fake_post(url, *, headers, json_body, attempts=1):
        sent.append(json_body)
        return _R()

    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "s")
    monkeypatch.setattr(saas_gate, "_httpx_post_json_with_retry", fake_post)
    service_health._last_sent.clear()

    async def go():
        await service_health.report_http_failure("/api/compress", 500)
        await service_health.report_http_failure("/api/compress", 500)  # throttle
        await service_health.report_http_failure("/api/merge", 503)

    asyncio.run(go())
    assert [b["path"] for b in sent] == ["/api/compress", "/api/merge"]
    assert set(sent[0]) == {"kind", "component", "path", "status"}


def test_post_is_non_fatal(monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("ağ yok")

    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "s")
    monkeypatch.setattr(saas_gate, "_httpx_post_json_with_retry", boom)
    service_health._last_sent.clear()
    asyncio.run(service_health.report_http_failure("/api/x", 500))  # hata fırlatmamalı


def test_no_secret_means_no_call(monkeypatch):
    called = []

    async def fake_post(*a, **k):
        called.append(1)

    monkeypatch.delenv("INTERNAL_SERVICE_SECRET", raising=False)
    monkeypatch.setattr(saas_gate, "_httpx_post_json_with_retry", fake_post)
    service_health._last_sent.clear()
    asyncio.run(service_health.report_http_failure("/api/x", 500))
    assert called == []

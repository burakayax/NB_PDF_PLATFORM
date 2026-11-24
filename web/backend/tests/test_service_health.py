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


def test_heartbeat_body_carries_boot_id_and_inflight_paths_only():
    service_health._inflight.clear()
    h = service_health.inflight_start("/api/pdf-to-word/0123456789abcdef0123456789abcdef", 48_000, "tok123")
    try:
        body = service_health._heartbeat_body()
    finally:
        service_health.inflight_end(h)
    assert body["bootId"] == service_health.BOOT_ID
    assert body["inflight"][0]["tool"] == "/api/pdf-to-word/:id"
    assert body["inflight"][0]["sizeKb"] == 48_000
    assert set(body["inflight"][0]) == {"tool", "ageSec", "sizeKb", "token"}
    assert service_health._inflight == {}


def test_report_tool_call_sends_status_duration_size_and_token_only(monkeypatch):
    sent: list[dict] = []

    class _R:
        status_code = 200
        text = "{}"

    async def fake_post(url, *, headers, json_body, attempts=1):
        sent.append(json_body)
        return _R()

    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "s")
    monkeypatch.setattr(saas_gate, "_httpx_post_json_with_retry", fake_post)
    asyncio.run(service_health.report_tool_call("/api/merge", 422, 812.6, 300, "tok"))
    asyncio.run(service_health.report_tool_call("/api/merge", 200, 10, None, None))
    assert sent[0] == {"kind": "tool_call", "component": "pdf", "path": "/api/merge", "status": 422, "durationMs": 812, "sizeKb": 300, "token": "tok"}
    assert "token" not in sent[1] and "sizeKb" not in sent[1]


def test_tool_call_middleware_records_post_tool_requests_but_not_health(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    calls: list[tuple] = []

    async def fake_report(path, status, duration_ms, size_kb, token):
        calls.append((path, status, token))

    monkeypatch.setattr(service_health, "report_tool_call", fake_report)
    client = TestClient(app, raise_server_exceptions=False)
    client.get("/api/health")
    client.post("/api/health/deps")
    r = client.post("/api/this-tool-does-not-exist", headers={"Authorization": "Bearer abc"})
    assert r.status_code in (404, 405)
    assert [c[0] for c in calls] == ["/api/this-tool-does-not-exist"]
    assert calls[0][1] in (404, 405) and calls[0][2] == "abc"

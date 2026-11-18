"""Fatura iç uçları ortak sır olmadan çağrılamaz."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.internal_billing import router


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/internal")
    return TestClient(app)


def test_sir_yoksa_403(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "dogru-sir")
    r = _client().post("/api/internal/invoice", json={"paymentId": "x", "status": "SUCCESS"})
    assert r.status_code == 403


def test_yanlis_sir_403(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "dogru-sir")
    r = _client().post("/api/internal/credit-note", json={}, headers={"X-Internal-Secret": "yanlis"})
    assert r.status_code == 403


def test_dogru_sir_gecer(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_SECRET", "dogru-sir")
    r = _client().post(
        "/api/internal/invoice",
        json={"status": "FAILURE", "paymentId": "x"},
        headers={"X-Internal-Secret": "dogru-sir"},
    )
    assert r.status_code == 200


def test_canlida_sir_tanimsizsa_kapali(monkeypatch):
    monkeypatch.delenv("INTERNAL_SERVICE_SECRET", raising=False)
    monkeypatch.setenv("RENDER", "true")
    r = _client().post("/api/internal/invoice", json={})
    assert r.status_code == 503

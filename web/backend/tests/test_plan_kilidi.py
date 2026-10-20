"""Planda kilitli araç: işlem uçları dosyayı İŞLEMEDEN 403 tool_not_allowed_on_plan döner."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.api.tool_routes_extra as tre
import app.core.saas_gate as gate
from app.limiter import limiter

_app = FastAPI()
_app.state.limiter = limiter
_app.include_router(tre.router)


@_app.exception_handler(gate.PlanLockedError)
async def _h(request, exc):
    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=403, content=gate.plan_locked_payload(exc))


client = TestClient(_app)
_AUTH = {"Authorization": "Bearer test"}
_PDF = b"%PDF-1.4\n%%EOF\n"


class _Yanit:
    def __init__(self, data, status=200):
        self.status_code = status
        self._d = data

    def json(self):
        return self._d


def _motor_karari(monkeypatch, data):
    async def _post(*_a, **_k):
        return _Yanit(data)

    monkeypatch.setattr(gate, "_httpx_post_json_with_retry", _post)


KILITLI = {"allowed": False, "reason": "tool_not_allowed_on_plan", "cost": 0}


@pytest.mark.asyncio
async def test_kilitli_arac_PlanLockedError_firlatir(monkeypatch):
    _motor_karari(monkeypatch, KILITLI)
    with pytest.raises(gate.PlanLockedError) as e:
        await gate.entitlement_check("t", "watermark")
    assert e.value.status_code == 403 and e.value.tool_id == "watermark"


@pytest.mark.asyncio
async def test_indirme_yolu_kararı_ham_alir(monkeypatch):
    _motor_karari(monkeypatch, KILITLI)
    d = await gate.entitlement_check("t", "watermark", reject_plan_locked=False)
    assert d["allowed"] is False


@pytest.mark.asyncio
async def test_baska_ret_nedenleri_firlatmaz(monkeypatch):
    _motor_karari(monkeypatch, {"allowed": False, "reason": "quota_exceeded"})
    d = await gate.entitlement_check("t", "watermark")
    assert d["reason"] == "quota_exceeded"


@pytest.mark.asyncio
async def test_izinli_arac_gecer(monkeypatch):
    _motor_karari(monkeypatch, {"allowed": True, "reason": "ok"})
    assert (await gate.entitlement_check("t", "merge"))["allowed"] is True


@pytest.mark.parametrize(
    "yol,alanlar",
    [
        ("/api/watermark", {"watermark_text": "X"}),
        ("/api/page-numbers", {}),
        ("/api/pdf-to-pdfa", {}),
        ("/api/repair-pdf", {}),
    ],
)
def test_islem_ucu_dosyayi_islemeden_403_verir(monkeypatch, yol, alanlar):
    _motor_karari(monkeypatch, KILITLI)

    async def _kaydetme_cagrilmamali(*_a, **_k):
        raise AssertionError("kilitli araçta dosya işlenmemeli")

    monkeypatch.setattr(tre, "save_upload", _kaydetme_cagrilmamali)
    r = client.post(yol, headers=_AUTH, files={"file": ("a.pdf", _PDF, "application/pdf")}, data=alanlar)
    assert r.status_code == 403, r.text
    j = r.json()
    assert j["error"] == "tool_not_allowed_on_plan"
    assert j["saasGating"]["allowed"] is False


# --- Sonuç / önizleme yolları -------------------------------------------------
import app.api.routes as rt

_app2 = FastAPI()
_app2.state.limiter = limiter
_app2.include_router(rt.router)
_app2.add_exception_handler(gate.PlanLockedError, _h)
client2 = TestClient(_app2)


@pytest.mark.parametrize(
    "yol",
    [
        "/api/pdf/result/abc/preview",
        "/api/pdf/result/abc/preview/thumbnail",
        "/api/pdf/result/abc/preview/hero",
        "/api/pdf/result/abc/preview/pdf",
        "/api/jobs/job1/preview/hero",
        "/api/jobs/job1/preview/pdf",
    ],
)
def test_kilitli_aracin_sonucu_onizlemeden_de_verilmez(monkeypatch, yol):
    _motor_karari(monkeypatch, KILITLI)

    async def _uid(_t):
        return "u1"

    async def _ok(_t):
        return None

    class _R:
        filename = "a.pdf"
        mime = "application/pdf"
        size_bytes = 1
        thumbnail_path = None
        payload_path = "x"
        presigned_url = None

    def _yasak(*_a, **_k):
        raise AssertionError("kilitli araçta sonuç dosyasına dokunulmamalı")

    monkeypatch.setattr(rt, "saas_current_user_id", _uid)
    monkeypatch.setattr(rt, "saas_session_ok", _ok)
    monkeypatch.setattr(rt, "get_result", lambda *_a, **_k: _R())
    monkeypatch.setattr(rt, "read_meta_only", lambda _i: {"tool": "watermark", "user_id": "u1", "mime": "application/pdf", "created_at": 1})
    monkeypatch.setattr(rt, "get_job_download", lambda *_a, **_k: _yasak())
    monkeypatch.setattr(rt, "generate_hero_watermarked_preview_png_queued_from_path", _yasak)
    monkeypatch.setattr(rt, "generate_watermarked_preview_pdf_queued_from_path", _yasak)
    r = client2.get(yol, headers=_AUTH)
    assert r.status_code == 403, r.text
    assert r.json()["error"] == "tool_not_allowed_on_plan"


def test_bozuk_dosyada_onizleme_500_degil_422_verir(monkeypatch):
    _motor_karari(monkeypatch, {"allowed": True, "reason": "ok"})

    async def _uid(_t):
        return "u1"

    async def _ok(_t):
        return None

    class _R:
        filename = "a.pdf"
        mime = "application/pdf"
        size_bytes = 1
        thumbnail_path = None
        payload_path = "x"
        presigned_url = None

    class _Kaynak:
        async def __aenter__(self):
            return "x"

        async def __aexit__(self, *a):
            return False

    async def _patlar(*_a, **_k):
        raise RuntimeError("fitz: cannot open broken document")

    monkeypatch.setattr(rt, "saas_current_user_id", _uid)
    monkeypatch.setattr(rt, "saas_session_ok", _ok)
    monkeypatch.setattr(rt, "get_result", lambda *_a, **_k: _R())
    monkeypatch.setattr(rt, "read_meta_only", lambda _i: {"tool": "rotate-pdf", "user_id": "u1", "mime": "application/pdf", "created_at": 1})
    monkeypatch.setattr(rt, "_preview_source", lambda *_a, **_k: _Kaynak())
    monkeypatch.setattr(rt, "_result_payload_looks_like_pdf", lambda *_a, **_k: True)
    monkeypatch.setattr(rt, "generate_hero_watermarked_preview_png_queued_from_path", _patlar)
    monkeypatch.setattr(rt, "generate_watermarked_preview_pdf_queued_from_path", _patlar)
    for yol in ("/api/pdf/result/abc/preview/hero", "/api/pdf/result/abc/preview/pdf"):
        r = client2.get(yol, headers=_AUTH)
        assert r.status_code == 422, r.text
        assert "okunamadı" in r.json()["detail"]

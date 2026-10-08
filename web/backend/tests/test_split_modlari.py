"""/api/split uç noktasının yeni kipleri: her N sayfa, boyuta göre, yer imine göre."""
import io
import shutil
import types
import zipfile
from pathlib import Path

import fitz
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.api.routes as rt
from app.limiter import limiter

_app = FastAPI()
_app.state.limiter = limiter
_app.include_router(rt.router)
client = TestClient(_app)
_AUTH = {"Authorization": "Bearer test"}


@pytest.fixture()
def yakala(tmp_path, monkeypatch):
    monkeypatch.setenv("PDF_SANDBOX_ENABLED", "false")

    async def _karar(*_a, **_k):
        return {"allowed": True, "reason": "", "cost": 0}

    async def _kullanici(_t):
        return "u1"

    def _kaydet(path, filename, mime, **_k):
        shutil.copyfile(path, tmp_path / "sonuc.zip")
        return types.SimpleNamespace(
            result_id="r1", filename=filename, mime=mime, size_bytes=Path(path).stat().st_size, has_thumbnail=False,
        )

    monkeypatch.setattr(rt, "entitlement_check", _karar)
    monkeypatch.setattr(rt, "saas_current_user_id", _kullanici)
    monkeypatch.setattr(rt, "save_result_from_file", _kaydet)
    return tmp_path / "sonuc.zip"


def _pdf(n: int = 6, toc=None) -> bytes:
    d = fitz.open()
    for i in range(n):
        d.new_page().insert_text((50, 60), f"S{i + 1}")
    if toc:
        d.set_toc(toc)
    return d.tobytes()


def _post(veri, **form):
    return client.post("/api/split", headers=_AUTH, files={"file": ("Rapor.pdf", veri, "application/pdf")}, data=form)


def test_her_n_sayfa(yakala):
    r = _post(_pdf(7), mode="every", every_n="3")
    assert r.status_code == 200, r.text
    z = zipfile.ZipFile(yakala)
    assert sorted(z.namelist()) == ["Rapor_1-3.pdf", "Rapor_4-6.pdf", "Rapor_7-7.pdf"]
    assert fitz.open(stream=z.read("Rapor_4-6.pdf"), filetype="pdf").page_count == 3


def test_yer_imine_gore(yakala):
    toc = [[1, "Giriş", 1], [1, "Bölüm", 3], [1, "Sonuç", 5]]
    r = _post(_pdf(6, toc), mode="outline")
    assert r.status_code == 200, r.text
    assert sorted(zipfile.ZipFile(yakala).namelist()) == ["01 Giriş.pdf", "02 Bölüm.pdf", "03 Sonuç.pdf"]


def test_boyuta_gore(yakala):
    d = fitz.open()
    from PIL import Image

    for _ in range(4):
        pg = d.new_page()
        im = Image.effect_noise((900, 650), 60).convert("RGB")
        b = io.BytesIO()
        im.save(b, "JPEG", quality=90)
        pg.insert_image(fitz.Rect(50, 100, 545, 450), stream=b.getvalue())
    r = _post(d.tobytes(), mode="size", max_mb="0.5")
    assert r.status_code == 200, r.text
    z = zipfile.ZipFile(yakala)
    assert len(z.namelist()) >= 2
    assert all(i.file_size <= 0.5 * 1024 * 1024 for i in z.infolist())


def test_eski_kip_hala_sayfa_ister(yakala):
    r = _post(_pdf(3), mode="single", pages_text="")
    assert r.status_code >= 400  # "Lütfen sayfa numarası girin."


def test_yer_imi_yoksa_anlasilir_hata(yakala):
    r = _post(_pdf(3), mode="outline")
    assert r.status_code >= 400
    assert "yer imi" in r.text


def test_sinir_asan_sayfa_zip_icinde_bildirilir(yakala):
    from PIL import Image

    d = fitz.open()
    im = Image.effect_noise((1400, 1000), 70).convert("RGB")
    b = io.BytesIO()
    im.save(b, "JPEG", quality=95)
    d.new_page().insert_image(fitz.Rect(20, 20, 575, 800), stream=b.getvalue())
    d.new_page().insert_text((50, 60), "kucuk")
    d.new_page().insert_text((50, 60), "kucuk2")
    r = _post(d.tobytes(), mode="size", max_mb="0.05")
    assert r.status_code == 200, r.text
    z = zipfile.ZipFile(yakala)
    uyari = [n for n in z.namelist() if n.startswith("UYARI")]
    assert uyari and "Sayfa 1" in z.read(uyari[0]).decode("utf-8")

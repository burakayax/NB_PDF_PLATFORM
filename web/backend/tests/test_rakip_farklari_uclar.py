"""Sunucu uçları: yeni seçeneklerin form alanlarıyla gerçekten motora ulaştığını doğrular.

Kimlik/kota/sonuç deposu taklit edilir; çıktı PDF'i yakalanıp içeriği kontrol edilir.
(Motorun kendisi tests/pdf/test_rakip_farklari.py'de ayrıca test edilir.)
"""
import io
import shutil
from pathlib import Path

import fitz
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

import app.api.tool_routes_extra as tre
from app.limiter import limiter

_app = FastAPI()
_app.state.limiter = limiter
_app.include_router(tre.router)
client = TestClient(_app)
_AUTH = {"Authorization": "Bearer test"}


@pytest.fixture()
def yakala(tmp_path, monkeypatch):
    """Dış bağımlılıkları taklit eder; üretilen PDF'i tmp_path/yakalanan.pdf'e kopyalar."""
    monkeypatch.setenv("PDF_SANDBOX_ENABLED", "false")

    async def _karar(*_a, **_k):
        return {"allowed": True, "reason": "", "cost": 0}

    async def _kullanici(_t):
        return "u1"

    def _paketle(out_p: Path, out_filename: str, user_id: str, tool: str):
        shutil.copyfile(out_p, tmp_path / "yakalanan.pdf")
        return {"result_id": "x", "filename": out_filename}

    monkeypatch.setattr(tre, "entitlement_check", _karar)
    monkeypatch.setattr(tre, "saas_current_user_id", _kullanici)
    monkeypatch.setattr(tre, "_pack_pdf_result_file", _paketle)
    monkeypatch.setattr(tre, "_after_save_validate", lambda *a, **k: None)
    return tmp_path / "yakalanan.pdf"


def _pdf_bayt(sayfa: int = 4) -> bytes:
    d = fitz.open()
    for i in range(sayfa):
        p = d.new_page()
        p.insert_text((50, 60), f"Belge icerik {i + 1}", fontsize=14)
    return d.tobytes()


def _metinler(yol: Path) -> list[str]:
    return [p.get_text().replace("\xa0", " ") for p in fitz.open(str(yol))]


def test_sayfa_numarasi_alanlari_motora_ulasir(yakala):
    r = client.post(
        "/api/page-numbers",
        headers=_AUTH,
        files={"file": ("a.pdf", _pdf_bayt(), "application/pdf")},
        data={
            "start_at": "5", "position": "footer-right", "fmt": "page-of",
            "font_size": "12", "color": "#CC0000", "from_page": "2", "to_page": "3",
        },
    )
    assert r.status_code == 200, r.text
    m = _metinler(yakala)
    assert "Sayfa 5 / 4" in m[1] and "Sayfa 6 / 4" in m[2]
    assert "Sayfa" not in m[0] and "Sayfa" not in m[3]


def test_sayfa_numarasi_gecersiz_konum_varsayilana_duser(yakala):
    r = client.post(
        "/api/page-numbers", headers=_AUTH,
        files={"file": ("a.pdf", _pdf_bayt(2), "application/pdf")},
        data={"position": "orta-ust-sol", "fmt": "yok"},
    )
    assert r.status_code == 200, r.text
    assert "1" in _metinler(yakala)[0]


def test_filigran_metin_secenekleri(yakala):
    r = client.post(
        "/api/watermark", headers=_AUTH,
        files={"file": ("a.pdf", _pdf_bayt(), "application/pdf")},
        data={
            "watermark_text": "GİZLİ Çığ", "watermark_opacity": "1.0", "watermark_rotation": "0",
            "watermark_size": "50", "from_page": "2", "to_page": "3",
        },
    )
    assert r.status_code == 200, r.text
    m = _metinler(yakala)
    assert "Çığ" in m[1] and "Çığ" in m[2] and "Çığ" not in m[0] and "Çığ" not in m[3]


def test_filigran_gorsel(yakala):
    logo = Image.new("RGBA", (200, 100), (200, 0, 0, 255))
    b = io.BytesIO()
    logo.save(b, "PNG")
    r = client.post(
        "/api/watermark", headers=_AUTH,
        files={
            "file": ("a.pdf", _pdf_bayt(), "application/pdf"),
            "watermark_image": ("logo.png", b.getvalue(), "image/png"),
        },
        data={
            "watermark_position": "bottom-right", "watermark_size": "30", "watermark_opacity": "1",
            "from_page": "1", "to_page": "1",
        },
    )
    assert r.status_code == 200, r.text
    d = fitz.open(str(yakala))
    kutu = fitz.Rect(d[0].rect.x1 - 200, d[0].rect.y1 - 120, d[0].rect.x1, d[0].rect.y1)
    pix = d[0].get_pixmap(dpi=36, clip=kutu)
    kirmizi = sum(1 for i in range(0, len(pix.samples) - 2, pix.n) if pix.samples[i] > 200 and pix.samples[i + 1] < 200)
    assert kirmizi > 0


def test_filigran_metin_ve_gorsel_yoksa_anlasilir_hata(yakala):
    r = client.post(
        "/api/watermark", headers=_AUTH,
        files={"file": ("a.pdf", _pdf_bayt(2), "application/pdf")},
        data={"watermark_text": "   "},
    )
    assert r.status_code == 400
    assert "metni" in r.text


def test_ust_alt_bilgi_ve_numara_birlikte(yakala):
    import json

    r = client.post(
        "/api/page-numbers", headers=_AUTH,
        files={"file": ("Rapor Dosyası.pdf", _pdf_bayt(), "application/pdf")},
        data={
            "fmt": "page", "position": "footer-center",
            "header_footer_json": json.dumps({"header-right": "{dosya} Çğş"}),
        },
    )
    assert r.status_code == 200, r.text
    m = _metinler(yakala)
    assert "Rapor Dosyası Çğş" in m[0]
    assert "Sayfa 1" in m[0] and "Sayfa 4" in m[3]


def test_yalniz_ust_alt_bilgi_numarasiz(yakala):
    import json

    r = client.post(
        "/api/page-numbers", headers=_AUTH,
        files={"file": ("a.pdf", _pdf_bayt(2), "application/pdf")},
        data={"fmt": "none", "header_footer_json": json.dumps({"footer-left": "Taslak"})},
    )
    assert r.status_code == 200, r.text
    m = _metinler(yakala)
    assert "Taslak" in m[0] and "Sayfa" not in m[0]


def test_numarasiz_ve_metinsiz_hata(yakala):
    r = client.post(
        "/api/page-numbers", headers=_AUTH,
        files={"file": ("a.pdf", _pdf_bayt(2), "application/pdf")},
        data={"fmt": "none"},
    )
    assert r.status_code == 400


def test_kirp_ucu_otomatik_ve_elle(yakala):
    r = client.post(
        "/api/crop-pdf", headers=_AUTH,
        files={"file": ("a.pdf", _pdf_bayt(2), "application/pdf")},
        data={"crop_mode": "auto", "pad_mm": "5", "uniform": "1"},
    )
    assert r.status_code == 200, r.text
    assert fitz.open(str(yakala))[0].rect.height < 100

    r = client.post(
        "/api/crop-pdf", headers=_AUTH,
        files={"file": ("a.pdf", _pdf_bayt(2), "application/pdf")},
        data={"crop_mode": "margins", "top_mm": "20", "from_page": "2", "to_page": "2"},
    )
    assert r.status_code == 200, r.text
    d = fitz.open(str(yakala))
    assert round(d[0].rect.height) == 842 and round(d[1].rect.height) < 842


def test_kirp_ucu_degersiz_istek_anlasilir_hata(yakala):
    r = client.post(
        "/api/crop-pdf", headers=_AUTH,
        files={"file": ("a.pdf", _pdf_bayt(2), "application/pdf")},
        data={"crop_mode": "margins"},
    )
    assert r.status_code >= 400
    assert "kenar" in r.text


def _renkli_bayt() -> bytes:
    d = fitz.open()
    pg = d.new_page()
    pg.insert_text((60, 80), "Renkli", fontsize=22, color=(1, 0, 0))
    pg.draw_rect(fitz.Rect(60, 120, 300, 220), fill=(0, 0.8, 0.2))
    return d.tobytes()


def test_gri_tonlama_ucu(yakala):
    r = client.post("/api/grayscale-pdf", headers=_AUTH, files={"file": ("a.pdf", _renkli_bayt(), "application/pdf")})
    assert r.status_code == 200, r.text
    px = fitz.open(str(yakala))[0].get_pixmap(dpi=40)
    assert all(abs(px.samples[i] - px.samples[i + 1]) <= 2 for i in range(0, len(px.samples) - 2, px.n))


def test_boyutlandirma_ucu(yakala):
    r = client.post(
        "/api/resize-pdf", headers=_AUTH, files={"file": ("a.pdf", _pdf_bayt(2), "application/pdf")},
        data={"page_size": "a5", "fit": "fit", "orientation": "portrait", "margin_mm": "5"},
    )
    assert r.status_code == 200, r.text
    rc = fitz.open(str(yakala))[0].rect
    assert (round(rc.width), round(rc.height)) == (420, 595)


def test_ayna_ucu(yakala):
    r = client.post(
        "/api/flip-pdf", headers=_AUTH, files={"file": ("a.pdf", _pdf_bayt(3), "application/pdf")},
        data={"direction": "vertical", "from_page": "2", "to_page": "2"},
    )
    assert r.status_code == 200, r.text
    assert fitz.open(str(yakala)).page_count == 3


def test_donusumlu_birlestirme_ucu(yakala):
    r = client.post(
        "/api/alternate-mix-pdf", headers=_AUTH,
        files=[("files", ("a.pdf", _pdf_bayt(2), "application/pdf")), ("files", ("b.pdf", _pdf_bayt(2), "application/pdf"))],
        data={"reverse_second": "1"},
    )
    assert r.status_code == 200, r.text
    m = _metinler(yakala)
    assert [t.strip() for t in m] == ["Belge icerik 1", "Belge icerik 2", "Belge icerik 2", "Belge icerik 1"]


def test_donusumlu_birlestirme_tek_dosya_hata(yakala):
    r = client.post(
        "/api/alternate-mix-pdf", headers=_AUTH,
        files=[("files", ("a.pdf", _pdf_bayt(2), "application/pdf"))],
    )
    assert r.status_code == 400
    assert "en az iki" in r.text


def test_egri_tarama_ucu(yakala):
    d = fitz.open()
    pg = d.new_page()
    for k in range(40):
        pg.insert_text((50, 60 + k * 17), "Bu satir egri tarama testi icin yazilmistir " * 2, fontsize=10)
    px = pg.get_pixmap(dpi=150, colorspace=fitz.csGRAY)
    from PIL import Image

    im = Image.frombytes("L", (px.w, px.h), px.samples).rotate(3.0, resample=Image.BICUBIC, fillcolor=255)
    import io as _io

    b = _io.BytesIO()
    im.save(b, "JPEG", quality=85)
    t = fitz.open()
    t.new_page(width=595, height=842).insert_image(fitz.Rect(0, 0, 595, 842), stream=b.getvalue())
    r = client.post("/api/deskew-pdf", headers=_AUTH, files={"file": ("a.pdf", t.tobytes(), "application/pdf")})
    assert r.status_code == 200, r.text
    assert fitz.open(str(yakala)).page_count == 1


def test_egri_tarama_dijital_pdf_anlasilir_hata(yakala):
    r = client.post("/api/deskew-pdf", headers=_AUTH, files={"file": ("a.pdf", _pdf_bayt(2), "application/pdf")})
    assert r.status_code >= 400
    assert "taranmış" in r.text

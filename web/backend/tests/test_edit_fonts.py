"""PDF Düzenle — birebir çıktı kuralları (edit_fonts + edit-text/pdf-analyze)."""
import io
import json

import fitz
import pytest
from fastapi.testclient import TestClient

from fastapi import FastAPI

from app.api.tool_routes_extra import router as _extra_router
from app.core import edit_fonts as ef
from app.limiter import limiter

# Yalnız ilgili router (app.main'in tamamı .env yükleyip diğer testlerin ortamını değiştirir).
_app = FastAPI()
_app.state.limiter = limiter
_app.include_router(_extra_router)
client = TestClient(_app)


def _spans(page):
    return [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]]


@pytest.mark.parametrize(
    "name,key",
    [
        ("ABCDEF+Calibri", "carlito"), ("Calibri-Bold", "carlito"), ("Cambria-Bold", "caladea"),
        ("ArialMT", "lsans"), ("Helvetica-Oblique", "lsans"), ("TimesNewRomanPSMT", "lserif"),
        ("Times-Roman", "lserif"), ("CourierNewPSMT", "lmono"), ("Georgia-Italic", "gelasio"),
        # Ölçüsü farklı kesitler EŞLEŞMEMELİ
        ("HelveticaNeueLTStd-Roman", None), ("ArialNarrow", None), ("Arial-Black", None),
        ("CambriaMath", None), ("Roboto", None), ("Verdana", None),
    ],
)
def test_metric_family_mapping(name, key):
    assert ef.metric_family_for(name) == key


def test_all_family_files_exist():
    import os

    for k in ef.METRIC_FAMILIES:
        for b in (False, True):
            for i in (False, True):
                assert os.path.exists(ef.family_path(k, b, i))


def test_liberation_matches_pdf_standard_helvetica_widths():
    ref, sub = fitz.Font("helv"), fitz.Font(fontfile=ef.family_path("lsans"))
    for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789":
        assert abs(ref.text_length(ch, 1) - sub.text_length(ch, 1)) < 0.001


def _reportlab_pdf() -> bytes:
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    t = c.beginText(72, 760)
    t.setFont("Helvetica", 12)
    t.textLine("Plain Helvetica line here")
    t.setCharSpace(1.5)
    t.textLine("Char spaced line here")
    t.setCharSpace(0)
    t.setWordSpace(6)
    t.textLine("Word spaced line goes here")
    t.setWordSpace(0)
    t.setHorizScale(70)
    t.textLine("Horizontally condensed text")
    t.setHorizScale(100)
    t.setFont("Times-Bold", 14)
    t.textLine("Times Bold Title")
    c.drawText(t)
    c.save()
    return buf.getvalue()


def test_analyze_reports_family_spacing_and_scale():
    r = client.post("/api/pdf-analyze", files={"file": ("a.pdf", _reportlab_pdf(), "application/pdf")})
    assert r.status_code == 200
    els = {e["text"].strip(): e for e in r.json()["pages"][0]["elements"] if e["type"] == "text"}
    assert els["Plain Helvetica line here"]["font"] == "lsans"
    assert "cs" not in els["Plain Helvetica line here"] and "hs" not in els["Plain Helvetica line here"]
    assert els["Char spaced line here"]["cs"] == pytest.approx(1.5, abs=0.05)
    assert els["Word spaced line goes here"]["ws"] == pytest.approx(6.0, abs=0.1)
    cond = els["Horizontally condensed text"]
    assert cond["hs"] == pytest.approx(0.7, abs=0.02)
    assert cond["size"] == pytest.approx(12.0, abs=0.1)  # gerçek boyut (MuPDF'in √ ölçüsü değil)
    assert els["Times Bold Title"]["font"] == "lserif" and els["Times Bold Title"]["bold"] is True


def _tight_pdf() -> bytes:
    d = fitz.open()
    p = d.new_page()
    for i, t in enumerate(["Birinci satir gjpqy", "Ikinci satir OOOO", "Ucuncu satir sonu"]):
        p.insert_text((72, 100 + i * 9.0), t, fontname="helv", fontsize=11)  # 0.82 em aralık
    p.draw_rect(fitz.Rect(70, 100, 200, 112), color=(0, 0, 1), width=0.5)
    return d.tobytes()


def test_vector_text_edit_keeps_neighbor_lines_and_graphics():
    src = fitz.open("pdf", _tight_pdf())
    mid = _spans(src[0])[1]
    op = {
        "page": 0, "bbox": [round(v, 1) for v in mid["bbox"]], "text": "Yeni ikinci", "size": 11,
        "font": "lsans", "by": round(mid["origin"][1], 1), "vt": True, "osz": 11,
    }
    r = client.post("/api/edit-text", files={"file": ("a.pdf", _tight_pdf(), "application/pdf")},
                    data={"edits": json.dumps([op])})
    assert r.status_code == 200
    out = fitz.open("pdf", r.content)[0]
    texts = [s["text"] for s in _spans(out)]
    assert any("Birinci" in t for t in texts) and any("Ucuncu" in t for t in texts)
    assert not any("Ikinci" in t for t in texts) and any("Yeni ikinci" in t for t in texts)
    assert len(out.get_drawings()) == 1  # çerçeve korunur, beyaz kutu eklenmez


def test_metric_family_uses_real_bold_face_and_fallback_glyph():
    d = fitz.open()
    d.new_page()
    op = {"page": 0, "bbox": [72, 90, 300, 104], "text": "Kalın 12.500 ₺", "size": 12, "font": "carlito",
          "bold": True, "by": 100}
    r = client.post("/api/edit-text", files={"file": ("a.pdf", d.tobytes(), "application/pdf")},
                    data={"edits": json.dumps([op])})
    assert r.status_code == 200
    fonts = {s["font"] for s in _spans(fitz.open("pdf", r.content)[0])}
    assert "Carlito Bold" in fonts  # sahte (çift basım) değil, gerçek kalın kesit
    assert any(f.startswith("Roboto") for f in fonts)  # ₺ sınıf yedeğinden


def test_rich_html_missing_glyph_goes_to_class_fallback():
    html = "<div style=\"font-family:'Carlito';font-size:14px\">Tutar &amp; 12.500 ₺</div>"
    out = ef.wrap_missing_glyphs(html)
    assert "font-family:'Roboto'\">₺</span>" in out and "&amp;" in out


def _subset_font_pdf() -> bytes:
    """Gömülü ALT KÜME TrueType font içeren belge (Word çıktısı gibi): yalnız kullanılan harfler dolu."""
    d = fitz.open()
    p = d.new_page()
    path = ef.family_path("carlito")
    p.insert_font(fontname="W", fontfile=path)
    p.insert_text((72, 100), "Blind users table", fontname="W", fontsize=11)
    d.subset_fonts()
    return d.tobytes()


def test_original_font_reused_only_for_verified_chars():
    pdf = _subset_font_pdf()
    a = client.post("/api/pdf-analyze", files={"file": ("a.pdf", pdf, "application/pdf")}).json()
    el = next(e for e in a["pages"][0]["elements"] if e["type"] == "text")
    assert el.get("ofont") and el["ofont"] in a["fonts"]
    chars = a["fonts"][el["ofont"]]["chars"]
    assert set("Blindusertab ") <= set(chars) and "ş" not in chars and "Z" not in chars
    base = {"page": 0, "bbox": el["bbox"], "size": el["size"], "font": el["font"], "by": el["by"],
            "vt": True, "osz": el["size"], "ofont": el["ofont"]}
    ops = [dict(base, text="Blind table")]  # yalnız belgedeki harfler → orijinal font
    r = client.post("/api/edit-text", files={"file": ("a.pdf", pdf, "application/pdf")}, data={"edits": json.dumps(ops)})
    orig_font = next(s["font"] for s in _spans(fitz.open("pdf", pdf)[0]))
    fonts = {s["font"] for s in _spans(fitz.open("pdf", r.content)[0]) if "Blind" in s["text"]}
    assert fonts and all(f.split(" ")[0].split("-")[0] == orig_font.split("-")[0] or f.startswith("Carlito") for f in fonts)
    # yeni harf (Z, ş) → orijinal font KULLANILMAZ (boş glif riski), ölçü-uyumlu aile
    ops = [dict(base, text="Zeynep Şişli")]
    r = client.post("/api/edit-text", files={"file": ("a.pdf", pdf, "application/pdf")}, data={"edits": json.dumps(ops)})
    out = [s for s in _spans(fitz.open("pdf", r.content)[0]) if "Zeynep" in s["text"]]
    assert out and out[0]["font"] == "Carlito Regular"


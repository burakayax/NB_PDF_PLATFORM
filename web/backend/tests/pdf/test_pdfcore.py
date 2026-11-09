"""pdfcore (PyMuPDF'siz çekirdek) birim testleri — gerçek PDF üretip PDFium ile görüntüleyerek doğrular."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pikepdf
import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.pdfcore import (  # noqa: E402
    PdfPasswordRequired,
    PdfPasswordWrong,
    PdfiumReader,
    overlay as ov,
    pages as pg,
)

ASSETS = Path(__file__).resolve().parents[2] / "app" / "assets"


def _make_pdf(path: Path, n: int = 3, size=A4, text_prefix: str = "Sayfa") -> Path:
    c = canvas.Canvas(str(path), pagesize=size)
    for i in range(n):
        c.setFont("Helvetica", 18)
        c.drawString(72, size[1] - 100, f"{text_prefix} {i + 1}")
        c.showPage()
    c.save()
    return path


def _encrypt(src: Path, dst: Path, user: str = "abc") -> Path:
    with pikepdf.open(src) as p:
        p.save(dst, encryption=pikepdf.Encryption(user=user, owner="own", R=6))
    return dst


# ── açma / parola ────────────────────────────────────────────────────────
def test_page_count_and_password(tmp_path):
    src = _make_pdf(tmp_path / "a.pdf", 4)
    enc = _encrypt(src, tmp_path / "e.pdf")
    assert pg.page_count(src) == 4
    assert pg.needs_password(enc) is True and pg.needs_password(src) is False
    with pytest.raises(PdfPasswordRequired, match="parola gerekli"):
        pg.open_pdf(enc)
    with pytest.raises(PdfPasswordWrong, match="parolası hatalı"):
        pg.open_pdf(enc, "zzz")
    assert pg.page_count(enc, "abc") == 4
    with pytest.raises(PdfPasswordRequired):
        PdfiumReader(enc)
    with pytest.raises(PdfPasswordWrong):
        PdfiumReader(enc, "zzz")
    with PdfiumReader(enc, "abc") as r:
        assert r.page_count == 4


# ── görüntüleme ──────────────────────────────────────────────────────────
def test_render_size_text_images(tmp_path):
    src = _make_pdf(tmp_path / "a.pdf", 2)
    with PdfiumReader(src) as r:
        assert r.page_size(0) == pytest.approx((595.0, 842.0), abs=1)
        im = r.render(0, dpi=144)
        assert im.mode == "RGB" and im.size in ((1190, 1684), (1191, 1684))
        g = r.render(0, scale=1, grayscale=True)
        assert g.mode == "L"
        assert "Sayfa 1" in r.text(0) and "\r" not in r.text(0)
        assert r.text_len(1) == len("Sayfa2")
        assert r.has_images(0) is False and r.image_count(0) == 0
        crop = r.render(0, scale=2, crop=(0, 0, 100, 50))
        assert crop.size == (200, 100)


def test_render_crop_is_top_left_origin(tmp_path):
    """crop penceresi ÜST-SOL başlangıçlı: sayfanın üst-sol köşesine çizilen kırmızı kutu görünmeli."""
    p = tmp_path / "r.pdf"
    c = canvas.Canvas(str(p), pagesize=(200, 300))
    c.setFillColorRGB(1, 0, 0)
    c.rect(0, 300 - 40, 40, 40, fill=1, stroke=0)
    c.showPage()
    c.save()
    with PdfiumReader(p) as r:
        top_left = np.asarray(r.render(0, scale=1, crop=(0, 0, 40, 40)))
        bottom_right = np.asarray(r.render(0, scale=1, crop=(160, 260, 200, 300)))
    assert top_left[..., 0].mean() > 240 and top_left[..., 1].mean() < 15
    assert bottom_right.mean() > 250


# ── sayfa işlemleri ──────────────────────────────────────────────────────
def test_select_reorder_and_merge(tmp_path):
    a = _make_pdf(tmp_path / "a.pdf", 4, text_prefix="A")
    b = _make_pdf(tmp_path / "b.pdf", 2, text_prefix="B")
    out = tmp_path / "o.pdf"
    assert pg.select_pages(a, out, [3, 0, 1]) == 3
    with PdfiumReader(out) as r:
        assert [r.text(i).strip() for i in range(3)] == ["A 4", "A 1", "A 2"]
    m = tmp_path / "m.pdf"
    assert pg.merge_pdfs_pikepdf([str(a), str(b)], m) == 6
    with PdfiumReader(m) as r:
        assert r.page_count == 6 and r.text(5).strip() == "B 2"


def test_outline_roundtrip_and_transfer(tmp_path):
    src = _make_pdf(tmp_path / "a.pdf", 5)
    with pikepdf.open(src) as p:
        pg.set_toc(p, [[1, "Giriş", 1], [2, "Alt", 2], [1, "Bölüm", 4], [3, "Derin", 5]])
        p.save(tmp_path / "t.pdf")
    with pikepdf.open(tmp_path / "t.pdf") as p:
        toc = pg.get_toc(p)
        assert toc == [(1, "Giriş", 1), (2, "Alt", 2), (1, "Bölüm", 4), (2, "Derin", 5)]
        out = pg.new_pdf()
        pg.append_pages(out, p, [3, 4])
        pg.transfer_outline(p, out, [3, 4])
        assert pg.get_toc(out) == [(1, "Bölüm", 1), (2, "Derin", 2)]
        out.close()


def test_rotate_and_visual_size(tmp_path):
    src = _make_pdf(tmp_path / "a.pdf", 1)
    with pikepdf.open(src) as p:
        page = p.pages[0]
        assert pg.page_visual_size(page) == pytest.approx((595.28, 841.89), abs=0.1)
        pg.rotate_page(page, 90)
        assert pg.page_rotation(page) == 90
        w, h = pg.page_visual_size(page)
        assert w > h
        pg.rotate_page(page, 270)
        assert pg.page_rotation(page) == 0


# ── bindirme: her döndürmede doğru yere ──────────────────────────────────
@pytest.mark.parametrize("rot", [0, 90, 180, 270])
def test_stamp_lands_top_left_for_every_rotation(tmp_path, rot):
    """Görünen sayfanın ÜST-SOL köşesine çizilen kırmızı kutu, döndürülmüş sayfada da orada görünmeli."""
    src = _make_pdf(tmp_path / "a.pdf", 1)
    with pikepdf.open(src) as p:
        p.pages[0].obj["/Rotate"] = rot
        p.pages[0].obj["/CropBox"] = [10, 20, 585, 822]  # ofsetli CropBox da denensin

        def draw(cv):
            cv.rect((0, 0, 50, 30), fill=(1, 0, 0))

        ov.stamp_pages(p, {0: draw})
        p.save(tmp_path / "s.pdf")
    with PdfiumReader(tmp_path / "s.pdf") as r:
        im = np.asarray(r.render(0, scale=1))
        red = (im[..., 0] > 200) & (im[..., 1] < 60) & (im[..., 2] < 60)
        ys, xs = np.where(red)
        assert len(xs) > 1000
        assert xs.min() <= 1 and ys.min() <= 1
        assert 48 <= xs.max() <= 52 and 28 <= ys.max() <= 32


def test_stamp_text_turkish_and_link(tmp_path):
    src = _make_pdf(tmp_path / "a.pdf", 2)
    ttf = ASSETS / "Roboto-Regular.ttf"
    assert ttf.is_file()

    def draw(cv):
        tw = cv.textbox_line((36, 800, 559, 836), "ĞÜŞİÖÇ ığüşöç 12", font=str(ttf), size=12, align="center")
        assert tw > 50
        cv.link((100, 100, 200, 120), "https://pdfplatform.app")

    with pikepdf.open(src) as p:
        ov.stamp_pages(p, {0: draw, 1: draw})
        p.save(tmp_path / "s.pdf")
    with PdfiumReader(tmp_path / "s.pdf") as r:
        assert "ĞÜŞİÖÇ ığüşöç 12" in r.text(0)
    with pikepdf.open(tmp_path / "s.pdf") as p:
        annots = p.pages[0].obj["/Annots"]
        assert str(annots[0].A.URI) == "https://pdfplatform.app"
        rect = [float(v) for v in annots[0].Rect]
        assert rect[0] == pytest.approx(100, abs=0.5)
        assert rect[1] == pytest.approx(841.89 - 120, abs=1.0)


def test_text_metrics():
    assert ov.text_width("Sayfa 12", "helv", 10) == pytest.approx(37.8, abs=2.0)
    assert ov.font_ascender("helv") == pytest.approx(1.075)


# ── sayfa yerleştirme (show_pdf_page karşılığı) ──────────────────────────
@pytest.mark.parametrize("rot", [0, 90, 180, 270])
@pytest.mark.parametrize("crop", [None, [20, 20, 180, 280]])
def test_place_page_matches_direct_render(tmp_path, rot, crop):
    """Kaynak sayfayı AYNI ölçüde yeni sayfaya yerleştirince, kaynağın kendi görüntüsüyle aynı çıkmalı."""
    src_path = tmp_path / "s.pdf"
    c = canvas.Canvas(str(src_path), pagesize=(200, 300))
    c.setFillColorRGB(1, 0, 0); c.rect(0, 260, 40, 40, fill=1, stroke=0)
    c.setFillColorRGB(0, 0, 1); c.rect(160, 0, 40, 40, fill=1, stroke=0)
    c.setFillColorRGB(0, 0.6, 0); c.rect(20, 20, 30, 30, fill=1, stroke=0)
    c.showPage(); c.save()
    with pikepdf.open(src_path, allow_overwriting_input=True) as p:
        p.pages[0].obj["/Rotate"] = rot
        if crop:
            p.pages[0].obj["/CropBox"] = crop
        p.save(src_path)
    with pikepdf.open(src_path) as src:
        w, h = pg.page_visual_size(src.pages[0])
        out = pg.new_pdf()
        out.add_blank_page(page_size=(w, h))
        pg.place_page(out, out.pages[0], src, 0, (0, 0, w, h))
        out.save(tmp_path / "o.pdf")
        out.close()
    with PdfiumReader(src_path) as a, PdfiumReader(tmp_path / "o.pdf") as b:
        ia = np.asarray(a.render(0, scale=2)).astype(int)
        ib = np.asarray(b.render(0, scale=2)).astype(int)
    assert ia.shape == ib.shape
    assert np.abs(ia - ib).mean() < 1.0

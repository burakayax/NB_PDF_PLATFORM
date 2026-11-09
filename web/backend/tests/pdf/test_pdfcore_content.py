"""pdfcore.content — içerik akışı yorumlayıcısı: harf konumu, silme (komşular yerinde kalır), form kopyası."""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pikepdf
import pytest
from reportlab.pdfgen import canvas

_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.pdfcore import PdfiumReader, content as C, pages as pc  # noqa: E402


def _pdf(draw) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(400, 300), pageCompression=0)
    draw(c)
    c.save()
    return buf.getvalue()


def _open(data: bytes) -> pikepdf.Pdf:
    return pikepdf.open(io.BytesIO(data))


def _save(pdf: pikepdf.Pdf) -> bytes:
    b = io.BytesIO()
    pdf.save(b)
    return b.getvalue()


def _simple() -> bytes:
    def d(c):
        c.setFont("Helvetica", 12)
        c.drawString(50, 250, "Merhaba dunya hello world")
        c.drawString(50, 200, "Ikinci satir burada")
    return _pdf(d)


def test_scan_origins_and_text():
    pdf = _open(_simple())
    sc = C.scan_page(pdf, pdf.pages[0])
    first = [g for g in sc.glyphs if abs(g.oy - 50) < 0.5]
    assert "".join(g.ch for g in first) == "Merhaba dunya hello world"
    assert first[0].ox == pytest.approx(50.0, abs=0.01)
    # 'M' genişliği: Helvetica 833/1000 × 12
    assert first[0].adv == pytest.approx(0.833 * 12, abs=0.01)
    assert first[0].size == pytest.approx(12.0, abs=0.01)


def test_delete_keeps_neighbors_in_place():
    pdf = _open(_simple())
    sc = C.scan_page(pdf, pdf.pages[0])
    before = {(g.ch, round(g.ox, 1)) for g in sc.glyphs if abs(g.oy - 50) < 0.5}
    hello = [g for g in sc.glyphs if abs(g.oy - 50) < 0.5 and 100 < g.ox < 150]
    r = (min(g.x0 for g in hello), 40, max(g.x1 for g in hello), 60)
    assert C.remove_in_rects(pdf, pdf.pages[0], [r], text=True)
    out = _open(_save(pdf))
    sc2 = C.scan_page(out, out.pages[0])
    after = {(g.ch, round(g.ox, 1)) for g in sc2.glyphs if abs(g.oy - 50) < 0.5}
    removed = {(g.ch, round(g.ox, 1)) for g in hello}
    assert after == before - removed  # kalan harfler birebir aynı yerde
    # ikinci satır dokunulmadı
    assert "".join(g.ch for g in sc2.glyphs if abs(g.oy - 100) < 0.5) == "Ikinci satir burada"
    with PdfiumReader(_save(pdf)) as rd:
        assert "Ikinci satir burada" in rd.text(0)


def test_char_word_space_and_hscale_are_parsed():
    def d(c):
        t = c.beginText(50, 250)
        t.setFont("Helvetica", 12)
        t.setCharSpace(2)
        t.setWordSpace(5)
        t.setHorizScale(80)
        t.textOut("ab cd")
        c.drawText(t)
    pdf = _open(_pdf(d))
    gl = C.scan_page(pdf, pdf.pages[0]).glyphs
    assert gl[0].tc == 2 and gl[0].th == pytest.approx(0.8)
    sp = [g for g in gl if g.ch == " "][0]
    assert sp.tw == 5


def test_tj_numbers_compensate_deleted_glyph_advance():
    # Elle yazılmış TJ: kerning sayısı olan satır
    def d(c):
        c.setFont("Helvetica", 12)
        c.drawString(50, 250, "ABCDEF")
    pdf = _open(_pdf(d))
    pg = pdf.pages[0]
    ops = list(pikepdf.parse_content_stream(pg))
    new = []
    for ins in ops:
        if str(ins.operator) == "Tj":
            new.append(pikepdf.ContentStreamInstruction([pikepdf.Array([pikepdf.String(b"AB"), -200, pikepdf.String(b"CDEF")])], pikepdf.Operator("TJ")))
        else:
            new.append(ins)
    pg.obj["/Contents"] = pdf.make_stream(pikepdf.unparse_content_stream(new))
    pdf2 = _open(_save(pdf))
    sc = C.scan_page(pdf2, pdf2.pages[0])
    pos = {g.ch: round(g.ox, 2) for g in sc.glyphs}
    c_g = [g for g in sc.glyphs if g.ch == "C"][0]
    assert C.remove_in_rects(pdf2, pdf2.pages[0], [(c_g.x0 + 0.1, 0, c_g.x1 - 0.1, 400)], text=True) is True
    out = _open(_save(pdf2))
    pos2 = {g.ch: round(g.ox, 2) for g in C.scan_page(out, out.pages[0]).glyphs}
    assert "C" not in pos2
    for ch in "ABDEF":
        assert pos2[ch] == pos[ch]


def test_shared_form_is_cloned_not_modified_elsewhere():
    from reportlab.pdfgen import canvas as _cv

    buf = io.BytesIO()
    c = _cv.Canvas(buf, pagesize=(400, 300), pageCompression=0)
    c.beginForm("f1")
    c.setFont("Helvetica", 12)
    c.drawString(0, 0, "SHARED")
    c.endForm()
    c.saveState(); c.translate(50, 250); c.doForm("f1"); c.restoreState()
    c.saveState(); c.translate(50, 100); c.doForm("f1"); c.restoreState()
    c.save()
    pdf = _open(buf.getvalue())
    sc = C.scan_page(pdf, pdf.pages[0])
    top = [g for g in sc.glyphs if g.oy < 100]
    assert "".join(g.ch for g in top) == "SHARED"
    r = (min(g.x0 for g in top), min(g.y0 for g in top), max(g.x1 for g in top), max(g.y1 for g in top))
    assert C.remove_in_rects(pdf, pdf.pages[0], [r], text=True)
    out = _open(_save(pdf))
    sc2 = C.scan_page(out, out.pages[0])
    assert "".join(g.ch for g in sc2.glyphs if g.oy < 100) == ""
    assert "".join(g.ch for g in sc2.glyphs if g.oy > 100) == "SHARED"  # diğer çizim aynen kaldı


def test_remove_rotation_keeps_appearance():
    pdf = _open(_simple())
    pdf.pages[0].obj["/Rotate"] = 90
    data = _save(pdf)
    with PdfiumReader(data) as a:
        ia = a.render(0, 1.0)
    pdf = _open(data)
    assert pc.remove_rotation(pdf, pdf.pages[0])
    out = _save(pdf)
    with PdfiumReader(out) as b:
        ib = b.render(0, 1.0)
    assert ia.size == ib.size
    from PIL import ImageChops

    assert ImageChops.difference(ia.convert("L"), ib.convert("L")).getbbox() is None or \
        max(ImageChops.difference(ia.convert("L"), ib.convert("L")).getdata()) < 40


def test_search_rects_finds_term():
    with PdfiumReader(_simple()) as rd:
        hits = rd.search_rects(0, "HELLO")  # büyük/küçük harf duyarsız
        assert len(hits) == 1
        x0, y0, x1, y1 = hits[0]
        assert 100 < x0 < x1 < 200 and 40 < y0 < y1 < 60


def test_path_removal_only_when_covered():
    def d(c):
        c.setStrokeColorRGB(1, 0, 0)
        c.rect(50, 100, 40, 20)       # kutuyla tamamen örtülür
        c.rect(200, 100, 100, 20)     # dışarıda
    pdf = _open(_pdf(d))
    sc = C.scan_page(pdf, pdf.pages[0])
    assert len(sc.paths) == 2
    inside = [p for p in sc.paths if p.rect[0] < 100][0]
    r = (inside.rect[0] - 2, inside.rect[1] - 2, inside.rect[2] + 2, inside.rect[3] + 2)
    assert C.remove_in_rects(pdf, pdf.pages[0], [r], text=False, paths=True)
    out = _open(_save(pdf))
    assert len(C.scan_page(out, out.pages[0]).paths) == 1

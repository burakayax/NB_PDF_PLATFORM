"""Dikey -> yatay düzen aracı (src/pdf_yatay_duzen.py)."""
import pikepdf
import pdfplumber
import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from src.pdf_yatay_duzen import YatayDuzenHatasi, yatay_duzene_cevir


def _dikey_pdf(yol, satir=40):
    c = canvas.Canvas(str(yol), pagesize=A4)
    _, h = A4
    y = h - 60
    for i in range(1, satir + 1):
        c.setFont("Helvetica", 11)
        c.drawString(50, y, f"Satir {i:02d} ornek metin 1.234,56 TL")
        y -= 30 if i % 8 == 0 else 17
    c.linkURL("https://example.com", (50, h - 70, 300, h - 50), relative=0)
    c.acroForm.textfield(name="ad", x=300, y=120, width=200, height=20, value="Burak")
    c.showPage()
    c.save()


def _kelimeler(yol):
    with pdfplumber.open(str(yol)) as p:
        return sorted(w["text"] for w in p.pages[0].extract_words())


def test_fit_metni_ve_alanlari_korur(tmp_path):
    g, o = tmp_path / "g.pdf", tmp_path / "o.pdf"
    _dikey_pdf(g)
    r = yatay_duzene_cevir(str(g), str(o), mod="fit")
    assert r["degisen"] == 1
    assert _kelimeler(g) == _kelimeler(o)
    with pikepdf.open(str(o)) as q:
        mb = [float(v) for v in q.pages[0].MediaBox]
        assert mb[2] > mb[3]  # yatay
        assert len(q.pages[0].Annots) == 2
        assert [str(f.T) for f in q.Root.AcroForm.Fields] == ["ad"]


def test_split_iki_sutun_ve_auto_dikeyde_split(tmp_path):
    g, o = tmp_path / "g.pdf", tmp_path / "o.pdf"
    _dikey_pdf(g)
    r = yatay_duzene_cevir(str(g), str(o), mod="auto")
    assert r["moda_gore"] == ["split"]
    # her yarı kırpılı biçimde iki kez yerleşir: metin ikiye katlanır ama hiçbiri kaybolmaz
    assert set(_kelimeler(g)) <= set(_kelimeler(o))


def test_yatay_sayfa_degismez(tmp_path):
    g, o = tmp_path / "g.pdf", tmp_path / "o.pdf"
    c = canvas.Canvas(str(g), pagesize=(842, 595))
    c.drawString(50, 500, "yatay")
    c.save()
    r = yatay_duzene_cevir(str(g), str(o))
    assert r["degisen"] == 0 and r["moda_gore"] == ["ayni"]


def test_gecersiz_mod(tmp_path):
    g = tmp_path / "g.pdf"
    _dikey_pdf(g)
    with pytest.raises(YatayDuzenHatasi):
        yatay_duzene_cevir(str(g), str(tmp_path / "o.pdf"), mod="x")


def _kisa_sayfalar(yol, sayfa=4, satir=12):
    c = canvas.Canvas(str(yol), pagesize=A4)
    _, h = A4
    for p in range(sayfa):
        for i in range(satir):
            c.setFont("Helvetica", 11)
            c.drawString(50, h - 60 - i * 17, f"S{p+1}K{i+1:02d} ornek")
        c.showPage()
    c.save()


def test_split_surekli_akis_bos_birakmaz(tmp_path):
    """4 kisa dikey sayfa, sayfa basina bir sutun doldurmaz: akis tek yatay sayfaya sigmali."""
    g, o = tmp_path / "g.pdf", tmp_path / "o.pdf"
    _kisa_sayfalar(g)
    r = yatay_duzene_cevir(str(g), str(o), mod="split")
    assert r["sayfa"] == 4 and r["cikis_sayfa"] < 4
    with pdfplumber.open(str(o)) as p:
        sozcukler = [w["text"] for pg in p.pages for w in pg.extract_words()]
    assert all(f"S{s}K{k:02d}" in sozcukler for s in range(1, 5) for k in range(1, 13))


def test_fit_tum_sayfalarda_ayni_olcek(tmp_path):
    g, o = tmp_path / "g.pdf", tmp_path / "o.pdf"
    c = canvas.Canvas(str(g), pagesize=A4)
    _, h = A4
    for satir in (40, 5):  # biri dolu, biri cok kisa
        for i in range(satir):
            c.setFont("Helvetica", 11)
            c.drawString(50, h - 60 - i * 17, f"Satir {i} ornek metin 1.234,56 TL")
        c.showPage()
    c.save()
    yatay_duzene_cevir(str(g), str(o), mod="fit")
    with pdfplumber.open(str(o)) as p:
        boyutlar = [pg.extract_words()[0]["bottom"] - pg.extract_words()[0]["top"] for pg in p.pages]
    assert abs(boyutlar[0] - boyutlar[1]) < 0.2


def test_tek_sutuna_sigan_icerik_iki_sutuna_dengelenir(tmp_path):
    """Tek sutuna sigan ama yeterince uzun icerik, sag sutun bos kalmasin diye ikiye dagitilir."""
    g, o = tmp_path / "g.pdf", tmp_path / "o.pdf"
    _kisa_sayfalar(g, sayfa=1, satir=29)
    r = yatay_duzene_cevir(str(g), str(o), mod="split")
    assert r["cikis_sayfa"] == 1
    with pdfplumber.open(str(o)) as p:
        orta = p.pages[0].width / 2
        sol = [w for w in p.pages[0].extract_words() if w["x1"] < orta]
        sag = [w for w in p.pages[0].extract_words() if w["x0"] > orta]
    assert sol and sag and abs(len(sol) - len(sag)) <= 12

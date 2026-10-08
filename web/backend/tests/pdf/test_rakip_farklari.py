"""Rakip karşılaştırmasında (7 Ekim 2026) bulunan eksiklerin ve hataların regresyon testleri.

Her test, o gün ölçülen davranışı sabitler:
  - sayfa silme dosyayı şişirmemeli,
  - sayfa numarası 6 konum + boyut + aralık desteklemeli,
  - filigran açı/boyut/aralık/%100 opaklık ve görsel filigranı desteklemeli,
  - PDF→görsel sayfa seçimi, TIFF ve DPI etiketi sunmalı,
  - onarım, bir yöntem bozuk sayfa üretirse başka yöntemi seçmeli.
"""

from __future__ import annotations

import io
import os
import sys
import zipfile
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

try:
    import fitz
    from PIL import Image

    import src.pdf_toolkit_extra as ptx  # noqa: E402

    HAS_PTX = True
except Exception:
    HAS_PTX = False

pytestmark = pytest.mark.skipif(not HAS_PTX, reason="pdf_toolkit_extra içe aktarılamadı")


def _gurultulu_jpeg(w: int = 700, h: int = 500) -> bytes:
    im = Image.effect_noise((w, h), 60).convert("RGB")
    b = io.BytesIO()
    im.save(b, "JPEG", quality=90)
    return b.getvalue()


@pytest.fixture()
def agir_pdf(tmp_path: Path) -> Path:
    """4 sayfa; her sayfada AYNI büyük görsel (ortak kaynak) + metin."""
    doc = fitz.open()
    jpg = _gurultulu_jpeg()
    xref = 0
    for i in range(4):
        page = doc.new_page()
        page.insert_text((50, 60), f"Belge icerik {i + 1}", fontsize=14)
        rect = fitz.Rect(50, 100, 545, 450)
        if xref:
            page.insert_image(rect, xref=xref)
        else:
            xref = page.insert_image(rect, stream=jpg)
    p = tmp_path / "agir.pdf"
    doc.save(str(p), garbage=4, deflate=True)
    return p


def _sayfa_metinleri(yol: Path | str) -> list[str]:
    d = fitz.open(str(yol))
    return [p.get_text().replace("\xa0", " ") for p in d]


class TestSayfaSilmeBoyut:
    def test_bitisik_olmayan_silme_dosyayi_sisirmez(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "out.pdf"
        ptx.delete_pages_pdf(str(agir_pdf), str(out), [2])  # 1, 3, 4 kalır = iki ayrı aralık
        assert fitz.open(str(out)).page_count == 3
        # Eski hata: ortak görsel her aralıkta yeniden kopyalanıp boyut ~2 katına çıkıyordu.
        assert out.stat().st_size <= os.path.getsize(agir_pdf) * 1.1

    def test_kalan_sayfalarin_sirasi_ve_icerigi_dogru(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "out.pdf"
        ptx.delete_pages_pdf(str(agir_pdf), str(out), [2])
        metin = _sayfa_metinleri(out)
        assert "icerik 1" in metin[0] and "icerik 3" in metin[1] and "icerik 4" in metin[2]


class TestSayfaNumarasi:
    @pytest.mark.parametrize(
        "konum,x_alt,x_ust,dikey",
        [
            ("footer-left", 0, 200, "alt"),
            ("footer-right", 395, 595, "alt"),
            ("header-left", 0, 200, "ust"),
            ("header-right", 395, 595, "ust"),
            ("footer", 200, 395, "alt"),
        ],
    )
    def test_konumlar(self, agir_pdf: Path, tmp_path: Path, konum, x_alt, x_ust, dikey):
        out = tmp_path / "n.pdf"
        ptx.add_page_numbers(str(agir_pdf), str(out), position=konum, fmt="of")
        sayfa = fitz.open(str(out))[0]
        blok = [b for b in sayfa.get_text("blocks") if b[4].strip().replace("\xa0", " ") == "1 / 4"]
        assert blok, f"{konum}: numara çizilmedi"
        x0, y0 = blok[0][0], blok[0][1]
        assert x_alt <= x0 <= x_ust
        assert (y0 > 700) if dikey == "alt" else (y0 < 100)

    def test_buyuk_yazi_boyutu_da_cizilir(self, agir_pdf: Path, tmp_path: Path):
        # Eski hata sınıfı: kutu yazıya göre küçük kalırsa metin SESSİZCE çizilmiyordu.
        out = tmp_path / "n.pdf"
        ptx.add_page_numbers(str(agir_pdf), str(out), font_size=48)
        assert "1" in _sayfa_metinleri(out)[0].split("\n")[-2:][0] or "1" in _sayfa_metinleri(out)[0]
        bloklar = [b for b in fitz.open(str(out))[0].get_text("blocks") if b[4].strip() == "1"]
        assert bloklar

    def test_aralik_ve_baslangic(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "n.pdf"
        ptx.add_page_numbers(str(agir_pdf), str(out), start_at=5, fmt="page-of", from_page=2, to_page=3)
        m = _sayfa_metinleri(out)
        assert "Sayfa 5 / 4" in m[1]
        assert "Sayfa 6 / 4" in m[2]
        assert "Sayfa" not in m[0] and "Sayfa" not in m[3]


class TestFiligran:
    def test_aralik_ve_turkce(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "w.pdf"
        ptx.add_watermark_text(
            str(agir_pdf), str(out), "GİZLİ Çığ Şöğüş",
            opacity=1.0, rotation=0, size_pct=50, from_page=2, to_page=3,
        )
        m = _sayfa_metinleri(out)
        assert "Çığ" in m[1] and "Çığ" in m[2]
        assert "Çığ" not in m[0] and "Çığ" not in m[3]

    def test_dosya_sismez(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "w.pdf"
        ptx.add_watermark_text(str(agir_pdf), str(out), "TASLAK")
        # Gömülü yazı tipi sayfa başına çoğalıp dosyayı şişirmemeli.
        assert out.stat().st_size <= os.path.getsize(agir_pdf) + 40 * 1024

    def test_gorsel_filigran_secili_sayfalarda(self, agir_pdf: Path, tmp_path: Path):
        logo = Image.new("RGBA", (200, 100), (200, 0, 0, 255))
        b = io.BytesIO()
        logo.save(b, "PNG")
        out = tmp_path / "wi.pdf"
        ptx.add_watermark_image(
            str(agir_pdf), str(out), b.getvalue(),
            opacity=0.4, rotation=30, size_pct=30, from_page=1, to_page=2, position="bottom-right",
        )
        d = fitz.open(str(out))

        def kirmizi_piksel(sayfa) -> int:
            # Sağ alt köşedeki kırmızı logo bölgesini çizip kırmızı baskın pikselleri say.
            kutu = fitz.Rect(sayfa.rect.x1 - 200, sayfa.rect.y1 - 120, sayfa.rect.x1, sayfa.rect.y1)
            pix = sayfa.get_pixmap(dpi=36, clip=kutu)
            ornek = pix.samples
            return sum(1 for i in range(0, len(ornek) - 2, pix.n) if ornek[i] > 200 and ornek[i + 1] < 200)

        cizilen = [kirmizi_piksel(p) for p in d]
        assert cizilen[0] > 0 and cizilen[1] > 0
        assert cizilen[2] == 0 and cizilen[3] == 0

    def test_bozuk_gorsel_anlasilir_hata_verir(self, agir_pdf: Path, tmp_path: Path):
        with pytest.raises(Exception, match="okunamadı"):
            ptx.add_watermark_image(str(agir_pdf), str(tmp_path / "x.pdf"), b"bu bir resim degil")


class TestPdfGorselDonusumu:
    def _donustur(self, pdf: Path, tmp_path: Path, **kw):
        try:
            return ptx.pdf_to_images_zip(str(pdf), str(tmp_path), **kw)
        except Exception as e:  # poppler yoksa atla
            if "poppler" in str(e).lower() or "Unable to get page count" in str(e):
                pytest.skip("poppler kurulu değil")
            raise

    def test_sayfa_secimi_ve_gercek_numara(self, agir_pdf: Path, tmp_path: Path):
        z = zipfile.ZipFile(self._donustur(agir_pdf, tmp_path, dpi=72, pages=[2, 4]))
        assert z.namelist() == ["sayfa_0002.jpg", "sayfa_0004.jpg"]

    def test_tiff_ve_dpi_etiketi(self, agir_pdf: Path, tmp_path: Path):
        z = zipfile.ZipFile(self._donustur(agir_pdf, tmp_path, image_format="tiff", dpi=150, pages=[1]))
        ad = z.namelist()[0]
        assert ad.endswith(".tiff")
        im = Image.open(io.BytesIO(z.read(ad)))
        assert round(float(im.info["dpi"][0])) == 150


class TestOnarimEnIyiYontem:
    def test_kesik_dosyada_butun_sayfalar_saglam(self, tmp_path: Path):
        # Gerçekçi senaryo: her sayfada AYRI büyük görsel (dosya birkaç yüz KB), yalnızca
        # kuyruktaki xref/trailer kesik. İlk yöntemin (pikepdf) bozuk sayfa bıraktığı,
        # PyMuPDF'in ise kusursuz kurtardığı durum.
        doc = fitz.open()
        for i in range(5):
            sayfa = doc.new_page()
            sayfa.insert_text((50, 60), f"Sayfa {i + 1}")
            sayfa.insert_image(fitz.Rect(50, 100, 545, 450), stream=_gurultulu_jpeg(900, 650))
        kaynak = tmp_path / "kaynak.pdf"
        doc.save(str(kaynak), garbage=4, deflate=True)
        kirik = tmp_path / "kirik.pdf"
        kirik.write_bytes(kaynak.read_bytes()[:-1200])
        out = tmp_path / "onarilmis.pdf"
        ptx.repair_pdf(str(kirik), str(out))
        assert fitz.open(str(out)).page_count == 5
        assert ptx._onarim_bozuk_sayfa(str(out)) == 0
        assert not list(tmp_path.glob("onarilmis.pdf.aday*"))  # geçici adaylar temizlenmeli


class TestUstAltBilgi:
    def test_yer_tutucular_ve_turkce(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "hf.pdf"
        ptx.add_header_footer(
            str(agir_pdf), str(out),
            {"header-left": "Şirket İçi — Gizli", "footer-right": "{dosya} · Sayfa {sayfa}/{toplam} · {tarih}"},
            file_name="Rapor Çalışması.pdf", date_text="08.10.2026",
        )
        m = _sayfa_metinleri(out)
        assert "Şirket İçi — Gizli" in m[0]
        assert "Rapor Çalışması · Sayfa 1/4 · 08.10.2026" in m[0]
        assert "Sayfa 4/4" in m[3]

    def test_aralik_ve_baslangic(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "hf.pdf"
        ptx.add_header_footer(str(agir_pdf), str(out), {"footer-center": "S{sayfa}"}, from_page=2, to_page=3, start_at=10)
        m = _sayfa_metinleri(out)
        assert "S10" in m[1] and "S11" in m[2]
        assert "S1" not in m[0].replace("Belge", "") and "S1" not in m[3].replace("Belge", "")

    def test_bos_metin_hata_verir(self, agir_pdf: Path, tmp_path: Path):
        with pytest.raises(Exception, match="en az bir metin"):
            ptx.add_header_footer(str(agir_pdf), str(tmp_path / "x.pdf"), {"header-left": "  "})

    def test_dosya_sismez(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "hf.pdf"
        ptx.add_header_footer(str(agir_pdf), str(out), {"header-center": "Başlık"})
        assert out.stat().st_size <= os.path.getsize(agir_pdf) + 40 * 1024


class TestSayfaKirp:
    def _icerikli(self, tmp_path: Path) -> Path:
        d = fitz.open()
        for i in range(3):
            pg = d.new_page()  # A4: 595 x 842
            pg.insert_text((200, 300), f"Orta metin {i + 1}", fontsize=18)
        yol = tmp_path / "ic.pdf"
        d.save(str(yol))
        return yol

    def test_elle_mm(self, tmp_path: Path):
        out = tmp_path / "k.pdf"
        ptx.crop_pdf(str(self._icerikli(tmp_path)), str(out), mode="margins",
                     top_mm=20, bottom_mm=30, left_mm=10, right_mm=10)
        r = fitz.open(str(out))[0].rect
        assert round(r.width) == round(595 - 20 * 72 / 25.4)
        assert round(r.height) == round(842 - 50 * 72 / 25.4)

    def test_otomatik_icerige_gore(self, tmp_path: Path):
        out = tmp_path / "k.pdf"
        sonuc = ptx.crop_pdf(str(self._icerikli(tmp_path)), str(out), mode="auto", pad_mm=5)
        assert sonuc["kirpilan"] == 3
        r = fitz.open(str(out))[0].rect
        assert r.width < 250 and r.height < 100  # tüm sayfa değil, yalnızca metnin çevresi
        assert "Orta metin 1" in fitz.open(str(out))[0].get_text()  # içerik kesilmedi

    def test_ayni_olcu_ve_aralik(self, tmp_path: Path):
        out = tmp_path / "k.pdf"
        ptx.crop_pdf(str(self._icerikli(tmp_path)), str(out), mode="auto", uniform=True, from_page=1, to_page=2)
        d = fitz.open(str(out))
        assert d[0].rect == d[1].rect
        assert round(d[2].rect.width) == 595  # aralık dışı sayfa kırpılmadı

    def test_donmus_sayfada_gorunen_kenarlar(self, tmp_path: Path):
        d = fitz.open(str(self._icerikli(tmp_path)))
        d[0].set_rotation(90)  # görünen boyut 842 x 595
        kaynak = tmp_path / "rot.pdf"
        d.save(str(kaynak))
        out = tmp_path / "k.pdf"
        ptx.crop_pdf(str(kaynak), str(out), mode="margins", top_mm=30, left_mm=10, from_page=1, to_page=1)
        r = fitz.open(str(out))[0].rect
        assert round(r.width) == round(842 - 10 * 72 / 25.4)
        assert round(r.height) == round(595 - 30 * 72 / 25.4)

    def test_gecersiz_girdiler(self, tmp_path: Path):
        k = self._icerikli(tmp_path)
        with pytest.raises(Exception, match="En az bir kenar"):
            ptx.crop_pdf(str(k), str(tmp_path / "x.pdf"), mode="margins")
        with pytest.raises(Exception, match="yok edecek"):
            ptx.crop_pdf(str(k), str(tmp_path / "x.pdf"), mode="margins", left_mm=150, right_mm=150)
        with pytest.raises(Exception, match="500 mm"):
            ptx.crop_pdf(str(k), str(tmp_path / "x.pdf"), mode="margins", top_mm=900)

    def test_bos_sayfa_otomatik_atlanir(self, tmp_path: Path):
        d = fitz.open()
        d.new_page()
        d.new_page().insert_text((100, 100), "var")
        kaynak = tmp_path / "bos.pdf"
        d.save(str(kaynak))
        sonuc = ptx.crop_pdf(str(kaynak), str(tmp_path / "k.pdf"), mode="auto")
        assert sonuc == {"kirpilan": 1, "atlanan": 1}


def _renkli_pdf(tmp_path: Path) -> Path:
    d = fitz.open()
    pg = d.new_page()
    pg.insert_text((60, 80), "Kirmizi baslik", fontsize=22, color=(1, 0, 0))
    pg.draw_rect(fitz.Rect(60, 120, 300, 220), color=(0, 0, 1), fill=(0, 0.8, 0.2), width=3)
    im = Image.new("RGB", (300, 200))
    for x in range(300):
        for y in range(200):
            im.putpixel((x, y), (x * 255 // 300, y * 255 // 200, 128))
    b = io.BytesIO()
    im.save(b, "JPEG", quality=90)
    pg.insert_image(fitz.Rect(60, 260, 360, 460), stream=b.getvalue())
    yol = tmp_path / "renkli.pdf"
    d.save(str(yol))
    return yol


def _renk_farki(yol: Path) -> int:
    px = fitz.open(str(yol))[0].get_pixmap(dpi=60)
    n = px.n
    ornek = px.samples
    fark = 0
    for i in range(0, len(ornek) - 2, n):
        fark = max(fark, abs(ornek[i] - ornek[i + 1]), abs(ornek[i + 1] - ornek[i + 2]))
    return fark


class TestGriTonlama:
    def test_butun_renkler_griye_doner_metin_kalir(self, tmp_path: Path):
        kaynak = _renkli_pdf(tmp_path)
        out = tmp_path / "gri.pdf"
        sonuc = ptx.grayscale_pdf(str(kaynak), str(out))
        assert sonuc["gorsel"] >= 1 and sonuc["icerik"] >= 1
        assert _renk_farki(kaynak) > 100  # kaynak gerçekten renkli
        assert _renk_farki(out) <= 2       # çıktıda renk kalmadı
        assert fitz.open(str(out))[0].get_text() == fitz.open(str(kaynak))[0].get_text()

    def test_zaten_gri_belge_bozulmaz(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "g.pdf"
        ptx.grayscale_pdf(str(agir_pdf), str(out))
        assert fitz.open(str(out)).page_count == 4


class TestSayfaBoyutlandirma:
    @pytest.mark.parametrize("boyut,genislik,yukseklik", [("a4", 595, 842), ("a5", 420, 595), ("letter", 612, 792)])
    def test_hedef_olculer(self, agir_pdf: Path, tmp_path: Path, boyut, genislik, yukseklik):
        out = tmp_path / "r.pdf"
        ptx.resize_pdf_pages(str(agir_pdf), str(out), size="a3" if False else boyut)
        r = fitz.open(str(out))[0].rect
        assert (round(r.width), round(r.height)) == (genislik, yukseklik)

    def test_yon_korunur_ve_yatay_zorlanir(self, tmp_path: Path):
        d = fitz.open()
        d.new_page(width=842, height=595).insert_text((50, 60), "Yatay sayfa")
        kaynak = tmp_path / "y.pdf"
        d.save(str(kaynak))
        out = tmp_path / "r.pdf"
        ptx.resize_pdf_pages(str(kaynak), str(out), size="a4")
        assert fitz.open(str(out))[0].rect.width > fitz.open(str(out))[0].rect.height  # auto: yatay kaldı
        ptx.resize_pdf_pages(str(kaynak), str(tmp_path / "p.pdf"), size="a4", orientation="portrait")
        assert fitz.open(str(tmp_path / "p.pdf"))[0].rect.height > fitz.open(str(tmp_path / "p.pdf"))[0].rect.width

    def test_ozel_olcu_ve_metin_korunur(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "r.pdf"
        ptx.resize_pdf_pages(str(agir_pdf), str(out), size="custom", custom_w_mm=100, custom_h_mm=150, fit="stretch")
        d = fitz.open(str(out))
        assert round(d[0].rect.width) == round(100 * 72 / 25.4)
        assert "icerik 1" in d[0].get_text()  # vektör metin hâlâ seçilebilir

    def test_gecersiz_olcu(self, agir_pdf: Path, tmp_path: Path):
        with pytest.raises(Exception, match="geçersiz"):
            ptx.resize_pdf_pages(str(agir_pdf), str(tmp_path / "x.pdf"), size="a99")
        with pytest.raises(Exception, match="20 ile 2000"):
            ptx.resize_pdf_pages(str(agir_pdf), str(tmp_path / "x.pdf"), size="custom", custom_w_mm=5, custom_h_mm=5)


class TestAyna:
    def _gri(self, yol: Path):
        px = fitz.open(str(yol))[0].get_pixmap(dpi=30, colorspace=fitz.csGRAY)
        return [list(px.samples[r * px.w:(r + 1) * px.w]) for r in range(px.h)]

    def test_yatay_ve_dikey(self, agir_pdf: Path, tmp_path: Path):
        a = self._gri(agir_pdf)
        ptx.flip_pdf(str(agir_pdf), str(tmp_path / "h.pdf"), "horizontal")
        ptx.flip_pdf(str(agir_pdf), str(tmp_path / "v.pdf"), "vertical")
        h = self._gri(tmp_path / "h.pdf")
        v = self._gri(tmp_path / "v.pdf")

        def fark(x, y):
            return sum(abs(p - q) for rx, ry in zip(x, y) for p, q in zip(rx, ry)) / (len(x) * len(x[0]))

        assert fark([r[::-1] for r in a], h) < fark(a, h)
        assert fark(a[::-1], v) < fark(a, v)
        assert fark(a[::-1], v) < 3

    def test_aralik_disi_sayfa_dokunulmaz(self, agir_pdf: Path, tmp_path: Path):
        ptx.flip_pdf(str(agir_pdf), str(tmp_path / "v.pdf"), "vertical", from_page=1, to_page=1)
        d2 = fitz.open(str(tmp_path / "v.pdf"))
        d1 = fitz.open(str(agir_pdf))
        assert d2[1].get_pixmap(dpi=30).samples == d1[1].get_pixmap(dpi=30).samples
        assert d2[0].get_pixmap(dpi=30).samples != d1[0].get_pixmap(dpi=30).samples


class TestDonusumluBirlestir:
    def _belge(self, tmp_path: Path, ad: str, n: int) -> Path:
        d = fitz.open()
        for i in range(n):
            d.new_page().insert_text((50, 60), f"{ad}{i + 1}")
        yol = tmp_path / f"{ad}.pdf"
        d.save(str(yol))
        return yol

    def test_sirayla(self, tmp_path: Path):
        a, b = self._belge(tmp_path, "A", 3), self._belge(tmp_path, "B", 3)
        out = tmp_path / "m.pdf"
        ptx.alternate_mix_pdfs([str(a), str(b)], str(out))
        assert [t.strip() for t in _sayfa_metinleri(out)] == ["A1", "B1", "A2", "B2", "A3", "B3"]

    def test_ikinci_ters_ve_farkli_uzunluk(self, tmp_path: Path):
        a, b = self._belge(tmp_path, "A", 3), self._belge(tmp_path, "B", 2)
        out = tmp_path / "m.pdf"
        ptx.alternate_mix_pdfs([str(a), str(b)], str(out), reverse_second=True)
        assert [t.strip() for t in _sayfa_metinleri(out)] == ["A1", "B2", "A2", "B1", "A3"]

    def test_tek_belge_hata(self, tmp_path: Path):
        a = self._belge(tmp_path, "A", 2)
        with pytest.raises(Exception, match="en az 2"):
            ptx.alternate_mix_pdfs([str(a)], str(tmp_path / "x.pdf"))


class TestGelismisBolme:
    def test_her_n_sayfa(self, agir_pdf: Path, tmp_path: Path):
        r = ptx.split_pdf_advanced(str(agir_pdf), str(tmp_path / "o"), "every", every_n=3, base_name="r")
        assert [fitz.open(x).page_count for x in r["dosyalar"]] == [3, 1]

    def test_boyuta_gore_limiti_asmaz(self, tmp_path: Path):
        d = fitz.open()
        for i in range(6):
            pg = d.new_page()
            pg.insert_image(fitz.Rect(50, 100, 545, 450), stream=_gurultulu_jpeg(900, 650))
        kaynak = tmp_path / "b.pdf"
        d.save(str(kaynak))
        limit_mb = 1.0
        r = ptx.split_pdf_advanced(str(kaynak), str(tmp_path / "o"), "size", max_mb=limit_mb, base_name="b")
        assert len(r["dosyalar"]) >= 2
        for y in r["dosyalar"]:
            assert os.path.getsize(y) <= limit_mb * 1024 * 1024
        assert sum(fitz.open(y).page_count for y in r["dosyalar"]) == 6  # hiçbir sayfa kaybolmadı

    def test_tek_sayfa_limiti_asarsa_bildirilir(self, tmp_path: Path):
        d = fitz.open()
        d.new_page().insert_image(fitz.Rect(50, 100, 545, 450), stream=_gurultulu_jpeg(1200, 900))
        d.new_page().insert_text((50, 60), "kucuk")
        d.new_page().insert_text((50, 60), "kucuk2")
        kaynak = tmp_path / "b.pdf"
        d.save(str(kaynak))
        r = ptx.split_pdf_advanced(str(kaynak), str(tmp_path / "o"), "size", max_mb=0.05)
        assert 1 in r["asan"]

    def test_yer_imine_gore(self, tmp_path: Path):
        d = fitz.open()
        for i in range(6):
            d.new_page().insert_text((50, 60), f"S{i + 1}")
        d.set_toc([[1, "Giriş: Çığ", 1], [2, "alt", 2], [1, "Bölüm Şu/Ğ", 3], [1, "Sonuç", 5]])
        kaynak = tmp_path / "t.pdf"
        d.save(str(kaynak))
        r = ptx.split_pdf_advanced(str(kaynak), str(tmp_path / "o"), "outline")
        adlar = [Path(x).name for x in r["dosyalar"]]
        assert adlar == ["01 Giriş Çığ.pdf", "02 Bölüm Şu Ğ.pdf", "03 Sonuç.pdf"]
        assert [fitz.open(x).page_count for x in r["dosyalar"]] == [2, 2, 2]

    def test_hata_mesajlari(self, agir_pdf: Path, tmp_path: Path):
        with pytest.raises(Exception, match="yer imi"):
            ptx.split_pdf_advanced(str(agir_pdf), str(tmp_path / "o1"), "outline")
        with pytest.raises(Exception, match="tek parça"):
            ptx.split_pdf_advanced(str(agir_pdf), str(tmp_path / "o2"), "every", every_n=10)


class TestBatesNumarasi:
    def test_sifirla_doldurma_ve_kesintisiz_baslangic(self, agir_pdf: Path, tmp_path: Path):
        out1 = tmp_path / "b1.pdf"
        ptx.add_header_footer(str(agir_pdf), str(out1), {"footer-right": "DAVA-{sayfa:6}"}, start_at=1)
        m1 = _sayfa_metinleri(out1)
        assert "DAVA-000001" in m1[0] and "DAVA-000004" in m1[3]
        # İkinci dosya, ilk dosyanın son numarasından (4) sonra devam eder.
        out2 = tmp_path / "b2.pdf"
        ptx.add_header_footer(str(agir_pdf), str(out2), {"footer-right": "DAVA-{sayfa:6}"}, start_at=5)
        m2 = _sayfa_metinleri(out2)
        assert "DAVA-000005" in m2[0] and "DAVA-000008" in m2[3]

    def test_pad_olmadan_eskisi_gibi(self, agir_pdf: Path, tmp_path: Path):
        out = tmp_path / "b.pdf"
        ptx.add_header_footer(str(agir_pdf), str(out), {"footer-left": "S{sayfa}/{toplam:3}"}, start_at=7)
        assert "S7/004" in _sayfa_metinleri(out)[0]


def _metin_goruntusu(aci: float = 0.0) -> "Image.Image":
    """Satır satır metin içeren sayfa görüntüsü; `aci` derece döndürülmüş (eğri tarama)."""
    d = fitz.open()
    pg = d.new_page()
    for k in range(40):
        pg.insert_text((50, 60 + k * 17), "Bu satir egri tarama testi icin yazilmistir " * 2, fontsize=10)
    px = pg.get_pixmap(dpi=150, colorspace=fitz.csGRAY)
    im = Image.frombytes("L", (px.w, px.h), px.samples)
    return im.rotate(aci, resample=Image.BICUBIC, fillcolor=255) if aci else im


def _tarama_pdf(tmp_path: Path, aci: float, sayfa: int = 2, metinli_ekle: bool = False) -> Path:
    b = io.BytesIO()
    _metin_goruntusu(aci).save(b, "JPEG", quality=85)
    d = fitz.open()
    for _ in range(sayfa):
        d.new_page(width=595, height=842).insert_image(fitz.Rect(0, 0, 595, 842), stream=b.getvalue())
    if metinli_ekle:
        d.new_page().insert_text((50, 60), "metinli sayfa")
    yol = tmp_path / "tarama.pdf"
    d.save(str(yol))
    return yol


class TestEgriTarama:
    @pytest.mark.parametrize("gercek", [-4.0, -1.5, 2.0, 3.5, 7.0])
    def test_aci_dogru_bulunur(self, gercek):
        import numpy as np

        bulunan = ptx._egrilik_acisi(np.asarray(_metin_goruntusu(gercek)), 10)
        assert abs(bulunan + gercek) <= 0.3  # düzeltme açısı = -eğrilik

    def test_duz_sayfada_sifir(self):
        import numpy as np

        assert abs(ptx._egrilik_acisi(np.asarray(_metin_goruntusu(0.0)), 10)) <= 0.2

    def test_bos_sayfada_sifir(self):
        import numpy as np

        assert ptx._egrilik_acisi(np.full((800, 600), 255, dtype=np.uint8), 10) == 0.0

    def test_uctan_uca_duzeltir_metinli_sayfaya_dokunmaz(self, tmp_path: Path):
        import numpy as np

        kaynak = _tarama_pdf(tmp_path, 3.0, sayfa=2, metinli_ekle=True)
        out = tmp_path / "duz.pdf"
        sonuc = ptx.deskew_pdf(str(kaynak), str(out))
        assert sonuc["duzeltilen"] == 2 and sonuc["atlanan_metinli"] == 1
        d = fitz.open(str(out))
        assert d.page_count == 3
        assert "metinli sayfa" in d[2].get_text()
        px = d[0].get_pixmap(dpi=150, colorspace=fitz.csGRAY)
        kalan = ptx._egrilik_acisi(np.frombuffer(px.samples, np.uint8).reshape(px.h, px.w), 10)
        assert abs(kalan) <= 0.3  # düzeltme sonrası düz

    def test_zaten_duz_tarama_hata_verir(self, tmp_path: Path):
        with pytest.raises(Exception, match="zaten düz"):
            ptx.deskew_pdf(str(_tarama_pdf(tmp_path, 0.0)), str(tmp_path / "x.pdf"))

    def test_dijital_pdf_hata_verir(self, agir_pdf: Path, tmp_path: Path):
        with pytest.raises(Exception, match="taranmış görüntü değil"):
            ptx.deskew_pdf(str(agir_pdf), str(tmp_path / "x.pdf"))

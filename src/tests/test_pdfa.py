"""
PDF/A DÖNÜŞÜMÜ (pdftopdfa ile; Ghostscript kaldırıldı).

Korunan kritik davranış: kütüphane bazı durumlarda özgün dosyayı DEĞİŞTİRMEDEN
kopyalayıp "başarılı" döner. Bu, kullanıcıya "PDF/A oldu" demek olurdu; kurum
reddederdi. Bu yüzden "atlandı / hedef üretilmedi" sonuçları HATA sayılır.
"""

import os
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src import pdf_toolkit_extra as ptx


def _sahte_modul(sonuc=None, hata=None, cikti_yaz=True):
    """`pdftopdfa` yerine geçen sahte modül."""

    def convert_to_pdfa(girdi, cikti, seviye, **kw):
        convert_to_pdfa.cagri = (seviye, kw)
        if hata:
            raise hata
        if cikti_yaz:
            with open(cikti, "wb") as f:
                f.write(b"%PDF-1.7\n" + b"x" * 200)
        return sonuc

    m = types.ModuleType("pdftopdfa")
    m.convert_to_pdfa = convert_to_pdfa
    return m


def _sonuc(**kw):
    d = dict(success=True, skipped=False, target_produced=True, error=None)
    d.update(kw)
    return types.SimpleNamespace(**d)


class PdfaDonusumTest(unittest.TestCase):
    def test_gecersiz_surum_reddedilir(self):
        for kotu in ("4x", "1b"):
            with self.assertRaises(Exception) as c:
                ptx.pdf_to_pdfa("in.pdf", "out.pdf", surum=kotu)
            self.assertIn("2b", str(c.exception))

    def test_kutuphane_yoksa_anlasilir_hata(self):
        with patch.dict(sys.modules, {"pdftopdfa": None}):
            with self.assertRaises(Exception) as c:
                ptx.pdf_to_pdfa("in.pdf", "out.pdf")
        self.assertIn("kullanılamıyor", str(c.exception))

    def test_basarili_donusumde_surum_bildirilir_ve_aykiri_ogeler_atilir(self):
        mod = _sahte_modul(_sonuc())
        with tempfile.TemporaryDirectory() as d, patch.dict(sys.modules, {"pdftopdfa": mod}):
            sonuc = ptx.pdf_to_pdfa("in.pdf", os.path.join(d, "out.pdf"), surum="3b")
        self.assertEqual(sonuc["surum"], "3b")
        seviye, kw = mod.convert_to_pdfa.cagri
        self.assertEqual(seviye, "3b")
        # "always": aykırı öğe atılsa da çıktı üretilir (veraPDF çalışma anında yok).
        self.assertEqual(kw.get("publication_policy"), "always")

    def test_atlanan_donusum_basarili_sayilmaz(self):
        # Kütüphane özgün dosyayı değiştirmeden kopyalarsa kullanıcıya PDF/A DENMEZ.
        mod = _sahte_modul(_sonuc(skipped=True))
        with tempfile.TemporaryDirectory() as d, patch.dict(sys.modules, {"pdftopdfa": mod}):
            with self.assertRaises(Exception) as c:
                ptx.pdf_to_pdfa("in.pdf", os.path.join(d, "out.pdf"))
        self.assertIn("dönüştürülemedi", str(c.exception))

    def test_hedef_uretilmediyse_basarili_sayilmaz(self):
        mod = _sahte_modul(_sonuc(target_produced=False, error="x"))
        with tempfile.TemporaryDirectory() as d, patch.dict(sys.modules, {"pdftopdfa": mod}):
            with self.assertRaises(Exception) as c:
                ptx.pdf_to_pdfa("in.pdf", os.path.join(d, "out.pdf"))
        self.assertIn("dönüştürülemedi", str(c.exception))

    def test_bos_cikti_basarili_sayilmaz(self):
        mod = _sahte_modul(_sonuc(), cikti_yaz=False)
        with tempfile.TemporaryDirectory() as d, patch.dict(sys.modules, {"pdftopdfa": mod}):
            with self.assertRaises(Exception) as c:
                ptx.pdf_to_pdfa("in.pdf", os.path.join(d, "out.pdf"))
        self.assertIn("dönüştürülemedi", str(c.exception))

    def test_kutuphane_hatasi_kullaniciya_anlasilir_gider(self):
        mod = _sahte_modul(hata=RuntimeError("bozuk"))
        with tempfile.TemporaryDirectory() as d, patch.dict(sys.modules, {"pdftopdfa": mod}):
            with self.assertRaises(Exception) as c:
                ptx.pdf_to_pdfa("in.pdf", os.path.join(d, "out.pdf"))
        self.assertIn("dönüştürülemedi", str(c.exception))


@unittest.skipUnless(
    __import__("importlib").util.find_spec("pdftopdfa"), "pdftopdfa kurulu değil"
)
class PdfaGercekDonusumTest(unittest.TestCase):
    def test_gercek_belge_pdfa_isaretlenir(self):
        import pikepdf

        with tempfile.TemporaryDirectory() as d:
            kaynak = os.path.join(d, "k.pdf")
            cikti = os.path.join(d, "o.pdf")
            pdf = pikepdf.new()
            pdf.add_blank_page(page_size=(200, 200))
            pdf.save(kaynak)
            bilgi = ptx.pdf_to_pdfa(kaynak, cikti, surum="2b")
            self.assertEqual(bilgi["surum"], "2b")
            with pikepdf.open(cikti) as p:
                ham = bytes(p.Root.Metadata.read_bytes()).decode("utf-8", "ignore")
            self.assertIn("pdfaid", ham)


if __name__ == "__main__":
    unittest.main()

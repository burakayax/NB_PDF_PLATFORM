"""
PDF/A DÖNÜŞÜMÜ.

Ghostscript her ortamda kurulu olmadığı için gerçek dönüşüm yerine DOĞRU KOMUTUN
kurulduğu ve hata yollarının doğru davrandığı sabitlenir. Burada korunan en
kritik ayar `-dPDFACompatibilityPolicy=1`: bu değer olmadan Ghostscript, PDF/A'ya
aykırı öğeleri dosyada BIRAKIR ve çıktı PDF/A sayılmaz — kullanıcı uyumlu
sandığı bir belgeyi kuruma gönderir, kurum reddeder.
"""

import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src import pdf_toolkit_extra as ptx


class PdfaKomutTest(unittest.TestCase):
    def komut(self, surum="2b", icc_var=True):
        return ptx.pdfa_komutu("gs", surum, "/tmp/def.ps", "/tmp/in.pdf", "/tmp/out.pdf", icc_var)

    def test_aykiri_ogeler_atilir(self):
        # Bu bayrak düşerse çıktı sessizce PDF/A olmaktan çıkar.
        self.assertIn("-dPDFACompatibilityPolicy=1", self.komut())

    def test_surum_numarasi_dogru_gecilir(self):
        self.assertIn("-dPDFA=1", self.komut("1b"))
        self.assertIn("-dPDFA=2", self.komut("2b"))
        self.assertIn("-dPDFA=3", self.komut("3b"))

    def test_tanim_dosyasi_girdiden_ONCE_gelir(self):
        # Ghostscript tanım dosyasını girdiden önce işlemelidir; sıra bozulursa
        # çıktı niyeti belgeye eklenmez.
        k = self.komut()
        self.assertLess(k.index("/tmp/def.ps"), k.index("/tmp/in.pdf"))

    def test_icc_varken_rgb_yoksa_cihazdan_bagimsiz(self):
        self.assertIn("-sColorConversionStrategy=RGB", self.komut(icc_var=True))
        self.assertIn(
            "-sColorConversionStrategy=UseDeviceIndependentColor",
            self.komut(icc_var=False),
        )

    def test_pdfwrite_cihazi_kullanilir(self):
        self.assertIn("-sDEVICE=pdfwrite", self.komut())


class PdfaTanimDosyasiTest(unittest.TestCase):
    def test_icc_varsa_cikti_niyeti_yazilir(self):
        with tempfile.TemporaryDirectory() as d:
            icc = os.path.join(d, "srgb.icc")
            open(icc, "wb").write(b"\x00")
            yol = ptx._pdfa_tanim_dosyasi(d, icc)
            icerik = open(yol, encoding="utf-8").read()
            self.assertIn("/OutputIntent", icerik)
            self.assertIn("/DestOutputProfile", icerik)

    def test_ters_boluler_duzeltilir(self):
        # PostScript'te ters bölü kaçış karakteridir; Windows yolu bozulmamalı.
        with tempfile.TemporaryDirectory() as d:
            yol = ptx._pdfa_tanim_dosyasi(d, "C:\\profiller\\srgb.icc")
            icerik = open(yol, encoding="utf-8").read()
            self.assertIn("C:/profiller/srgb.icc", icerik)
            self.assertNotIn("\\profiller", icerik)

    def test_icc_yoksa_niyet_yazilmaz(self):
        with tempfile.TemporaryDirectory() as d:
            icerik = open(ptx._pdfa_tanim_dosyasi(d, None), encoding="utf-8").read()
            self.assertNotIn("/OutputIntent", icerik)


class PdfaDonusumTest(unittest.TestCase):
    def test_gecersiz_surum_reddedilir(self):
        with self.assertRaises(Exception) as c:
            ptx.pdf_to_pdfa("in.pdf", "out.pdf", surum="4x")
        self.assertIn("1b", str(c.exception))

    def test_ghostscript_yoksa_anlasilir_hata(self):
        with patch.object(ptx.shutil, "which", return_value=None):
            with self.assertRaises(Exception) as c:
                ptx.pdf_to_pdfa("in.pdf", "out.pdf")
            self.assertIn("Ghostscript", str(c.exception))

    def test_bos_cikti_basarili_sayilmaz(self):
        # Ghostscript 0 dönse bile üretilen dosya boşsa işlem başarısızdır.
        class SahteProc:
            returncode = 0
            stderr = b""

        with tempfile.TemporaryDirectory() as d:
            cikti = os.path.join(d, "out.pdf")
            open(cikti, "wb").write(b"kisa")
            with patch.object(ptx.shutil, "which", return_value="gs"), patch.object(
                ptx, "_icc_profili_bul", return_value=None
            ), patch.object(ptx.subprocess, "run", return_value=SahteProc()):
                with self.assertRaises(Exception) as c:
                    ptx.pdf_to_pdfa("in.pdf", cikti)
            self.assertIn("dönüştürülemedi", str(c.exception))

    def test_icc_yoksa_kullaniciya_uyari_dondurulur(self):
        class SahteProc:
            returncode = 0
            stderr = b""

        with tempfile.TemporaryDirectory() as d:
            cikti = os.path.join(d, "out.pdf")

            def sahte_run(komut, **kw):
                open(cikti, "wb").write(b"%PDF-1.7\n" + b"x" * 200)
                return SahteProc()

            with patch.object(ptx.shutil, "which", return_value="gs"), patch.object(
                ptx, "_icc_profili_bul", return_value=None
            ), patch.object(ptx.subprocess, "run", side_effect=sahte_run):
                sonuc = ptx.pdf_to_pdfa("in.pdf", cikti)
            self.assertFalse(sonuc["cikti_niyeti"])
            self.assertIsNotNone(sonuc["uyari"])

    def test_basarili_donusumde_surum_bildirilir(self):
        class SahteProc:
            returncode = 0
            stderr = b""

        with tempfile.TemporaryDirectory() as d:
            cikti = os.path.join(d, "out.pdf")
            icc = os.path.join(d, "srgb.icc")
            open(icc, "wb").write(b"\x00")

            def sahte_run(komut, **kw):
                open(cikti, "wb").write(b"%PDF-1.7\n" + b"x" * 200)
                return SahteProc()

            with patch.object(ptx.shutil, "which", return_value="gs"), patch.object(
                ptx, "_icc_profili_bul", return_value=icc
            ), patch.object(ptx.subprocess, "run", side_effect=sahte_run):
                sonuc = ptx.pdf_to_pdfa("in.pdf", cikti, surum="3b")
            self.assertEqual(sonuc["surum"], "3b")
            self.assertTrue(sonuc["cikti_niyeti"])
            self.assertIsNone(sonuc["uyari"])


if __name__ == "__main__":
    unittest.main()

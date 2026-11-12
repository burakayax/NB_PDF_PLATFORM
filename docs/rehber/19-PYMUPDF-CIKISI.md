# 19 — PyMuPDF'den çıkış (lisans maliyeti)

PyMuPDF (AGPL, ticari lisans ≈ 5000 $/yıl) kod tabanından çıkarıldı. Yerine yalnızca izinli lisanslı kütüphaneler kullanıldı:
pypdfium2 (çizim/metin/arama), pikepdf (yapı + içerik akışı), reportlab (yeni metin/çizim bindirme), pypdf, pdfplumber, pytesseract, img2pdf, fonttools.

## Ne değişti
- Ortak çekirdek: `src/pdfcore/` (kendi içerik akışı yorumlayıcısı: harf konumu, silme, yazı tipi).
- PDF Düzenle, Gizle (redact), Döndür/Sil/Sırala, Sıkıştır, Onar, metin/görsel çıkarma: PyMuPDF'siz.
- Word'e dönüştürme (dijital PDF): `src/pdf_to_docx_digital.py` (pdf2docx kaldırıldı; pdf2docx PyMuPDF istiyordu).
  Taranmış PDF'ler eskisi gibi OCR hattına gider. Tablolu PDF'ler eskisi gibi tablo yolundan geçer.
- Testler ve video örnek belge üreticisi PyMuPDF'siz (`web/backend/tests/minifitz.py`).

## Canlıya alırken
1. Sunucu paket listesi güncel: `pymupdf` ve `pdf2docx` yok; `pypdfium2`, `img2pdf`, `fonttools` var.
2. Masaüstü paketi (`packaging/nb_pdf_tools.spec`): pdf2docx çıkarıldı; pypdfium2 otomatik toplanır, gerekirse hiddenimports'a ekle.
3. Canlıya almadan önce Word dönüştürmeyi birkaç gerçek PDF ile elle dene (CV, form, rapor).

## Geri alma
Bu dalın (`calisma/pymupdf-cikis`) merge'ü geri alınırsa `requirements.txt` dosyalarına `pymupdf` ve `pdf2docx` yeniden eklenmelidir.

## Hâlâ kalan lisans gri alanı
- Poppler (GPL) KALDIRILDI: PDF→Görsel ve PDF→PowerPoint artık pdfium ile sayfa çiziyor (pdf2image bağımlılığı, Docker/CI poppler-utils paketi çıkarıldı).
- Ghostscript (AGPL) KALDIRILDI (2026-11-12): sıkıştırma yalnız pikepdf (+ taranmış belgede pdfium sayfa-render); PDF/A artık `pdftopdfa` (MPL-2.0+) ile (yalnız 2b/3b; 1b kalktı). Kullanılmayan `ocrmypdf` bağımlılığı da silindi (OCR zaten Tesseract/pytesseract). Örnek 11 belge veraPDF ile doğrulandı: dönüştürülmemiş kontrol dosyaları KALDI, dönüştürülenlerin hepsi GEÇTİ. Bilinen fark: ağır sıkıştırmada Ghostscript bazı dosyalarda pikepdf'ten daha çok küçültüyordu; bu kazanç kayboldu. Geri alma: Dockerfile'a `ghostscript` ekleyip bu commit'i geri al.

## Ölçümler (2026-11-11)
- Word (kendi dönüştürücü / eski pdf2docx, görsel benzerlik, LibreOffice ile geri açılarak): matematik sınav kâğıdı 0,987/0,978; fatura 0,983/0,946; vergi levhası 0,988/0,943; 6 sayfalık yazılı 0,981/0,953; 12 sayfalık denetim raporu 0,961/0,917 (sayfa sayısı 12/18, orijinal 12). Yeni motor 13 dosyanın 12'sinde eşit/daha iyi görsel verdi; pdf2docx'in önde olduğu tek dosya (Güneş Sistemi, 0,993/0,995) fark ihmal edilebilir.
- Metin eşleşmesi iki motorda da düşük kalan dosyalar: matematik kâğıdı (0,70/0,76), vergi levhası (0,58/0,63), vergi.pdf (0,54/0,54) — formül/özel yazı tipi/tablo düzeni; sorun yeni motora özgü değil.
- Hız (204 sayfa, 5,3 MB): PDF→Word 158 sn (≈0,8 sn/sayfa, eski motordan yavaş), PDF→Görsel 6,7 sn, PDF→PPT 77 sn, Sıkıştır 5,5 sn. Tepe bellek 233–313 MB (sunucu 512 MB).
- Poppler yerine pdfium (150 DPI): aynı piksel boyutu, görsel benzerlik 0,991–0,999, sayfa başına ≈0,01 sn (Poppler ≈0,2 sn).

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
- Ghostscript (AGPL) hâlâ sunucuda ayrı program olarak çağrılıyor (sıkıştırma + ocrmypdf). Kesin hukuki görüş için avukata danışılmalı; sıkıştırmada pikepdf+pdfium yolu zaten var.

"""pdfcore — PyMuPDF (AGPL) içermeyen, yalnız izinli (BSD/Apache/MPL/MIT) kütüphanelerle PDF çekirdeği.

Katmanlar:
  pdfium_io : sayfa → görüntü, metin, boyut, görsel sayısı  (pypdfium2 / PDFium)
  pages     : açma, ayıklama, sıralama, birleştirme, döndürme, yer imleri  (pikepdf / qpdf)
  overlay   : sayfa üstüne metin/görsel/çizgi/bağlantı bindirme  (reportlab + pikepdf)
"""

from . import overlay, pages
from .errors import (
    MSG_NEED_PASSWORD,
    MSG_WRONG_PASSWORD,
    PdfCoreError,
    PdfPasswordRequired,
    PdfPasswordWrong,
)
from .pdfium_io import (
    PdfiumReader,
    pdfium_lock,
    pdfium_page_count,
    pdfium_text_stats,
    render_pdf_pages,
)

__all__ = [
    "MSG_NEED_PASSWORD", "MSG_WRONG_PASSWORD",
    "PdfCoreError", "PdfPasswordRequired", "PdfPasswordWrong",
    "PdfiumReader", "pdfium_lock", "pdfium_page_count", "pdfium_text_stats", "render_pdf_pages",
    "overlay", "pages",
]

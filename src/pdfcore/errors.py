"""pdfcore hata iletileri.

Mesajlar, eski PyMuPDF tabanlı kodun kullandığı Türkçe metinlerle BİREBİR aynıdır:
`web/backend/app/core/tool_errors.py` bu metinleri tanıyıp kullanıcıya doğru hata
kodunu döndürür. Metni değiştirirsen o dosyayı da güncelle.
"""

from __future__ import annotations

MSG_NEED_PASSWORD = "Şifreli PDF için parola gerekli."
MSG_WRONG_PASSWORD = "Girilen PDF parolası hatalı."


class PdfCoreError(Exception):
    """pdfcore'un fırlattığı genel hata (iletisi kullanıcıya gösterilebilir).

    `corrupt`: dosya bozuk/geçersiz biçimde (PDFium "Data format error" / "File not found or
    could not be opened") — şifreli olduğu anlamına GELMEZ.
    """

    def __init__(self, message: str = "", *, corrupt: bool = False) -> None:
        super().__init__(message)
        self.corrupt = corrupt


class PdfPasswordRequired(PdfCoreError):
    """Dosya açılış parolası istiyor ve parola verilmedi."""

    def __init__(self, message: str = MSG_NEED_PASSWORD) -> None:
        super().__init__(message)


class PdfPasswordWrong(PdfCoreError):
    """Verilen açılış parolası yanlış."""

    def __init__(self, message: str = MSG_WRONG_PASSWORD) -> None:
        super().__init__(message)

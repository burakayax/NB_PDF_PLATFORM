"""İstemciye güvenli, marka uyumlu hata metinleri.

Ham Python yığını, dosya yolu veya dahili kitaplık ayrıntıları asla döndürülmez.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# Okuma/bozukluk vb. için parola varsayımı yapılmaz.
GENERIC_TOOL_FAILURE_TR = (
    "İşlem başarısız: PDF okunamadı veya dosya desteklenmiyor. "
    "Dosyayı yeniden kaydedip deneyin; sorun sürerse günlükteki ayrıntıya bakın."
)
GENERIC_PASSWORD_OR_CORRUPT_TR = "İşlem başarısız: Parola hatalı veya dosya bozuk."
WRONG_PASSWORD_TR = (
    "Parola hatalı. Belgeyi açan parolayı kontrol edip yeniden deneyin."
)
MISSING_PASSWORD_TR = (
    "Bu PDF parola korumalı. Devam etmek için belgeyi açan parolayı girin."
)


def _password_message(msg: str) -> str | None:
    r"""Parola hatalarını, kitaplığın İngilizce metni ve dosya yolu içerse bile tanır.

    pikepdf ve PyMuPDF parola hatasını dosya yolunu içeren İngilizce bir metinle
    bildirir (ör. ``C:\...\belge.pdf: invalid password``). Yol içerdiği için bu
    metin "dahili ayrıntı" sayılıp genel hataya düşüyordu; kullanıcı sunucu
    parolanın yanlış olduğunu bildiği hâlde "dosya okunamadı" görüyordu.
    """
    low = msg.lower()
    wrong = (
        "invalid password",
        "incorrect password",
        "wrong password",
        "bad password",
        "şifre hatalı",
        "parolası hatalı",
        "parola hatalı",
        "girilen pdf parolası",
    )
    missing = (
        "password required",
        "password is required",
        "parolası gerekli",
        "parola gerekli",
        "şifre gerekli",
    )
    if any(k in low for k in wrong):
        return WRONG_PASSWORD_TR
    if any(k in low for k in missing):
        return MISSING_PASSWORD_TR
    # PyMuPDF tek metinde ikisini birden söyler: "parolası gerekli veya hatalı".
    if "parola" in low and "hatalı" in low:
        return WRONG_PASSWORD_TR
    return None

# Eksik altyapı (nadiren).
INFRA_MISSING_TR = "İşlem başarısız: Sunucu yapılandırması eksik. Lütfen daha sonra tekrar deneyin."


def _looks_like_path_or_internal(msg: str) -> bool:
    if not msg:
        return True
    lower = msg.lower()
    if "traceback" in lower or "file \"" in lower:
        return True
    if re.search(r"[a-z]:\\", lower) or "/tmp/" in lower or "\\\\" in msg:
        return True
    if ".pdf" in lower and ("/" in msg or "\\" in msg):
        return True
    return False


def public_message_for_exception(exc: BaseException, *, log_full: bool = False) -> str:
    """Araç ve beklenmeyen hatalar için istemci güvenli Türkçe özet."""
    if log_full:
        logger.exception("pdf_tool_failure", exc_info=exc)

    text = str(exc).strip()
    low = text.lower()

    if "pycryptodome" in low or "aes algorithm" in low:
        return "İşlem başarısız: Şifreli PDF için ek bileşen gerekli. Yöneticiyle iletişime geçin."

    if "iptal edildi" in low:
        return "İşlem iptal edildi."

    # Parola kontrolü, "dahili ayrıntı" elemesinden ÖNCE gelmeli: kitaplıkların
    # parola hatası metni dosya yolu içerdiği için aksi hâlde eleniyor ve
    # kullanıcı sebebi öğrenemiyor.
    password_msg = _password_message(text)
    if password_msg:
        return password_msg

    if "gerekli" in low and ("pip install" in low or "kurulum" in low):
        return INFRA_MISSING_TR

    if _looks_like_path_or_internal(text):
        return GENERIC_TOOL_FAILURE_TR

    # pdf_engine ve benzeri: [PdfReadError] kısa teknik özet (yol içermez).
    if text.startswith("[") and "]" in text[:40] and len(text) <= 260:
        return text

    if len(text) > 260:
        return GENERIC_TOOL_FAILURE_TR

    if (
        "şifre hatalı" in low
        or "parolası hatalı" in low
        or "girilen pdf parolası" in low
        or ("şifreli" in low and "lütfen" in low and "şifre" in low)
    ):
        return GENERIC_PASSWORD_OR_CORRUPT_TR

    # Kısa, bilinçli HTTP/validasyon iletisine izin ver (ör. "PPT veya PPTX yükleyin.").
    if len(text) < 120 and not re.search(r"[A-Za-z]:[/\\]", text):
        return text

    if len(text) <= 260:
        return text

    return GENERIC_TOOL_FAILURE_TR

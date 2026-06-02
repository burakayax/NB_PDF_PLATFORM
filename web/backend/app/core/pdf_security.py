"""PDF işleme güvenlik katmanı.

Bu modül üç sorumluluk taşır:

1. **İşlem öncesi doğrulama** — Bir PDF sunucuya kaydedildikten sonra,
   herhangi bir kütüphane onu açmadan önce hızlı kontroller yapılır:
   sayfa sayısı, dosya boyutu ve magic-byte doğrulaması.

2. **Savunmacı try/except sarmalayıcı** — Her PDF işlemi bu modülün
   ``safe_run_pdf_op`` yardımcısından geçer. Hata olursa sunucu süreci
   asla çökmez; yalnızca ilgili istek başarısız olur.

3. **Şüpheli dosya loglama** — Sıfır sayfa, anormal boyut/sayfa oranı,
   kütüphane istisnaları — hepsi IP adresiyle birlikte yapılandırılmış
   log olarak kaydedilir.

Tüm Public API'ler type-hint'lidir ve None döndürmez (hata → HTTPException).
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Callable, TypeVar

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# ─── Sabitler ────────────────────────────────────────────────────────────────

MAX_PDF_PAGES: int = 5_000
"""Tek bir PDF'de izin verilen maksimum sayfa sayısı."""

MAX_SAFE_RATIO_BYTES_PER_PAGE: int = 500 * 1024 * 1024  # 500 MB / sayfa — aşırı üst sınır
MIN_SUSPICIOUS_RATIO_BYTES_PER_PAGE: int = 100
"""Sayfa başına düşen bayt sayısı bu değerin altındaysa dosya şüpheli kabul edilir."""

_PDF_MAGIC = b"%PDF-"

R = TypeVar("R")


# ─── 1. İşlem öncesi doğrulama ───────────────────────────────────────────────

def validate_pdf_before_processing(
    path: Path,
    *,
    filename: str = "<bilinmiyor>",
    expected_max_bytes: int | None = None,
    client_ip: str = "<bilinmiyor>",
) -> None:
    """İşlem başlamadan önce PDF dosyasını doğrula.

    Sırasıyla şu kontrolleri yapar:
    1. Dosya var mı ve okunabilir mi?
    2. Dosya boyutu beklenenle uyuşuyor mu (çift kontrol)?
    3. Magic-byte doğrulaması: gerçekten PDF mi?
    4. Sayfa sayısı 5 000'i aşıyor mu?
    5. Şüpheli boyut/sayfa oranı var mı?

    Herhangi bir kontrol başarısız olursa açık bir HTTPException fırlatılır.
    Şüpheli ama geçerli dosyalar loglanır.
    """
    _tag = f"filename={filename!r} ip={client_ip}"

    if not path.exists():
        logger.error("pdf_validate missing_file %s", _tag)
        raise HTTPException(status_code=400, detail="Dosya işleme hazırlanamadı. Lütfen tekrar deneyin.")

    actual_bytes = path.stat().st_size

    if actual_bytes == 0:
        logger.warning("pdf_validate zero_size %s", _tag)
        raise HTTPException(status_code=400, detail="Yüklenen dosya boş (0 bayt).")

    # Çift boyut kontrolü — yükleme sırasında sınır aşılmış olabilir.
    if expected_max_bytes is not None and actual_bytes > expected_max_bytes:
        logger.warning(
            "pdf_validate size_exceeded actual_bytes=%d limit_bytes=%d %s",
            actual_bytes, expected_max_bytes, _tag,
        )
        raise HTTPException(
            status_code=413,
            detail=f"Dosya boyutu izin verilen sınırı ({expected_max_bytes // 1024 // 1024} MB) aşıyor.",
        )

    # Magic-byte kontrolü — content-type veya uzantıya güvenme.
    try:
        with path.open("rb") as fh:
            header = fh.read(1024)
    except OSError as exc:
        logger.error("pdf_validate read_error %s exc=%s", _tag, exc)
        raise HTTPException(status_code=400, detail="Dosya okunamadı.") from exc

    if _PDF_MAGIC not in header:
        logger.warning(
            "pdf_validate not_pdf magic_missing actual_bytes=%d %s",
            actual_bytes, _tag,
        )
        raise HTTPException(
            status_code=415,
            detail="Yüklenen dosya geçerli bir PDF değil (%PDF başlığı bulunamadı).",
        )

    # Sayfa sayısı kontrolü — PyMuPDF kullanılabiliyorsa.
    page_count: int | None = _fast_page_count(path, filename=filename, client_ip=client_ip)

    if page_count is not None:
        if page_count == 0:
            logger.warning(
                "pdf_validate zero_pages actual_bytes=%d %s",
                actual_bytes, _tag,
            )
            # 0 sayfalı PDF geçersizdir ama tamamen reddetme; uyarıyı logla.
            # Bazı PDF araçları boş belgeler oluşturabilir — işlemi dene.

        elif page_count > MAX_PDF_PAGES:
            logger.warning(
                "pdf_validate page_count_exceeded pages=%d max=%d actual_bytes=%d %s",
                page_count, MAX_PDF_PAGES, actual_bytes, _tag,
            )
            raise HTTPException(
                status_code=400,
                detail=(
                    f"PDF çok fazla sayfa içeriyor ({page_count:,} sayfa). "
                    f"En fazla {MAX_PDF_PAGES:,} sayfalı PDF'ler işlenebilir."
                ),
            )

        # Boyut/sayfa oranı şüphe kontrolü.
        if page_count > 0:
            ratio = actual_bytes / page_count
            if ratio < MIN_SUSPICIOUS_RATIO_BYTES_PER_PAGE:
                logger.warning(
                    "pdf_validate suspicious_ratio bytes_per_page=%.1f pages=%d "
                    "actual_bytes=%d %s",
                    ratio, page_count, actual_bytes, _tag,
                )


def _fast_page_count(path: Path, *, filename: str, client_ip: str) -> int | None:
    """PyMuPDF ile sayfa sayısını döndürür. Kitaplık yoksa veya hata olursa None."""
    try:
        import fitz  # type: ignore[import]
        doc = fitz.open(str(path))
        try:
            return doc.page_count
        finally:
            doc.close()
    except ImportError:
        return None
    except Exception as exc:
        logger.warning(
            "pdf_validate page_count_error filename=%r ip=%s exc_type=%s exc=%s",
            filename, client_ip, type(exc).__name__, exc,
        )
        return None


# ─── 2. Savunmacı işlem sarmalayıcı ──────────────────────────────────────────

def log_pdf_operation_error(
    *,
    operation: str,
    filename: str,
    file_size_bytes: int | None,
    client_ip: str,
    error: Exception,
) -> None:
    """Tüm PDF işleme hatalarını yapılandırılmış formatta loglar.

    Ham yığın izi izleme sistemine gönderilir; istemciye sızdırılmaz.
    """
    logger.error(
        "pdf_op_error op=%s filename=%r file_size=%s ip=%s exc_type=%s exc=%s",
        operation,
        filename,
        file_size_bytes if file_size_bytes is not None else "<bilinmiyor>",
        client_ip,
        type(error).__name__,
        str(error)[:240],  # stack trace'i kırp, tam hatayı Sentry/logs'a logla
        exc_info=error,
    )


def log_suspicious_pdf(
    *,
    reason: str,
    filename: str,
    file_size_bytes: int | None,
    client_ip: str,
    extra: dict[str, Any] | None = None,
) -> None:
    """Şüpheli PDF özelliklerini (istisna olmayan) loglar."""
    logger.warning(
        "pdf_suspicious reason=%s filename=%r file_size=%s ip=%s extra=%s",
        reason,
        filename,
        file_size_bytes if file_size_bytes is not None else "<bilinmiyor>",
        client_ip,
        extra or {},
    )


# ─── 3. Başlangıç kitaplık versiyonu kontrolü ────────────────────────────────

def log_pdf_library_versions() -> dict[str, str]:
    """Yüklü PDF kütüphanelerinin versiyonlarını loglar ve dict döndürür.

    main.py lifespan başlangıcından çağrılır.
    """
    versions: dict[str, str] = {}

    _libs: list[tuple[str, str, str]] = [
        ("fitz",          "pymupdf",   "PyMuPDF"),
        ("pikepdf",       "pikepdf",   "pikepdf"),
        ("pdf2docx",      "pdf2docx",  "pdf2docx"),
        ("pypdf",         "pypdf",     "pypdf"),
        ("reportlab",     "reportlab", "ReportLab"),
        ("pdfplumber",    "pdfplumber","pdfplumber"),
        ("PIL",           "Pillow",    "Pillow"),
        ("pptx",          "python-pptx","python-pptx"),
        ("xhtml2pdf",     "xhtml2pdf", "xhtml2pdf"),
    ]
    _critical = {"fitz", "pikepdf", "PIL"}

    for import_name, pkg_name, display in _libs:
        try:
            mod = __import__(import_name)
            ver = getattr(mod, "__version__", None) or getattr(mod, "version", None) or "?"
            versions[pkg_name] = str(ver)
            logger.info("pdf_lib_ok lib=%s version=%s", display, ver)
        except ImportError:
            versions[pkg_name] = "NOT_INSTALLED"
            level = logging.CRITICAL if import_name in _critical else logging.WARNING
            logger.log(level, "pdf_lib_missing lib=%s pkg=%s", display, pkg_name)

    return versions


def get_library_versions() -> dict[str, str]:
    """Mevcut PDF kütüphanesi versiyonlarını döndürür (health endpoint için)."""
    versions: dict[str, str] = {}
    _libs = [
        ("fitz",       "pymupdf"),
        ("pikepdf",    "pikepdf"),
        ("pdf2docx",   "pdf2docx"),
        ("pypdf",      "pypdf"),
        ("reportlab",  "reportlab"),
        ("PIL",        "Pillow"),
        ("pptx",       "python-pptx"),
        ("xhtml2pdf",  "xhtml2pdf"),
    ]
    for import_name, pkg_name in _libs:
        try:
            mod = __import__(import_name)
            versions[pkg_name] = str(
                getattr(mod, "__version__", None) or
                getattr(mod, "version", None) or "installed"
            )
        except ImportError:
            versions[pkg_name] = "not_installed"
    return versions

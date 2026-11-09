"""Çıktı markalama: herkese görünmez PDF metadata + ücretsiz/Starter planda
görünür filigran.

Bu mantık bilerek paylaşılan masaüstü motorunda (``src/pdf_engine.py``) değil,
yalnızca web servisinde durur — masaüstü çıktıları markasız kalır. Tüm işlevler
hata durumunda non-fatal'dır: markalama başarısız olsa bile kullanıcının dosyası
teslim edilir.
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

BRAND_NAME = "PDF PLATFORM"
BRAND_SITE = "pdfplatform.app"
BRAND_URL = f"https://{BRAND_SITE}"
_PRODUCER = f"{BRAND_NAME} ({BRAND_SITE})"
# Görünür alt bilgi markası (ücretsiz/Starter). Her sayfanın alt-sağına işlenir.
# İki parça: gri açıklama + mavi TIKLANABİLİR site adı. Alıcı belgeyi açtığında
# hangi araçla üretildiğini görüp siteye yönelir.
# NOT: helv (base14 Helvetica/WinAnsi) Türkçe ş/ğ/ı glyph'lerini taşımadığından
# metni bilerek ASCII tutuyoruz; aksi halde glyph'ler bozuk çıkar.
_FOOTER_PREFIX = "Created with PDF Platform  ·  "
_FOOTER_LINK = BRAND_SITE
_FOOTER_GRAY = (0.46, 0.46, 0.46)
_FOOTER_BLUE = (0.10, 0.45, 0.85)


def brand_pdf_output(p: Path | str, *, watermark_enabled: bool) -> None:
    """Çıktı markalaması — tek adımda, non-fatal.

    - **Metadata (her plan):** Producer/Creator/Author = "PDF PLATFORM".
      Görünmez, dosyayla taşınır.
    - **Görünür alt bilgi (yalnızca ``watermark_enabled``):** Her sayfanın
      sağ-altına soluk gri "Created with PDF Platform · " + mavi, TIKLANABİLİR
      "pdfplatform.app" (siteye giden bağlantı).

    Dosya önce geçici bir dosyaya yazılır, sonra yerine konur: yazma yarıda kesilirse
    kullanıcının dosyası bozulmaz.
    """
    import os as _os

    try:
        from src.pdfcore import overlay as _ov
        from src.pdfcore import pages as _pc
    except Exception:  # pragma: no cover - çekirdek her zaman var
        logger.warning("branding atlandı: pdfcore import edilemedi")
        return

    doc = None
    tmp = Path(p).parent / (Path(p).stem + "__brand_tmp.pdf")
    try:
        doc = _pc.open_pdf(str(p))
        page_count = len(doc.pages)

        if watermark_enabled:
            fs = 9  # alt bilgi boyutu — sayfa içeriğini örtmeyen, okunur footer
            margin_x = 36  # sağ kenardan ~0.5 inç
            margin_y = 22  # alt kenardan
            # Parça genişlikleri — sağa yaslamak ve link kutusunu konumlamak için.
            prefix_w = _ov.text_width(_FOOTER_PREFIX, "helv", fs)
            link_w = _ov.text_width(_FOOTER_LINK, "helv", fs)
            total_w = prefix_w + link_w

            def _footer(cv: "_ov.Canvas2D") -> None:
                # Sağ-alt köşeye yasla: link metninin sağ kenarı ~ sayfa sağ kenarı.
                x0 = cv.width - margin_x - total_w
                y = cv.height - margin_y
                # Gri açıklama parçası ("Created with PDF Platform · ").
                cv.text(x0, y, _FOOTER_PREFIX, font="helv", size=fs, color=_FOOTER_GRAY, alpha=0.92)
                # Mavi, tıklanabilir site adı ("pdfplatform.app").
                link_x = x0 + prefix_w
                cv.text(link_x, y, _FOOTER_LINK, font="helv", size=fs, color=_FOOTER_BLUE, alpha=0.96)
                # Sadece site adının üstüne siteye giden tıklanabilir link alanı.
                try:
                    cv.link((link_x, y - fs, link_x + link_w, y + fs * 0.3), BRAND_URL)
                except Exception as link_exc:  # link annotation non-fatal
                    logger.debug("watermark link eklenemedi: %s", link_exc)

            _ov.stamp_pages(doc, {i: _footer for i in range(page_count)})

        # Metadata — her plan.
        info = doc.docinfo
        info["/Producer"] = _PRODUCER
        info["/Creator"] = _PRODUCER
        if not str(info.get("/Author", "") or "").strip():
            info["/Author"] = BRAND_NAME

        _pc.save_pdf(doc, str(tmp))
        doc.close()
        doc = None
        _os.replace(str(tmp), str(p))
        logger.info(
            "merge branding tamam: watermark=%s pages=%s path=%s",
            watermark_enabled, page_count, p,
        )
    except Exception as exc:
        logger.warning("merge branding başarısız (non-fatal): %s", exc)
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass

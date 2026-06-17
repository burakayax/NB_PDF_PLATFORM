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
    """Çıktı markalaması — tek fitz adımında, non-fatal.

    - **Metadata (her plan):** Producer/Creator/Author = "PDF PLATFORM".
      Görünmez, dosyayla taşınır.
    - **Görünür filigran (yalnızca ``watermark_enabled``):** Her sayfanın
      ortasına soluk gri "PDF PLATFORM · pdfplatform.app" + aynı alana siteye
      giden TIKLANABİLİR link açıklaması.

    Incremental save kullanır: tüm dosyayı yeniden yazmaz, küçük bir revizyon
    ekler; büyük merge çıktısında bile ucuzdur.
    """
    try:
        import fitz
    except Exception:  # pragma: no cover - fitz her zaman var
        logger.warning("branding atlandı: fitz import edilemedi")
        return

    doc = None
    try:
        doc = fitz.open(str(p))
        page_count = doc.page_count

        if watermark_enabled:
            fs = 9  # alt bilgi boyutu — sayfa içeriğini örtmeyen, okunur footer
            margin_x = 36  # sağ kenardan ~0.5 inç
            margin_y = 22  # alt kenardan
            # Parça genişlikleri — sağa yaslamak ve link kutusunu konumlamak için.
            try:
                prefix_w = fitz.get_text_length(_FOOTER_PREFIX, fontname="helv", fontsize=fs)
                link_w = fitz.get_text_length(_FOOTER_LINK, fontname="helv", fontsize=fs)
            except Exception:
                prefix_w = fs * len(_FOOTER_PREFIX) * 0.5
                link_w = fs * len(_FOOTER_LINK) * 0.5
            total_w = prefix_w + link_w
            for page in doc:
                r = page.rect
                # Sağ-alt köşeye yasla: link metninin sağ kenarı ~ sayfa sağ kenarı.
                x0 = r.x1 - margin_x - total_w
                y = r.y1 - margin_y
                # Gri açıklama parçası ("Created with PDF Platform · ").
                page.insert_text(
                    fitz.Point(x0, y),
                    _FOOTER_PREFIX,
                    fontname="helv",
                    fontsize=fs,
                    color=_FOOTER_GRAY,
                    fill_opacity=0.92,
                )
                # Mavi, tıklanabilir site adı ("pdfplatform.app").
                link_x = x0 + prefix_w
                page.insert_text(
                    fitz.Point(link_x, y),
                    _FOOTER_LINK,
                    fontname="helv",
                    fontsize=fs,
                    color=_FOOTER_BLUE,
                    fill_opacity=0.96,
                )
                # Sadece site adının üstüne siteye giden tıklanabilir link alanı.
                link_rect = fitz.Rect(link_x, y - fs, link_x + link_w, y + fs * 0.3)
                try:
                    page.insert_link(
                        {"kind": fitz.LINK_URI, "from": link_rect, "uri": BRAND_URL}
                    )
                except Exception as link_exc:  # link annotation non-fatal
                    logger.debug("watermark link eklenemedi: %s", link_exc)

        # Metadata — her plan.
        md = dict(doc.metadata or {})
        md["producer"] = _PRODUCER
        md["creator"] = _PRODUCER
        if not str(md.get("author") or "").strip():
            md["author"] = BRAND_NAME
        doc.set_metadata(md)

        try:
            doc.save(str(p), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
        except Exception as inc_exc:
            # Incremental bazı kaynaklarda (örn. pikepdf çıktısı) başarısız olur;
            # geçici dosyaya tam kayıt + replace ile garanti altına al.
            logger.info("incremental save başarısız, tam kayda düşülüyor: %s", inc_exc)
            import os as _os
            tmp = Path(p).parent / (Path(p).stem + "__brand_tmp.pdf")
            doc.save(str(tmp), garbage=3, deflate=True)
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

"""Blurred first-page thumbnail generation for PDF results.

The thumbnail is the only part of the output the client sees before paying
(or using a credit / active subscription). It is intentionally *lossy* —
blurred, downscaled, watermarked — so the preview cannot be reconstructed
into the full document.

Renders with pypdfium2 (PDFium); Pillow handles the blur + watermark overlay.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import Optional, Union

logger = logging.getLogger(__name__)

_RENDER_DPI = 160
_TARGET_WIDTH_PX = 480
_BLUR_RADIUS_PX = 6
_WATERMARK_TEXT = "PREVIEW"
_HERO_TARGET_WIDTH_PX = 1400
_HERO_RENDER_DPI = 200
_HERO_WATERMARK = "NB GLOBAL STUDIO"


def _render_page_image(src: object, index: int, dpi: float, password: Optional[str] = None):
    """pdfium ile `index`. sayfayı RGB PIL görüntüsüne çevirir. Başarısızsa None.

    `src`: dosya yolu ya da bayt dizisi. Parola korumalı belge ARIZA DEĞİL, beklenen
    durumdur (şifreleme aracının çıktısı gibi): önizleme atlanır ve hata izleme
    sistemine "istisna" olarak düşmez.
    """
    from src.pdfcore import PdfiumReader
    from src.pdfcore.errors import PdfPasswordRequired, PdfPasswordWrong

    try:
        reader = PdfiumReader(src, password)
    except (PdfPasswordRequired, PdfPasswordWrong):
        logger.info("preview_thumbnail: belge parola korumalı, önizleme atlandı")
        return None
    except Exception:
        logger.exception("preview_thumbnail: failed to open PDF")
        return None
    try:
        if len(reader) < 1:
            return None
        return reader.render(index, dpi=dpi)
    except Exception:
        logger.exception("preview_thumbnail: failed to rasterize PDF page %d", index + 1)
        return None
    finally:
        reader.close()


def _blurred_png_from_image(image) -> Optional[bytes]:
    try:
        from PIL import Image, ImageDraw, ImageFilter
    except ImportError:
        return None

    image = image.convert("RGB")
    if image.width > _TARGET_WIDTH_PX:
        ratio = _TARGET_WIDTH_PX / float(image.width)
        new_size = (_TARGET_WIDTH_PX, max(1, int(image.height * ratio)))
        image = image.resize(new_size, Image.LANCZOS)

    image = image.filter(ImageFilter.GaussianBlur(radius=_BLUR_RADIUS_PX))

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    font = _load_watermark_font(size=max(28, image.width // 10))
    text_w, text_h = _measure_text(draw, _WATERMARK_TEXT, font)
    position = ((image.size[0] - text_w) // 2, (image.size[1] - text_h) // 2)
    draw.text((position[0] + 2, position[1] + 2), _WATERMARK_TEXT, font=font, fill=(0, 0, 0, 140))
    draw.text(position, _WATERMARK_TEXT, font=font, fill=(255, 255, 255, 190))

    composed = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")

    buffer = io.BytesIO()
    composed.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def generate_blurred_pdf_thumbnail(pdf_bytes: bytes) -> Optional[bytes]:
    """Return a blurred PNG thumbnail of page 1, or ``None`` on failure.

    Failure modes (missing deps, corrupt PDF, empty document) are *not*
    raised — callers treat the thumbnail as optional and fall back to a
    generic client-rendered card.
    """
    if not pdf_bytes:
        return None
    image = _render_page_image(pdf_bytes, 0, _RENDER_DPI)
    if image is None:
        return None
    return _blurred_png_from_image(image)


def generate_blurred_pdf_thumbnail_from_doc(doc: object) -> Optional[bytes]:
    """Açık bir pikepdf belgesinden küçük resim üretir (belgeyi bellekte serileştirir)."""
    try:
        from src.pdfcore import pages as _pc

        data = _pc.pdf_to_bytes(doc)
    except Exception:
        logger.exception("preview_thumbnail: belge serileştirilemedi")
        return None
    return generate_blurred_pdf_thumbnail(data)


def generate_blurred_pdf_thumbnail_from_path(pdf_path: Union[str, Path]) -> Optional[bytes]:
    """Like :func:`generate_blurred_pdf_thumbnail` but opens the file on disk (saves RAM for huge PDFs)."""
    p = Path(pdf_path)
    if not p.is_file():
        return None
    image = _render_page_image(p, 0, _RENDER_DPI)
    if image is None:
        return None
    return _blurred_png_from_image(image)


def _hero_png_from_image(image) -> Optional[bytes]:
    try:
        from PIL import Image
    except ImportError:
        logger.warning("preview_thumbnail hero: Pillow missing")
        return None
    image = image.convert("RGBA")
    if image.width > _HERO_TARGET_WIDTH_PX:
        ratio = _HERO_TARGET_WIDTH_PX / float(image.width)
        new_size = (_HERO_TARGET_WIDTH_PX, max(1, int(image.height * ratio)))
        image = image.resize(new_size, Image.LANCZOS)
    composed = _tile_watermark(image, _HERO_WATERMARK, hero=True)
    buffer = io.BytesIO()
    composed.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def generate_hero_watermarked_preview_png(pdf_bytes: bytes) -> Optional[bytes]:
    """High-quality first-page raster with visible diagonal watermark (modal preview).

    Sharper than the blurred thumbnail; still not a substitute for the full PDF.
    """
    if not pdf_bytes:
        return None
    image = _render_page_image(pdf_bytes, 0, _HERO_RENDER_DPI)
    if image is None:
        return None
    return _hero_png_from_image(image)


def generate_hero_watermarked_preview_png_from_path(pdf_path: Union[str, Path]) -> Optional[bytes]:
    """Like :func:`generate_hero_watermarked_preview_png` but opens the file on disk — no RAM load."""
    p = Path(pdf_path)
    if not p.is_file():
        return None
    image = _render_page_image(p, 0, _HERO_RENDER_DPI)
    if image is None:
        return None
    return _hero_png_from_image(image)


_PREVIEW_PDF_MAX_PAGES = 10
_PREVIEW_PDF_RENDER_DPI = 120
_PREVIEW_PDF_TARGET_WIDTH_PX = 1000


def _tile_watermark(image, msg: str, hero: bool = False):
    """Görselin üstüne çapraz döşenmiş filigran bindirir (hero ile aynı görünüm)."""
    from PIL import Image, ImageDraw

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    if hero:
        font = _load_watermark_font(size=max(22, min(44, image.width // 28)))
    else:
        font = _load_watermark_font(size=max(20, min(40, image.width // 26)))
    try:
        bbox = draw.textbbox((0, 0), msg, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
    except Exception:
        tw, th = len(msg) * 10, 24

    step_x = int(tw * 1.8) + 32
    step_y = int(th * 2.8) + 36
    w, h = image.size
    y = -step_y * 2
    row = 0
    while y < h + step_y * 3:
        x = -step_x * 2 + (row % 2) * (step_x // 2)
        while x < w + step_x * 3:
            draw.text((x + 2, y + 2), msg, font=font, fill=(0, 0, 0, 85))
            draw.text((x, y), msg, font=font, fill=(255, 255, 255, 130))
            x += step_x
        y += step_y
        row += 1
    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def generate_watermarked_preview_pdf_from_path(
    pdf_path: Union[str, Path],
    max_pages: int = _PREVIEW_PDF_MAX_PAGES,
) -> Optional[bytes]:
    """Ödeme/kota kapısından ÖNCE gösterilebilecek güvenli çok sayfalı önizleme.

    Kaynak PDF'in ilk ``max_pages`` sayfasını düşük çözünürlükte görüntüye çevirir,
    her sayfaya çapraz filigran basar ve bunlardan YENİ bir PDF üretir. Çıktı
    metin katmanı içermez ve filigranlıdır; tarayıcıya inen dosya kopyalansa bile
    orijinal belgenin yerini tutmaz. Tam ve temiz çıktı yalnızca onaylı indirme
    ucundan verilir.
    """
    p = Path(pdf_path)
    if not p.is_file():
        return None

    try:
        from PIL import Image
    except ImportError:
        logger.warning("preview_pdf: Pillow missing")
        return None

    from src.pdfcore import PdfiumReader
    from src.pdfcore import pages as _pc

    try:
        reader = PdfiumReader(p)
    except Exception:
        logger.exception("preview_pdf: open failed")
        return None

    out = _pc.new_pdf()
    try:
        page_count = min(len(reader), max(1, int(max_pages)))
        if page_count < 1:
            return None
        for index in range(page_count):
            image = reader.render(index, dpi=_PREVIEW_PDF_RENDER_DPI)
            if image.width > _PREVIEW_PDF_TARGET_WIDTH_PX:
                ratio = _PREVIEW_PDF_TARGET_WIDTH_PX / float(image.width)
                image = image.resize(
                    (_PREVIEW_PDF_TARGET_WIDTH_PX, max(1, int(image.height * ratio))),
                    Image.LANCZOS,
                )
            image = _tile_watermark(image, _HERO_WATERMARK)
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=72, optimize=True)
            _pc.add_image_page(out, buffer.getvalue(), image.width, image.height, float(image.width), float(image.height))
        return _pc.pdf_to_bytes(out)
    except Exception:
        logger.exception("preview_pdf: render failed")
        return None
    finally:
        reader.close()
        out.close()


def _load_watermark_font(size: int):
    from PIL import ImageFont

    for candidate in ("DejaVuSans-Bold.ttf", "arialbd.ttf", "Arial Bold.ttf"):
        try:
            return ImageFont.truetype(candidate, size=size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def _measure_text(draw, text: str, font) -> tuple[int, int]:
    # Pillow's text measurement API changed across versions; try the modern
    # textbbox path first and fall back to textsize for older builds.
    try:
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
        return right - left, bottom - top
    except AttributeError:
        try:
            return draw.textsize(text, font=font)  # type: ignore[attr-defined]
        except Exception:
            return len(text) * 16, 24

"""Blurred first-page thumbnail generation for PDF results.

The thumbnail is the only part of the output the client sees before paying
(or using a credit / active subscription). It is intentionally *lossy* —
blurred, downscaled, watermarked — so the preview cannot be reconstructed
into the full document.

Uses PyMuPDF (``fitz``) which is already in ``requirements.txt``; Pillow
handles the blur + watermark overlay.
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


def _blurred_png_bytes_from_fitz_doc(doc: object) -> Optional[bytes]:
    try:
        import fitz  # noqa: F401
        from PIL import Image, ImageDraw, ImageFilter, ImageFont
    except ImportError:
        return None

    try:
        if doc.page_count < 1:
            return None
        page = doc.load_page(0)
        zoom = _RENDER_DPI / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        raw_png = pix.tobytes("png")
    except Exception:
        logger.exception("preview_thumbnail: failed to rasterize PDF page 1")
        return None

    try:
        image = Image.open(io.BytesIO(raw_png)).convert("RGB")
    except Exception:
        logger.exception("preview_thumbnail: failed to decode rasterized PNG")
        return None

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

    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("preview_thumbnail: PyMuPDF (fitz) is not installed; skipping")
        return None

    try:
        from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: F401
    except ImportError:
        logger.warning("preview_thumbnail: Pillow is not installed; skipping")
        return None

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        logger.exception("preview_thumbnail: failed to open PDF stream")
        return None

    try:
        return _blurred_png_bytes_from_fitz_doc(doc)
    finally:
        doc.close()


def generate_blurred_pdf_thumbnail_from_doc(doc: object) -> Optional[bytes]:
    """Generate thumbnail from an already-open fitz document (avoids a second disk read)."""
    return _blurred_png_bytes_from_fitz_doc(doc)


def generate_blurred_pdf_thumbnail_from_path(pdf_path: Union[str, Path]) -> Optional[bytes]:
    """Like :func:`generate_blurred_pdf_thumbnail` but opens the file on disk (saves RAM for huge PDFs)."""
    p = Path(pdf_path)
    if not p.is_file():
        return None

    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("preview_thumbnail: PyMuPDF (fitz) is not installed; skipping")
        return None

    try:
        from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: F401
    except ImportError:
        logger.warning("preview_thumbnail: Pillow is not installed; skipping")
        return None

    try:
        doc = fitz.open(p)
    except Exception:
        logger.exception("preview_thumbnail: failed to open PDF path")
        return None

    try:
        return _blurred_png_bytes_from_fitz_doc(doc)
    finally:
        doc.close()


def generate_hero_watermarked_preview_png(pdf_bytes: bytes) -> Optional[bytes]:
    """High-quality first-page raster with visible diagonal watermark (modal preview).

    Sharper than the blurred thumbnail; still not a substitute for the full PDF.
    """
    if not pdf_bytes:
        return None

    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("preview_thumbnail hero: PyMuPDF missing")
        return None

    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        logger.warning("preview_thumbnail hero: Pillow missing")
        return None

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        logger.exception("preview_thumbnail hero: open failed")
        return None

    try:
        if doc.page_count < 1:
            return None
        page = doc.load_page(0)
        zoom = _HERO_RENDER_DPI / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        raw_png = pix.tobytes("png")
    except Exception:
        logger.exception("preview_thumbnail hero: rasterize failed")
        return None
    finally:
        doc.close()

    try:
        image = Image.open(io.BytesIO(raw_png)).convert("RGBA")
    except Exception:
        logger.exception("preview_thumbnail hero: decode failed")
        return None

    if image.width > _HERO_TARGET_WIDTH_PX:
        ratio = _HERO_TARGET_WIDTH_PX / float(image.width)
        new_size = (_HERO_TARGET_WIDTH_PX, max(1, int(image.height * ratio)))
        image = image.resize(new_size, Image.LANCZOS)

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = _load_watermark_font(size=max(22, min(44, image.width // 28)))

    msg = _HERO_WATERMARK
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

    composed = Image.alpha_composite(image, overlay).convert("RGB")
    buffer = io.BytesIO()
    composed.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def generate_hero_watermarked_preview_png_from_path(pdf_path: Union[str, Path]) -> Optional[bytes]:
    """Like :func:`generate_hero_watermarked_preview_png` but opens the file on disk — no RAM load."""
    p = Path(pdf_path)
    if not p.is_file():
        return None

    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("preview_thumbnail hero: PyMuPDF missing")
        return None

    try:
        from PIL import Image, ImageDraw, ImageFont  # noqa: F401
    except ImportError:
        logger.warning("preview_thumbnail hero: Pillow missing")
        return None

    try:
        doc = fitz.open(p)
    except Exception:
        logger.exception("preview_thumbnail hero: open failed")
        return None

    try:
        if doc.page_count < 1:
            return None
        page = doc.load_page(0)
        zoom = _HERO_RENDER_DPI / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        raw_png = pix.tobytes("png")
    except Exception:
        logger.exception("preview_thumbnail hero: rasterize failed")
        return None
    finally:
        doc.close()

    try:
        image = Image.open(io.BytesIO(raw_png)).convert("RGBA")
    except Exception:
        logger.exception("preview_thumbnail hero: decode failed")
        return None

    if image.width > _HERO_TARGET_WIDTH_PX:
        ratio = _HERO_TARGET_WIDTH_PX / float(image.width)
        new_size = (_HERO_TARGET_WIDTH_PX, max(1, int(image.height * ratio)))
        image = image.resize(new_size, Image.LANCZOS)

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = _load_watermark_font(size=max(22, min(44, image.width // 28)))

    msg = _HERO_WATERMARK
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

    composed = Image.alpha_composite(image, overlay).convert("RGB")
    buffer = io.BytesIO()
    composed.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


_PREVIEW_PDF_MAX_PAGES = 10
_PREVIEW_PDF_RENDER_DPI = 120
_PREVIEW_PDF_TARGET_WIDTH_PX = 1000


def _tile_watermark(image, msg: str):
    """Görselin üstüne çapraz döşenmiş filigran bindirir (hero ile aynı görünüm)."""
    from PIL import Image, ImageDraw

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
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
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("preview_pdf: PyMuPDF missing")
        return None

    try:
        from PIL import Image
    except ImportError:
        logger.warning("preview_pdf: Pillow missing")
        return None

    try:
        src = fitz.open(p)
    except Exception:
        logger.exception("preview_pdf: open failed")
        return None

    out = fitz.open()
    try:
        page_count = min(src.page_count, max(1, int(max_pages)))
        if page_count < 1:
            return None
        zoom = _PREVIEW_PDF_RENDER_DPI / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        for index in range(page_count):
            pix = src.load_page(index).get_pixmap(matrix=matrix, alpha=False)
            image = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            if image.width > _PREVIEW_PDF_TARGET_WIDTH_PX:
                ratio = _PREVIEW_PDF_TARGET_WIDTH_PX / float(image.width)
                image = image.resize(
                    (_PREVIEW_PDF_TARGET_WIDTH_PX, max(1, int(image.height * ratio))),
                    Image.LANCZOS,
                )
            image = _tile_watermark(image, _HERO_WATERMARK)
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=72, optimize=True)
            page = out.new_page(width=image.width, height=image.height)
            page.insert_image(fitz.Rect(0, 0, image.width, image.height), stream=buffer.getvalue())
        return out.tobytes()
    except Exception:
        logger.exception("preview_pdf: render failed")
        return None
    finally:
        out.close()
        src.close()


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

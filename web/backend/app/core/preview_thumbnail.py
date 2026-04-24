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
from typing import Optional

logger = logging.getLogger(__name__)

_RENDER_DPI = 160
_TARGET_WIDTH_PX = 480
_BLUR_RADIUS_PX = 6
_WATERMARK_TEXT = "PREVIEW"


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
        from PIL import Image, ImageDraw, ImageFilter, ImageFont
    except ImportError:
        logger.warning("preview_thumbnail: Pillow is not installed; skipping")
        return None

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        logger.exception("preview_thumbnail: failed to open PDF stream")
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
    finally:
        doc.close()

    try:
        image = Image.open(io.BytesIO(raw_png)).convert("RGB")
    except Exception:
        logger.exception("preview_thumbnail: failed to decode rasterized PNG")
        return None

    # Downscale to ~480px wide while preserving aspect ratio.
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
    # Translucent dark shadow + light fill for contrast on any background.
    draw.text((position[0] + 2, position[1] + 2), _WATERMARK_TEXT, font=font, fill=(0, 0, 0, 140))
    draw.text(position, _WATERMARK_TEXT, font=font, fill=(255, 255, 255, 190))

    composed = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")

    buffer = io.BytesIO()
    composed.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


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

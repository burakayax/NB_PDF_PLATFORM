"""Test için minimal geçerli bir PDF dosyası ve geçici dizin sağlar."""

from __future__ import annotations

import io
import os
import tempfile
from pathlib import Path

import pytest

try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


def _build_minimal_pdf(page_count: int = 3) -> bytes:
    """reportlab ile sayfa_count sayfalı bir PDF döndürür. reportlab yoksa fitz ile üretir."""
    if HAS_REPORTLAB:
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        for i in range(page_count):
            c.setFont("Helvetica", 14)
            c.drawString(72, 700, f"Test sayfası {i + 1}")
            c.showPage()
        c.save()
        return buf.getvalue()

    if HAS_FITZ:
        doc = fitz.open()
        for i in range(page_count):
            page = doc.new_page()
            page.insert_text((72, 100), f"Test sayfası {i + 1}")
        return doc.tobytes()

    pytest.skip("Test PDF oluşturmak için reportlab veya PyMuPDF gerekli")


@pytest.fixture()
def tmp_dir():
    with tempfile.TemporaryDirectory() as d:
        yield Path(d)


@pytest.fixture()
def sample_pdf(tmp_dir: Path) -> Path:
    """3 sayfalık geçici bir PDF dosyası döndürür."""
    p = tmp_dir / "sample.pdf"
    p.write_bytes(_build_minimal_pdf(3))
    return p


@pytest.fixture()
def sample_pdf_bytes() -> bytes:
    return _build_minimal_pdf(3)

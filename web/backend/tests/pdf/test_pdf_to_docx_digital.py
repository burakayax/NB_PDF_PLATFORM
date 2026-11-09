"""Dijital PDF → DOCX (PyMuPDF'siz dönüştürücü): metin, başlık/gövde, sayfa sayısı."""
from __future__ import annotations

import io
import sys
from pathlib import Path

from reportlab.pdfgen import canvas

_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.pdf_to_docx_digital import pdf_to_docx_digital  # noqa: E402


def _make(tmp_path):
    p = tmp_path / "a.pdf"
    c = canvas.Canvas(str(p), pagesize=(595, 842))
    c.setFont("Helvetica-Bold", 20)
    c.drawString(72, 760, "Baslik Satiri")
    c.setFont("Helvetica", 11)
    for i in range(5):
        c.drawString(72, 720 - i * 15, f"Govde metni satir {i} lorem ipsum dolor")
    c.showPage()
    c.setFont("Helvetica", 11)
    c.drawString(72, 760, "Ikinci sayfa")
    c.save()
    return p


def test_digital_pdf_to_docx(tmp_path):
    from docx import Document

    out = tmp_path / "a.docx"
    assert pdf_to_docx_digital(str(_make(tmp_path)), str(out))
    d = Document(str(out))
    txt = "\n".join(p.text for p in d.paragraphs)
    assert "Baslik Satiri" in txt and "Govde metni satir 3" in txt and "Ikinci sayfa" in txt
    assert len(d.sections) == 2
    bold = [r for p in d.paragraphs for r in p.runs if "Baslik" in r.text]
    assert bold and bold[0].bold


def test_image_only_pdf_returns_false(tmp_path):
    from PIL import Image

    p = tmp_path / "img.pdf"
    Image.new("RGB", (200, 200), "white").save(p)
    assert pdf_to_docx_digital(str(p), str(tmp_path / "o.docx")) is False

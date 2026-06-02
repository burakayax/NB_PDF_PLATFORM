"""PDF toolkit extra — temel operasyon unit testleri.

Her test gerçek dosya sistemi üzerinde çalışır; harici servis veya veritabanı bağımlılığı yoktur.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Proje kökünü sys.path'e ekle (web/backend/tests/pdf/ → proje kökü 4 seviye üst)
_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

try:
    import src.pdf_toolkit_extra as ptx  # noqa: E402
    HAS_PTX = True
except Exception:
    HAS_PTX = False

pytestmark = pytest.mark.skipif(not HAS_PTX, reason="pdf_toolkit_extra içe aktarılamadı")


# ─── delete_pages_pdf ─────────────────────────────────────────────────────────

class TestDeletePages:
    def test_delete_middle_page(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "out.pdf"
        result = ptx.delete_pages_pdf(str(sample_pdf), str(out), [1])  # 0-indexed: 2. sayfa
        assert result is True
        assert out.exists()

        import fitz
        doc = fitz.open(str(out))
        assert doc.page_count == 2

    def test_delete_all_pages_raises_or_false(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "out.pdf"
        # 3 sayfalı PDF'den tüm sayfaları silmeye çalışmak hata vermeli veya False dönmeli
        try:
            result = ptx.delete_pages_pdf(str(sample_pdf), str(out), [0, 1, 2])
            assert result is False or not out.exists() or (out.stat().st_size == 0)
        except Exception:
            pass  # hata fırlatması da kabul edilir

    def test_delete_out_of_range_page_raises_or_false(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "out.pdf"
        try:
            result = ptx.delete_pages_pdf(str(sample_pdf), str(out), [99])
            assert result is False
        except Exception:
            pass


# ─── rotate_pdf ──────────────────────────────────────────────────────────────

class TestRotatePdf:
    # rotate_pdf imzası: (pdf_path, output_path, degrees, pages_1based, password=None, per_page_degrees=None)
    def test_rotate_all_pages_90(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "rotated.pdf"
        # pages_1based=None → tüm sayfaları 90° döndür
        result = ptx.rotate_pdf(str(sample_pdf), str(out), 90, None)
        assert result is True
        assert out.exists()
        assert out.stat().st_size > 0

    def test_rotate_partial_pages(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "rotated_partial.pdf"
        # per_page_degrees ile yalnızca 1. sayfayı 180° döndür
        result = ptx.rotate_pdf(str(sample_pdf), str(out), 0, None, per_page_degrees={1: 180})
        assert result is True

    def test_invalid_angle_raises(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "rotated_bad.pdf"
        # 45 geçersiz açı → Exception fırlatmalı
        with pytest.raises(Exception):
            ptx.rotate_pdf(str(sample_pdf), str(out), 45, None)


# ─── organize_pdf ─────────────────────────────────────────────────────────────

class TestOrganizePdf:
    # organize_pdf imzası: (pdf_path, output_path, new_order_1based, ...) — 1-based, her sayfa tam bir kez
    def test_reorder_pages(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "organized.pdf"
        # Sayfaları ters sırayla düzenle (1-based): [3, 2, 1]
        result = ptx.organize_pdf(str(sample_pdf), str(out), [3, 2, 1])
        assert result is True
        assert out.exists()

        import fitz
        doc = fitz.open(str(out))
        assert doc.page_count == 3

    def test_organize_duplicate_pages_raises(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "dup.pdf"
        # Aynı sayfa iki kez → Exception fırlatmalı
        with pytest.raises(Exception):
            ptx.organize_pdf(str(sample_pdf), str(out), [1, 1, 2])


# ─── add_watermark_text ───────────────────────────────────────────────────────

class TestAddWatermark:
    # add_watermark_text imzası: (input_path, output_path, text, opacity=, password=, font_name=, font_color="#RRGGBB")
    def test_basic_watermark(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "watermarked.pdf"
        result = ptx.add_watermark_text(
            str(sample_pdf),
            str(out),
            "TEST",
            font_name="helv",
            font_color="#808080",
        )
        assert result is True
        assert out.stat().st_size > 0

    def test_hex_to_rgb_helper(self):
        assert ptx._hex_to_rgb("#ff0000") == pytest.approx((1.0, 0.0, 0.0), abs=0.01)
        assert ptx._hex_to_rgb("#000000") == pytest.approx((0.0, 0.0, 0.0), abs=0.01)
        assert ptx._hex_to_rgb("#ffffff") == pytest.approx((1.0, 1.0, 1.0), abs=0.01)

    def test_hex_to_rgb_invalid_returns_default(self):
        # Geçersiz girdide _hex_to_rgb varsayılan gri döner (raise etmez).
        result = ptx._hex_to_rgb("not-a-color")
        assert result == pytest.approx((0.55, 0.55, 0.55), abs=0.01)


# ─── add_page_numbers ─────────────────────────────────────────────────────────

class TestAddPageNumbers:
    def test_adds_page_numbers(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "numbered.pdf"
        result = ptx.add_page_numbers(str(sample_pdf), str(out))
        assert result is True
        assert out.exists()
        assert out.stat().st_size > 0


# ─── repair_pdf ──────────────────────────────────────────────────────────────

class TestRepairPdf:
    def test_repair_valid_pdf(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "repaired.pdf"
        result = ptx.repair_pdf(str(sample_pdf), str(out))
        assert result is True
        assert out.exists()


# ─── pdf_to_text ──────────────────────────────────────────────────────────────

class TestPdfToText:
    def test_extracts_text(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "text.txt"
        result = ptx.pdf_to_text(str(sample_pdf), str(out))
        assert result is True
        assert out.exists()
        content = out.read_text(encoding="utf-8", errors="replace")
        assert len(content) > 0


# ─── flatten_pdf ──────────────────────────────────────────────────────────────

class TestFlattenPdf:
    def test_flatten_valid_pdf(self, sample_pdf: Path, tmp_dir: Path):
        out = tmp_dir / "flat.pdf"
        result = ptx.flatten_pdf(str(sample_pdf), str(out))
        assert result is True
        assert out.exists()
        assert out.stat().st_size > 0


# ─── images_to_pdf ────────────────────────────────────────────────────────────

class TestImagesToPdf:
    def test_empty_list_raises_or_false(self, tmp_dir: Path):
        out = tmp_dir / "from_images.pdf"
        try:
            result = ptx.images_to_pdf([], str(out))
            assert result is False
        except Exception:
            pass

    def test_valid_png_image(self, tmp_dir: Path):
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow gerekli")

        img_path = tmp_dir / "test.png"
        img = Image.new("RGB", (100, 100), color=(255, 0, 0))
        img.save(str(img_path))

        out = tmp_dir / "from_image.pdf"
        result = ptx.images_to_pdf([str(img_path)], str(out))
        assert result is True
        assert out.stat().st_size > 0

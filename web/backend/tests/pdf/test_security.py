"""Güvenlik kritik modüller için birim testleri.

Kapsanan alanlar:
- PDF magic byte doğrulaması (operations.py)
- Rate limiter yapılandırması (limiter.py)
"""

from __future__ import annotations

import io
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

# ─── PDF Magic Byte Testleri ──────────────────────────────────────────────────

class TestPdfMagicByte:
    """save_upload: magic byte doğrulamasının doğru çalıştığını test eder."""

    def _make_fake_upload(self, content: bytes, content_type: str = "application/pdf"):
        """FastAPI UploadFile benzeri bir mock nesnesi oluşturur."""
        upload = MagicMock()
        upload.content_type = content_type
        upload.filename = "test.pdf"
        buf = io.BytesIO(content)
        upload.file = buf
        upload.close = AsyncMock()
        return upload

    @pytest.mark.asyncio
    async def test_valid_pdf_magic_accepted(self, tmp_dir):
        """Geçerli %PDF- başlığına sahip dosya kabul edilmelidir."""
        from web.backend.app.core.operations import save_upload  # noqa: PLC0415

        content = b"%PDF-1.4\n%test content" + b"x" * 100
        upload = self._make_fake_upload(content)

        result = await save_upload(upload, tmp_dir)
        assert result.exists()
        assert result.read_bytes()[:5] == b"%PDF-"

    @pytest.mark.asyncio
    async def test_missing_magic_byte_rejected(self, tmp_dir):
        """PDF magic byte olmayan dosya 415 ile reddedilmelidir."""
        from fastapi import HTTPException  # noqa: PLC0415
        from web.backend.app.core.operations import save_upload  # noqa: PLC0415

        content = b"This is not a PDF file at all"
        upload = self._make_fake_upload(content)

        with pytest.raises(HTTPException) as exc_info:
            await save_upload(upload, tmp_dir)
        assert exc_info.value.status_code == 415

    @pytest.mark.asyncio
    async def test_magic_byte_in_first_1024_bytes_accepted(self, tmp_dir):
        """PDF magic byte'ı ilk 1024 bayt içinde olduğunda kabul edilmelidir."""
        from web.backend.app.core.operations import save_upload  # noqa: PLC0415

        # Bazı PDF oluşturucular BOM veya boşluk karakteriyle başlar
        content = b"  " + b"%PDF-1.7\n" + b"x" * 500
        upload = self._make_fake_upload(content)

        result = await save_upload(upload, tmp_dir)
        assert result.exists()

    @pytest.mark.asyncio
    async def test_magic_byte_after_1024_bytes_rejected(self, tmp_dir):
        """PDF magic byte 1024. bayttan sonra geliyorsa reddedilmelidir."""
        from fastapi import HTTPException  # noqa: PLC0415
        from web.backend.app.core.operations import save_upload  # noqa: PLC0415

        content = b"x" * 1025 + b"%PDF-1.4"
        upload = self._make_fake_upload(content)

        with pytest.raises(HTTPException) as exc_info:
            await save_upload(upload, tmp_dir)
        assert exc_info.value.status_code == 415

    @pytest.mark.asyncio
    async def test_invalid_content_type_rejected(self, tmp_dir):
        """Desteklenmeyen content-type ile gönderilen dosya reddedilmelidir."""
        from fastapi import HTTPException  # noqa: PLC0415
        from web.backend.app.core.operations import save_upload  # noqa: PLC0415

        content = b"%PDF-1.4\nvalid content"
        upload = self._make_fake_upload(content, content_type="text/html")

        with pytest.raises(HTTPException) as exc_info:
            await save_upload(upload, tmp_dir)
        assert exc_info.value.status_code == 415

    @pytest.mark.asyncio
    async def test_file_size_limit_enforced(self, tmp_dir):
        """Belirtilen boyut sınırını aşan dosya 413 ile reddedilmelidir."""
        from fastapi import HTTPException  # noqa: PLC0415
        from web.backend.app.core.operations import save_upload  # noqa: PLC0415

        # 5 bayt sınırı — magic byte geçerli ama sonrası aşıyor
        content = b"%PDF-1.4\n" + b"x" * 1000
        upload = self._make_fake_upload(content)

        with pytest.raises(HTTPException) as exc_info:
            await save_upload(upload, tmp_dir, max_bytes=10)
        assert exc_info.value.status_code == 413


# ─── Rate Limiter Testleri ────────────────────────────────────────────────────

class TestRateLimiter:
    """Limiter yapılandırmasının doğru çalıştığını doğrular."""

    def test_default_rate_limit_set(self):
        """Varsayılan rate limit 10/minute olmalıdır."""
        import importlib  # noqa: PLC0415
        # Temiz import — env değişkeni yoksa
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("RATE_LIMIT_DEFAULT", None)
            if "web.backend.app.limiter" in sys.modules:
                del sys.modules["web.backend.app.limiter"]
            import web.backend.app.limiter as limiter_mod  # noqa: PLC0415
            assert limiter_mod._rate_default == "10/minute"

    def test_custom_rate_limit_from_env(self):
        """RATE_LIMIT_DEFAULT env değişkeni özel sınır belirleyebilmelidir."""
        with patch.dict(os.environ, {"RATE_LIMIT_DEFAULT": "20/minute"}):
            if "web.backend.app.limiter" in sys.modules:
                del sys.modules["web.backend.app.limiter"]
            import web.backend.app.limiter as limiter_mod  # noqa: PLC0415
            assert limiter_mod._rate_default == "20/minute"

    def test_rate_limit_key_func_direct_ip(self):
        """TRUST_PROXY olmadan doğrudan istemci IP'si kullanılmalıdır."""
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("TRUST_PROXY", None)
            if "web.backend.app.limiter" in sys.modules:
                del sys.modules["web.backend.app.limiter"]
            import web.backend.app.limiter as limiter_mod  # noqa: PLC0415

            request = MagicMock()
            request.client.host = "1.2.3.4"
            # X-Forwarded-For mevcut olsa bile TRUST_PROXY=0 ise görmezden gelir
            request.headers = {"x-forwarded-for": "9.9.9.9"}

            with patch("web.backend.app.limiter.get_remote_address", return_value="1.2.3.4"):
                key = limiter_mod.rate_limit_key_func(request)
            assert key == "1.2.3.4"

    def test_rate_limit_key_func_trusted_proxy(self):
        """TRUST_PROXY=1 iken X-Forwarded-For ilk adresi kullanılmalıdır."""
        with patch.dict(os.environ, {"TRUST_PROXY": "1"}):
            if "web.backend.app.limiter" in sys.modules:
                del sys.modules["web.backend.app.limiter"]
            import web.backend.app.limiter as limiter_mod  # noqa: PLC0415

            request = MagicMock()
            request.headers = {"x-forwarded-for": "203.0.113.5, 10.0.0.1"}

            key = limiter_mod.rate_limit_key_func(request)
            assert key == "203.0.113.5"

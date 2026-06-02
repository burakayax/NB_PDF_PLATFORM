"""result_store — S3 backend testleri (boto3 mock'lu).

Gerçek AWS bağlantısı gerektirmez; tüm S3 çağrıları unittest.mock ile taklit edilir.
"""

from __future__ import annotations

import importlib
import io
import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch, call

import pytest
from fastapi import HTTPException

_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

# ── S3 ortam değişkenleri ──────────────────────────────────────────────────────

S3_ENV = {
    "S3_BUCKET": "test-bucket",
    "S3_ACCESS_KEY_ID": "test-key",
    "S3_SECRET_ACCESS_KEY": "test-secret",
    "S3_REGION": "auto",
}


def _make_s3_client(objects: dict | None = None) -> MagicMock:
    """Gerçekçi davranış sergileyen bir mock S3 istemcisi döndürür."""
    store: dict[str, bytes] = {}
    if objects:
        store.update(objects)

    s3 = MagicMock()

    def put_object(Bucket, Key, Body, ContentType="application/octet-stream"):
        store[Key] = Body if isinstance(Body, bytes) else Body.read()

    def get_object(Bucket, Key):
        if Key not in store:
            from botocore.exceptions import ClientError  # type: ignore
            error_response = {"Error": {"Code": "NoSuchKey", "Message": "Not found"}}
            raise ClientError(error_response, "GetObject")
        return {"Body": io.BytesIO(store[Key])}

    def head_object(Bucket, Key):
        if Key not in store:
            from botocore.exceptions import ClientError  # type: ignore
            error_response = {"Error": {"Code": "404", "Message": "Not found"}}
            raise ClientError(error_response, "HeadObject")
        return {}

    def delete_objects(Bucket, Delete):
        for obj in Delete.get("Objects", []):
            store.pop(obj["Key"], None)

    def generate_presigned_url(operation, Params, ExpiresIn=3600):
        key = Params.get("Key", "")
        return f"https://test-bucket.s3.example.com/{key}?X-Amz-Expires={ExpiresIn}"

    # list_objects_v2 paginator
    paginator = MagicMock()

    def get_paginator(operation):
        if operation == "list_objects_v2":
            def paginate(Bucket, Prefix=""):
                contents = [{"Key": k} for k in store if k.startswith(Prefix)]
                yield {"Contents": contents}
            paginator.paginate = paginate
            return paginator
        return MagicMock()

    s3.put_object.side_effect = put_object
    s3.get_object.side_effect = get_object
    s3.head_object.side_effect = head_object
    s3.delete_objects.side_effect = delete_objects
    s3.generate_presigned_url.side_effect = generate_presigned_url
    s3.get_paginator.side_effect = get_paginator

    return s3


@pytest.fixture()
def s3_store(monkeypatch):
    """S3 modu aktif result_store modülü + mock client döndürür."""
    for k, v in S3_ENV.items():
        monkeypatch.setenv(k, v)

    # Önce S3 env yokken yüklenen modülü temizle
    import web.backend.app.core.result_store as rs  # type: ignore
    monkeypatch.setattr(rs, "_s3_client", None)
    monkeypatch.setattr(rs, "_s3_available", None)

    mock_client = _make_s3_client()

    with patch("boto3.client", return_value=mock_client):
        importlib.reload(rs)
        yield rs, mock_client


# ── Testler ────────────────────────────────────────────────────────────────────

class TestS3SaveResult:
    def test_save_result_calls_s3_put(self, s3_store):
        rs, s3 = s3_store
        payload = b"%PDF-1.4 hello"

        with patch.object(rs, "_get_s3", return_value=s3):
            handle = rs.save_result(
                payload,
                filename="test.pdf",
                mime="application/pdf",
                user_id="user-42",
            )

        assert handle.result_id
        assert handle.size_bytes == len(payload)
        assert handle.presigned_url is not None
        assert "test-bucket.s3" in handle.presigned_url

    def test_save_result_stores_meta_json(self, s3_store):
        rs, s3 = s3_store
        payload = b"PDF content"

        with patch.object(rs, "_get_s3", return_value=s3):
            handle = rs.save_result(
                payload,
                filename="doc.pdf",
                mime="application/pdf",
                user_id="u-meta",
            )

        # meta.json S3'e PUT edilmiş olmalı
        meta_key = f"{handle.result_id}/meta.json"
        get_resp = s3.get_object(Bucket="test-bucket", Key=meta_key)
        meta = json.loads(get_resp["Body"].read())
        assert meta["user_id"] == "u-meta"
        assert meta["filename"] == "doc.pdf"
        assert meta["size_bytes"] == len(payload)

    def test_save_result_with_thumbnail_uploads_png(self, s3_store):
        rs, s3 = s3_store
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20

        with patch.object(rs, "_get_s3", return_value=s3):
            handle = rs.save_result(
                b"PDF",
                filename="thumb.pdf",
                mime="application/pdf",
                user_id="u-thumb",
                thumbnail_png=png,
            )

        assert handle.has_thumbnail is True
        thumb_key = f"{handle.result_id}/thumbnail.png"
        resp = s3.get_object(Bucket="test-bucket", Key=thumb_key)
        assert resp["Body"].read() == png


class TestS3PresignedUrl:
    def test_get_result_returns_presigned_url(self, s3_store):
        rs, s3 = s3_store

        with patch.object(rs, "_get_s3", return_value=s3):
            handle = rs.save_result(
                b"content",
                filename="file.pdf",
                mime="application/pdf",
                user_id="user-psign",
            )
            result = rs.get_result(handle.result_id, "user-psign")

        assert result.presigned_url is not None
        assert handle.result_id in result.presigned_url
        assert result.payload_path is None  # S3 modunda yerel path olmaz

    def test_presigned_url_contains_expiry(self, s3_store):
        rs, s3 = s3_store

        with patch.object(rs, "_get_s3", return_value=s3):
            handle = rs.save_result(
                b"pdf",
                filename="x.pdf",
                mime="application/pdf",
                user_id="u1",
            )
            result = rs.get_result(handle.result_id, "u1")

        assert "X-Amz-Expires" in result.presigned_url


class TestS3GetResult:
    def test_wrong_user_raises_404(self, s3_store):
        rs, s3 = s3_store

        with patch.object(rs, "_get_s3", return_value=s3):
            handle = rs.save_result(
                b"data",
                filename="f.pdf",
                mime="application/pdf",
                user_id="owner",
            )
            with pytest.raises(HTTPException) as exc:
                rs.get_result(handle.result_id, "attacker")

        assert exc.value.status_code == 404

    def test_expired_result_raises_404(self, s3_store, monkeypatch):
        rs, s3 = s3_store

        with patch.object(rs, "_get_s3", return_value=s3):
            handle = rs.save_result(
                b"data",
                filename="f.pdf",
                mime="application/pdf",
                user_id="u1",
            )

        monkeypatch.setattr(rs, "RESULT_TTL_SECONDS", -1)
        with patch.object(rs, "_get_s3", return_value=s3):
            with pytest.raises(HTTPException) as exc:
                rs.get_result(handle.result_id, "u1")

        assert exc.value.status_code == 404

    def test_invalid_result_id_raises_404(self, s3_store):
        rs, s3 = s3_store

        with patch.object(rs, "_get_s3", return_value=s3):
            with pytest.raises(HTTPException) as exc:
                rs.get_result("not-a-uuid", "u1")

        assert exc.value.status_code == 404

    def test_returns_correct_filename_and_mime(self, s3_store):
        rs, s3 = s3_store

        with patch.object(rs, "_get_s3", return_value=s3):
            handle = rs.save_result(
                b"pdf-bytes",
                filename="report.pdf",
                mime="application/pdf",
                user_id="u1",
            )
            result = rs.get_result(handle.result_id, "u1")

        assert result.filename == "report.pdf"
        assert result.mime == "application/pdf"


class TestS3DeleteResult:
    def test_delete_removes_s3_objects(self, s3_store):
        rs, s3 = s3_store

        with patch.object(rs, "_get_s3", return_value=s3):
            handle = rs.save_result(
                b"data",
                filename="del.pdf",
                mime="application/pdf",
                user_id="u1",
            )
            rs.delete_result(handle.result_id)

            # Silindikten sonra get_result 404 dönmeli
            with pytest.raises(HTTPException) as exc:
                rs.get_result(handle.result_id, "u1")

        assert exc.value.status_code == 404

    def test_delete_nonexistent_id_safe(self, s3_store):
        rs, s3 = s3_store
        import uuid
        fake_id = uuid.uuid4().hex

        with patch.object(rs, "_get_s3", return_value=s3):
            # Hata fırlatmamalı
            rs.delete_result(fake_id)

    def test_delete_invalid_id_safe(self, s3_store):
        rs, s3 = s3_store

        with patch.object(rs, "_get_s3", return_value=s3):
            rs.delete_result("not-a-uuid-at-all")  # hata fırlatmamalı


class TestS3FallbackToLocalDisk:
    def test_no_s3_env_uses_local(self, tmp_dir: Path, monkeypatch):
        """S3 env değişkenleri yoksa yerel disk kullanılmalı."""
        for k in S3_ENV:
            monkeypatch.delenv(k, raising=False)

        store_dir = tmp_dir / "local_rs"
        store_dir.mkdir()
        monkeypatch.setenv("NB_RESULT_STORE_DIR", str(store_dir))

        import web.backend.app.core.result_store as rs  # type: ignore
        importlib.reload(rs)

        handle = rs.save_result(
            b"local-pdf",
            filename="local.pdf",
            mime="application/pdf",
            user_id="u-local",
        )
        assert handle.presigned_url is None  # S3 yoksa presigned URL olmamalı
        result = rs.get_result(handle.result_id, "u-local")
        assert result.payload_path is not None
        assert result.payload_path.read_bytes() == b"local-pdf"

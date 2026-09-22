"""Parola hatalarında kullanıcı sebebi öğrenmeli.

Buradaki iki davranış birlikte bir kullanıcı şikâyetini karşılıyor:
  1. Sunucu, kitaplıkların İngilizce ve dosya yolu içeren parola hatasını
     anlaşılır bir cümleye çevirmeli (yol içerdiği için eskiden "dosya
     okunamadı" genel mesajına düşüyordu).
  2. Sıkıştırma, parola yanlışken BAŞARILI görünmemeli. Eskiden aşamalar
     sessizce başarısız oluyor, girdi olduğu gibi kopyalanıyor ve kullanıcı
     hiç değişmemiş şifreli dosyasını "sıkıştırıldı" diye alıyordu.
"""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))

from app.core.tool_errors import (  # noqa: E402
    GENERIC_TOOL_FAILURE_TR,
    MISSING_PASSWORD_TR,
    WRONG_PASSWORD_TR,
    public_message_for_exception,
)


@pytest.mark.parametrize(
    "ham",
    [
        r"C:\Users\x\Temp\belge.pdf: invalid password",
        "/tmp/nbpdf/belge.pdf: invalid password",
        "incorrect password",
        "PDF sıkıştırma: girilen PDF parolası hatalı (belge.pdf).",
    ],
)
def test_yanlis_parola_anlasilir_mesaja_cevrilir(ham: str) -> None:
    assert public_message_for_exception(Exception(ham)) == WRONG_PASSWORD_TR


@pytest.mark.parametrize(
    "ham",
    [
        "password required",
        "PDF sıkıştırma için şifre gerekli: belge.pdf",
    ],
)
def test_eksik_parola_anlasilir_mesaja_cevrilir(ham: str) -> None:
    assert public_message_for_exception(Exception(ham)) == MISSING_PASSWORD_TR


def test_parola_disi_teknik_hata_hala_gizlenir() -> None:
    msg = public_message_for_exception(Exception(r"C:\tmp\a.pdf okunamadi"))
    assert msg == GENERIC_TOOL_FAILURE_TR


def test_sifreli_pdf_yanlis_parolayla_sikistirilamaz(tmp_path) -> None:
    fitz = pytest.importorskip("fitz")
    from src.pdf_engine import compress_pdf

    kaynak = tmp_path / "sifreli.pdf"
    doc = fitz.open()
    doc.new_page().insert_text((72, 100), "gizli")
    doc.save(str(kaynak), encryption=fitz.PDF_ENCRYPT_AES_256, user_pw="dogru")
    doc.close()

    cikti = tmp_path / "cikti.pdf"

    with pytest.raises(Exception) as bos:
        compress_pdf(str(kaynak), str(cikti))
    assert "şifre gerekli" in str(bos.value)

    with pytest.raises(Exception) as yanlis:
        compress_pdf(str(kaynak), str(cikti), password="yanlis")
    assert "parolası hatalı" in str(yanlis.value)

    # Doğru parolayla iş görmeli.
    assert compress_pdf(str(kaynak), str(cikti), password="dogru") is True
    assert cikti.is_file() and cikti.stat().st_size > 0

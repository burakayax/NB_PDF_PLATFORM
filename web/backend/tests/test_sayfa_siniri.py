"""Ağır dönüşümlerde (Word, PowerPoint) sayfa sınırı: aşan belge iş başlamadan açık mesajla reddedilir."""

import os
import sys

import pikepdf
import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from app.core.operations import ensure_page_limit


def _pdf(tmp_path, sayfa):
    p = tmp_path / "k.pdf"
    pdf = pikepdf.new()
    for _ in range(sayfa):
        pdf.add_blank_page(page_size=(100, 100))
    pdf.save(p)
    return str(p)


def test_sinir_asilirsa_413_ve_acik_mesaj(tmp_path, monkeypatch):
    monkeypatch.setenv("NB_WORD_MAX_PAGES", "3")
    with pytest.raises(HTTPException) as e:
        ensure_page_limit(_pdf(tmp_path, 4), None, "pdf-to-word")
    assert e.value.status_code == 413
    assert "4 sayfa" in e.value.detail and "en fazla 3" in e.value.detail
    assert "PDF Böl" in e.value.detail


def test_sinir_icindeki_belge_gecer(tmp_path, monkeypatch):
    monkeypatch.setenv("NB_WORD_MAX_PAGES", "3")
    ensure_page_limit(_pdf(tmp_path, 3), None, "pdf-to-word")


def test_ppt_sinir_ayri_ayarlanir(tmp_path, monkeypatch):
    monkeypatch.setenv("NB_PPT_MAX_PAGES", "2")
    monkeypatch.setenv("NB_WORD_MAX_PAGES", "50")
    with pytest.raises(HTTPException):
        ensure_page_limit(_pdf(tmp_path, 3), None, "pdf-to-ppt")
    ensure_page_limit(_pdf(tmp_path, 3), None, "pdf-to-word")


def test_varsayilan_sinir_150(tmp_path, monkeypatch):
    monkeypatch.delenv("NB_WORD_MAX_PAGES", raising=False)
    ensure_page_limit(_pdf(tmp_path, 150), None, "pdf-to-word")
    with pytest.raises(HTTPException):
        ensure_page_limit(_pdf(tmp_path, 151), None, "pdf-to-word")


def test_sayfa_sayisi_okunamazsa_sessizce_gecer(tmp_path):
    bozuk = tmp_path / "x.pdf"
    bozuk.write_bytes(b"degil")
    ensure_page_limit(str(bozuk), None, "pdf-to-word")

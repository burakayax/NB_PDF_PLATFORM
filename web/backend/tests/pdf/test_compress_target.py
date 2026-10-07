"""PDF sıkıştırma — HEDEF BOYUT modu.

Gerçek PDF'lerle çalışır (mock yok). Doğruladığımız sözler:
  * Hedef zaten karşılanıyorsa dosyaya dokunulmaz.
  * Ulaşılabilir hedefte hedefin altına inilir.
  * Metin-koruyan basamaklar metni gerçekten korur.
  * Ulaşılamayan hedefte DÜRÜST sonuç: ulaşıldı=False, en küçük hâl verilir.
  * Görüntüye çevirme yalnızca izin verilince denenir ve `rasterized` ile bildirilir.
"""

from __future__ import annotations

import io
import os
import random
import sys
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import fitz  # PyMuPDF
from PIL import Image

try:
    import src.pdf_engine as engine  # noqa: E402

    ENGINE_OK = True
except Exception:  # pragma: no cover
    engine = None  # type: ignore[assignment]
    ENGINE_OK = False

pytestmark = pytest.mark.skipif(not ENGINE_OK, reason="pdf_engine içe aktarılamadı")

KB = 1024
MB = 1024 * 1024


def _photo(w: int, h: int, seed: int) -> bytes:
    """Gürültülü ama sıkıştırılabilir bir "fotoğraf" (JPEG bayt dizisi)."""
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            base = (x * 255 // w, y * 255 // h, (x + y) * 255 // (w + h))
            n = rnd.randint(-40, 40)
            px[x, y] = tuple(max(0, min(255, c + n)) for c in base)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def _make_pdf(path: Path, *, pages: int = 3, with_text: bool = True, with_image: bool = True) -> None:
    doc = fitz.open()
    photo = _photo(1600, 1100, 1) if with_image else b""
    for i in range(pages):
        page = doc.new_page()
        if with_text:
            for k in range(12):
                page.insert_text((60, 80 + k * 22), f"Sayfa {i + 1} satır {k}: sözleşme metni örneği seçilebilir yazı.", fontsize=11)
        if with_image:
            page.insert_image(fitz.Rect(40, 360, 555, 760), stream=photo)
    doc.save(str(path), garbage=1)
    doc.close()


def _text_len(path: str) -> int:
    d = fitz.open(path)
    try:
        return sum(len((p.get_text("text") or "").strip()) for p in d)
    finally:
        d.close()


@pytest.fixture()
def photo_pdf(tmp_path):
    p = tmp_path / "foto.pdf"
    _make_pdf(p, pages=4)
    return str(p)


def test_zaten_hedefin_altindaysa_dokunulmaz(photo_pdf, tmp_path):
    size = os.path.getsize(photo_pdf)
    out = str(tmp_path / "out.pdf")
    r = engine.compress_pdf_to_target(photo_pdf, out, size + 10 * KB)
    assert r["reached"] is True and r["method"] == "unchanged"
    assert os.path.getsize(out) == size


def test_ulasilabilir_hedefte_hedefin_altina_iner_ve_metin_korunur(photo_pdf, tmp_path):
    size = os.path.getsize(photo_pdf)
    target = int(size * 0.6)
    out = str(tmp_path / "out.pdf")
    r = engine.compress_pdf_to_target(photo_pdf, out, target)
    assert r["reached"] is True, r
    assert os.path.getsize(out) <= target
    assert r["rasterized"] is False
    # Metin katmanı korunmuş olmalı (seçilebilir).
    assert _text_len(out) >= 0.5 * _text_len(photo_pdf)
    fitz.open(out).close()  # geçerli PDF


def test_ulasilamayan_hedefte_durust_sonuc(photo_pdf, tmp_path):
    out = str(tmp_path / "out.pdf")
    r = engine.compress_pdf_to_target(photo_pdf, out, 21 * KB)  # 4 sayfalık fotoğraflı PDF için imkânsız
    assert r["reached"] is False
    assert r["rasterized"] is False  # izin verilmedi
    assert os.path.getsize(out) == r["bytes"]
    assert r["bytes"] <= os.path.getsize(photo_pdf)  # en küçük hâl, asla daha büyük değil
    assert _text_len(out) >= 0.5 * _text_len(photo_pdf)  # metin yine korunur


def test_izin_verilince_goruntuye_cevirme_denenir_ve_bildirilir(photo_pdf, tmp_path):
    out = str(tmp_path / "out.pdf")
    r = engine.compress_pdf_to_target(photo_pdf, out, 70 * KB, allow_rasterize=True)
    if r["rasterized"]:
        assert os.path.getsize(out) == r["bytes"]
        assert r["method"] == "rasterize"
        assert _text_len(out) < _text_len(photo_pdf)  # yazı seçilemez oldu — söylenen bu
    else:
        # Metin-koruyan basamaklar yettiyse görüntüye çevrilmemeli.
        assert r["reached"] is True
        assert _text_len(out) >= 0.5 * _text_len(photo_pdf)


def test_izin_yoksa_asla_goruntuye_cevrilmez(photo_pdf, tmp_path):
    out = str(tmp_path / "out.pdf")
    r = engine.compress_pdf_to_target(photo_pdf, out, 30 * KB, allow_rasterize=False)
    assert r["rasterized"] is False
    assert _text_len(out) >= 0.5 * _text_len(photo_pdf)


def test_gecersiz_hedef_reddedilir(photo_pdf, tmp_path):
    out = str(tmp_path / "out.pdf")
    with pytest.raises(ValueError):
        engine.compress_pdf_to_target(photo_pdf, out, 1 * KB)
    with pytest.raises(ValueError):
        engine.compress_pdf_to_target(photo_pdf, out, 500 * MB)


def test_salt_metin_pdf_kazanc_yoksa_orijinal_ve_ulasilamadi(tmp_path):
    p = tmp_path / "metin.pdf"
    _make_pdf(p, pages=6, with_image=False)
    size = os.path.getsize(p)
    out = str(tmp_path / "out.pdf")
    r = engine.compress_pdf_to_target(str(p), out, 20 * KB if size > 20 * KB else size - 1 if size > 20 * KB else 20 * KB)
    # Küçük bir salt-metin PDF zaten hedefin altındaysa değişmez; değilse dürüstçe bildirilir.
    if size <= 20 * KB:
        assert r["reached"] is True
    else:
        assert r["bytes"] <= size


def test_goruntuye_cevirme_hedefe_iner_metni_kaybeder_gecici_dosya_birakmaz(photo_pdf, tmp_path):
    import time

    out = str(tmp_path / "r.pdf")
    size = engine._rasterize_to_target(photo_pdf, out, 200 * KB, "", time.monotonic() + 120)
    assert size is not None and size <= 200 * KB
    assert os.path.getsize(out) == size
    assert _text_len(out) == 0  # yazı seçilemez — arayüz bunu kullanıcıya söylüyor
    assert fitz.open(out).page_count == fitz.open(photo_pdf).page_count
    # Geçici dosya sızıntısı olmamalı.
    assert sorted(p.name for p in tmp_path.iterdir() if p.suffix == ".pdf") == ["foto.pdf", "r.pdf"]


def test_goruntuye_cevirme_imkansiz_hedefte_en_kucugunu_yazar(photo_pdf, tmp_path):
    import time

    out = str(tmp_path / "r.pdf")
    size = engine._rasterize_to_target(photo_pdf, out, 5 * KB, "", time.monotonic() + 120)
    assert size is not None and size > 5 * KB  # hedefe inilemedi, ama sonuç yazıldı
    assert os.path.getsize(out) == size


def test_api_hedef_alani_dogrulamasi():
    routes = pytest.importorskip("app.api.routes")
    from fastapi import HTTPException

    assert routes._parse_compress_target(0, "1") == (0, False)  # hedef yoksa izin de yok
    assert routes._parse_compress_target(500, "") == (500 * KB, False)
    assert routes._parse_compress_target(500, "1") == (500 * KB, True)
    assert routes._parse_compress_target(1024, "true") == (1024 * KB, True)
    for bad in (1, 19, 200 * 1024 + 1, 10**9):
        with pytest.raises(HTTPException) as e:
            routes._parse_compress_target(bad, "")
        assert e.value.status_code == 400

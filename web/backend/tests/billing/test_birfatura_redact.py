"""BirFatura hata/log metinlerinde 10-11 haneli numaralar (VKN/TCKN) maskelenir."""
from app.billing.birfatura import _redact


def test_tckn_ve_vkn_maskelenir():
    out = _redact("Hata: alici 12345678901 ve satici 1234567890 gecersiz")
    assert "12345678901" not in out and "1234567890" not in out
    assert "<no-gizli>" in out


def test_diger_sayilar_korunur():
    assert _redact("HTTP 400 kod 12345") == "HTTP 400 kod 12345"

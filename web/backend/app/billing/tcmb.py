"""TCMB (Türkiye Cumhuriyet Merkez Bankası) döviz kuru çekici.

Günlük XML endpoint'i kullanır; aynı gün içinde birden fazla çağrıda
sonucu bellekte saklar (in-process cache).
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import date
from typing import Any
from xml.etree import ElementTree

import requests

logger = logging.getLogger(__name__)

_TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml"
_CACHE_TTL = 3600  # saniye — günde bir kez değişir; 1 saat yeterli

_lock = threading.Lock()
_cache: dict[str, Any] = {}   # {"rates": {...}, "date": "YYYY-MM-DD", "ts": float}


def _fetch_rates() -> dict[str, float]:
    """TCMB XML'inden döviz kurlarını çeker. {ISO_CODE: TRY_buying} döner."""
    resp = requests.get(_TCMB_URL, timeout=10)
    resp.raise_for_status()
    root = ElementTree.fromstring(resp.content)
    rates: dict[str, float] = {}
    for currency in root.findall("Currency"):
        code = currency.get("CurrencyCode", "").upper()
        # ForexBuying — döviz alış kuru
        buying_el = currency.find("ForexBuying")
        if buying_el is not None and buying_el.text:
            try:
                rates[code] = float(buying_el.text.replace(",", "."))
            except ValueError:
                pass
    logger.debug("tcmb: %d kur çekildi: %s", len(rates), list(rates.keys()))
    return rates


def get_rate(currency_code: str) -> float:
    """
    currency_code için TCMB döviz alış kurunu döner (1 birim = X TRY).
    TRY için 1.0 döner.
    Hata durumunda 1.0 döner ve uyarı loglar (fatura akışı bloke olmaz).
    """
    code = currency_code.strip().upper()
    if code in ("TRY", "TRL", ""):
        return 1.0

    with _lock:
        now = time.time()
        today_str = date.today().isoformat()
        cached = _cache.get("rates")
        cached_date = _cache.get("date")
        cached_ts = _cache.get("ts", 0.0)

        if cached and cached_date == today_str and (now - cached_ts) < _CACHE_TTL:
            rate = cached.get(code)
            if rate:
                logger.debug("tcmb cache: %s = %.4f TRY", code, rate)
                return rate

        # Cache geçersiz ya da boş — yenile
        try:
            rates = _fetch_rates()
            _cache["rates"] = rates
            _cache["date"] = today_str
            _cache["ts"] = now
            rate = rates.get(code)
            if rate:
                logger.info("tcmb: %s = %.4f TRY (yeni çekim)", code, rate)
                return rate
            logger.warning("tcmb: %s kuru bulunamadı, 1.0 kullanılıyor", code)
            return 1.0
        except Exception as exc:
            logger.error("tcmb: kur çekme hatası, 1.0 kullanılıyor hata=%s", exc)
            return 1.0

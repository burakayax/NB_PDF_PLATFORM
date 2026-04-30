"""SlowAPI: IP başına dakikalık üst sınır (varsayılan 10/dk)."""

from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address


def rate_limit_key_func(request):
    """TRUST_PROXY=1 iken X-Forwarded-For ilk adresi; aksi halde doğrudan istemci."""
    if os.getenv("TRUST_PROXY", "").strip().lower() in ("1", "true", "yes"):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return get_remote_address(request)


_raw = os.getenv("RATE_LIMIT_DEFAULT")
_rate_default = (
    _raw.strip()
    if _raw is not None and _raw.strip()
    else "10/minute"
)
limiter = Limiter(
    key_func=rate_limit_key_func,
    default_limits=[_rate_default],
)

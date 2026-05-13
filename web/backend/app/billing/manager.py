"""Billing provider factory — BILLING_PROVIDER env var ile seçim yapar."""

from __future__ import annotations

import os

from .base import BillingProviderBase


def get_provider() -> BillingProviderBase:
    """
    BILLING_PROVIDER değerine göre provider örneği döner.
    Desteklenen değerler: mock (varsayılan), parasut
    """
    provider = os.getenv("BILLING_PROVIDER", "mock").strip().lower()

    if provider == "parasut":
        from .parasut import ParasutProvider
        return ParasutProvider()

    if provider == "birfatura":
        from .birfatura import BirFaturaProvider
        return BirFaturaProvider()

    if provider == "mock":
        from .mock import MockProvider
        return MockProvider()

    raise ValueError(
        f"Bilinmeyen billing provider: '{provider}'. "
        "Desteklenen değerler: mock, parasut, birfatura"
    )

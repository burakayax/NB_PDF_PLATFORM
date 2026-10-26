"""Tüm testler için ortak ayarlar."""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _no_fork_sandbox(monkeypatch):
    """PDF uç noktaları Linux'ta işi `fork` ile ayrı bir süreçte çalıştırır (pdf_sandbox).

    TestClient uygulamayı ayrı bir iş parçacığında çalıştırdığı için çok iş parçacıklı süreçte
    `fork` KİLİTLENEBİLİR: çocuk süreç, başka bir iş parçacığının tuttuğu kilidi (log, bellek ayırıcı)
    miras alır ve hiç çıkmaz. CI'da pytest 15-40 dakika takılıp zaman aşımına uğruyordu; yalnız
    Linux'ta ve ara sıra olduğu için yerelde (Windows'ta sandbox zaten kapalı) görünmüyordu.

    Testte işlev doğrudan çalışsın — davranış aynı, yalnız süreç izolasyonu yok. İzolasyonun kendisini
    sınamak isteyen bir test, bu ayarı kendi içinde `monkeypatch.setenv("PDF_SANDBOX_ENABLED", "true")`
    ile geri açabilir (şu an böyle bir test yok).
    """
    monkeypatch.setenv("PDF_SANDBOX_ENABLED", "false")

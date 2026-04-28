"""Önizleme uçları için eşzamanlılık: CPU ağır hero PNG üretimini kuyruklar.

SlowAPI varsayılan limiti (10/dk) ayrıca ``routes`` içinde önizleme GET'lerinde
gevşetilir; burada ise aynı anda çalışacak hero raster sayısı sınırlanır — istekler
reddedilmez, semaphore sırasıyla bekler.
"""

from __future__ import annotations

import asyncio
import os
from typing import Optional

from app.core.preview_thumbnail import generate_hero_watermarked_preview_png
from app.core.thread_pool import run_cpu_bound

_MAX = max(1, int(os.getenv("PREVIEW_HERO_MAX_CONCURRENT", "2")))
_hero_semaphore = asyncio.Semaphore(_MAX)


async def generate_hero_watermarked_preview_png_queued(pdf_bytes: bytes) -> Optional[bytes]:
    """Hero önizlemesini en fazla ``PREVIEW_HERO_MAX_CONCURRENT`` eşzamanlı iş parçacığında üret."""
    async with _hero_semaphore:
        return await run_cpu_bound(generate_hero_watermarked_preview_png, pdf_bytes)

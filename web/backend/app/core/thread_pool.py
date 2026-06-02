"""Offload blocking PDF / CPU work from the asyncio event loop.

Varsayılan Starlette ``run_in_threadpool`` yerine yapılandırılabilir
``ThreadPoolExecutor`` + ``PDF_CPU_MAX_IN_FLIGHT`` ile global eşzamanlılık
tavanı kullanılır. Böylece yüzlerce eşzamanlı HTTP isteği geldiğinde sınırsız
iş parçacığı / bellek şişmesi yerine kontrollü kuyruk ve anlamlı 503 yanıtı
üretilir.

Üretimde birden fazla uvicorn worker kullanıldığında tavan **işlem başına**
uygulanır; toplam kapasite ≈ worker_sayısı × PDF_CPU_MAX_IN_FLIGHT.

Harici Redis/Celery/RQ kuyruğu için ayrı worker süreci ve paylaşılan depolama
gerekir; bu modül tek makine / tek API süreci ölçeklemesini çözer.
"""

from __future__ import annotations

import asyncio
import functools
import logging
import os
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")

logger = logging.getLogger(__name__)

_init_lock = threading.Lock()
_executor: ThreadPoolExecutor | None = None
_slots: asyncio.Semaphore | None = None


class CpuCapacityTimeout(Exception):
    """PDF CPU havuzu ``PDF_CPU_QUEUE_WAIT_SEC`` içinde slot vermedi."""

    def __init__(self, *, retry_after_sec: int) -> None:
        super().__init__("pdf_cpu_capacity_timeout")
        self.retry_after_sec = retry_after_sec


def _workers() -> int:
    raw = os.getenv("PDF_CPU_WORKERS", "").strip()
    if raw.isdigit():
        return max(1, min(256, int(raw)))
    cpu = os.cpu_count() or 4
    return max(4, min(32, cpu * 2))


def _max_in_flight() -> int:
    raw = os.getenv("PDF_CPU_MAX_IN_FLIGHT", "").strip()
    if raw.isdigit():
        return max(1, min(512, int(raw)))
    return _workers()


def _acquire_timeout_sec() -> float:
    raw = os.getenv("PDF_CPU_QUEUE_WAIT_SEC", "").strip()
    if raw:
        try:
            return max(1.0, float(raw))
        except ValueError:
            pass
    return 300.0


def _retry_after_header_sec() -> int:
    raw = os.getenv("PDF_CPU_RETRY_AFTER_SEC", "").strip()
    if raw.isdigit():
        return max(5, min(3600, int(raw)))
    return min(120, max(15, int(_acquire_timeout_sec())))


def _operation_timeout_sec() -> float:
    """Tek bir PDF işleminin maksimum çalışma süresi (saniye). Varsayılan 120."""
    raw = os.getenv("PDF_OPERATION_TIMEOUT_SEC", "").strip()
    if raw:
        try:
            return max(10.0, float(raw))
        except ValueError:
            pass
    return 600.0


def pdf_cpu_settings_snapshot() -> dict[str, int | float]:
    return {
        "workers": _workers(),
        "max_in_flight": _max_in_flight(),
        "queue_wait_sec": _acquire_timeout_sec(),
    }


def init_pdf_thread_pool() -> None:
    """Uvicorn/FastAPI lifespan başında çağrılır: havuzu oluşturur ve loglar."""
    _executor_singleton()
    snap = pdf_cpu_settings_snapshot()
    logger.info(
        "pdf_cpu_pool started workers=%s max_in_flight=%s queue_wait_sec=%s",
        snap["workers"],
        snap["max_in_flight"],
        snap["queue_wait_sec"],
    )


def shutdown_pdf_thread_pool(*, wait: bool = True, cancel_futures: bool = False) -> None:
    """Lifespan kapanışında executor'ı düzgün kapat."""
    global _executor
    with _init_lock:
        ex = _executor
        _executor = None
    if ex is not None:
        ex.shutdown(wait=wait, cancel_futures=cancel_futures)
        logger.info("pdf_cpu_pool shutdown wait=%s", wait)


def _executor_singleton() -> ThreadPoolExecutor:
    global _executor
    with _init_lock:
        if _executor is None:
            _executor = ThreadPoolExecutor(
                max_workers=_workers(),
                thread_name_prefix="pdf_cpu",
            )
        return _executor


def _get_slots() -> asyncio.Semaphore:
    global _slots
    if _slots is None:
        with _init_lock:
            if _slots is None:
                _slots = asyncio.Semaphore(_max_in_flight())
    return _slots


async def run_cpu_bound(func: Callable[P, R], *args: P.args, **kwargs: P.kwargs) -> R:
    """Run ``func(*args, **kwargs)`` in the PDF thread pool with global concurrency cap."""
    executor = _executor_singleton()
    slots = _get_slots()
    timeout = _acquire_timeout_sec()
    op_timeout = _operation_timeout_sec()
    retry_after = _retry_after_header_sec()
    try:
        await asyncio.wait_for(slots.acquire(), timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning(
            "pdf_cpu_pool saturated timeout_sec=%s max_in_flight=%s",
            timeout,
            _max_in_flight(),
        )
        raise CpuCapacityTimeout(retry_after_sec=retry_after) from None
    loop = asyncio.get_running_loop()
    try:
        future = loop.run_in_executor(executor, functools.partial(func, *args, **kwargs))
        return await asyncio.wait_for(future, timeout=op_timeout)
    except asyncio.TimeoutError:
        logger.error(
            "pdf_operation_timeout op_timeout_sec=%s func=%s",
            op_timeout,
            getattr(func, "__name__", repr(func)),
        )
        raise CpuCapacityTimeout(retry_after_sec=retry_after) from None
    finally:
        slots.release()

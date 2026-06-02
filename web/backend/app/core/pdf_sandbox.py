"""PDF Subprocess Sandbox — süreç izolasyonu.

Mimari gerekçe
──────────────
PyMuPDF, pikepdf ve pdf2docx gibi kütüphaneler güvenilmeyen kullanıcı
dosyalarını doğrudan belleğe yükler. Herhangi bir CVE istismarı ana
uvicorn/gunicorn sürecini çökertebilir veya bellek sızdırabilir.

Bu modül her ağır PDF işlemini ayrı bir ``multiprocessing`` süreci içinde
çalıştırır:

- Ana süreç hiçbir zaman bozuk PDF verisine dokunmaz.
- Alt süreç çökerse/segfault olursa ana süreç etkilenmez; yalnızca ilgili
  istek 500 döner.
- Linux'ta ``resource`` modülüyle bellek + CPU süresi sınırlanır.

Neden ``fork``?
───────────────
PDF endpoint'lerindeki iş fonksiyonları **closure**'dur (yerel ``_run``
kapanışları). ``spawn`` bağlamı target/args'ı pickle etmeye çalışır ve
closure'lar pickle edilemez. ``fork`` ise çocuğa tüm bellek alanını miras
bırakır; target pickle edilmez, closure olduğu gibi çalışır.

``fork`` yalnızca Linux/macOS'ta vardır. Windows'ta (geliştirme ortamı)
``fork`` yoktur; bu durumda sandbox otomatik devre dışı kalır ve eski
thread havuzu davranışına düşülür. Üretim (Render/Linux) her zaman
izole subprocess kullanır.

Kullanım (mevcut kodla birebir uyumlu)
──────────────────────────────────────
    from app.core.pdf_sandbox import run_sandboxed
    body = await run_sandboxed(_run)
"""

from __future__ import annotations

import asyncio
import functools
import logging
import multiprocessing
import os
import sys
import traceback
from collections.abc import Callable
from typing import Any, TypeVar

from app.core.thread_pool import (
    CpuCapacityTimeout,
    _acquire_timeout_sec,
    _executor_singleton,
    _get_slots,
    _operation_timeout_sec,
    _retry_after_header_sec,
)

logger = logging.getLogger(__name__)

R = TypeVar("R")

# ``fork`` yalnızca POSIX'te (Linux/macOS) vardır. Windows = spawn only → sandbox kapalı.
_FORK_AVAILABLE = "fork" in multiprocessing.get_all_start_methods()


def _sandbox_enabled() -> bool:
    """Sandbox aktif mi? Hem env hem platform desteği gerekir."""
    env_flag = os.getenv("PDF_SANDBOX_ENABLED", "true").strip().lower()
    if env_flag in ("false", "0", "no"):
        return False
    return _FORK_AVAILABLE


# ── Kaynak limitleri ────────────────────────────────────────────────────────

def _apply_resource_limits() -> None:
    """Alt süreçte Linux kaynak sınırlarını uygular. Diğer OS'lerde no-op."""
    try:
        import resource  # type: ignore[import]  # POSIX only

        mem_mb = int(os.getenv("PDF_SANDBOX_MEM_MB", "1024"))
        mem_bytes = mem_mb * 1024 * 1024
        try:
            resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
        except (ValueError, OSError):
            pass

        cpu_sec = int(os.getenv("PDF_SANDBOX_CPU_SEC", "120"))
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_sec, cpu_sec + 10))
        except (ValueError, OSError):
            pass
    except ImportError:
        pass


# ── Alt süreç giriş noktası ─────────────────────────────────────────────────

def _subprocess_worker(
    func: Callable[[], Any],
    result_queue: Any,
) -> None:
    """Fork edilmiş çocuk süreçte çalışır. Sonuç/hata queue'ya yazılır.

    ``func`` fork ile miras alınır (pickle edilmez), bu yüzden closure olabilir.
    Dönüş değeri picklable olmalıdır (PDF endpoint'leri dict döndürür — uygun).
    """
    _apply_resource_limits()
    try:
        result = func()
        result_queue.put((True, result))
    except Exception as exc:  # noqa: BLE001
        tb = traceback.format_exc()
        result_queue.put((False, (type(exc).__name__, str(exc), tb)))


def _run_in_subprocess(func: Callable[[], Any], timeout_sec: float) -> Any:
    """``func``'ı fork edilmiş izole bir süreçte çalıştırır, sonucu döndürür.

    ThreadPoolExecutor thread'inde (blocking) çağrılır.
    """
    ctx = multiprocessing.get_context("fork")
    result_queue = ctx.Queue(maxsize=1)

    proc = ctx.Process(
        target=_subprocess_worker,
        args=(func, result_queue),
        daemon=True,
        name="pdf-sandbox-worker",
    )
    proc.start()

    import queue as _queue_mod
    try:
        ok, payload = result_queue.get(timeout=timeout_sec)
    except _queue_mod.Empty:
        proc.kill()
        proc.join(timeout=5)
        logger.error(
            "pdf_sandbox_timeout func=%s timeout_sec=%s pid=%s",
            getattr(func, "__name__", repr(func)),
            timeout_sec,
            proc.pid,
        )
        raise TimeoutError(f"PDF işlemi {timeout_sec}s içinde tamamlanamadı.") from None
    finally:
        if proc.is_alive():
            proc.kill()
        proc.join(timeout=5)

    if ok:
        return payload

    exc_type_name, exc_msg, tb_str = payload
    logger.error(
        "pdf_sandbox_error func=%s exc_type=%s exc=%s\n%s",
        getattr(func, "__name__", repr(func)),
        exc_type_name,
        exc_msg[:240],
        tb_str[-800:],
    )
    # Orijinal hata mesajını koruyarak yeniden fırlat — operations.cleanup_and_raise
    # bunu kullanıcı-dostu mesaja çevirir.
    raise RuntimeError(f"[{exc_type_name}] {exc_msg}") from None


# ── Async arayüzü (thread_pool.run_cpu_bound ile aynı imza) ─────────────────

async def run_sandboxed(func: Callable[..., R], *args: Any, **kwargs: Any) -> R:
    """``func(*args, **kwargs)`` işlemini izole bir alt süreçte çalıştırır.

    thread_pool.run_cpu_bound ile aynı concurrency cap + semaphore + timeout
    mekanizmasını paylaşır. ``run_cpu_bound`` çağrılarının yerine geçer.

    - Linux + ``PDF_SANDBOX_ENABLED!=false`` → fork ile subprocess izolasyonu
    - Windows / sandbox kapalı → eski thread havuzu davranışı (closure pickle sorunu yok)
    """
    slots = _get_slots()
    acquire_timeout = _acquire_timeout_sec()
    op_timeout = _operation_timeout_sec()
    retry_after = _retry_after_header_sec()

    try:
        await asyncio.wait_for(slots.acquire(), timeout=acquire_timeout)
    except asyncio.TimeoutError:
        logger.warning("pdf_sandbox_saturated timeout_sec=%s", acquire_timeout)
        raise CpuCapacityTimeout(retry_after_sec=retry_after) from None

    loop = asyncio.get_running_loop()
    executor = _executor_singleton()

    if args or kwargs:
        callable_func: Callable[[], Any] = functools.partial(func, *args, **kwargs)
    else:
        callable_func = func  # type: ignore[assignment]

    try:
        if _sandbox_enabled():
            future = loop.run_in_executor(
                executor,
                functools.partial(_run_in_subprocess, callable_func, op_timeout),
            )
            # Subprocess kendi timeout'unu uygular; ek 15s tampon ile sarmala.
            return await asyncio.wait_for(future, timeout=op_timeout + 15)
        else:
            # Geliştirme (Windows) veya sandbox kapalı: thread havuzu.
            future = loop.run_in_executor(executor, callable_func)
            return await asyncio.wait_for(future, timeout=op_timeout)
    except (asyncio.TimeoutError, TimeoutError):
        logger.error("pdf_sandbox_op_timeout op_timeout_sec=%s", op_timeout)
        raise CpuCapacityTimeout(retry_after_sec=retry_after) from None
    finally:
        slots.release()

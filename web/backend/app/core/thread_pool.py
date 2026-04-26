"""Offload blocking PDF / CPU work from the asyncio event loop.

FastAPI ``async`` handlers must not run long synchronous calls (``pikepdf``,
``fitz``, ``PyPDF2``, large ``read_bytes``) on the main thread: they block
all other HTTP and WebSocket traffic. We delegate to Starlette's thread pool
(``anyio.to_thread`` under the hood).
"""

from __future__ import annotations

import functools
from collections.abc import Callable
from typing import ParamSpec, TypeVar

from starlette.concurrency import run_in_threadpool

P = ParamSpec("P")
R = TypeVar("R")


async def run_cpu_bound(func: Callable[P, R], *args: P.args, **kwargs: P.kwargs) -> R:
    """Run ``func(*args, **kwargs)`` in a worker thread and await the result."""
    return await run_in_threadpool(functools.partial(func, *args, **kwargs))

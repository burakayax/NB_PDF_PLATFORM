"""Uretim icin JSON tabanli yapilandirilmis loglama ayarlari.

LOG_FORMAT=json (veya uretimde varsayilan) iken her log satiri tek satir JSON olarak cikar.
Bu format Loki, Datadog, CloudWatch gibi log aggregator'larla uyumludur.
"""

from __future__ import annotations

import io
import json
import logging
import os
import sys
import time
from typing import Any


class JsonFormatter(logging.Formatter):
    """Her log kaydini tek satir JSON olarak serileştirir."""

    LEVEL_MAP = {
        logging.DEBUG: "debug",
        logging.INFO: "info",
        logging.WARNING: "warning",
        logging.ERROR: "error",
        logging.CRITICAL: "critical",
    }

    def format(self, record: logging.LogRecord) -> str:
        data: dict[str, Any] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": self.LEVEL_MAP.get(record.levelno, record.levelname.lower()),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            data["exc"] = self.formatException(record.exc_info)
        for key in ("ip", "path", "method", "user_id", "result_id"):
            if hasattr(record, key):
                data[key] = getattr(record, key)
        return json.dumps(data, ensure_ascii=False)


def _utf8_stream() -> Any:
    """Windows'ta stdout'u UTF-8 moduna alir; diger platformlarda aynen doner."""
    stream = sys.stdout
    if sys.platform == "win32" and hasattr(stream, "buffer"):
        try:
            return io.TextIOWrapper(
                stream.buffer, encoding="utf-8", errors="replace", line_buffering=True
            )
        except Exception:
            pass
    return stream


def configure_logging() -> None:
    """Uygulama baslangiicinda bir kez cagrilir."""
    fmt = os.getenv("LOG_FORMAT", "json" if os.getenv("NODE_ENV") == "production" else "text").lower()
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)

    if root.handlers:
        root.handlers.clear()

    handler = logging.StreamHandler(_utf8_stream())
    handler.setLevel(level)

    if fmt == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s %(levelname)-8s %(name)s - %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )

    root.addHandler(handler)

    # Gurultulu kutuphaneleri sustur
    for noisy in ("fontTools", "PIL", "urllib3", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.ERROR)

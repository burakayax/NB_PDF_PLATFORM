"""Masaüstü üretim loglaması + global çökme (crash) yakalama.

Bu modül üç şey sağlar:

1. **Rotasyonlu dosya logu** — ``%APPDATA%/PDF PLATFORM/logs/desktop.log``
   (5 MB × 3 dosya). `print()` yerine yapılandırılmış log; üretimde tanı için.
2. **Global exception hook** — `sys.excepthook` + `threading.excepthook`
   yakalanmayan tüm hataları tam traceback ile loglar (süreç sessizce ölmez).
3. **Tkinter hata köprüsü + çökme diyaloğu** — UI thread'inde yakalanmayan
   hatayı loglar, kullanıcıya sade Türkçe/İngilizce bir uyarı gösterir ve
   log dosyasının yolunu bildirir (crash recovery için zemin).

Hassas veri (token, parola) loglanmaz; çağıranlar bunları log mesajına koymamalı.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
import sys
import threading
import traceback
from pathlib import Path
from typing import Any, Optional

_LOGGER_NAME = "nb_pdf_desktop"
_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
_BACKUP_COUNT = 3

_configured = False
_log_file_path: Optional[Path] = None


def _user_data_dir() -> Path:
    """``%APPDATA%/PDF PLATFORM`` (Windows) veya HOME tabanlı eşdeğeri."""
    base = os.environ.get("APPDATA")
    if not base:
        # Windows dışı / APPDATA yoksa: ~/.pdfplatform
        base = str(Path.home() / ".pdfplatform")
    return Path(base) / "PDF PLATFORM"


def log_file_path() -> Path:
    return _user_data_dir() / "logs" / "desktop.log"


def setup_logging(level: int = logging.INFO) -> logging.Logger:
    """Rotasyonlu dosya + konsol handler'larını bir kez kurar; logger döndürür.

    Tekrar çağrılırsa mevcut logger döner (idempotent).
    """
    global _configured, _log_file_path
    logger = logging.getLogger(_LOGGER_NAME)
    if _configured:
        return logger

    logger.setLevel(level)
    logger.propagate = False

    fmt = logging.Formatter(
        "%(asctime)s %(levelname)s [%(threadName)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Dosya handler (rotasyonlu) — yazılamıyorsa sessizce konsola düşer.
    try:
        target = log_file_path()
        target.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            target, maxBytes=_MAX_BYTES, backupCount=_BACKUP_COUNT, encoding="utf-8"
        )
        file_handler.setFormatter(fmt)
        logger.addHandler(file_handler)
        _log_file_path = target
    except Exception:
        # Dosyaya yazamıyorsak (izin/disk) en azından konsol handler kalır.
        pass

    # Konsol handler — donmuş (frozen, windowed) build'de stderr None olabilir.
    if sys.stderr is not None:
        console = logging.StreamHandler(sys.stderr)
        console.setFormatter(fmt)
        logger.addHandler(console)

    _configured = True
    logger.info("desktop logging başlatıldı file=%s", _log_file_path or "<konsol-only>")
    return logger


def get_logger(child: Optional[str] = None) -> logging.Logger:
    """Modüller için alt-logger döndürür (örn. ``get_logger('payment')``)."""
    base = setup_logging()
    if child:
        return base.getChild(child)
    return base


def _format_crash(exc_type: type, exc_value: BaseException, exc_tb: Any) -> str:
    return "".join(traceback.format_exception(exc_type, exc_value, exc_tb))


def _show_crash_dialog(message: str) -> None:
    """Kullanıcıya sade bir çökme uyarısı gösterir (UI yoksa sessizce geçer)."""
    try:
        import tkinter.messagebox as messagebox

        path = str(_log_file_path or log_file_path())
        messagebox.showerror(
            "Beklenmeyen bir hata oluştu",
            (
                "Uygulamada beklenmeyen bir hata oluştu ve işlem tamamlanamadı.\n"
                "An unexpected error occurred.\n\n"
                f"Teknik kayıt / log: {path}\n\n"
                "Sorun sürerse bu dosyayı destek ekibiyle paylaşın."
            ),
        )
    except Exception:
        # Diyalog gösterilemiyorsa (root yok / headless) sessizce devam et.
        pass


def install_crash_handlers(show_dialog: bool = True) -> None:
    """`sys.excepthook` ve `threading.excepthook`'u logger'a yönlendirir.

    Yakalanmayan her hata tam traceback ile dosyaya yazılır; istenirse
    kullanıcıya sade bir uyarı gösterilir. KeyboardInterrupt korunur.
    """
    logger = setup_logging()

    def _hook(exc_type, exc_value, exc_tb):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_tb)
            return
        logger.critical("Yakalanmayan hata:\n%s", _format_crash(exc_type, exc_value, exc_tb))
        if show_dialog:
            _show_crash_dialog(str(exc_value))

    sys.excepthook = _hook

    # threading.excepthook (Python 3.8+) — worker thread hataları da loglanır.
    def _thread_hook(args: threading.ExceptHookArgs) -> None:  # type: ignore[name-defined]
        if issubclass(args.exc_type, KeyboardInterrupt):
            return
        logger.critical(
            "Worker thread'de yakalanmayan hata (%s):\n%s",
            args.thread.name if args.thread else "?",
            _format_crash(args.exc_type, args.exc_value, args.exc_traceback),
        )

    try:
        threading.excepthook = _thread_hook
    except Exception:
        pass


def install_tk_exception_bridge(tk_root: Any, show_dialog: bool = True) -> None:
    """Tkinter event-loop içindeki yakalanmayan hataları logger'a köprüler.

    CustomTkinter/Tk varsayılanı hatayı stderr'e basıp yutar; bu köprü
    hatayı dosyaya yazar ve (istenirse) kullanıcıya gösterir.
    """
    logger = setup_logging()

    def _report(exc_type, exc_value, exc_tb):
        logger.error("Tkinter callback hatası:\n%s", _format_crash(exc_type, exc_value, exc_tb))
        if show_dialog:
            _show_crash_dialog(str(exc_value))

    try:
        tk_root.report_callback_exception = _report
    except Exception:
        pass

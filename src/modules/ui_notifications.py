"""Profesyonel masaüstü bildirim sistemi: non-blocking toast + temalı onay diyaloğu.

Neden: Uygulama her yerde bloklayan native ``tkinter.messagebox`` kullanıyordu.
Bu modül web ile tutarlı, marka renkli, otomatik kapanan ve yığılabilen (stack)
toast bildirimleri ve modern bir onay (confirm) diyaloğu sağlar.

Kullanım:
    from modules.ui_notifications import show_toast, confirm
    show_toast(self, "İşlem tamamlandı", kind="success")
    if confirm(self, "Çıkış", "Oturumu kapatmak istiyor musunuz?"):
        ...

``kind``: "success" | "info" | "warning" | "error".
Tüm fonksiyonlar UI thread'inden çağrılmalıdır (Tkinter kuralı).
"""

from __future__ import annotations

import tkinter as tk
from typing import Optional

import customtkinter as ctk

from modules.ui_theme import theme

try:
    from modules.desktop_logging import get_logger

    _log = get_logger("ui")
except Exception:  # pragma: no cover - logging opsiyonel
    _log = None


# Bildirim türüne göre renk + ikon (web tasarım diliyle hizalı).
_KIND_STYLE = {
    "success": {"accent": "success", "icon": "✓"},
    "info": {"accent": "accent", "icon": "ℹ"},
    "warning": {"accent": "warning", "icon": "⚠"},
    "error": {"accent": "danger", "icon": "✕"},
}

# Aktif toast'ların kök pencere bazlı kayıt defteri (yığma/konumlandırma için).
_active_by_root: "dict[int, list[_Toast]]" = {}


def _toplevel_for(widget: tk.Misc) -> Optional[tk.Misc]:
    try:
        return widget.winfo_toplevel()
    except Exception:
        return None


def _restack(root_id: int) -> None:
    """Bir kök penceredeki tüm toast'ları sağ-üstten aşağı yeniden konumlandırır."""
    toasts = _active_by_root.get(root_id, [])
    y = 24
    for toast in list(toasts):
        if not toast._alive():
            try:
                toasts.remove(toast)
            except ValueError:
                pass
            continue
        toast._place_at(y)
        y += toast.winfo_reqheight() + 10


class _Toast(ctk.CTkToplevel):
    def __init__(self, parent: tk.Misc, message: str, kind: str, duration_ms: int):
        super().__init__(parent)
        self.ui = theme()
        self._parent_top = _toplevel_for(parent) or parent
        self._root_id = id(self._parent_top)
        self._dismissed = False

        style = _KIND_STYLE.get(kind, _KIND_STYLE["info"])
        accent_color = self.ui.get(style["accent"], self.ui["accent"])

        self.overrideredirect(True)
        try:
            self.attributes("-topmost", True)
        except Exception:
            pass
        self.configure(fg_color=self.ui["panel"])

        # Kart: sol renkli şerit + ikon + mesaj + kapat.
        card = ctk.CTkFrame(
            self,
            fg_color=self.ui["panel"],
            corner_radius=12,
            border_width=1,
            border_color=self.ui.get("border", "#243044"),
        )
        card.pack(fill="both", expand=True)

        strip = ctk.CTkFrame(card, fg_color=accent_color, width=5, corner_radius=8)
        strip.pack(side="left", fill="y", padx=(6, 0), pady=8)

        ctk.CTkLabel(
            card,
            text=style["icon"],
            font=("Segoe UI", 15, "bold"),
            text_color=accent_color,
            width=24,
        ).pack(side="left", padx=(10, 4), pady=10)

        ctk.CTkLabel(
            card,
            text=message,
            font=self.ui.get("body_font", ("Segoe UI", 12)),
            text_color=self.ui["text"],
            justify="left",
            wraplength=320,
        ).pack(side="left", padx=(2, 8), pady=10)

        ctk.CTkButton(
            card,
            text="✕",
            width=24,
            height=24,
            corner_radius=6,
            fg_color="transparent",
            hover_color=self.ui.get("panel_soft", "#0e1628"),
            text_color=self.ui.get("muted", "#94a3b8"),
            command=self.dismiss,
        ).pack(side="right", padx=(0, 8), pady=10)

        # Tüm yüzeye tıklayınca kapan.
        for w in (card,):
            w.bind("<Button-1>", lambda _e: self.dismiss())

        _active_by_root.setdefault(self._root_id, []).append(self)
        self.update_idletasks()
        _restack(self._root_id)

        if duration_ms > 0:
            self.after(duration_ms, self.dismiss)

    def _alive(self) -> bool:
        try:
            return bool(self.winfo_exists()) and not self._dismissed
        except Exception:
            return False

    def _place_at(self, y: int) -> None:
        """Üst pencerenin sağ-üst köşesine göre yerleştir."""
        try:
            top = self._parent_top
            top.update_idletasks()
            tx = top.winfo_rootx()
            tw = top.winfo_width()
            w = self.winfo_reqwidth()
            x = tx + tw - w - 24
            gy = top.winfo_rooty() + y
            self.geometry(f"+{max(0, x)}+{max(0, gy)}")
        except Exception:
            pass

    def dismiss(self) -> None:
        if self._dismissed:
            return
        self._dismissed = True
        toasts = _active_by_root.get(self._root_id)
        if toasts and self in toasts:
            try:
                toasts.remove(self)
            except ValueError:
                pass
        try:
            self.destroy()
        except Exception:
            pass
        _restack(self._root_id)


def show_toast(parent: tk.Misc, message: str, *, kind: str = "info", duration_ms: int = 3800) -> None:
    """Non-blocking toast bildirim gösterir. Hata olursa sessizce yutar (UI akışını bozmaz)."""
    try:
        _Toast(parent, message, kind, duration_ms)
    except Exception:
        if _log is not None:
            _log.exception("toast gösterilemedi")


class _ConfirmDialog(ctk.CTkToplevel):
    def __init__(
        self,
        parent: tk.Misc,
        title: str,
        message: str,
        confirm_text: str,
        cancel_text: str,
        danger: bool,
        center_fn,
    ):
        super().__init__(parent)
        self.ui = theme()
        self._result = False

        self.title(title)
        self.configure(fg_color=self.ui["bg"])
        self.resizable(False, False)
        try:
            self.grab_set()
        except Exception:
            pass

        body = ctk.CTkFrame(self, fg_color=self.ui["panel"], corner_radius=14)
        body.pack(fill="both", expand=True, padx=16, pady=16)

        ctk.CTkLabel(
            body,
            text=title,
            font=self.ui.get("title_font", ("Segoe UI Semibold", 18, "bold")),
            text_color=self.ui["text"],
        ).pack(anchor="w", padx=18, pady=(16, 6))

        ctk.CTkLabel(
            body,
            text=message,
            font=self.ui.get("body_font", ("Segoe UI", 12)),
            text_color=self.ui.get("muted", "#94a3b8"),
            justify="left",
            wraplength=380,
        ).pack(anchor="w", padx=18, pady=(0, 16))

        row = ctk.CTkFrame(body, fg_color="transparent")
        row.pack(fill="x", padx=18, pady=(4, 16))

        ctk.CTkButton(
            row,
            text=cancel_text,
            height=40,
            fg_color=self.ui.get("panel_soft", "#0e1628"),
            hover_color=self.ui.get("border", "#243044"),
            text_color=self.ui["text"],
            command=self._cancel,
        ).pack(side="right", padx=(8, 0))

        ctk.CTkButton(
            row,
            text=confirm_text,
            height=40,
            fg_color=self.ui["danger"] if danger else self.ui["accent"],
            hover_color=self.ui.get("accent_hover", self.ui["accent"]) if not danger else "#b91c1c",
            text_color="#ffffff",
            command=self._ok,
        ).pack(side="right")

        self.protocol("WM_DELETE_WINDOW", self._cancel)
        self.bind("<Escape>", lambda _e: self._cancel())
        self.bind("<Return>", lambda _e: self._ok())

        self.update_idletasks()
        try:
            if center_fn is not None:
                center_fn(self, 440, self.winfo_reqheight())
        except Exception:
            pass
        self.after(60, self.lift)

    def _ok(self) -> None:
        self._result = True
        self._close()

    def _cancel(self) -> None:
        self._result = False
        self._close()

    def _close(self) -> None:
        try:
            self.grab_release()
        except Exception:
            pass
        try:
            self.destroy()
        except Exception:
            pass


def confirm(
    parent: tk.Misc,
    title: str,
    message: str,
    *,
    confirm_text: str = "Onayla",
    cancel_text: str = "Vazgeç",
    danger: bool = False,
    center_fn=None,
) -> bool:
    """Temalı, modal onay diyaloğu gösterir ve True/False döndürür (blocking).

    Yıkıcı işlemler için ``danger=True`` kırmızı onay butonu verir.
    ``center_fn``: opsiyonel ``app.ekran_ortala`` benzeri (widget, w, h) ortalayıcı.
    """
    try:
        dlg = _ConfirmDialog(parent, title, message, confirm_text, cancel_text, danger, center_fn)
        parent.wait_window(dlg)
        return bool(dlg._result)
    except Exception:
        if _log is not None:
            _log.exception("confirm diyaloğu gösterilemedi")
        # Güvenli taraf: yıkıcı işlemde hata olursa onaylama.
        return False

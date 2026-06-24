"""
Premium UI helpers: gradient surfaces, loading pulse, staggered entrance, hover polish.
CustomTkinter has no native CSS gradients; we use PIL-backed CTkImage strips and banners.
"""

from __future__ import annotations

import tkinter as tk

import customtkinter as ctk
from PIL import Image, ImageDraw, ImageTk


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.strip().lstrip("#")
    if len(h) == 6:
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (19, 28, 46)


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def draw_vertical_gradient(width: int, height: int, top_hex: str, bottom_hex: str) -> Image.Image:
    """Soft vertical gradient (RGB)."""
    top = _hex_to_rgb(top_hex)
    bottom = _hex_to_rgb(bottom_hex)
    img = Image.new("RGB", (max(2, width), max(2, height)))
    draw = ImageDraw.Draw(img)
    h = max(1, height - 1)
    for y in range(height):
        t = y / h
        r = int(_lerp(top[0], bottom[0], t))
        g = int(_lerp(top[1], bottom[1], t))
        b = int(_lerp(top[2], bottom[2], t))
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    return img


def draw_horizontal_gradient(width: int, height: int, left_hex: str, right_hex: str) -> Image.Image:
    left = _hex_to_rgb(left_hex)
    right = _hex_to_rgb(right_hex)
    img = Image.new("RGB", (max(2, width), max(2, height)))
    draw = ImageDraw.Draw(img)
    w = max(1, width - 1)
    for x in range(width):
        t = x / w
        r = int(_lerp(left[0], right[0], t))
        g = int(_lerp(left[1], right[1], t))
        b = int(_lerp(left[2], right[2], t))
        draw.line([(x, 0), (x, height)], fill=(r, g, b))
    return img


def vertical_gradient_strip(
    parent: tk.Misc,
    width: int,
    height: int,
    top_hex: str,
    bottom_hex: str,
    *,
    bg_hex: str | None = None,
) -> tk.Label | ctk.CTkFrame:
    """
    Vertical gradient using tk.Label + PhotoImage.

    PhotoImage must use ``master=parent`` (or the same toplevel) so Tcl registers the image
    in the same interpreter as CustomTkinter — otherwise ``image pyimageN doesn't exist``.
    """
    pil = draw_vertical_gradient(width, height, top_hex, bottom_hex)
    if pil.mode != "RGB":
        pil = pil.convert("RGB")
    bg = bg_hex or bottom_hex
    try:
        try:
            parent.update_idletasks()
        except tk.TclError:
            pass
        photo = ImageTk.PhotoImage(pil, master=parent)
        lbl = tk.Label(parent, image=photo, borderwidth=0, highlightthickness=0, bg=bg)
        lbl._photo_ref = photo  # noqa: SLF001 — keep PhotoImage alive
        return lbl
    except tk.TclError:
        # Last resort: no bitmap (some Tk 9 / CTk combinations)
        fb = ctk.CTkFrame(parent, fg_color=top_hex, width=width, height=height, corner_radius=0)
        fb.pack_propagate(False)
        return fb


class LoadingPulseDots(ctk.CTkFrame):
    """Three-dot breathing loader; call stop() when leaving the screen."""

    def __init__(self, master, ui: dict, app: ctk.CTk):
        super().__init__(master, fg_color="transparent")
        self._app = app
        self._ui = ui
        self._after_id: str | None = None
        self._phase = 0
        self._dots: list[ctk.CTkLabel] = []
        for i in range(3):
            lbl = ctk.CTkLabel(
                self,
                text="●",
                font=("Segoe UI", 14),
                text_color=ui["muted"],
                fg_color="transparent",
            )
            lbl.pack(side="left", padx=3)
            self._dots.append(lbl)
        self._tick()

    def _tick(self) -> None:
        if not self.winfo_exists():
            return
        accent = self._ui.get("accent_soft", self._ui["accent"])
        muted = self._ui["muted"]
        dim = self._ui.get("accent_mid", accent)
        for i, d in enumerate(self._dots):
            # Rolling highlight
            dist = (i - (self._phase % 3)) % 3
            if dist == 0:
                c = accent
            elif dist == 1:
                c = dim
            else:
                c = muted
            d.configure(text_color=c)
        self._phase += 1
        try:
            self._after_id = self._app.after(420, self._tick)
        except Exception:
            self._after_id = None

    def stop(self) -> None:
        if self._after_id is not None:
            try:
                self._app.after_cancel(self._after_id)
            except Exception:
                pass
            self._after_id = None


def attach_feature_button_polish(btn: ctk.CTkButton, ui: dict) -> None:
    """Stronger hover: accent border + width; complements CTk hover_color."""
    base_border = ui.get("border_subtle", ui["border"])
    glow = ui.get("accent_mid", ui["accent"])

    def on_enter(_e=None):
        btn.configure(border_width=2, border_color=glow)

    def on_leave(_e=None):
        btn.configure(border_width=1, border_color=base_border)

    btn.bind("<Enter>", on_enter, add="+")
    btn.bind("<Leave>", on_leave, add="+")


def stagger_raise_buttons(app: ctk.CTk, buttons: list[ctk.CTkButton], ui: dict, start_fg: str, end_fg: str, delay_ms: int = 42) -> None:
    """Sequential lighten-in for tool tiles."""
    for i, btn in enumerate(buttons):
        try:
            btn.configure(fg_color=start_fg, border_color=ui.get("border_subtle", ui["border"]))
        except Exception:
            continue

        def lift(b=btn, fg=end_fg, border=ui.get("border_subtle", ui["border"])):
            try:
                if b.winfo_exists():
                    b.configure(fg_color=fg, border_color=border)
            except Exception:
                pass

        app.after(delay_ms * i, lift)


class ToolTip:
    """Hover tooltip popup for any Tkinter/CTk widget."""

    _DELAY = 680

    def __init__(self, widget, text: str, ui: dict | None = None):
        self.widget = widget
        self.text = text
        self.ui = ui or {}
        self._tip: tk.Toplevel | None = None
        self._after_id: str | None = None
        self._mx = 0
        self._my = 0
        widget.bind("<Enter>", self._on_enter, add="+")
        widget.bind("<Leave>", self._on_leave, add="+")
        widget.bind("<Motion>", self._on_motion, add="+")
        widget.bind("<ButtonPress>", self._on_leave, add="+")

    def _on_enter(self, event):
        self._mx = event.x_root
        self._my = event.y_root
        self._schedule()

    def _on_leave(self, _event=None):
        self._cancel()
        self._hide()

    def _on_motion(self, event):
        self._mx = event.x_root
        self._my = event.y_root

    def _schedule(self):
        self._cancel()
        self._after_id = self.widget.after(self._DELAY, self._show)

    def _cancel(self):
        if self._after_id:
            try:
                self.widget.after_cancel(self._after_id)
            except Exception:
                pass
            self._after_id = None

    def _show(self):
        if self._tip:
            return
        x = self._mx + 16
        y = self._my + 16
        self._tip = tk.Toplevel(self.widget)
        self._tip.wm_overrideredirect(True)
        self._tip.wm_geometry(f"+{x}+{y}")
        try:
            self._tip.attributes("-topmost", True)
        except Exception:
            pass
        bg = self.ui.get("panel", "#1a2035")
        border_c = self.ui.get("accent", "#6366f1")
        fg = self.ui.get("text", "#e2e8f0")
        muted = self.ui.get("muted", "#64748b")
        outer = tk.Frame(self._tip, bg=border_c, padx=1, pady=1)
        outer.pack()
        inner = tk.Frame(outer, bg=bg, padx=11, pady=7)
        inner.pack()
        tk.Label(
            inner, text=self.text, bg=bg, fg=fg,
            font=("Segoe UI", 10), wraplength=240, justify="left",
        ).pack()

    def _hide(self):
        if self._tip:
            try:
                self._tip.destroy()
            except Exception:
                pass
            self._tip = None


def thin_accent_line(parent, ui: dict, width: int = 520, height: int = 3) -> tk.Label | ctk.CTkFrame:
    """Horizontal gradient hairline (tk.Label + PhotoImage; solid bar fallback on TclError)."""
    left = ui.get("accent", "#2563eb")
    right = ui.get("accent_soft", "#93c5fd")
    bg = ui.get("panel", "#131c2e")
    w = max(80, width)
    h = max(2, height)
    full = draw_horizontal_gradient(w, h, left, right)
    if full.mode != "RGB":
        full = full.convert("RGB")
    try:
        try:
            parent.update_idletasks()
        except tk.TclError:
            pass
        photo = ImageTk.PhotoImage(full, master=parent)
        lbl = tk.Label(parent, image=photo, borderwidth=0, highlightthickness=0, bg=bg)
        lbl._photo_ref = photo  # noqa: SLF001
        return lbl
    except tk.TclError:
        fb = ctk.CTkFrame(parent, fg_color=left, height=h, corner_radius=0)
        fb.pack_propagate(False)
        return fb


class ToolCard(ctk.CTkFrame):
    """Profesyonel araç kartı: ikon-chip + başlık + açıklama.

    CTkButton'ın düz emoji+metin görünümünün yerine geçer. Tüm yüzeyde (kart +
    tüm çocuk widget'lar) tıklama ve hover yakalanır; ``set_locked()`` ile kilitli
    durum (uyarı kenarlık + rozet) gösterilir. Bir ``CTkFrame`` olduğundan
    ``stagger_raise_buttons`` / dim animasyonlarıyla ``configure(fg_color=...)``
    üzerinden uyumludur.
    """

    def __init__(
        self,
        parent,
        ui: dict,
        *,
        icon: str,
        title: str,
        description: str = "",
        command=None,
        height: int = 150,
    ):
        super().__init__(
            parent,
            height=height,
            corner_radius=ui.get("radius_md", 12),
            fg_color=ui["panel"],
            border_width=1,
            border_color=ui.get("border_subtle", ui["border"]),
        )
        self.ui = ui
        self._command = command
        self._locked = False
        self._base_fg = ui["panel"]
        self._hover_fg = ui.get("panel_alt", ui["panel"])
        self._base_border = ui.get("border_subtle", ui["border"])
        self._hover_border = ui.get("accent_mid", ui["accent"])
        self.pack_propagate(False)

        self._chip = ctk.CTkLabel(
            self,
            text=icon,
            font=("Segoe UI Emoji", 21),
            fg_color=ui.get("panel_alt", ui["panel"]),
            text_color=ui.get("accent_soft", ui["accent"]),
            corner_radius=10,
            width=44,
            height=44,
        )
        self._chip.pack(anchor="w", padx=14, pady=(14, 8))

        self._title_lbl = ctk.CTkLabel(
            self,
            text=title,
            font=("Segoe UI Semibold", 12, "bold"),
            text_color=ui["text"],
            anchor="w",
            justify="left",
            wraplength=150,
        )
        self._title_lbl.pack(anchor="w", padx=14)

        self._desc_lbl = None
        if description:
            self._desc_lbl = ctk.CTkLabel(
                self,
                text=description,
                font=("Segoe UI", 10),
                text_color=ui.get("muted", "#94a3b8"),
                anchor="w",
                justify="left",
                wraplength=160,
            )
            self._desc_lbl.pack(anchor="w", padx=14, pady=(3, 0))

        self._badge = ctk.CTkLabel(
            self,
            text="",
            font=("Segoe UI Semibold", 9, "bold"),
            text_color=ui.get("warning", "#eab308"),
            anchor="w",
        )

        self._bind_surface()

    # ── iç yardımcılar ─────────────────────────────────────────────────────
    def _all_widgets(self) -> list:
        out: list = [self]
        stack = list(self.winfo_children())
        while stack:
            w = stack.pop()
            out.append(w)
            stack.extend(w.winfo_children())
        return out

    def _bind_surface(self) -> None:
        for w in self._all_widgets():
            w.bind("<Button-1>", self._on_click, add="+")
            w.bind("<Enter>", self._on_enter, add="+")
            w.bind("<Leave>", self._on_leave, add="+")

    def _pointer_inside(self) -> bool:
        try:
            x, y = self.winfo_pointerxy()
            w = self.winfo_containing(x, y)
        except Exception:
            return False
        while w is not None:
            if w == self:
                return True
            w = getattr(w, "master", None)
        return False

    def _on_click(self, _e=None):
        if not self._locked and self._command:
            self._command()

    def _on_enter(self, _e=None):
        if self._locked:
            return
        try:
            self.configure(fg_color=self._hover_fg, border_color=self._hover_border, border_width=2)
        except Exception:
            pass

    def _on_leave(self, _e=None):
        if self._locked or self._pointer_inside():
            return
        try:
            self.configure(fg_color=self._base_fg, border_color=self._base_border, border_width=1)
        except Exception:
            pass

    # ── public ─────────────────────────────────────────────────────────────
    def set_locked(self, locked: bool, locked_label: str = "") -> None:
        self._locked = bool(locked)
        if self._locked:
            self.configure(
                fg_color=self.ui.get("panel_alt", self.ui["panel"]),
                border_color=self.ui.get("warning", self.ui["border"]),
                border_width=1,
            )
            self._title_lbl.configure(text_color=self.ui.get("muted", self.ui["text"]))
            self._chip.configure(text_color=self.ui.get("muted", self.ui["text"]))
            if locked_label:
                self._badge.configure(text=f"🔒 {locked_label}")
                self._badge.pack(anchor="w", padx=14, pady=(4, 0))
        else:
            self.configure(
                fg_color=self._base_fg,
                border_color=self._base_border,
                border_width=1,
            )
            self._title_lbl.configure(text_color=self.ui["text"])
            self._chip.configure(text_color=self.ui.get("accent_soft", self.ui["accent"]))
            self._badge.pack_forget()

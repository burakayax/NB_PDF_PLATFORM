"""
PdfVisualGrid — PDF sayfalarını görsel thumbnail grid olarak gösteren widget.
Modlar: "select" | "rotate" | "organize"
"""
from __future__ import annotations

import threading
import tkinter as tk
from typing import Callable

import customtkinter as ctk
from PIL import Image, ImageTk

from modules.i18n import t
from modules.ui_theme import theme

RENDER_W = 200  # Arka planda render edilecek max thumbnail px genişliği


class PdfVisualGrid(ctk.CTkFrame):
    """
    Kaydırılabilir PDF sayfa thumbnail grid widget'ı.

    mode:
      "select"   — tıklayarak seçim (sayfa sil / sayfa ayıkla)
      "rotate"   — per-kart ↺↻ butonları (PDF döndür)
      "organize" — sürükle-bırak sıralama (sayfa sırala)
    """

    THUMB_MIN = 70
    THUMB_MAX = 180
    THUMB_DEF = 105

    def __init__(
        self,
        parent,
        mode: str = "select",
        *,
        cols: int = 4,
        on_selection_change: Callable[[set[int]], None] | None = None,
        on_rotations_change: Callable[[dict[int, int]], None] | None = None,
        on_order_change: Callable[[list[int]], None] | None = None,
    ):
        super().__init__(parent, fg_color="transparent")
        self.mode = mode
        self._cols = cols
        self._cb_select = on_selection_change
        self._cb_rotate = on_rotations_change
        self._cb_order = on_order_change

        self.ui = theme()

        self._pdf_path: str | None = None
        self._password: str | None = None
        self._page_count = 0

        self._selected: set[int] = set()
        self._rotations: dict[int, int] = {}
        self._order: list[int] = []

        self._raw_cache: dict[int, Image.Image] = {}
        self._photo_refs: dict[int, ImageTk.PhotoImage] = {}
        self._stop_render = threading.Event()
        self._render_thread: threading.Thread | None = None

        self._cards: dict[int, ctk.CTkFrame] = {}
        self._img_lbls: dict[int, ctk.CTkLabel] = {}
        self._rot_lbls: dict[int, ctk.CTkLabel] = {}

        self._drag_page: int | None = None
        self._drag_ghost: tk.Toplevel | None = None
        self._drag_ghost_ph: ImageTk.PhotoImage | None = None
        self._zoom_after: str | None = None

        self.bind("<Destroy>", self._on_widget_destroy)
        self._build_ui()

    # ─── UI ──────────────────────────────────────────────────────────────────

    def _build_ui(self):
        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.pack(fill="x", padx=4, pady=(4, 0))

        ctk.CTkLabel(
            bar, text="🔍", font=("Segoe UI", 13), text_color=self.ui["muted"]
        ).pack(side="left")

        self._zoom_var = ctk.IntVar(value=self.THUMB_DEF)
        ctk.CTkSlider(
            bar,
            from_=self.THUMB_MIN,
            to=self.THUMB_MAX,
            variable=self._zoom_var,
            command=self._on_zoom,
            width=130,
            height=16,
        ).pack(side="left", padx=(4, 10))

        self._info_lbl = ctk.CTkLabel(
            bar, text="", font=self.ui["small_font"], text_color=self.ui["muted"]
        )
        self._info_lbl.pack(side="left")

        if self.mode == "select":
            self._sel_btn = ctk.CTkButton(
                bar,
                text=t("visual_grid.select_all"),
                width=92,
                height=26,
                fg_color=self.ui["panel_soft"],
                hover_color=self.ui["border"],
                text_color=self.ui["text"],
                font=("Segoe UI", 11),
                command=self._toggle_all,
            )
            self._sel_btn.pack(side="right")

        self._scroll = ctk.CTkScrollableFrame(
            self,
            fg_color=self.ui.get("panel_alt", self.ui["panel"]),
            corner_radius=10,
        )
        self._scroll.pack(fill="both", expand=True, padx=2, pady=(6, 0))

    # ─── Load ────────────────────────────────────────────────────────────────

    def load_pdf(self, path: str, password: str | None = None):
        """PDF'i yükle, thumbnail render'ını başlat."""
        self._stop_render.set()
        if self._render_thread and self._render_thread.is_alive():
            self._render_thread.join(timeout=1.5)
        self._stop_render.clear()

        self._pdf_path = path
        self._password = password
        self._selected.clear()
        self._rotations.clear()
        self._raw_cache.clear()
        self._photo_refs.clear()

        try:
            import fitz
            doc = fitz.open(path)
            if doc.needs_pass and password:
                doc.authenticate(password)
            self._page_count = len(doc)
            doc.close()
        except Exception:
            self._page_count = 0
            return

        self._order = list(range(1, self._page_count + 1))
        for p in self._order:
            self._rotations[p] = 0

        self._info_lbl.configure(
            text=t("visual_grid.page_count", n=self._page_count)
        )
        self._rebuild_grid()
        self._start_render()

    # ─── Grid ────────────────────────────────────────────────────────────────

    def _rebuild_grid(self):
        for w in self._scroll.winfo_children():
            w.destroy()
        self._cards.clear()
        self._img_lbls.clear()
        self._rot_lbls.clear()

        tw = self._zoom_var.get()
        th = int(tw * 1.414)
        cols = self._cols

        for flat, page_num in enumerate(self._order):
            card = self._build_card(flat, page_num, tw, th)
            card.grid(row=flat // cols, column=flat % cols, padx=5, pady=5, sticky="n")
            self._cards[flat] = card

        for c in range(cols):
            self._scroll.grid_columnconfigure(c, weight=1)

        self._emit()

    def _build_card(self, flat: int, page_num: int, tw: int, th: int) -> ctk.CTkFrame:
        selected = page_num in self._selected
        bc = self.ui["accent"] if selected else self.ui.get("border_subtle", self.ui["border"])
        bg = self.ui.get("panel_selected", "#182d50") if selected else self.ui.get("panel_card", self.ui["panel"])

        card = ctk.CTkFrame(
            self._scroll,
            fg_color=bg,
            corner_radius=10,
            border_width=2,
            border_color=bc,
            width=tw + 16,
        )

        ph = self._make_photo(page_num, tw, th)
        img_lbl = ctk.CTkLabel(card, text="", image=ph, width=tw, height=th)
        img_lbl.pack(pady=(7, 2), padx=7)
        self._img_lbls[page_num] = img_lbl
        self._photo_refs[page_num] = ph

        num_lbl = ctk.CTkLabel(
            card,
            text=str(page_num),
            font=("Segoe UI", 10, "bold"),
            text_color=self.ui["muted"],
        )
        num_lbl.pack(pady=(0, 3))

        if self.mode == "select":
            self._bind_select(card, img_lbl, num_lbl, page_num)
        elif self.mode == "rotate":
            self._add_rotate_controls(card, page_num, tw)
        elif self.mode == "organize":
            self._bind_drag(card, img_lbl, num_lbl, page_num)

        return card

    def _make_photo(self, page_num: int, tw: int, th: int) -> ImageTk.PhotoImage:
        if page_num in self._raw_cache:
            raw = self._raw_cache[page_num]
            angle = self._rotations.get(page_num, 0)
            if angle:
                raw = raw.rotate(angle, expand=True)
            img = raw.resize((tw, th), Image.LANCZOS)
        else:
            img = Image.new("RGB", (tw, th), color=(45, 50, 62))
        return ImageTk.PhotoImage(img)

    # ─── Select ──────────────────────────────────────────────────────────────

    def _bind_select(self, card, img_lbl, num_lbl, page_num: int):
        def toggle(e=None):
            if page_num in self._selected:
                self._selected.discard(page_num)
            else:
                self._selected.add(page_num)
            self._refresh_card(page_num)
            self._emit()

        for w in (card, img_lbl, num_lbl):
            w.bind("<Button-1>", toggle)
            w.configure(cursor="hand2")

    def _refresh_card(self, page_num: int):
        try:
            flat = self._order.index(page_num)
        except ValueError:
            return
        card = self._cards.get(flat)
        if not card:
            return
        sel = page_num in self._selected
        card.configure(
            border_color=self.ui["accent"] if sel else self.ui.get("border_subtle", self.ui["border"]),
            fg_color=self.ui.get("panel_selected", "#182d50") if sel else self.ui.get("panel_card", self.ui["panel"]),
        )

    def _toggle_all(self):
        if len(self._selected) == self._page_count:
            self._selected.clear()
        else:
            self._selected = set(self._order)
        for p in self._order:
            self._refresh_card(p)
        self._emit()

    # ─── Rotate ──────────────────────────────────────────────────────────────

    def _add_rotate_controls(self, card, page_num: int, tw: int):
        angle = self._rotations.get(page_num, 0)
        rot_lbl = ctk.CTkLabel(
            card,
            text=f"{angle}°" if angle else "",
            font=("Segoe UI", 9, "bold"),
            text_color=self.ui["accent"],
            height=14,
        )
        rot_lbl.pack()
        self._rot_lbls[page_num] = rot_lbl

        btn_row = ctk.CTkFrame(card, fg_color="transparent")
        btn_row.pack(pady=(2, 7))
        bs = max(28, tw // 4)
        ctk.CTkButton(
            btn_row, text="↺", width=bs, height=bs,
            fg_color=self.ui["panel_soft"], hover_color=self.ui["accent"],
            text_color=self.ui["text"], font=("Segoe UI", 14),
            command=lambda p=page_num: self._do_rotate(p, 90),
        ).pack(side="left", padx=2)
        ctk.CTkButton(
            btn_row, text="↻", width=bs, height=bs,
            fg_color=self.ui["panel_soft"], hover_color=self.ui["accent"],
            text_color=self.ui["text"], font=("Segoe UI", 14),
            command=lambda p=page_num: self._do_rotate(p, -90),
        ).pack(side="left", padx=2)

    def _do_rotate(self, page_num: int, delta: int):
        cur = self._rotations.get(page_num, 0)
        self._rotations[page_num] = (cur + delta) % 360
        tw = self._zoom_var.get()
        th = int(tw * 1.414)
        ph = self._make_photo(page_num, tw, th)
        self._photo_refs[page_num] = ph
        lbl = self._img_lbls.get(page_num)
        if lbl:
            lbl.configure(image=ph)
        rot_lbl = self._rot_lbls.get(page_num)
        if rot_lbl is not None:
            a = self._rotations[page_num]
            rot_lbl.configure(text=f"{a}°" if a else "")
        self._emit()

    # ─── Organize / drag-drop ────────────────────────────────────────────────

    def _bind_drag(self, card, img_lbl, num_lbl, page_num: int):
        def press(e):
            self._drag_page = page_num
            self._make_ghost(page_num, e.x_root, e.y_root)

        def motion(e):
            if self._drag_ghost:
                try:
                    self._drag_ghost.wm_geometry(f"+{e.x_root + 14}+{e.y_root + 14}")
                except Exception:
                    pass
                self._hilight_target(e.x_root, e.y_root)

        def release(e):
            self._kill_ghost()
            if self._drag_page is not None:
                tgt = self._page_at(e.x_root, e.y_root)
                if tgt is not None and tgt != self._drag_page:
                    si = self._order.index(self._drag_page)
                    ti = self._order.index(tgt)
                    self._order[si], self._order[ti] = self._order[ti], self._order[si]
                    self._drag_page = None
                    self._rebuild_grid()
                    return
                self._clear_hilight()
            self._drag_page = None

        for w in (card, img_lbl, num_lbl):
            w.bind("<ButtonPress-1>", press)
            w.bind("<B1-Motion>", motion)
            w.bind("<ButtonRelease-1>", release)
            w.configure(cursor="fleur")

    def _make_ghost(self, page_num: int, xr: int, yr: int):
        tw = min(72, self._zoom_var.get())
        th = int(tw * 1.414)
        ph = self._make_photo(page_num, tw, th)
        self._drag_ghost_ph = ph
        g = tk.Toplevel(self)
        g.wm_overrideredirect(True)
        try:
            g.attributes("-alpha", 0.75)
        except Exception:
            pass
        g.wm_geometry(f"+{xr + 14}+{yr + 14}")
        lbl = tk.Label(g, image=ph, bd=2, relief="solid", bg="#253a6e")
        lbl.image = ph
        lbl.pack()
        self._drag_ghost = g

    def _kill_ghost(self):
        if self._drag_ghost:
            try:
                self._drag_ghost.destroy()
            except Exception:
                pass
            self._drag_ghost = None

    def _page_at(self, xr: int, yr: int) -> int | None:
        for flat, card in self._cards.items():
            try:
                if not card.winfo_exists():
                    continue
                cx, cy = card.winfo_rootx(), card.winfo_rooty()
                cw, ch = card.winfo_width(), card.winfo_height()
                if cx <= xr <= cx + cw and cy <= yr <= cy + ch:
                    return self._order[flat]
            except Exception:
                pass
        return None

    def _hilight_target(self, xr: int, yr: int):
        tgt = self._page_at(xr, yr)
        for flat, card in self._cards.items():
            try:
                if not card.winfo_exists():
                    continue
                pg = self._order[flat]
                if pg == tgt and pg != self._drag_page:
                    card.configure(border_color=self.ui["accent"])
                else:
                    card.configure(border_color=self.ui.get("border_subtle", self.ui["border"]))
            except Exception:
                pass

    def _clear_hilight(self):
        for card in self._cards.values():
            try:
                if card.winfo_exists():
                    card.configure(border_color=self.ui.get("border_subtle", self.ui["border"]))
            except Exception:
                pass

    # ─── Render thread ───────────────────────────────────────────────────────

    def _start_render(self):
        self._render_thread = threading.Thread(target=self._render_worker, daemon=True)
        self._render_thread.start()

    def _render_worker(self):
        try:
            import fitz
            doc = fitz.open(self._pdf_path)
            if doc.needs_pass and self._password:
                doc.authenticate(self._password)
            for i in range(self._page_count):
                if self._stop_render.is_set():
                    break
                page = doc[i]
                scale = RENDER_W / max(page.rect.width, 1)
                mat = fitz.Matrix(scale, scale)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                self._raw_cache[i + 1] = img
                if not self._stop_render.is_set():
                    self.after(0, self._on_thumb_ready, i + 1)
            doc.close()
        except Exception:
            pass

    def _on_thumb_ready(self, page_num: int):
        if self._stop_render.is_set():
            return
        lbl = self._img_lbls.get(page_num)
        if not lbl:
            return
        try:
            if not lbl.winfo_exists():
                return
            tw = self._zoom_var.get()
            th = int(tw * 1.414)
            ph = self._make_photo(page_num, tw, th)
            self._photo_refs[page_num] = ph
            lbl.configure(image=ph)
        except Exception:
            pass

    # ─── Zoom (debounced) ────────────────────────────────────────────────────

    def _on_zoom(self, _val):
        if self._zoom_after:
            try:
                self.after_cancel(self._zoom_after)
            except Exception:
                pass
        self._zoom_after = self.after(180, self._do_zoom)

    def _do_zoom(self):
        self._zoom_after = None
        if not self._page_count:
            return
        self._rebuild_grid()
        for pn in list(self._raw_cache):
            if not self._stop_render.is_set():
                self._on_thumb_ready(pn)

    # ─── Callbacks ───────────────────────────────────────────────────────────

    def _emit(self):
        if self.mode == "select" and self._cb_select:
            self._cb_select(set(self._selected))
        elif self.mode == "rotate" and self._cb_rotate:
            self._cb_rotate(dict(self._rotations))
        elif self.mode == "organize" and self._cb_order:
            self._cb_order(list(self._order))

    # ─── Cleanup ─────────────────────────────────────────────────────────────

    def _on_widget_destroy(self, event):
        if event.widget is self:
            self.stop()

    def stop(self):
        """Arka plan render thread'ini durdur."""
        self._stop_render.set()
        self._kill_ghost()

    # ─── Public API ──────────────────────────────────────────────────────────

    def get_selected(self) -> list[int]:
        """Sıralı seçili sayfa numaraları (1-tabanlı)."""
        return sorted(self._selected)

    def get_rotations(self) -> dict[int, int]:
        """Tüm sayfalar için {sayfa_no: açı} dict'i."""
        return dict(self._rotations)

    def get_order(self) -> list[int]:
        """Yeni sayfa sıralaması (1-tabanlı sayfa numaraları listesi)."""
        return list(self._order)

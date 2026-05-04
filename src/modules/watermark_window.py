import customtkinter as ctk
from tkinter import filedialog, messagebox, colorchooser
import os
import threading
from queue import Queue, Empty

from PIL import Image, ImageDraw, ImageFont, ImageTk

from modules.i18n import t
from modules.pdf_password_dialog import PdfPasswordDialog
from modules.pdf_tool_ui import build_drop_zone, build_file_card, build_tool_header
from modules.progress_dialog import ProgressDialog
from modules.ui_theme import theme

# Önizleme canvas boyutları (A4 portrait oranı)
_PV_W = 200
_PV_H = 283

# Windows system font haritası
_FONT_FILES = {
    "helv": "arial.ttf",
    "tiro": "times.ttf",
    "cour": "cour.ttf",
}

# Varsayılan fallback font boyutu (pt → px yaklaşık)
_PV_FONT_SIZE = 28


def _hex_valid(h: str) -> bool:
    h = h.strip()
    if not h.startswith("#") or len(h) != 7:
        return False
    try:
        int(h[1:], 16)
        return True
    except ValueError:
        return False


def _load_pil_font(font_key: str, size: int) -> ImageFont.ImageFont:
    fname = _FONT_FILES.get(font_key, "arial.ttf")
    for base in (
        r"C:\Windows\Fonts",
        r"C:\WINDOWS\Fonts",
    ):
        path = os.path.join(base, fname)
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def _build_preview_image(text: str, font_key: str, color_hex: str) -> Image.Image:
    """Filigranın nasıl görüneceğini gösteren PIL Image üret."""
    img = Image.new("RGB", (_PV_W, _PV_H), color=(248, 248, 252))
    # Sayfa kenarlığı
    draw = ImageDraw.Draw(img)
    draw.rectangle([(0, 0), (_PV_W - 1, _PV_H - 1)], outline=(200, 200, 210), width=1)
    # Filigran metin satırlarını temsil eden ince çizgiler
    for y in range(30, _PV_H - 20, 18):
        draw.line([(16, y), (_PV_W - 16, y)], fill=(220, 220, 228), width=1)

    if not text or not _hex_valid(color_hex):
        return img

    try:
        r = int(color_hex[1:3], 16)
        g = int(color_hex[3:5], 16)
        b = int(color_hex[5:7], 16)
    except ValueError:
        return img

    font = _load_pil_font(font_key, _PV_FONT_SIZE)

    # Döndürülmüş filigran overlay
    overlay = Image.new("RGBA", (_PV_W, _PV_H), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    try:
        bbox = ov_draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
    except Exception:
        tw, th = len(text) * 12, 20
    tx = (_PV_W - tw) // 2
    ty = (_PV_H - th) // 2
    ov_draw.text((tx, ty), text, fill=(r, g, b, 140), font=font)
    rotated = overlay.rotate(45, expand=False)
    img_rgba = img.convert("RGBA")
    img_rgba.paste(rotated, mask=rotated.split()[3])
    img = img_rgba.convert("RGB")
    # Kenarlık ve çizgileri rotated üzerine yeniden çiz
    draw = ImageDraw.Draw(img)
    draw.rectangle([(0, 0), (_PV_W - 1, _PV_H - 1)], outline=(200, 200, 210), width=1)
    return img


class WatermarkWindow(ctk.CTkToplevel):
    def __init__(self, master, ortalama_func, engine, success_dialog_class, access_controller=None):
        super().__init__(master)
        self.ui = theme()
        self.ortalama_func = ortalama_func
        self.pdf_engine = engine
        self.success_dialog = success_dialog_class
        self.access_controller = access_controller
        self.selected_file = None
        self.selected_password = None
        self.selected_is_encrypted = False
        self.font_var = ctk.StringVar(value="helv")
        self._color_hex = "#8C8C8C"
        self._preview_ph: ImageTk.PhotoImage | None = None
        self._preview_after: str | None = None

        self.title(t("watermark.window_title"))
        self.ortalama_func(self, 680, 820)
        self.grab_set()
        self.configure(fg_color=self.ui["bg"])

        build_tool_header(self, t("watermark.header"), t("watermark.detail"))

        # Dosya alanı
        self.main_card = ctk.CTkFrame(self, fg_color=self.ui["panel"], corner_radius=16,
                                      border_width=1, border_color=self.ui["border"])
        self.main_card.pack(pady=10, padx=28, fill="x")

        self.content_frame = ctk.CTkFrame(self.main_card, fg_color="transparent")
        self.content_frame.pack(pady=8, padx=16, fill="both", expand=True)
        self.show_empty_state()

        # Orta bölüm: sol seçenekler + sağ önizleme
        middle = ctk.CTkFrame(self, fg_color="transparent")
        middle.pack(pady=(8, 0), padx=28, fill="x")
        middle.grid_columnconfigure(0, weight=3)
        middle.grid_columnconfigure(1, weight=0)

        # ── Sol: seçenekler ─────────────────────────────────────────────────
        opts = ctk.CTkFrame(middle, fg_color="transparent")
        opts.grid(row=0, column=0, sticky="nsew", padx=(0, 12))

        ctk.CTkLabel(opts, text=t("watermark.text_label"),
                     font=self.ui["subtitle_font"], text_color=self.ui["text"]).pack(anchor="w")
        self.text_entry = ctk.CTkEntry(
            opts, height=40, corner_radius=10, border_width=1,
            placeholder_text=t("watermark.text_placeholder"),
            fg_color=self.ui.get("input_bg", self.ui["panel"]),
            border_color=self.ui.get("input_border", self.ui["border"]),
            text_color=self.ui["text"],
        )
        self.text_entry.pack(fill="x", pady=(4, 10))
        self.text_entry.bind("<KeyRelease>", self._schedule_preview)

        ctk.CTkLabel(opts, text=t("watermark.font_label"),
                     font=self.ui["subtitle_font"], text_color=self.ui["text"]).pack(anchor="w")
        font_row = ctk.CTkFrame(opts, fg_color="transparent")
        font_row.pack(fill="x", pady=(4, 10))
        for val, key in [("helv", "watermark.font_helv"),
                         ("tiro", "watermark.font_tiro"),
                         ("cour", "watermark.font_cour")]:
            ctk.CTkRadioButton(
                font_row, text=t(key), variable=self.font_var, value=val,
                text_color=self.ui["text"],
                command=self._schedule_preview,
            ).pack(side="left", padx=(0, 12))

        ctk.CTkLabel(opts, text=t("watermark.color_label"),
                     font=self.ui["subtitle_font"], text_color=self.ui["text"]).pack(anchor="w")
        color_row = ctk.CTkFrame(opts, fg_color="transparent")
        color_row.pack(fill="x", pady=(4, 4))

        # Renk swatch (renkli küçük kare)
        self._swatch = ctk.CTkFrame(
            color_row, width=36, height=36, corner_radius=8,
            fg_color=self._color_hex, border_width=1,
            border_color=self.ui.get("border_subtle", self.ui["border"]),
        )
        self._swatch.pack(side="left", padx=(0, 8))
        self._swatch.pack_propagate(False)
        self._swatch.bind("<Button-1>", lambda e: self._pick_color())
        self._swatch.configure(cursor="hand2")

        self._hex_lbl = ctk.CTkLabel(
            color_row, text=self._color_hex,
            font=("Segoe UI Mono", 13), text_color=self.ui["text"],
        )
        self._hex_lbl.pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            color_row, text=t("watermark.color_pick_btn"),
            width=110, height=36, corner_radius=10,
            fg_color=self.ui["panel_soft"], hover_color=self.ui["accent"],
            text_color=self.ui["text"], font=("Segoe UI", 12),
            command=self._pick_color,
        ).pack(side="left")

        # ── Sağ: önizleme ───────────────────────────────────────────────────
        pv_frame = ctk.CTkFrame(
            middle, fg_color=self.ui["panel_alt"], corner_radius=12,
            border_width=1, border_color=self.ui.get("border_subtle", self.ui["border"]),
        )
        pv_frame.grid(row=0, column=1, sticky="n")

        ctk.CTkLabel(
            pv_frame, text=t("watermark.preview_label"),
            font=self.ui["small_font"], text_color=self.ui["muted"],
        ).pack(pady=(8, 4))

        self._preview_lbl = ctk.CTkLabel(
            pv_frame, text="", width=_PV_W, height=_PV_H,
        )
        self._preview_lbl.pack(padx=10, pady=(0, 10))
        self._refresh_preview()

        # Çalıştır butonu
        self.btn_run = ctk.CTkButton(
            self, text=t("watermark.run"),
            font=("Segoe UI Semibold", 16, "bold"), height=50,
            fg_color=self.ui["accent"], hover_color=self.ui["accent_hover"],
            text_color=self.ui["button_text"], state="disabled",
            command=self.run_watermark,
        )
        self.btn_run.pack(pady=(12, 20), padx=28, fill="x")

    # ─── Dosya seçimi ────────────────────────────────────────────────────────

    def show_empty_state(self):
        for w in self.content_frame.winfo_children():
            w.destroy()
        build_drop_zone(self.content_frame, on_paths=self.ingest_paths,
                        on_browse=self.select_file, extensions={".pdf"},
                        access_controller=self.access_controller).pack(fill="both", expand=True)

    def ingest_paths(self, paths):
        if not paths:
            return
        path = paths[0]
        try:
            password = None
            is_encrypted = False
            if hasattr(self.pdf_engine, "is_pdf_encrypted"):
                is_encrypted = self.pdf_engine.is_pdf_encrypted(path)
            if is_encrypted:
                def validate_password(value):
                    try:
                        return True if (hasattr(self.pdf_engine, "validate_pdf_password")
                                        and self.pdf_engine.validate_pdf_password(path, value)) \
                            else t("pdf_password.invalid_password")
                    except Exception as e:
                        return str(e)
                dialog = PdfPasswordDialog(self, self.ortalama_func, os.path.basename(path),
                                           password_validator=validate_password)
                self.wait_window(dialog)
                if dialog.action == "skip" or not dialog.result:
                    self.lift()
                    return
                password = dialog.result
            self.selected_file = path
            self.selected_password = password
            self.selected_is_encrypted = is_encrypted
            self.update_ui()
        except Exception as e:
            messagebox.showerror(t("app.error"), str(e))
        self.lift()

    def select_file(self):
        f = filedialog.askopenfilename(parent=self, filetypes=[("PDF", "*.pdf")])
        if f:
            self.ingest_paths([f])
        else:
            self.lift()

    def update_ui(self):
        for w in self.content_frame.winfo_children():
            w.destroy()
        badge = t("app.encrypted_badge") if self.selected_is_encrypted else None
        build_file_card(self.content_frame, self.selected_file,
                        badge_text=badge, badge_warning=bool(self.selected_is_encrypted),
                        on_change=self.select_file)
        self.btn_run.configure(state="normal")

    # ─── Renk seçici ─────────────────────────────────────────────────────────

    def _pick_color(self):
        result = colorchooser.askcolor(
            color=self._color_hex, parent=self, title=t("watermark.color_pick_btn"),
        )
        if result and result[1]:
            self._color_hex = result[1].upper()
            self._swatch.configure(fg_color=self._color_hex)
            self._hex_lbl.configure(text=self._color_hex)
            self._refresh_preview()
        self.lift()

    # ─── Önizleme ────────────────────────────────────────────────────────────

    def _schedule_preview(self, _e=None):
        if self._preview_after:
            try:
                self.after_cancel(self._preview_after)
            except Exception:
                pass
        self._preview_after = self.after(120, self._refresh_preview)

    def _refresh_preview(self):
        self._preview_after = None
        text = (self.text_entry.get() if hasattr(self, "text_entry") else "").strip() or "ÖRNEK"
        font_key = self.font_var.get()
        img = _build_preview_image(text, font_key, self._color_hex)
        self._preview_ph = ImageTk.PhotoImage(img)
        self._preview_lbl.configure(image=self._preview_ph)

    # ─── İşlem ───────────────────────────────────────────────────────────────

    def run_watermark(self):
        text = (self.text_entry.get() or "").strip()
        if not text:
            messagebox.showwarning(t("app.warning"), t("watermark.missing_text"))
            return
        color = self._color_hex
        font = self.font_var.get()

        save_path = filedialog.asksaveasfilename(
            parent=self, title=t("watermark.save_title"),
            defaultextension=".pdf", filetypes=[("PDF", "*.pdf")],
        )
        if not save_path:
            return

        self.btn_run.configure(state="disabled", fg_color=self.ui["panel_alt"])
        q = Queue()
        finished = {"value": False}
        progress_dialog = ProgressDialog(self, self.ortalama_func, total_count=2,
                                         title=t("watermark.progress_title"))
        progress_dialog.update_progress(0, 2, t("progress.starting"))

        def worker():
            try:
                if self.access_controller:
                    self.access_controller.authorize_operation("watermark", [self.selected_file])
                import pdf_toolkit_extra
                pdf_toolkit_extra.add_watermark_text(
                    self.selected_file, save_path, text,
                    password=self.selected_password, font_name=font, font_color=color,
                )
                q.put(("done", save_path))
            except Exception as e:
                q.put(("error", str(e)))

        threading.Thread(target=worker, daemon=True).start()

        def poll():
            try:
                while True:
                    msg = q.get_nowait()
                    if msg[0] == "done":
                        finished["value"] = True
                        progress_dialog.destroy()
                        self.destroy()
                        self.success_dialog(self.master, msg[1], self.ortalama_func)
                        return
                    elif msg[0] == "error":
                        finished["value"] = True
                        progress_dialog.destroy()
                        messagebox.showerror(t("app.error"), str(msg[1]))
                        self.btn_run.configure(state="normal", fg_color=self.ui["accent"])
                        return
            except Empty:
                pass
            if not finished["value"]:
                self.after(100, poll)

        self.after(100, poll)

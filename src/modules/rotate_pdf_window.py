import customtkinter as ctk
from tkinter import filedialog, messagebox
import os
import threading
from queue import Queue, Empty

from modules.i18n import t
from modules.pdf_password_dialog import PdfPasswordDialog
from modules.pdf_tool_ui import build_drop_zone, build_file_card, build_tool_header
from modules.pdf_visual_grid import PdfVisualGrid
from modules.progress_dialog import ProgressDialog
from modules.ui_theme import theme


class RotatePdfWindow(ctk.CTkToplevel):
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
        self.visual_grid: PdfVisualGrid | None = None

        self.title(t("rotate_pdf.window_title"))
        self.ortalama_func(self, 820, 780)
        self.grab_set()
        self.configure(fg_color=self.ui["bg"])
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        build_tool_header(self, t("rotate_pdf.header"), t("rotate_pdf.detail"))

        self.main_card = ctk.CTkFrame(self, fg_color=self.ui["panel"], corner_radius=16,
                                      border_width=1, border_color=self.ui["border"])
        self.main_card.pack(pady=12, padx=28, fill="both", expand=True)

        self.content_frame = ctk.CTkFrame(self.main_card, fg_color="transparent")
        self.content_frame.pack(pady=10, padx=16, fill="both", expand=True)

        self.show_empty_state()

        self.status_lbl = ctk.CTkLabel(
            self, text=t("visual_grid.no_rotation"),
            font=self.ui["small_font"], text_color=self.ui["muted"],
        )
        self.status_lbl.pack(pady=(4, 2))

        self.btn_run = ctk.CTkButton(
            self, text=t("rotate_pdf.run"),
            font=("Segoe UI Semibold", 16, "bold"), height=50,
            fg_color=self.ui["accent"], hover_color=self.ui["accent_hover"],
            text_color=self.ui["button_text"], state="disabled",
            command=self.run_rotate,
        )
        self.btn_run.pack(pady=(0, 18), padx=28, fill="x")

    def show_empty_state(self):
        for w in self.content_frame.winfo_children():
            w.destroy()
        self.visual_grid = None
        build_drop_zone(
            self.content_frame,
            on_paths=self.ingest_paths,
            on_browse=self.select_file,
            extensions={".pdf"},
            access_controller=self.access_controller,
        ).pack(fill="both", expand=True)

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
        if self.visual_grid:
            self.visual_grid.stop()
        for w in self.content_frame.winfo_children():
            w.destroy()
        self.visual_grid = None

        badge = t("app.encrypted_badge") if self.selected_is_encrypted else None
        build_file_card(
            self.content_frame, self.selected_file,
            badge_text=badge, badge_warning=bool(self.selected_is_encrypted),
            on_change=self.select_file,
        )

        self.visual_grid = PdfVisualGrid(
            self.content_frame,
            mode="rotate",
            cols=4,
            on_rotations_change=self._on_rotations_changed,
        )
        self.visual_grid.pack(fill="both", expand=True, pady=(8, 0))
        self.visual_grid.load_pdf(self.selected_file, self.selected_password)
        self.btn_run.configure(state="normal", fg_color=self.ui["accent"])

    def _on_rotations_changed(self, rotations: dict):
        n = sum(1 for a in rotations.values() if a != 0)
        if n == 0:
            self.status_lbl.configure(text=t("visual_grid.no_rotation"), text_color=self.ui["muted"])
        else:
            self.status_lbl.configure(
                text=t("visual_grid.rotate_status", n=n),
                text_color=self.ui["accent"],
            )

    def run_rotate(self):
        if not self.visual_grid:
            return
        rotations = self.visual_grid.get_rotations()

        save_path = filedialog.asksaveasfilename(
            parent=self, title=t("rotate_pdf.save_title"),
            defaultextension=".pdf", filetypes=[("PDF", "*.pdf")],
        )
        if not save_path:
            return

        self.btn_run.configure(state="disabled", fg_color=self.ui["panel_alt"])
        q = Queue()
        finished = {"value": False}
        progress_dialog = ProgressDialog(self, self.ortalama_func, total_count=2,
                                         title=t("rotate_pdf.progress_title"))
        progress_dialog.update_progress(0, 2, t("progress.starting"))

        def worker():
            try:
                if self.access_controller:
                    self.access_controller.authorize_operation("rotate-pdf", [self.selected_file])
                import fitz
                doc = fitz.open(self.selected_file)
                if self.selected_password:
                    doc.authenticate(self.selected_password)
                for pnum, delta in rotations.items():
                    if delta != 0:
                        page = doc[pnum - 1]
                        page.set_rotation((page.rotation + delta) % 360)
                doc.save(save_path, garbage=4, deflate=True)
                doc.close()
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

    def _on_close(self):
        if self.visual_grid:
            self.visual_grid.stop()
        self.destroy()

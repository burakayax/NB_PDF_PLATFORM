import customtkinter as ctk
from tkinter import filedialog, messagebox
import os
import threading
from queue import Queue, Empty

from modules.i18n import t
from modules.pdf_password_dialog import PdfPasswordDialog
from modules.pdf_tool_ui import build_drop_zone, build_file_card, build_tool_header
from modules.progress_dialog import ProgressDialog
from modules.ui_theme import theme


class PdfToImageWindow(ctk.CTkToplevel):
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
        self.format_var = ctk.StringVar(value="jpg")

        self.title(t("pdf_to_image.window_title"))
        self.ortalama_func(self, 640, 650)
        self.grab_set()
        self.configure(fg_color=self.ui["bg"])

        build_tool_header(self, t("pdf_to_image.header"), t("pdf_to_image.detail"))

        self.main_card = ctk.CTkFrame(self, fg_color=self.ui["panel"], corner_radius=16, border_width=1, border_color=self.ui["border"])
        self.main_card.pack(pady=15, padx=30, fill="both", expand=True)

        self.content_frame = ctk.CTkFrame(self.main_card, fg_color="transparent")
        self.content_frame.pack(pady=10, padx=20, fill="both", expand=True)

        self.show_empty_state()

        options_frame = ctk.CTkFrame(self, fg_color="transparent")
        options_frame.pack(pady=(0, 8), padx=30, fill="x")

        ctk.CTkLabel(options_frame, text=t("pdf_to_image.format_label"), font=self.ui["subtitle_font"], text_color=self.ui["text"]).pack(anchor="w")
        fmt_row = ctk.CTkFrame(options_frame, fg_color="transparent")
        fmt_row.pack(fill="x", pady=(4, 0))
        for val in ["jpg", "png"]:
            ctk.CTkRadioButton(fmt_row, text=val.upper(), variable=self.format_var, value=val, text_color=self.ui["text"]).pack(side="left", padx=(0, 16))

        self.btn_run = ctk.CTkButton(
            self, text=t("pdf_to_image.run"),
            font=("Segoe UI Semibold", 16, "bold"), height=50,
            fg_color=self.ui["accent"], hover_color=self.ui["accent_hover"],
            text_color=self.ui["button_text"], state="disabled",
            command=self.run_convert,
        )
        self.btn_run.pack(pady=(0, 20), padx=30, fill="x")

    def show_empty_state(self):
        for w in self.content_frame.winfo_children():
            w.destroy()
        build_drop_zone(self.content_frame, on_paths=self.ingest_paths, on_browse=self.select_file, extensions={".pdf"}, access_controller=self.access_controller).pack(fill="both", expand=True)

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
                        return True if (hasattr(self.pdf_engine, "validate_pdf_password") and self.pdf_engine.validate_pdf_password(path, value)) else t("pdf_password.invalid_password")
                    except Exception as e:
                        return str(e)
                dialog = PdfPasswordDialog(self, self.ortalama_func, os.path.basename(path), password_validator=validate_password)
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
        build_file_card(self.content_frame, self.selected_file, badge_text=badge, badge_warning=bool(self.selected_is_encrypted), on_change=self.select_file)
        self.btn_run.configure(state="normal")

    def run_convert(self):
        save_path = filedialog.asksaveasfilename(parent=self, title=t("pdf_to_image.save_title"), defaultextension=".zip", filetypes=[("ZIP", "*.zip")])
        if not save_path:
            return

        fmt = self.format_var.get()
        self.btn_run.configure(state="disabled", fg_color=self.ui["panel_alt"])
        q = Queue()
        finished = {"value": False}
        progress_dialog = ProgressDialog(self, self.ortalama_func, total_count=2, title=t("pdf_to_image.progress_title"))
        progress_dialog.update_progress(0, 2, t("progress.starting"))

        def worker():
            try:
                if self.access_controller:
                    self.access_controller.authorize_operation("pdf-to-image", [self.selected_file])
                import pdf_toolkit_extra
                import tempfile, shutil
                with tempfile.TemporaryDirectory() as workdir:
                    zip_tmp = pdf_toolkit_extra.pdf_to_images_zip(self.selected_file, workdir, image_format=fmt, password=self.selected_password)
                    shutil.copy2(zip_tmp, save_path)
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


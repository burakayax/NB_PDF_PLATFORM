import customtkinter as ctk
from tkinter import filedialog, messagebox
import os
import threading
from queue import Queue, Empty

from modules.i18n import t
from modules.pdf_tool_ui import build_drop_zone, build_file_card, build_tool_header
from modules.progress_dialog import ProgressDialog
from modules.ui_theme import theme


class UnlockPdfWindow(ctk.CTkToplevel):
    def __init__(self, master, ortalama_func, engine, success_dialog_class, access_controller=None):
        super().__init__(master)
        self.ui = theme()
        self.ortalama_func = ortalama_func
        self.pdf_engine = engine
        self.success_dialog = success_dialog_class
        self.access_controller = access_controller
        self.selected_file = None

        self.title(t("unlock_pdf.window_title"))
        self.ortalama_func(self, 640, 660)
        self.grab_set()
        self.configure(fg_color=self.ui["bg"])

        build_tool_header(self, t("unlock_pdf.header"), t("unlock_pdf.detail"))

        self.main_card = ctk.CTkFrame(self, fg_color=self.ui["panel"], corner_radius=16, border_width=1, border_color=self.ui["border"])
        self.main_card.pack(pady=15, padx=30, fill="both", expand=True)

        self.content_frame = ctk.CTkFrame(self.main_card, fg_color="transparent")
        self.content_frame.pack(pady=10, padx=20, fill="both", expand=True)

        self.show_empty_state()

        options_frame = ctk.CTkFrame(self, fg_color="transparent")
        options_frame.pack(pady=(0, 8), padx=30, fill="x")

        ctk.CTkLabel(options_frame, text=t("unlock_pdf.password_label"), font=self.ui["subtitle_font"], text_color=self.ui["text"]).pack(anchor="w")
        self.password_entry = ctk.CTkEntry(
            options_frame, height=40, corner_radius=10, border_width=1,
            placeholder_text=t("unlock_pdf.password_placeholder"),
            show="*",
            fg_color=self.ui.get("input_bg", self.ui["panel"]),
            border_color=self.ui.get("input_border", self.ui["border"]),
            text_color=self.ui["text"],
        )
        self.password_entry.pack(fill="x", pady=(4, 0))

        self.btn_run = ctk.CTkButton(
            self, text=t("unlock_pdf.run"),
            font=("Segoe UI Semibold", 16, "bold"), height=50,
            fg_color=self.ui["accent"], hover_color=self.ui["accent_hover"],
            text_color=self.ui["button_text"], state="disabled",
            command=self.run_unlock,
        )
        self.btn_run.pack(pady=(0, 20), padx=30, fill="x")

    def show_empty_state(self):
        for w in self.content_frame.winfo_children():
            w.destroy()
        build_drop_zone(self.content_frame, on_paths=self.ingest_paths, on_browse=self.select_file, extensions={".pdf"}, access_controller=self.access_controller).pack(fill="both", expand=True)

    def ingest_paths(self, paths):
        if not paths:
            return
        self.selected_file = paths[0]
        self.update_ui()
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
        build_file_card(self.content_frame, self.selected_file, on_change=self.select_file)
        self.btn_run.configure(state="normal")

    def run_unlock(self):
        password = (self.password_entry.get() or "").strip()
        if not password:
            messagebox.showwarning(t("app.warning"), t("unlock_pdf.missing_password"))
            return

        save_path = filedialog.asksaveasfilename(parent=self, title=t("unlock_pdf.save_title"), defaultextension=".pdf", filetypes=[("PDF", "*.pdf")])
        if not save_path:
            return

        self.btn_run.configure(state="disabled", fg_color=self.ui["panel_alt"])
        q = Queue()
        finished = {"value": False}
        progress_dialog = ProgressDialog(self, self.ortalama_func, total_count=2, title=t("unlock_pdf.progress_title"))
        progress_dialog.update_progress(0, 2, t("progress.starting"))

        def worker():
            try:
                if self.access_controller:
                    self.access_controller.authorize_operation("unlock-pdf", [self.selected_file])
                import pdf_toolkit_extra
                pdf_toolkit_extra.unlock_pdf_pikepdf(self.selected_file, save_path, password)
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


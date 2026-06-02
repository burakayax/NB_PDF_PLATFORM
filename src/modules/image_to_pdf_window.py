import customtkinter as ctk
from tkinter import filedialog, messagebox
import os
import threading
from queue import Queue, Empty

from modules.i18n import t
from modules.pdf_tool_ui import build_tool_header
from modules.progress_dialog import ProgressDialog
from modules.ui_theme import theme

_SUPPORTED_IMG = [("Images", "*.jpg *.jpeg *.png *.bmp *.gif *.tiff *.tif *.webp")]


class ImageToPdfWindow(ctk.CTkToplevel):
    def __init__(self, master, ortalama_func, engine, success_dialog_class, access_controller=None):
        super().__init__(master)
        self.ui = theme()
        self.ortalama_func = ortalama_func
        self.pdf_engine = engine
        self.success_dialog = success_dialog_class
        self.access_controller = access_controller
        self.image_paths = []

        self.title(t("image_to_pdf.window_title"))
        self.ortalama_func(self, 640, 680)
        self.grab_set()
        self.configure(fg_color=self.ui["bg"])

        build_tool_header(self, t("image_to_pdf.header"), t("image_to_pdf.detail"))

        self.main_card = ctk.CTkFrame(self, fg_color=self.ui["panel"], corner_radius=16, border_width=1, border_color=self.ui["border"])
        self.main_card.pack(pady=15, padx=30, fill="both", expand=True)

        btn_row = ctk.CTkFrame(self.main_card, fg_color="transparent")
        btn_row.pack(fill="x", padx=16, pady=(12, 4))
        ctk.CTkButton(btn_row, text=t("image_to_pdf.add_images"), height=36, corner_radius=10, fg_color=self.ui["accent"], hover_color=self.ui["accent_hover"], text_color=self.ui["button_text"], command=self.add_images).pack(side="left", padx=(0, 8))
        ctk.CTkButton(btn_row, text=t("image_to_pdf.clear"), height=36, corner_radius=10, fg_color=self.ui["panel_alt"], hover_color=self.ui["panel_soft"], text_color=self.ui["text"], command=self.clear_images).pack(side="left")

        self.count_label = ctk.CTkLabel(self.main_card, text="", font=self.ui["small_font"], text_color=self.ui["muted"])
        self.count_label.pack(anchor="w", padx=16, pady=(4, 4))

        self.list_frame = ctk.CTkScrollableFrame(self.main_card, fg_color="transparent", height=220)
        self.list_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        self.btn_run = ctk.CTkButton(
            self, text=t("image_to_pdf.run"),
            font=("Segoe UI Semibold", 16, "bold"), height=50,
            fg_color=self.ui["accent"], hover_color=self.ui["accent_hover"],
            text_color=self.ui["button_text"], state="disabled",
            command=self.run_convert,
        )
        self.btn_run.pack(pady=(0, 20), padx=30, fill="x")

    def add_images(self):
        files = filedialog.askopenfilenames(parent=self, filetypes=_SUPPORTED_IMG)
        if files:
            self.image_paths.extend(list(files))
            self.refresh_list()
        self.lift()

    def clear_images(self):
        self.image_paths.clear()
        self.refresh_list()

    def refresh_list(self):
        for w in self.list_frame.winfo_children():
            w.destroy()
        for i, p in enumerate(self.image_paths):
            row = ctk.CTkFrame(self.list_frame, fg_color=self.ui["panel_alt"], corner_radius=8)
            row.pack(fill="x", pady=2)
            ctk.CTkLabel(row, text=f"{i+1}. {os.path.basename(p)}", font=self.ui["small_font"], text_color=self.ui["text"], anchor="w").pack(side="left", padx=10, expand=True, fill="x")
            idx = i
            ctk.CTkButton(row, text="✕", width=28, height=28, corner_radius=6, fg_color="transparent", hover_color=self.ui["danger"], text_color=self.ui["muted"], command=lambda i=idx: self.remove_image(i)).pack(side="right", padx=4)
        n = len(self.image_paths)
        self.count_label.configure(text=t("image_to_pdf.images_count", n=n) if n else "")
        self.btn_run.configure(state="normal" if n > 0 else "disabled")

    def remove_image(self, idx):
        if 0 <= idx < len(self.image_paths):
            self.image_paths.pop(idx)
            self.refresh_list()

    def run_convert(self):
        if not self.image_paths:
            messagebox.showwarning(t("app.warning"), t("image_to_pdf.no_images"))
            return
        save_path = filedialog.asksaveasfilename(parent=self, title=t("image_to_pdf.save_title"), defaultextension=".pdf", filetypes=[("PDF", "*.pdf")])
        if not save_path:
            return

        self.btn_run.configure(state="disabled", fg_color=self.ui["panel_alt"])
        q = Queue()
        finished = {"value": False}
        paths_snapshot = list(self.image_paths)
        progress_dialog = ProgressDialog(self, self.ortalama_func, total_count=2, title=t("image_to_pdf.progress_title"))
        progress_dialog.update_progress(0, 2, t("progress.starting"))

        def worker():
            try:
                if self.access_controller:
                    self.access_controller.authorize_operation("image-to-pdf", paths_snapshot)
                import pdf_toolkit_extra
                pdf_toolkit_extra.images_to_pdf(paths_snapshot, save_path)
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

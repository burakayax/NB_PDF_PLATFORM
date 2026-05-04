import customtkinter as ctk
from tkinter import filedialog, messagebox
import os
import threading
from queue import Queue, Empty

from modules.i18n import t
from modules.pdf_tool_ui import build_tool_header
from modules.progress_dialog import ProgressDialog
from modules.ui_theme import theme


class HtmlToPdfWindow(ctk.CTkToplevel):
    def __init__(self, master, ortalama_func, engine, success_dialog_class, access_controller=None):
        super().__init__(master)
        self.ui = theme()
        self.ortalama_func = ortalama_func
        self.pdf_engine = engine
        self.success_dialog = success_dialog_class
        self.access_controller = access_controller
        self.selected_html_file = None
        self.active_tab = ctk.StringVar(value="url")

        self.title(t("html_to_pdf.window_title"))
        self.ortalama_func(self, 640, 620)
        self.grab_set()
        self.configure(fg_color=self.ui["bg"])

        build_tool_header(self, t("html_to_pdf.header"), t("html_to_pdf.detail"))

        self.main_card = ctk.CTkFrame(self, fg_color=self.ui["panel"], corner_radius=16, border_width=1, border_color=self.ui["border"])
        self.main_card.pack(pady=15, padx=30, fill="both", expand=True)

        inner = ctk.CTkFrame(self.main_card, fg_color="transparent")
        inner.pack(pady=16, padx=20, fill="both", expand=True)

        tab_row = ctk.CTkFrame(inner, fg_color="transparent")
        tab_row.pack(fill="x", pady=(0, 12))
        self._tab_url_btn = ctk.CTkButton(tab_row, text=t("html_to_pdf.tab_url"), height=34, corner_radius=10, command=lambda: self._switch_tab("url"))
        self._tab_url_btn.pack(side="left", padx=(0, 6))
        self._tab_file_btn = ctk.CTkButton(tab_row, text=t("html_to_pdf.tab_file"), height=34, corner_radius=10, command=lambda: self._switch_tab("file"))
        self._tab_file_btn.pack(side="left")

        self.url_frame = ctk.CTkFrame(inner, fg_color="transparent")
        ctk.CTkLabel(self.url_frame, text=t("html_to_pdf.url_label"), font=self.ui["subtitle_font"], text_color=self.ui["text"]).pack(anchor="w")
        self.url_entry = ctk.CTkEntry(
            self.url_frame, height=40, corner_radius=10, border_width=1,
            placeholder_text=t("html_to_pdf.url_placeholder"),
            fg_color=self.ui.get("input_bg", self.ui["panel"]),
            border_color=self.ui.get("input_border", self.ui["border"]),
            text_color=self.ui["text"],
        )
        self.url_entry.pack(fill="x", pady=(4, 0))

        self.file_frame = ctk.CTkFrame(inner, fg_color="transparent")
        self.file_label = ctk.CTkLabel(self.file_frame, text=t("tool_ui.drop_hint"), font=self.ui["small_font"], text_color=self.ui["muted"])
        self.file_label.pack(anchor="w")
        ctk.CTkButton(self.file_frame, text=t("app.select_file"), height=36, corner_radius=10, fg_color=self.ui["accent"], hover_color=self.ui["accent_hover"], text_color=self.ui["button_text"], command=self.select_html_file).pack(anchor="w", pady=(6, 0))

        self._switch_tab("url")

        self.btn_run = ctk.CTkButton(
            self, text=t("html_to_pdf.run"),
            font=("Segoe UI Semibold", 16, "bold"), height=50,
            fg_color=self.ui["accent"], hover_color=self.ui["accent_hover"],
            text_color=self.ui["button_text"],
            command=self.run_convert,
        )
        self.btn_run.pack(pady=(0, 20), padx=30, fill="x")

    def _switch_tab(self, tab):
        self.active_tab.set(tab)
        accent = self.ui["accent"]
        panel = self.ui["panel_alt"]
        text_btn = self.ui["button_text"]
        text_col = self.ui["text"]
        if tab == "url":
            self._tab_url_btn.configure(fg_color=accent, text_color=text_btn)
            self._tab_file_btn.configure(fg_color=panel, text_color=text_col)
            self.file_frame.pack_forget()
            self.url_frame.pack(fill="x")
        else:
            self._tab_file_btn.configure(fg_color=accent, text_color=text_btn)
            self._tab_url_btn.configure(fg_color=panel, text_color=text_col)
            self.url_frame.pack_forget()
            self.file_frame.pack(fill="x")

    def select_html_file(self):
        f = filedialog.askopenfilename(parent=self, filetypes=[("HTML", "*.html *.htm")])
        if f:
            self.selected_html_file = f
            self.file_label.configure(text=os.path.basename(f))
        self.lift()

    def run_convert(self):
        tab = self.active_tab.get()
        if tab == "url":
            url = (self.url_entry.get() or "").strip()
            if not url:
                messagebox.showwarning(t("app.warning"), t("html_to_pdf.missing_input"))
                return
        else:
            if not self.selected_html_file:
                messagebox.showwarning(t("app.warning"), t("html_to_pdf.missing_input"))
                return

        save_path = filedialog.asksaveasfilename(parent=self, title=t("html_to_pdf.save_title"), defaultextension=".pdf", filetypes=[("PDF", "*.pdf")])
        if not save_path:
            return

        self.btn_run.configure(state="disabled", fg_color=self.ui["panel_alt"])
        q = Queue()
        finished = {"value": False}
        progress_dialog = ProgressDialog(self, self.ortalama_func, total_count=2, title=t("html_to_pdf.progress_title"))
        progress_dialog.update_progress(0, 2, t("progress.starting"))

        def worker():
            try:
                if self.access_controller:
                    src = url if tab == "url" else self.selected_html_file
                    self.access_controller.authorize_operation("html-to-pdf", [src])
                import pdf_toolkit_extra
                if tab == "url":
                    pdf_toolkit_extra.html_url_to_pdf(url, save_path)
                else:
                    with open(self.selected_html_file, "r", encoding="utf-8", errors="replace") as fh:
                        html_content = fh.read()
                    base_url = os.path.dirname(os.path.abspath(self.selected_html_file))
                    pdf_toolkit_extra.html_to_pdf_file(html_content, save_path, base_url=base_url)
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

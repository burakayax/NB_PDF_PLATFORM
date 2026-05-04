import customtkinter as ctk
from tkinter import filedialog, messagebox
import os

from modules.i18n import t
from modules.pdf_password_dialog import PdfPasswordDialog
from modules.pdf_tool_ui import build_drop_zone, build_file_card, build_tool_header
from modules.pdf_visual_grid import PdfVisualGrid
from modules.ui_theme import theme


class ExtractWindow(ctk.CTkToplevel):
    def __init__(self, master, ortalama_func, engine, success_dialog_class, access_controller=None):
        super().__init__(master)
        self.ortalama_func = ortalama_func
        self.pdf_engine = engine
        self.success_dialog = success_dialog_class
        self.access_controller = access_controller
        self.ui = theme()
        self.selected_file = None
        self.selected_password = None
        self.selected_is_encrypted = False
        self.visual_grid: PdfVisualGrid | None = None

        self.title(t("extract.window_title"))
        self.ortalama_func(self, 820, 820)
        self.grab_set()
        self.configure(fg_color=self.ui["bg"])
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        build_tool_header(self, t("extract.header"))

        self.main_card = ctk.CTkFrame(self, fg_color=self.ui["panel"], corner_radius=16,
                                      border_width=1, border_color=self.ui["border"])
        self.main_card.pack(pady=12, padx=28, fill="both", expand=True)

        self.content_frame = ctk.CTkFrame(self.main_card, fg_color="transparent")
        self.content_frame.pack(pady=10, padx=16, fill="both", expand=True)

        self.show_empty_state()

        # Save mode — gösterilmez/aktif değilken pasif görünür
        bottom_bar = ctk.CTkFrame(self, fg_color="transparent")
        bottom_bar.pack(pady=(4, 0), padx=28, fill="x")

        ctk.CTkLabel(
            bottom_bar, text=t("extract.save_mode"),
            font=self.ui["subtitle_font"], text_color=self.ui["warning"],
        ).pack(anchor="w")
        self.segment_mode = ctk.CTkSegmentedButton(
            bottom_bar,
            values=[t("extract.mode_single"), t("extract.mode_separate")],
            command=lambda _: None,
        )
        self.segment_mode.set(t("extract.mode_single"))
        self.segment_mode.pack(fill="x", pady=(4, 4))

        self.status_lbl = ctk.CTkLabel(
            self, text=t("visual_grid.no_selection"),
            font=self.ui["small_font"], text_color=self.ui["muted"],
        )
        self.status_lbl.pack(pady=(2, 2))

        self.btn_run = ctk.CTkButton(
            self, text=t("extract.run"),
            font=("Segoe UI Semibold", 16, "bold"), height=50,
            fg_color=self.ui["panel_alt"], hover_color=self.ui["border"],
            text_color=self.ui["button_text"], state="disabled",
            command=self.run_extract,
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

    def ingest_paths(self, paths: list[str]) -> None:
        if not paths:
            return
        file = paths[0]
        try:
            password = None
            is_encrypted = False
            if hasattr(self.pdf_engine, "is_pdf_encrypted"):
                is_encrypted = self.pdf_engine.is_pdf_encrypted(file)
            if is_encrypted:
                def validate_password(value):
                    try:
                        if hasattr(self.pdf_engine, "validate_pdf_password") \
                                and self.pdf_engine.validate_pdf_password(file, value):
                            return True
                        return t("pdf_password.invalid_password")
                    except Exception as e:
                        return str(e)
                dialog = PdfPasswordDialog(
                    self, self.ortalama_func, os.path.basename(file),
                    password_validator=validate_password, allow_skip=False,
                )
                self.wait_window(dialog)
                if not dialog.result:
                    self.lift()
                    return
                password = dialog.result

            self.selected_file = file
            self.selected_password = password
            self.selected_is_encrypted = is_encrypted
            self.update_ui()
        except Exception as e:
            messagebox.showerror(t("app.error"), t("extract.file_read_error", error=e))
        self.lift()

    def select_file(self):
        f = filedialog.askopenfilename(parent=self, filetypes=[("PDF Files", "*.pdf")])
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
            mode="select",
            cols=4,
            on_selection_change=self._on_selection_changed,
        )
        self.visual_grid.pack(fill="both", expand=True, pady=(8, 0))
        self.visual_grid.load_pdf(self.selected_file, self.selected_password)

    def _on_selection_changed(self, pages: set):
        n = len(pages)
        if n == 0:
            self.status_lbl.configure(text=t("visual_grid.no_selection"), text_color=self.ui["muted"])
            self.btn_run.configure(state="disabled", fg_color=self.ui["panel_alt"])
        else:
            self.status_lbl.configure(
                text=t("visual_grid.selected_status", n=n),
                text_color=self.ui["accent"],
            )
            self.btn_run.configure(state="normal", fg_color=self.ui["accent"],
                                   text_color=self.ui["button_text"])

    def run_extract(self):
        if not self.visual_grid:
            return
        pages_list = self.visual_grid.get_selected()
        if not pages_list:
            messagebox.showwarning(t("app.warning"), t("extract.invalid_format"))
            return

        save_mode = self.segment_mode.get()

        try:
            if save_mode == t("extract.mode_single"):
                save_path = filedialog.asksaveasfilename(
                    parent=self, title=t("extract.save_title"),
                    defaultextension=".pdf", filetypes=[("PDF", "*.pdf")],
                )
                if save_path:
                    if self.access_controller:
                        self.access_controller.authorize_operation("split", [self.selected_file])
                    if hasattr(self.pdf_engine, "extract_and_merge_pages"):
                        self.pdf_engine.extract_and_merge_pages(
                            self.selected_file, save_path, pages_list,
                        )
                    else:
                        self.pdf_engine.extract_pages(
                            self.selected_file, pages_list, save_path,
                            password=self.selected_password,
                        )
                    self.destroy()
                    self.success_dialog(self.master, save_path, self.ortalama_func)
            else:
                folder_path = filedialog.askdirectory(parent=self, title=t("extract.folder_title"))
                if folder_path:
                    if self.access_controller:
                        self.access_controller.authorize_operation("split", [self.selected_file])
                    if hasattr(self.pdf_engine, "extract_and_save_separate_pages"):
                        self.pdf_engine.extract_and_save_separate_pages(
                            self.selected_file, folder_path, pages_list,
                        )
                    else:
                        self.pdf_engine.extract_pages_separate(
                            self.selected_file, pages_list, folder_path,
                            password=self.selected_password,
                        )
                    self.destroy()
                    self.success_dialog(self.master, os.path.abspath(folder_path), self.ortalama_func)
        except Exception as e:
            messagebox.showerror(t("app.error"), str(e))

    def _on_close(self):
        if self.visual_grid:
            self.visual_grid.stop()
        self.destroy()

from __future__ import annotations

import re
import threading
import webbrowser
from queue import Empty, Queue
from tkinter import messagebox

import customtkinter as ctk

from modules.desktop_auth import DesktopAuthClient, DesktopAuthError, DesktopNetworkError
from modules.i18n import t
from modules.ui_theme import theme


class ContactDialog(ctk.CTkToplevel):
    def __init__(self, master, ortalama_func, auth_client: DesktopAuthClient):
        super().__init__(master)
        self.ui = theme()
        self.ortalama_func = ortalama_func
        self.auth_client = auth_client
        self._queue: Queue = Queue()
        self._closed = False

        self.title(t("contact.window_title"))
        self.ortalama_func(self, 520, 560)
        self.grab_set()
        self.configure(fg_color=self.ui["bg"])
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        # Header
        header = ctk.CTkFrame(self, fg_color=self.ui["panel"], height=62, corner_radius=0, border_width=0)
        header.pack(fill="x")
        header.pack_propagate(False)
        h_inner = ctk.CTkFrame(header, fg_color="transparent")
        h_inner.pack(fill="both", expand=True, padx=22, pady=14)
        ctk.CTkLabel(h_inner, text=t("contact.header"), font=self.ui["title_font"], text_color=self.ui.get("accent_soft", self.ui["accent"])).pack(anchor="w")
        ctk.CTkLabel(h_inner, text=t("contact.description"), font=self.ui["small_font"], text_color=self.ui["muted"], wraplength=460, justify="left").pack(anchor="w", pady=(4, 0))

        # Form card
        body = ctk.CTkFrame(self, fg_color=self.ui["panel"], border_width=1, border_color=self.ui["border"], corner_radius=18)
        body.pack(fill="both", expand=True, padx=20, pady=(12, 0))
        body.grid_columnconfigure(0, weight=1)

        self.status_label = ctk.CTkLabel(body, text="", font=self.ui["small_font"], text_color=self.ui["danger"], wraplength=440, justify="left")
        self.status_label.grid(row=0, column=0, sticky="w", padx=20, pady=(14, 0))

        entry_cfg = dict(
            height=40, corner_radius=10, border_width=1,
            fg_color=self.ui.get("input_bg", self.ui["panel_alt"]),
            border_color=self.ui.get("input_border", self.ui["border"]),
            text_color=self.ui["text"],
        )

        ctk.CTkLabel(body, text=t("contact.name"), font=self.ui["subtitle_font"], text_color=self.ui["text"]).grid(row=1, column=0, sticky="w", padx=20, pady=(10, 2))
        self.entry_name = ctk.CTkEntry(body, **entry_cfg)
        self.entry_name.grid(row=2, column=0, sticky="ew", padx=20)

        ctk.CTkLabel(body, text=t("contact.email"), font=self.ui["subtitle_font"], text_color=self.ui["text"]).grid(row=3, column=0, sticky="w", padx=20, pady=(10, 2))
        self.entry_email = ctk.CTkEntry(body, **entry_cfg)
        self.entry_email.grid(row=4, column=0, sticky="ew", padx=20)

        ctk.CTkLabel(body, text=t("contact.message"), font=self.ui["subtitle_font"], text_color=self.ui["text"]).grid(row=5, column=0, sticky="w", padx=20, pady=(10, 2))
        self.entry_message = ctk.CTkTextbox(
            body, height=110, corner_radius=10, border_width=1,
            fg_color=self.ui.get("input_bg", self.ui["panel_alt"]),
            border_color=self.ui.get("input_border", self.ui["border"]),
            text_color=self.ui["text"],
        )
        self.entry_message.grid(row=6, column=0, sticky="ew", padx=20, pady=(0, 16))

        # Buttons
        btn_row = ctk.CTkFrame(body, fg_color="transparent")
        btn_row.grid(row=7, column=0, sticky="ew", padx=20, pady=(0, 18))
        btn_row.grid_columnconfigure(0, weight=1)

        self.btn_submit = ctk.CTkButton(
            btn_row, text=t("contact.submit"),
            height=44, corner_radius=12,
            font=("Segoe UI Semibold", 14, "bold"),
            fg_color=self.ui["accent"], hover_color=self.ui["accent_hover"],
            text_color=self.ui["button_text"],
            command=self._submit_clicked,
        )
        self.btn_submit.grid(row=0, column=0, sticky="ew", padx=(0, 8))

        ctk.CTkButton(
            btn_row, text=t("contact.close"),
            width=100, height=44, corner_radius=12,
            font=self.ui["subtitle_font"],
            fg_color=self.ui["panel_alt"], hover_color=self.ui["border"],
            text_color=self.ui["text"],
            command=self._on_close,
        ).grid(row=0, column=1)

        self.after(100, self._process_queue_loop)

    def _on_close(self):
        self._closed = True
        self.destroy()

    def _set_status(self, text: str):
        self.status_label.configure(text=text or "")

    def _validate(self) -> bool:
        name = (self.entry_name.get() or "").strip()
        email = (self.entry_email.get() or "").strip()
        message = (self.entry_message.get("1.0", "end") or "").strip()
        if len(name) < 2:
            self._set_status(t("contact.validation_name"))
            return False
        if not email:
            self._set_status(t("contact.validation_email_required"))
            return False
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
            self._set_status(t("contact.validation_email"))
            return False
        if len(message) < 10:
            self._set_status(t("contact.validation_message"))
            return False
        self._set_status("")
        return True

    def _submit_clicked(self):
        if not self._validate():
            return
        name = (self.entry_name.get() or "").strip()
        email = (self.entry_email.get() or "").strip()
        message = (self.entry_message.get("1.0", "end") or "").strip()
        self.btn_submit.configure(state="disabled", text=t("contact.submitting"))

        def worker():
            try:
                result = self.auth_client.submit_contact(name, email, message)
                self._queue.put(("ok", result))
            except DesktopNetworkError as e:
                self._queue.put(("network_err", str(e)))
            except DesktopAuthError as e:
                self._queue.put(("err", str(e)))
            except Exception as e:
                self._queue.put(("err", str(e)))

        threading.Thread(target=worker, daemon=True).start()

    def _open_web_contact(self):
        try:
            from modules.desktop_auth import load_desktop_auth_config
            cfg = load_desktop_auth_config()
            web_url = cfg.get("web_app_url", "").rstrip("/")
            if web_url:
                webbrowser.open(f"{web_url}/contact")
        except Exception:
            pass

    def _process_queue_loop(self):
        if self._closed:
            return
        try:
            while True:
                item = self._queue.get_nowait()
                self._handle_queue_item(item)
        except Empty:
            pass
        self.after(120, self._process_queue_loop)

    def _handle_queue_item(self, item):
        kind = item[0]
        if kind == "ok":
            msg = ""
            if isinstance(item[1], dict):
                msg = str(item[1].get("message") or "").strip()
            if not msg:
                msg = t("contact.success_body")
            self.btn_submit.configure(state="normal", text=t("contact.submit"))
            messagebox.showinfo(t("contact.success_title"), msg)
            self._on_close()
        elif kind == "network_err":
            self.btn_submit.configure(state="normal", text=t("contact.submit"))
            self._set_status(item[1])
            if messagebox.askyesno(
                t("contact.error_title"),
                f"{item[1]}\n\nWeb sayfasındaki iletişim formunu açmak ister misiniz?" if t.__module__ else f"{item[1]}\n\nOpen web contact form?",
            ):
                self._open_web_contact()
        elif kind == "err":
            self.btn_submit.configure(state="normal", text=t("contact.submit"))
            messagebox.showerror(t("contact.error_title"), item[1])

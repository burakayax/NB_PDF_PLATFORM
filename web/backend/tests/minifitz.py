"""Testler için küçük PDF üretme/okuma yardımcısı (PyMuPDF'siz).

Eski testler PyMuPDF'in `fitz` arayüzüyle PDF üretiyor/okuyordu. Üretim koduna PyMuPDF girmediği
için testler de ona bağlı kalmasın diye aynı küçük arayüz reportlab + pdfcore (pdfium/pikepdf) ile
sağlanır. Yalnızca testlerin kullandığı alt küme vardır: yeni belge, metin/şekil/resim ekleme,
kaydetme (AES-256 şifreleme dahil), açma, metin/blok/span okuma, görüntüleme (pixmap), çizim/resim sayımı.
"""
from __future__ import annotations

import io
import os
import sys
import uuid
from pathlib import Path
from typing import Any, Optional

_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from PIL import Image  # noqa: E402

PDF_ENCRYPT_AES_256 = 5
PDF_WIDGET_TYPE_TEXT = 7
PDF_WIDGET_TYPE_CHECKBOX = 2
csGRAY = "gray"
csRGB = "rgb"


class Rect:
    def __init__(self, x0: float = 0, y0: float = 0, x1: float = 0, y1: float = 0) -> None:
        self.x0, self.y0, self.x1, self.y1 = float(x0), float(y0), float(x1), float(y1)

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0

    def __iter__(self):
        return iter((self.x0, self.y0, self.x1, self.y1))

    def __getitem__(self, i: int) -> float:
        return (self.x0, self.y0, self.x1, self.y1)[i]

    def __repr__(self) -> str:
        return f"Rect({self.x0}, {self.y0}, {self.x1}, {self.y1})"


IRect = Rect


class Pixmap:
    """Hem render çıktısı hem boş (düz renk) görüntü için: samples/n/w/h/pixel."""

    def __init__(self, cs: Any = None, irect: Any = None, alpha: bool = False, *, image: Optional[Image.Image] = None) -> None:
        if image is None:
            r = Rect(*irect)
            image = Image.new("L" if cs == csGRAY else "RGB", (int(r.width), int(r.height)), 255)
        self.image = image

    def clear_with(self, value: int) -> None:
        self.image.paste(value if self.image.mode == "L" else (value,) * 3, (0, 0, *self.image.size))

    @property
    def w(self) -> int:
        return self.image.width

    @property
    def h(self) -> int:
        return self.image.height

    width, height = w, h

    @property
    def n(self) -> int:
        return len(self.image.getbands())

    @property
    def samples(self) -> bytes:
        return self.image.tobytes()

    def pixel(self, x: int, y: int) -> tuple:
        v = self.image.getpixel((x, y))
        return v if isinstance(v, tuple) else (v,)


class Font:
    """Yalnız text_length için: standart 'helv' ya da bir TTF dosyası."""

    def __init__(self, fontname: str = "helv", fontfile: Optional[str] = None) -> None:
        self._ttf = None
        if fontfile:
            from fontTools.ttLib import TTFont

            self._ttf = TTFont(fontfile)
            self._upem = self._ttf["head"].unitsPerEm
            self._cmap = self._ttf.getBestCmap()
            self._hmtx = self._ttf["hmtx"]

    def text_length(self, text: str, fontsize: float = 11) -> float:
        if self._ttf is None:
            from reportlab.pdfbase.pdfmetrics import stringWidth

            return stringWidth(text, "Helvetica", fontsize)
        return sum(self._hmtx[self._cmap[ord(c)]][0] for c in text if ord(c) in self._cmap) * fontsize / self._upem


_UNI_HELV: list = []


def _unicode_helv() -> str:
    """Helvetica ölçülü (Liberation Sans) gömülü yazı tipi — Türkçe harfler için."""
    if not _UNI_HELV:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        from app.core import edit_fonts as ef

        name = "mf_unihelv"
        pdfmetrics.registerFont(TTFont(name, ef.family_path("lsans")))
        _UNI_HELV.append(name)
    return _UNI_HELV[0]


class Widget:
    """Form alanı (yalnız metin kutusu ve onay kutusu)."""

    def __init__(self) -> None:
        self.field_type = PDF_WIDGET_TYPE_TEXT
        self.field_name = ""
        self.rect = Rect()
        self.text_fontsize = 12


class Page:
    """Yazılabilir (yeni) ya da salt-okunur (açılmış) sayfa."""

    def __init__(self, doc: "Document", index: int, width: float = 595, height: float = 842) -> None:
        self._doc = doc
        self._index = index
        self._ops: list[tuple] = []
        self._w, self._h = float(width), float(height)
        self._fonts: dict[str, str] = {}

    # ---- yazma ----
    @property
    def rect(self) -> Rect:
        if self._doc._data is not None:
            from src.pdfcore import pages as pc

            pdf = self._doc._pike()
            w, h = pc.page_visual_size(pdf.pages[self._index])
            return Rect(0, 0, w, h)
        return Rect(0, 0, self._w, self._h)

    def insert_text(self, point, text, fontsize: float = 11, fontname: str = "helv", color=(0, 0, 0), render_mode: int = 0, **_: Any) -> None:
        self._ops.append(("text", tuple(point), text, fontsize, fontname, tuple(color or (0, 0, 0)), render_mode))

    def insert_font(self, fontname: str, fontfile: str) -> None:
        self._doc._ttf_register(fontname, fontfile)

    def insert_textbox(self, rect, text: str, fontsize: float = 11, fontname: str = "helv", color=(0, 0, 0),
                       lineheight: float = 1.2, **_: Any) -> None:
        """Sözcük kaydırmalı çok satırlı metin (sol hizalı); sığmayan satırlar çizilmez."""
        from reportlab.pdfbase.pdfmetrics import stringWidth

        r = Rect(*rect)
        name = self._doc._reg_name(fontname)
        y = r.y0 + fontsize
        for para in str(text).split(chr(10)):
            line = ""
            for word in para.split(" "):
                trial = (line + " " + word).strip()
                if line and stringWidth(trial, name, fontsize) > r.width:
                    if y > r.y1:
                        return
                    self.insert_text((r.x0, y), line, fontsize=fontsize, fontname=fontname, color=color)
                    y += fontsize * lineheight
                    line = word
                else:
                    line = trial
            if y > r.y1:
                return
            self.insert_text((r.x0, y), line, fontsize=fontsize, fontname=fontname, color=color)
            y += fontsize * lineheight

    def draw_line(self, p1, p2, color=(0, 0, 0), width: float = 1, **_: Any) -> None:
        self._ops.append(("line", tuple(p1), tuple(p2), color, width))

    def add_widget(self, w: Widget) -> None:
        self._ops.append(("widget", w))

    def draw_rect(self, rect, color=(0, 0, 0), fill=None, width: float = 1, **_: Any) -> None:
        self._ops.append(("rect", tuple(rect), color, fill, width))

    def insert_image(self, rect, stream: Optional[bytes] = None, pixmap: Optional[Pixmap] = None, **_: Any) -> None:
        img = Image.open(io.BytesIO(stream)) if stream is not None else pixmap.image  # type: ignore[union-attr]
        self._ops.append(("image", tuple(rect), img, stream))

    # ---- okuma ----
    def _glyphs(self):
        from src.pdfcore import content as ct

        pdf = self._doc._pike()
        return ct.scan_page(pdf, pdf.pages[self._index])

    def get_text(self, mode: str = "text") -> Any:
        from src.pdfcore import layout as lay

        sc = self._glyphs()
        blocks = lay.build_blocks([g for g in sc.glyphs if g.font is not None])
        if mode == "dict":
            out = []
            for bl in blocks:
                lines = []
                for ln in bl:
                    spans = []
                    for sp in ln:
                        sp = lay.with_spaces(sp) if hasattr(lay, "with_spaces") else sp
                        spans.append({
                            "text": "".join(g.ch for g in sp), "font": __import__("re").sub(r"^[A-Z]{6}\+", "", sp[0].font.name or ""), "size": sp[0].size,
                            "bbox": (min(g.x0 for g in sp), min(g.y0 for g in sp), max(g.x1 for g in sp), max(g.y1 for g in sp)),
                            "origin": (sp[0].ox, sp[0].oy),
                        })
                    lines.append({"spans": spans})
                out.append({"lines": lines})
            return {"blocks": out}
        texts = []
        for bl in blocks:
            lines = ["".join("".join(g.ch for g in lay.with_spaces(sp)) for sp in ln) for ln in bl]
            gs = [g for ln in bl for sp in ln for g in sp]
            texts.append((min(g.x0 for g in gs), min(g.y0 for g in gs), max(g.x1 for g in gs), max(g.y1 for g in gs),
                          "\n".join(lines) + "\n", len(texts), 0))
        if mode == "blocks":
            return texts
        return "".join(t[4] for t in texts)

    def get_pixmap(self, dpi: float = 72, colorspace: Any = None, clip: Any = None, **_: Any) -> Pixmap:
        from src.pdfcore import PdfiumReader

        with PdfiumReader(self._doc.tobytes()) as rd:
            im = rd.render(self._index, dpi=dpi, **({"crop": tuple(clip)} if clip is not None else {}))
        im = im.convert("L" if colorspace == csGRAY else "RGB")
        return Pixmap(image=im)

    def get_drawings(self) -> list:
        return list(self._glyphs().paths)

    def get_image_info(self) -> list:
        return [{"bbox": im.rect} for im in self._glyphs().images]


class Document:
    def __init__(self, data: Optional[bytes] = None, password: Optional[str] = None) -> None:
        self._data = data
        self._password = password
        self._pages: list[Page] = []
        self._pk = None
        self._fontfiles: dict[str, str] = {}
        self._toc: list = []
        self._regs: dict[str, str] = {}
        self._lazy = data is not None

    def _load(self) -> None:
        if self._lazy:
            self._lazy = False
            self._pages = [Page(self, i) for i in range(len(self._pike().pages))]

    def set_toc(self, toc: list) -> None:
        self._toc = list(toc)

    def _pike(self):
        if self._pk is None:
            import pikepdf

            self._pk = pikepdf.open(io.BytesIO(self._data), password=self._password or "")
        return self._pk

    def _ttf_register(self, name: str, path: str) -> None:
        self._fontfiles[name] = path
        if name not in self._regs:
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont

            self._regs[name] = "mf_" + uuid.uuid4().hex[:8]
            pdfmetrics.registerFont(TTFont(self._regs[name], path))

    def _reg_name(self, fontname: str) -> str:
        return self._regs.get(fontname, "Helvetica")

    @property
    def needs_pass(self) -> bool:
        import pikepdf

        try:
            pikepdf.open(io.BytesIO(self._data)).close()
            return False
        except pikepdf.PasswordError:
            return True

    def authenticate(self, pw: str) -> bool:
        import pikepdf

        try:
            pikepdf.open(io.BytesIO(self._data), password=pw).close()
            self._password = pw
            self._pk = None
            return True
        except pikepdf.PasswordError:
            return False

    @property
    def page_count(self) -> int:
        self._load()
        return len(self._pages)

    def __len__(self) -> int:
        return self.page_count

    def __getitem__(self, i: int) -> Page:
        self._load()
        return self._pages[i]

    def __iter__(self):
        self._load()
        return iter(self._pages)

    def new_page(self, pno: int = -1, width: float = 595, height: float = 842) -> Page:
        assert self._data is None, "minifitz: açılmış belgeye sayfa eklenemez"
        p = Page(self, len(self._pages), width, height)
        self._pages.append(p)
        return p

    def subset_fonts(self) -> None:  # reportlab zaten yalnız kullanılan harfleri gömer
        return None

    def close(self) -> None:
        if self._pk is not None:
            self._pk.close()

    def tobytes(self, **_: Any) -> bytes:
        if self._data is not None:
            return self._data
        from reportlab.lib.utils import ImageReader
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.pdfgen import canvas

        from reportlab import rl_config

        rl_config.useA85 = 0  # ikili akış (ASCII85 boyutu %25 şişirir)
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pageCompression=0)
        regs = self._regs
        for pno, pg in enumerate(self._pages):
            c.setPageSize((pg._w, pg._h))
            for lvl, title, page_no in self._toc:
                if page_no == pno + 1:
                    key = f"bm{pno}_{len(title)}_{lvl}"
                    c.bookmarkPage(key)
                    c.addOutlineEntry(title, key, level=max(0, int(lvl) - 1), closed=False)
            H = pg._h
            for op in pg._ops:
                if op[0] == "text":
                    _, (x, y), text, size, fname, col, mode = op
                    t = c.beginText(x, H - y)
                    face = regs.get(fname, "Helvetica")
                    if face == "Helvetica":
                        try:
                            text.encode("cp1252")
                        except UnicodeEncodeError:  # ş, ğ, ı gibi harfler standart Helvetica'da yok → gömülü eşdeğer
                            face = _unicode_helv()
                    t.setFont(face, size)
                    t.setFillColorRGB(*col)
                    t.setTextRenderMode(mode)
                    t.textOut(text)
                    c.drawText(t)
                elif op[0] == "line":
                    _, (x0, y0), (x1, y1), color, width = op
                    c.setStrokeColorRGB(*(color or (0, 0, 0)))
                    c.setLineWidth(width)
                    c.line(x0, H - y0, x1, H - y1)
                elif op[0] == "widget":
                    w = op[1]
                    r = w.rect
                    if w.field_type == PDF_WIDGET_TYPE_CHECKBOX:
                        c.acroForm.checkbox(name=w.field_name, x=r.x0, y=H - r.y1, size=r.width, borderWidth=1)
                    else:
                        c.acroForm.textfield(name=w.field_name, x=r.x0, y=H - r.y1, width=r.width, height=r.height,
                                             fontSize=w.text_fontsize, borderWidth=1)
                elif op[0] == "rect":
                    _, (x0, y0, x1, y1), color, fill, width = op
                    if color:
                        c.setStrokeColorRGB(*color)
                    if fill:
                        c.setFillColorRGB(*fill)
                    c.setLineWidth(width)
                    c.rect(x0, H - y1, x1 - x0, y1 - y0, stroke=1 if color else 0, fill=1 if fill else 0)
                else:
                    _, (x0, y0, x1, y1), img, raw = op
                    if raw is not None and img.format == "JPEG":
                        src = ImageReader(io.BytesIO(raw))  # JPEG olduğu gibi (yeniden sıkıştırılmaz)
                    else:
                        src = ImageReader(img.convert("RGBA") if img.mode in ("RGBA", "LA", "P") else img.convert("RGB"))
                    c.drawImage(src, x0, H - y1, x1 - x0, y1 - y0, mask="auto")
            c.showPage()
        if not self._pages:
            c.showPage()
        c.save()
        return buf.getvalue()

    def save(self, path: Any, garbage: int = 0, deflate: bool = False, encryption: Any = None,
             user_pw: str = "", owner_pw: str = "", **_: Any) -> None:
        data = self.tobytes()
        if encryption is not None:
            import pikepdf

            pdf = pikepdf.open(io.BytesIO(data))
            pdf.save(str(path), encryption=pikepdf.Encryption(user=user_pw, owner=owner_pw or user_pw, R=6))
            return
        Path(str(path)).write_bytes(data)


def open(*args: Any, stream: Optional[bytes] = None, filetype: Optional[str] = None, **_: Any) -> Document:  # noqa: A001
    """open() yeni belge; open(yol); open(stream=..., filetype="pdf"); open("pdf", bayt)."""
    if stream is not None:
        return Document(bytes(stream))
    if not args:
        return Document()
    if len(args) == 2 and isinstance(args[1], (bytes, bytearray)):
        return Document(bytes(args[1]))
    a = args[0]
    if isinstance(a, (bytes, bytearray)):
        return Document(bytes(a))
    return Document(Path(str(a)).read_bytes())

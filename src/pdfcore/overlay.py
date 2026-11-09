"""Mevcut sayfaların ÜSTÜNE çizim (metin, görsel, çizgi, bağlantı) — reportlab + pikepdf.

PyMuPDF'in `page.insert_text / insert_textbox / insert_image / draw_line / insert_link` ve
`TextWriter.write_text` işlerinin karşılığı. Mantık:

1. Her hedef sayfa için, sayfanın GÖRÜNEN ölçüsünde (CropBox + /Rotate uygulanmış) bir reportlab
   sayfası çizilir. Çizim API'si PyMuPDF gibi ÜST-SOL başlangıçlıdır (y aşağı artar).
2. Bu çizim sayfası PDF'e form nesnesi olarak, sayfanın dönüşüm matrisiyle (döndürülmüş
   sayfalarda da doğru yere) bindirilir. Sayfanın kendi içeriği q/Q ile sarılır → önceki
   içeriğin bıraktığı grafik durumu bindirmeyi bozmaz.

Lisans: reportlab = BSD, pikepdf = MPL-2.0.
"""

from __future__ import annotations

import io
import math
import os
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Union

import pikepdf
from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas

from .pages import page_box, page_rotation

Color = Tuple[float, float, float]
Rect = Tuple[float, float, float, float]

# PyMuPDF'in yerleşik Helvetica ("helv") yerleşiminde ilk satır taban çizgisi bu oranla iner
# (ölçüm: taban çizgisi = kutu üstü + 1,075 × punto). Çıktı konumları eskisiyle aynı kalsın.
_BUILTIN_ASCENDER = 1.075
_BUILTIN_FONTS = {
    "helv": "Helvetica", "helvetica": "Helvetica",
    "hebo": "Helvetica-Bold", "heit": "Helvetica-Oblique", "hebi": "Helvetica-BoldOblique",
    "tiro": "Times-Roman", "tibo": "Times-Bold", "tiit": "Times-Italic", "tibi": "Times-BoldItalic",
    "cour": "Courier", "cobo": "Courier-Bold", "coit": "Courier-Oblique", "cobi": "Courier-BoldOblique",
}

_registered: Dict[str, str] = {}


def register_font(path: str) -> str:
    """TTF dosyasını reportlab'a kaydeder; font adını döndürür (aynı yol için tekrar kaydetmez).
    reportlab TTF'leri çıktıda KENDİLİĞİNDEN yalnız kullanılan harflerle (alt küme) gömer."""
    ap = os.path.abspath(path)
    name = _registered.get(ap)
    if name:
        return name
    name = f"nbf{len(_registered)}_{os.path.splitext(os.path.basename(ap))[0]}"
    pdfmetrics.registerFont(TTFont(name, ap))
    _registered[ap] = name
    return name


def resolve_font(font: Optional[str]) -> Tuple[str, bool]:
    """(reportlab font adı, yerleşik_mi). `font` bir TTF yolu, 'helv/tiro/cour' kısa adı ya da None."""
    if font and os.path.isfile(font):
        return register_font(font), False
    if font and font.lower() in _BUILTIN_FONTS:
        return _BUILTIN_FONTS[font.lower()], True
    if font and font in pdfmetrics.getRegisteredFontNames():
        return font, False
    return "Helvetica", True


def text_width(text: str, font: Optional[str], size: float) -> float:
    name, _ = resolve_font(font)
    return float(pdfmetrics.stringWidth(text, name, size))


def font_ascender(font: Optional[str]) -> float:
    """Yazı tipi yükselti oranı (punto başına) — ilk satır taban çizgisi hesabı için."""
    name, builtin = resolve_font(font)
    if builtin:
        return _BUILTIN_ASCENDER
    try:
        return float(pdfmetrics.getAscent(name)) / 1000.0
    except Exception:
        return 0.93


def visual_to_user_matrix(page: pikepdf.Page) -> Tuple[float, float, float, float, float, float]:
    """Çizim koordinatını (GÖRÜNEN sayfa, başlangıç sol-ALT, y yukarı) sayfanın kullanıcı
    uzayına çeviren matris (a b c d e f). Döndürme 0/90/180/270 ve CropBox ofseti dikkate alınır."""
    x0, y0, x1, y1 = page_box(page)
    w, h = x1 - x0, y1 - y0
    rot = page_rotation(page)
    if rot == 90:
        return (0.0, 1.0, -1.0, 0.0, x0 + w, y0)
    if rot == 180:
        return (-1.0, 0.0, 0.0, -1.0, x0 + w, y0 + h)
    if rot == 270:
        return (0.0, -1.0, 1.0, 0.0, x0, y0 + h)
    return (1.0, 0.0, 0.0, 1.0, x0, y0)


def visual_rect_to_user(page: pikepdf.Page, rect: Rect, visual_h: float) -> Tuple[float, float, float, float]:
    """Üst-sol başlangıçlı görünen dikdörtgeni, kullanıcı uzayında (x0,y0,x1,y1) kutuya çevirir."""
    a, b, c, d, e, f = visual_to_user_matrix(page)
    vx0, vy0, vx1, vy1 = rect
    pts = []
    for vx, vy in ((vx0, vy0), (vx1, vy0), (vx0, vy1), (vx1, vy1)):
        ox, oy = vx, visual_h - vy
        pts.append((a * ox + c * oy + e, b * ox + d * oy + f))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))


class Canvas2D:
    """reportlab canvas'ı ÜST-SOL başlangıçlı (PyMuPDF benzeri) sarmalayıcı."""

    def __init__(self, c: "rl_canvas.Canvas", width: float, height: float) -> None:
        self.c = c
        self.width = float(width)
        self.height = float(height)
        self.links: List[Tuple[Rect, str]] = []

    # ── yardımcılar ─────────────────────────────────────────────────
    def _y(self, y: float) -> float:
        return self.height - y

    def _alpha(self, alpha: float) -> None:
        a = max(0.0, min(1.0, float(alpha)))
        self.c.setFillAlpha(a)
        self.c.setStrokeAlpha(a)

    # ── metin ───────────────────────────────────────────────────────
    def text(
        self,
        x: float,
        baseline_y: float,
        text: str,
        *,
        font: Optional[str] = None,
        size: float = 11.0,
        color: Color = (0.0, 0.0, 0.0),
        alpha: float = 1.0,
        rotate: float = 0.0,
        pivot: Optional[Tuple[float, float]] = None,
        char_space: float = 0.0,
        hscale: float = 100.0,
        shear: float = 0.0,
        render_mode: int = 0,
    ) -> None:
        """Tek satır metin; (x, baseline_y) taban çizgisinin sol ucu.

        rotate: derece, SAAT YÖNÜNÜN TERSİ pozitif (PyMuPDF Matrix(rot) gibi); pivot (varsayılan
        = (x, baseline_y)) etrafında döner. shear: yatay eğim katsayısı (sahte italik için).
        """
        name, _ = resolve_font(font)
        c = self.c
        c.saveState()
        try:
            self._alpha(alpha)
            c.setFillColorRGB(*color)
            c.setStrokeColorRGB(*color)
            if rotate:
                px, py = pivot if pivot is not None else (x, baseline_y)
                c.translate(px, self._y(py))
                c.rotate(rotate)
                c.translate(-px, -self._y(py))
            if shear:
                # (x, taban çizgisi) çevresinde: x' = x + shear*(y - baseline)
                c.translate(x, self._y(baseline_y))
                c.transform(1, 0, shear, 1, 0, 0)
                c.translate(-x, -self._y(baseline_y))
            t = c.beginText()
            t.setFont(name, size)
            t.setTextOrigin(x, self._y(baseline_y))
            if char_space:
                t.setCharSpace(char_space)
            if hscale != 100.0:
                t.setHorizScale(hscale)
            if render_mode:
                t.setTextRenderMode(render_mode)
            t.textOut(text)
            c.drawText(t)
        finally:
            c.restoreState()

    def textbox_line(
        self,
        rect: Rect,
        text: str,
        *,
        font: Optional[str] = None,
        size: float = 11.0,
        color: Color = (0.0, 0.0, 0.0),
        align: str = "left",
        alpha: float = 1.0,
    ) -> float:
        """Tek satırlık metin kutusu (PyMuPDF `insert_textbox` ile aynı yerleşim): ilk satırın taban
        çizgisi = kutu üstü + yükselti × punto; yatay hiza kutu içinde. Çizilen metin genişliğini döndürür."""
        x0, y0, x1, _y1 = rect
        tw = text_width(text, font, size)
        if align == "center":
            x = x0 + (x1 - x0 - tw) / 2.0
        elif align == "right":
            x = x1 - tw
        else:
            x = x0
        baseline = y0 + font_ascender(font) * size
        self.text(x, baseline, text, font=font, size=size, color=color, alpha=alpha)
        return tw

    def wrap_lines(self, text: str, font: Optional[str], size: float, max_w: float) -> List[str]:
        """Kelime kaydırmayla satırlara böler (satır içi boşluklar tek boşluğa inmez; '\\n' korunur)."""
        lines: List[str] = []
        for para in text.split("\n"):
            words = para.split(" ")
            cur = ""
            for w in words:
                cand = w if not cur else cur + " " + w
                if text_width(cand, font, size) <= max_w or not cur:
                    cur = cand
                else:
                    lines.append(cur)
                    cur = w
            lines.append(cur)
        return lines

    # ── çizgi / dikdörtgen ──────────────────────────────────────────
    def line(
        self, x0: float, y0: float, x1: float, y1: float, *,
        color: Color = (0, 0, 0), width: float = 1.0, alpha: float = 1.0,
    ) -> None:
        c = self.c
        c.saveState()
        try:
            self._alpha(alpha)
            c.setStrokeColorRGB(*color)
            c.setLineWidth(width)
            c.line(x0, self._y(y0), x1, self._y(y1))
        finally:
            c.restoreState()

    def rect(
        self, rect: Rect, *, fill: Optional[Color] = None, stroke: Optional[Color] = None,
        width: float = 1.0, alpha: float = 1.0,
    ) -> None:
        x0, y0, x1, y1 = rect
        c = self.c
        c.saveState()
        try:
            self._alpha(alpha)
            if fill is not None:
                c.setFillColorRGB(*fill)
            if stroke is not None:
                c.setStrokeColorRGB(*stroke)
                c.setLineWidth(width)
            c.rect(x0, self._y(y1), x1 - x0, y1 - y0, stroke=1 if stroke is not None else 0,
                   fill=1 if fill is not None else 0)
        finally:
            c.restoreState()

    # ── görsel ──────────────────────────────────────────────────────
    def image(
        self, rect: Rect, source: Union[bytes, Image.Image, str], *,
        keep_proportion: bool = True, alpha: float = 1.0,
    ) -> None:
        """Görseli kutuya yerleştirir (varsayılan: oran korunur, kutuda ortalanır).
        Saydam PNG'nin alfası korunur (mask='auto')."""
        x0, y0, x1, y1 = rect
        if isinstance(source, (bytes, bytearray)):
            src: Any = io.BytesIO(bytes(source))
        else:
            src = source
        reader = ImageReader(src)
        bw, bh = float(x1 - x0), float(y1 - y0)
        dx, dy, dw, dh = x0, y0, bw, bh
        if keep_proportion:
            iw, ih = reader.getSize()
            if iw > 0 and ih > 0:
                s = min(bw / iw, bh / ih)
                dw, dh = iw * s, ih * s
                dx, dy = x0 + (bw - dw) / 2.0, y0 + (bh - dh) / 2.0
        c = self.c
        c.saveState()
        try:
            self._alpha(alpha)
            c.drawImage(reader, dx, self._y(dy + dh), width=dw, height=dh, mask="auto")
        finally:
            c.restoreState()

    # ── bağlantı ────────────────────────────────────────────────────
    def link(self, rect: Rect, uri: str) -> None:
        self.links.append((rect, uri))


def stamp_pages(
    pdf: pikepdf.Pdf,
    builders: Dict[int, Callable[[Canvas2D], None]],
) -> None:
    """`builders[sayfa_indeksi](canvas2d)` ile her hedef sayfaya çizim ekler.

    Çizim, sayfanın GÖRÜNEN ölçüsünde üst-sol başlangıçlı bir tuvaldir. Bağlantılar
    (`canvas2d.link`) sayfaya link açıklaması olarak eklenir.
    """
    if not builders:
        return
    order = sorted(builders)
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(1, 1), pageCompression=1)
    canvases: Dict[int, Canvas2D] = {}
    for idx in order:
        page = pdf.pages[idx]
        x0, y0, x1, y1 = page_box(page)
        w, h = (y1 - y0, x1 - x0) if page_rotation(page) in (90, 270) else (x1 - x0, y1 - y0)
        c.setPageSize((w, h))
        cv = Canvas2D(c, w, h)
        builders[idx](cv)
        canvases[idx] = cv
        c.showPage()
    c.save()
    ov = pikepdf.open(io.BytesIO(buf.getvalue()))
    try:
        for k, idx in enumerate(order):
            page = pdf.pages[idx]
            form = ov.pages[k].as_form_xobject()
            # BBox'ı sıfırdan başlayan görünen sayfa ölçüsüne sabitle.
            form_foreign = pdf.copy_foreign(form)
            a, b, cc, d, e, f = visual_to_user_matrix(page)
            name = page.add_resource(form_foreign, pikepdf.Name.XObject, prefix="NbOv")
            page.contents_add(pikepdf.Stream(pdf, b"q\n"), prepend=True)
            page.contents_add(pikepdf.Stream(pdf, b"\nQ\n"), prepend=False)
            cmd = f"q {a:.6f} {b:.6f} {cc:.6f} {d:.6f} {e:.6f} {f:.6f} cm {name} Do Q\n"
            page.contents_add(pikepdf.Stream(pdf, cmd.encode("ascii")), prepend=False)
            _add_links(pdf, page, canvases[idx])
    finally:
        ov.close()


def _add_links(pdf: pikepdf.Pdf, page: pikepdf.Page, cv: Canvas2D) -> None:
    if not cv.links:
        return
    annots = page.obj.get("/Annots")
    if annots is None:
        annots = pikepdf.Array()
        page.obj["/Annots"] = annots
    for rect, uri in cv.links:
        ux0, uy0, ux1, uy1 = visual_rect_to_user(page, rect, cv.height)
        annot = pdf.make_indirect(
            pikepdf.Dictionary(
                Type=pikepdf.Name.Annot,
                Subtype=pikepdf.Name.Link,
                Rect=[ux0, uy0, ux1, uy1],
                Border=[0, 0, 0],
                A=pikepdf.Dictionary(S=pikepdf.Name.URI, URI=pikepdf.String(uri)),
            )
        )
        annots.append(annot)

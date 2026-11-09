"""PDF içerik akışı yorumlayıcısı (PyMuPDF'siz): harf / çizim / görsel konumlarını çıkarır ve
istenenleri içerik akışından GERÇEKTEN siler.

Neden var: PDF Düzenle ve Gizleme araçları eskiden PyMuPDF'nin get_texttrace / get_drawings /
get_image_info / apply_redactions işlevlerine dayanıyordu. Yeni (izinli lisanslı) yığında bunların
karşılığı yok; burada pikepdf ile yazıldı.

Koordinatlar: GÖRÜNEN sayfa, üst-sol başlangıç, punto (PyMuPDF ile aynı). Döndürme ve CropBox
ofseti `base_matrix` ile hesaba katılır.

Kural: silinen harfin ilerlemesi (genişlik + Tc + Tw) TJ sayısıyla telafi edilir → kalan harfler
yerinden OYNAMAZ.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

import pikepdf
from reportlab.pdfbase import pdfmetrics

from .overlay import visual_to_user_matrix
from .pages import page_box, page_visual_size

Matrix = Tuple[float, float, float, float, float, float]
IDENT: Matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def mul(m: Matrix, n: Matrix) -> Matrix:
    """Önce m, sonra n uygulanır (PDF `cm` sırası: yeni = m × n)."""
    return (
        m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
        m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
        m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
    )


def inv(m: Matrix) -> Matrix:
    det = m[0] * m[3] - m[1] * m[2]
    if abs(det) < 1e-12:
        return IDENT
    a, b, c, d = m[3] / det, -m[1] / det, -m[2] / det, m[0] / det
    return (a, b, c, d, -(m[4] * a + m[5] * c), -(m[4] * b + m[5] * d))


def apply(m: Matrix, x: float, y: float) -> Tuple[float, float]:
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])


def base_matrix(page: pikepdf.Page) -> Matrix:
    """Kullanıcı uzayı → GÖRÜNEN sayfa (üst-sol, y aşağı)."""
    u = visual_to_user_matrix(page)  # görünen(alt-sol) → kullanıcı
    _w, h = page_visual_size(page)
    flip: Matrix = (1.0, 0.0, 0.0, -1.0, 0.0, h)  # alt-sol → üst-sol
    return mul(inv(u), flip)


# ─── yazı tipleri ─────────────────────────────────────────────────────────

def _f(o: Any, default: float = 0.0) -> float:
    try:
        return float(o)
    except Exception:
        return default


_STD_WIDTH_FONT = (
    ("courier", "Courier"), ("mono", "Courier"), ("times", "Times-Roman"), ("serif", "Times-Roman"),
)


def _std14(base: str) -> str:
    low = (base or "").lower()
    bold = "bold" in low or "black" in low
    ital = "italic" in low or "oblique" in low
    for key, name in _STD_WIDTH_FONT:
        if key in low:
            fam = name.split("-")[0]
            if fam == "Courier":
                return "Courier" + ("-BoldOblique" if bold and ital else "-Bold" if bold else "-Oblique" if ital else "")
            return "Times-" + ("BoldItalic" if bold and ital else "Bold" if bold else "Italic" if ital else "Roman")
    return "Helvetica" + ("-BoldOblique" if bold and ital else "-Bold" if bold else "-Oblique" if ital else "")


def _parse_to_unicode(data: bytes) -> Dict[int, str]:
    """ToUnicode CMap (bfchar / bfrange) → {kod: metin}."""
    out: Dict[int, str] = {}
    txt = data.decode("latin-1", "replace")

    def _u(h: str) -> str:
        try:
            return bytes.fromhex(h).decode("utf-16-be", "replace")
        except Exception:
            return ""

    for blk in re.findall(r"beginbfchar(.*?)endbfchar", txt, re.S):
        for a, b in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>", blk):
            out[int(a, 16)] = _u(b)
    for blk in re.findall(r"beginbfrange(.*?)endbfrange", txt, re.S):
        for m in re.finditer(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]*>|\[[^\]]*\])", blk):
            lo, hi, dst = int(m.group(1), 16), int(m.group(2), 16), m.group(3)
            if hi - lo > 70000:
                continue
            if dst.startswith("["):
                for i, h in enumerate(re.findall(r"<([0-9A-Fa-f]*)>", dst)):
                    out[lo + i] = _u(h)
            else:
                base = _u(dst[1:-1])
                if not base:
                    continue
                for i in range(hi - lo + 1):
                    out[lo + i] = base[:-1] + chr(ord(base[-1]) + i)
    return out


class PdfFont:
    """Bir PDF yazı tipi sözlüğünden: kod çözme, genişlik (1/1000), yükselti/alçalma, unicode."""

    def __init__(self, fd: Any) -> None:
        self.obj = fd
        self.name = str(fd.get("/BaseFont", "")).lstrip("/")
        self.subtype = str(fd.get("/Subtype", ""))
        self.composite = self.subtype == "/Type0"
        self.two_byte = False
        self.widths: Dict[int, float] = {}
        self.dw = 1000.0
        self.first = 0
        self.arr: List[float] = []
        self.missing = 0.0
        self.std: Optional[str] = None
        self.fm = 0.001
        self.ascent, self.descent = 0.8, -0.2
        self.to_uni: Dict[int, str] = {}
        self.enc_map: Dict[int, str] = {}
        self.vertical = False
        self.desc_flags = 0
        self.italic_angle = 0.0
        try:
            self._setup(fd)
        except Exception:
            pass

    def _setup(self, fd: Any) -> None:
        desc = None
        if self.composite:
            enc = fd.get("/Encoding")
            self.two_byte = True
            self.vertical = isinstance(enc, pikepdf.Name) and str(enc).endswith("-V")
            df = fd.DescendantFonts[0]
            self.name = str(df.get("/BaseFont", self.name)).lstrip("/")
            self.dw = _f(df.get("/DW"), 1000.0)
            w = df.get("/W")
            if w is not None:
                items = list(w)
                i = 0
                while i < len(items):
                    c = int(items[i])
                    nxt = items[i + 1] if i + 1 < len(items) else None
                    if isinstance(nxt, pikepdf.Array):
                        for k, ww in enumerate(nxt):
                            self.widths[c + k] = _f(ww)
                        i += 2
                    else:
                        c2 = int(nxt)
                        ww = _f(items[i + 2])
                        for k in range(c, min(c2, c + 70000) + 1):
                            self.widths[k] = ww
                        i += 3
            desc = df.get("/FontDescriptor")
        else:
            self.first = int(fd.get("/FirstChar", 0))
            wa = fd.get("/Widths")
            if wa is not None:
                self.arr = [_f(x) for x in wa]
            desc = fd.get("/FontDescriptor")
            if desc is not None:
                self.missing = _f(desc.get("/MissingWidth"), 0.0)
            if self.subtype == "/Type3":
                fm = fd.get("/FontMatrix")
                self.fm = _f(fm[0], 0.001) if fm is not None else 0.001
            if not self.arr and self.subtype != "/Type3":
                self.std = _std14(self.name)
            self._simple_encoding(fd)
        if desc is not None:
            try:
                self.desc_flags = int(desc.get("/Flags", 0))
                self.italic_angle = _f(desc.get("/ItalicAngle"))
            except Exception:
                pass
            a, d = _f(desc.get("/Ascent")), _f(desc.get("/Descent"))
            if a > 0:
                self.ascent = min(1.3, a / 1000.0)
            if d < 0:
                self.descent = max(-0.5, d / 1000.0)
        tu = fd.get("/ToUnicode")
        if tu is not None:
            self.to_uni = _parse_to_unicode(bytes(tu.read_bytes()))

    def _simple_encoding(self, fd: Any) -> None:
        enc = fd.get("/Encoding")
        base = None
        diffs = None
        if isinstance(enc, pikepdf.Name):
            base = str(enc)
        elif enc is not None:
            be = enc.get("/BaseEncoding")
            base = str(be) if be is not None else None
            diffs = enc.get("/Differences")
        codec = "cp1252"
        if base == "/MacRomanEncoding":
            codec = "mac_roman"
        elif base in (None, "/StandardEncoding"):
            codec = "cp1252"
        for c in range(32, 256):
            try:
                self.enc_map[c] = bytes([c]).decode(codec)
            except Exception:
                pass
        if diffs is not None:
            from fontTools.agl import toUnicode

            code = 0
            for it in diffs:
                if isinstance(it, pikepdf.Name):
                    try:
                        u = toUnicode(str(it)[1:])
                    except Exception:
                        u = ""
                    if u:
                        self.enc_map[code] = u
                    code += 1
                else:
                    code = int(it)

    def decode(self, s: bytes) -> List[Tuple[int, int]]:
        """[(kod, bayt_uzunluğu)]"""
        if self.composite:
            return [((s[i] << 8) | (s[i + 1] if i + 1 < len(s) else 0), 2) for i in range(0, len(s), 2)]
        return [(b, 1) for b in s]

    def width(self, code: int) -> float:
        if self.composite:
            return self.widths.get(code, self.dw)
        if self.subtype == "/Type3":
            i = code - self.first
            return self.arr[i] * self.fm * 1000.0 if 0 <= i < len(self.arr) else 0.0
        i = code - self.first
        if self.arr:
            if 0 <= i < len(self.arr):
                return self.arr[i]
            return self.missing
        ch = self.enc_map.get(code, chr(code))
        try:
            return float(pdfmetrics.stringWidth(ch, self.std or "Helvetica", 1000))
        except Exception:
            return 500.0

    def gid(self, code: int) -> Optional[int]:
        """Bileşik (CID) fontta glif no; basit fontta None (gömülü fontun cmap'inden çözülür)."""
        if not self.composite:
            return None
        try:
            m = self.obj.DescendantFonts[0].get("/CIDToGIDMap")
            if m is not None and not isinstance(m, pikepdf.Name):
                b = bytes(m.read_bytes())
                if 2 * code + 1 < len(b):
                    return (b[2 * code] << 8) | b[2 * code + 1]
                return None
        except Exception:
            return None
        return code

    def unicode(self, code: int) -> str:
        if code in self.to_uni:
            return self.to_uni[code]
        if not self.composite:
            return self.enc_map.get(code, "")
        return ""


# ─── olay kayıtları ───────────────────────────────────────────────────────

@dataclass
class Glyph:
    code: int
    ch: str
    font: PdfFont
    x0: float
    y0: float
    x1: float
    y1: float
    ox: float            # köken (taban çizgisi sol ucu), görünen koordinat
    oy: float
    size: float          # etkin dikey boyut (Tfs × ölçek), punto
    tfs: float
    th: float            # yatay ölçek (Tz/100)
    tc: float
    tw: float
    adv: float           # görünen genişlik (yatay yön), punto
    color: Tuple[float, float, float]
    mode: int            # Tr (3 = görünmez)
    slope: float = 0.0   # yazı yönü açısı (derece)
    nat: float = 0.0     # Tc/Tw HARİÇ doğal genişlik (görünen punto)
    sx: float = 1.0      # metin uzayı → görünen yatay ölçek


@dataclass
class PathRec:
    rect: Tuple[float, float, float, float]
    kinds: List[str]
    width: float
    stroke: bool
    fill: bool
    color: Optional[Tuple[float, float, float]]
    fill_color: Optional[Tuple[float, float, float]]


@dataclass
class ImageRec:
    rect: Tuple[float, float, float, float]
    xref: int
    name: str
    obj: Any = None
    ctm: Matrix = IDENT


@dataclass
class Scan:
    glyphs: List[Glyph] = field(default_factory=list)
    paths: List[PathRec] = field(default_factory=list)
    images: List[ImageRec] = field(default_factory=list)


_PAINT = {"S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n"}
_PATH_BUILD = {"m", "l", "c", "v", "y", "re", "h"}


def _rgb(vals: Sequence[float], n: int) -> Tuple[float, float, float]:
    if n == 1:
        g = vals[0]
        return (g, g, g)
    if n == 3:
        return (vals[0], vals[1], vals[2])
    if n == 4:
        c, m, y, k = vals
        return ((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k))
    return (0.0, 0.0, 0.0)


class Interp:
    """İçerik akışını yürütür. `scan` her zaman doldurulur; `del_*` geri çağırmaları True verirse
    ilgili öğe içerik akışından çıkarılır (yalnız `rewrite=True` iken)."""

    def __init__(self, pdf: pikepdf.Pdf, base: Matrix, *, rewrite: bool = False,
                 del_glyph: Optional[Callable[[Glyph], bool]] = None,
                 del_path: Optional[Callable[[PathRec], bool]] = None,
                 del_image: Optional[Callable[[ImageRec], bool]] = None) -> None:
        self.pdf = pdf
        self.base = base
        self.rewrite = rewrite
        self.del_glyph = del_glyph
        self.del_path = del_path
        self.del_image = del_image
        self.scan = Scan()
        self.changed = False
        self._fonts: Dict[Any, PdfFont] = {}
        self._seen_forms: set = set()
        self._ndel = 0
        self._nclone = 0

    def font_for(self, fobj: Any) -> PdfFont:
        key = fobj.objgen if getattr(fobj, "objgen", (0, 0)) != (0, 0) else id(fobj)
        f = self._fonts.get(key)
        if f is None:
            f = PdfFont(fobj)
            self._fonts[key] = f
        return f

    # -- sayfa --
    def run_page(self, page: pikepdf.Page) -> None:
        instrs = list(pikepdf.parse_content_stream(page))
        res = page.get("/Resources")
        if res is None:
            from .pages import _inherited
            res = _inherited(page, "/Resources")
        out = self._run(instrs, res, self.base, depth=0)
        if self.rewrite and self.changed:
            page.obj["/Contents"] = self.pdf.make_stream(pikepdf.unparse_content_stream(out))

    # -- çekirdek --
    def _run(self, instrs: List[Any], res: Any, ctm0: Matrix, depth: int) -> List[Any]:
        out: List[Any] = []
        ctm = ctm0
        stack: List[Tuple] = []
        fill: Tuple[float, float, float] = (0.0, 0.0, 0.0)
        stroke: Tuple[float, float, float] = (0.0, 0.0, 0.0)
        fill_cs_n = 1
        stroke_cs_n = 1
        lw = 1.0
        # metin durumu
        tm: Matrix = IDENT
        tlm: Matrix = IDENT
        font: Optional[PdfFont] = None
        tfs = 0.0
        tc = tw = 0.0
        th = 1.0
        tl = 0.0
        trise = 0.0
        mode = 0
        # yol durumu
        pts: List[Tuple[float, float]] = []
        kinds: List[str] = []
        path_start = -1
        cur = (0.0, 0.0)
        pending_clip = False

        def show(s: bytes, op_out: List[Any]) -> List[Any]:
            """Dizgiyi yürütür; [(parça_bayt | float_telafi)] döner (silme için)."""
            nonlocal tm
            parts: List[Any] = []
            if font is None:
                return [s]
            buf = bytearray()
            for code, ln in font.decode(s):
                w0 = font.width(code) / 1000.0
                if font.vertical:
                    w0 = 0.0
                # yazı uzayı → görünen
                trm = mul((tfs * th, 0.0, 0.0, tfs, 0.0, trise), mul(tm, ctm))
                ox, oy = apply(trm, 0.0, 0.0)
                adv_pt = w0 * tfs + tc + (tw if (ln == 1 and code == 32) else 0.0)
                # kutu: yükselti/alçalma (yazı yüksekliği) × yatay ilerleme
                xs, ys = [], []
                for (px, py) in ((0.0, font.descent), (w0, font.descent), (w0, font.ascent), (0.0, font.ascent)):
                    qx, qy = apply(trm, px, py)
                    xs.append(qx)
                    ys.append(qy)
                sz = math.hypot(trm[2], trm[3])
                xlen = math.hypot(trm[0], trm[1])
                sxs = xlen / (abs(tfs * th) or 1.0)
                tw_eff = tw if (ln == 1 and code == 32) else 0.0
                nat = w0 * xlen
                gl = Glyph(
                    code=code, ch=font.unicode(code), font=font,
                    x0=min(xs), y0=min(ys), x1=max(xs), y1=max(ys), ox=ox, oy=oy,
                    size=sz, tfs=tfs, th=th, tc=tc, tw=tw_eff,
                    adv=nat + (tc + tw_eff) * th * sxs, nat=nat, sx=sxs,
                    color=fill, mode=mode, slope=math.degrees(math.atan2(trm[1], trm[0])),
                )
                self.scan.glyphs.append(gl)
                dele = bool(self.rewrite and self.del_glyph and self.del_glyph(gl))
                if dele:
                    if buf:
                        parts.append(bytes(buf))
                        buf = bytearray()
                    # telafi: TJ sayısı = -(w0*1000 + (Tc+Tw)*1000/Tfs)
                    comp = -(w0 * 1000.0 + ((tc + (tw if (ln == 1 and code == 32) else 0.0)) * 1000.0 / tfs if tfs else 0.0))
                    if parts and isinstance(parts[-1], float):
                        parts[-1] += comp
                    else:
                        parts.append(comp)
                    self.changed = True
                    self._ndel += 1
                else:
                    buf += s_slice(s, code, ln, buf_src=None)
                # konum ilerletme
                tm = mul((1.0, 0.0, 0.0, 1.0, adv_pt * th, 0.0), tm)
            if buf:
                parts.append(bytes(buf))
            return parts

        def s_slice(s: bytes, code: int, ln: int, buf_src: Any) -> bytes:
            return bytes([code]) if ln == 1 else bytes([(code >> 8) & 255, code & 255])

        def advance_only(n_thousandths: float) -> None:
            nonlocal tm
            tm = mul((1.0, 0.0, 0.0, 1.0, -n_thousandths / 1000.0 * tfs * th, 0.0), tm)

        for ins in instrs:
            if isinstance(ins, pikepdf.ContentStreamInlineImage):
                ops_name = "BI"
                operands: List[Any] = []
            else:
                operands = list(ins.operands)
                ops_name = str(ins.operator)
            keep = True
            replacement: Optional[List[Any]] = None

            if ops_name == "q":
                stack.append((ctm, fill, stroke, fill_cs_n, stroke_cs_n, lw, tfs, font, tc, tw, th, tl, trise, mode))
            elif ops_name == "Q":
                if stack:
                    (ctm, fill, stroke, fill_cs_n, stroke_cs_n, lw, tfs, font, tc, tw, th, tl, trise, mode) = stack.pop()
            elif ops_name == "cm" and len(operands) == 6:
                ctm = mul(tuple(_f(o) for o in operands), ctm)  # type: ignore[arg-type]
            elif ops_name == "w" and operands:
                lw = _f(operands[0], 1.0)
            elif ops_name == "g":
                fill = _rgb([_f(operands[0])], 1); fill_cs_n = 1
            elif ops_name == "G":
                stroke = _rgb([_f(operands[0])], 1); stroke_cs_n = 1
            elif ops_name == "rg":
                fill = _rgb([_f(o) for o in operands], 3); fill_cs_n = 3
            elif ops_name == "RG":
                stroke = _rgb([_f(o) for o in operands], 3); stroke_cs_n = 3
            elif ops_name == "k":
                fill = _rgb([_f(o) for o in operands], 4); fill_cs_n = 4
            elif ops_name == "K":
                stroke = _rgb([_f(o) for o in operands], 4); stroke_cs_n = 4
            elif ops_name in ("cs", "CS") and operands:
                nm = str(operands[0])
                n = {"/DeviceGray": 1, "/DeviceRGB": 3, "/DeviceCMYK": 4, "/CalGray": 1, "/CalRGB": 3}.get(nm, 0)
                if n == 0 and res is not None:
                    try:
                        cso = res.ColorSpace[nm]
                        base0 = str(cso[0]) if isinstance(cso, pikepdf.Array) else str(cso)
                        n = {"/CalGray": 1, "/CalRGB": 3, "/DeviceGray": 1, "/DeviceRGB": 3, "/DeviceCMYK": 4, "/ICCBased": 0}.get(base0, 0)
                        if base0 == "/ICCBased":
                            n = int(cso[1].get("/N", 0))
                    except Exception:
                        n = 0
                if ops_name == "cs":
                    fill_cs_n = n
                    fill = (0.0, 0.0, 0.0)
                else:
                    stroke_cs_n = n
                    stroke = (0.0, 0.0, 0.0)
            elif ops_name in ("sc", "scn", "SC", "SCN"):
                nums = [_f(o) for o in operands if isinstance(o, (int, float, pikepdf.Object)) and not isinstance(o, pikepdf.Name)]
                try:
                    nums = [float(o) for o in operands if not isinstance(o, (pikepdf.Name, pikepdf.String))]
                except Exception:
                    nums = []
                if ops_name in ("sc", "scn"):
                    if fill_cs_n and len(nums) >= fill_cs_n:
                        fill = _rgb(nums[:fill_cs_n], fill_cs_n)
                else:
                    if stroke_cs_n and len(nums) >= stroke_cs_n:
                        stroke = _rgb(nums[:stroke_cs_n], stroke_cs_n)
            # ── metin ──
            elif ops_name == "BT":
                tm = tlm = IDENT
            elif ops_name == "Tc" and operands:
                tc = _f(operands[0])
            elif ops_name == "Tw" and operands:
                tw = _f(operands[0])
            elif ops_name == "Tz" and operands:
                th = _f(operands[0], 100.0) / 100.0
            elif ops_name == "TL" and operands:
                tl = _f(operands[0])
            elif ops_name == "Ts" and operands:
                trise = _f(operands[0])
            elif ops_name == "Tr" and operands:
                mode = int(_f(operands[0]))
            elif ops_name == "Tf" and len(operands) == 2:
                tfs = _f(operands[1])
                font = None
                try:
                    fo = res.Font[str(operands[0])]
                    font = self.font_for(fo)
                except Exception:
                    font = None
            elif ops_name == "Td" and len(operands) == 2:
                tlm = mul((1.0, 0.0, 0.0, 1.0, _f(operands[0]), _f(operands[1])), tlm)
                tm = tlm
            elif ops_name == "TD" and len(operands) == 2:
                tl = -_f(operands[1])
                tlm = mul((1.0, 0.0, 0.0, 1.0, _f(operands[0]), _f(operands[1])), tlm)
                tm = tlm
            elif ops_name == "Tm" and len(operands) == 6:
                tm = tlm = tuple(_f(o) for o in operands)  # type: ignore[assignment]
            elif ops_name == "T*":
                tlm = mul((1.0, 0.0, 0.0, 1.0, 0.0, -tl), tlm)
                tm = tlm
            elif ops_name in ("Tj", "'", '"', "TJ"):
                pre: List[Any] = []
                if ops_name in ("'", '"'):
                    if ops_name == '"' and len(operands) == 3:
                        tw = _f(operands[0]); tc = _f(operands[1])
                        pre = [pikepdf.ContentStreamInstruction([operands[0]], pikepdf.Operator("Tw")),
                               pikepdf.ContentStreamInstruction([operands[1]], pikepdf.Operator("Tc"))]
                    tlm = mul((1.0, 0.0, 0.0, 1.0, 0.0, -tl), tlm)
                    tm = tlm
                    pre.append(pikepdf.ContentStreamInstruction([], pikepdf.Operator("T*")))
                    strs = [bytes(operands[-1])]
                    arr_items: List[Any] = [operands[-1]]
                elif ops_name == "Tj":
                    arr_items = [operands[0]]
                else:
                    arr_items = list(operands[0])
                new_arr: List[Any] = []
                ndel0 = self._ndel
                for it in arr_items:
                    if isinstance(it, pikepdf.String):
                        for p in show(bytes(it), out):
                            new_arr.append(pikepdf.String(p) if isinstance(p, bytes) else p)
                    else:
                        v = _f(it)
                        advance_only(v)
                        new_arr.append(it)
                if self.rewrite and self._ndel != ndel0:
                    merged: List[Any] = []
                    for x in new_arr:
                        if isinstance(x, pikepdf.String):
                            merged.append(x)
                        else:
                            v = float(x)
                            if merged and isinstance(merged[-1], float):
                                merged[-1] += v
                            else:
                                merged.append(v)
                    arr = pikepdf.Array(merged)
                    replacement = pre + [pikepdf.ContentStreamInstruction([arr], pikepdf.Operator("TJ"))]
            # ── yollar ──
            elif ops_name in _PATH_BUILD:
                if path_start < 0:
                    path_start = len(out)
                    pts = []
                    kinds = []
                nums = [_f(o) for o in operands]
                if ops_name == "m" and len(nums) == 2:
                    cur = (nums[0], nums[1]); pts.append(cur)
                elif ops_name == "l" and len(nums) == 2:
                    cur = (nums[0], nums[1]); pts.append(cur); kinds.append("l")
                elif ops_name == "c" and len(nums) == 6:
                    pts += [(nums[0], nums[1]), (nums[2], nums[3]), (nums[4], nums[5])]
                    cur = (nums[4], nums[5]); kinds.append("c")
                elif ops_name in ("v", "y") and len(nums) == 4:
                    pts += [(nums[0], nums[1]), (nums[2], nums[3])]
                    cur = (nums[2], nums[3]); kinds.append("c")
                elif ops_name == "re" and len(nums) == 4:
                    x, y, w, h = nums
                    pts += [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
                    kinds.append("re")
            elif ops_name in ("W", "W*"):
                pending_clip = True
            elif ops_name in _PAINT:
                if path_start >= 0:
                    dpts = [apply(ctm, x, y) for (x, y) in pts] or [(0.0, 0.0)]
                    xs = [p[0] for p in dpts]
                    ys = [p[1] for p in dpts]
                    st = ops_name in ("S", "s", "B", "B*", "b", "b*")
                    fl = ops_name in ("f", "F", "f*", "B", "B*", "b", "b*")
                    lw_dev = lw * math.sqrt(abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]))
                    rec = PathRec((min(xs), min(ys), max(xs), max(ys)), list(kinds), lw_dev, st, fl,
                                  stroke if st else None, fill if fl else None)
                    if ops_name != "n":
                        self.scan.paths.append(rec)
                    if (self.rewrite and self.del_path and ops_name != "n" and not pending_clip
                            and self.del_path(rec)):
                        del out[path_start:]
                        keep = False
                        self.changed = True
                path_start = -1
                pts = []
                kinds = []
                pending_clip = False
            # ── görsel / form ──
            elif ops_name == "Do" and operands and res is not None:
                try:
                    xo = res.XObject[str(operands[0])]
                except Exception:
                    xo = None
                if xo is not None:
                    st_ = str(xo.get("/Subtype", ""))
                    if st_ == "/Image":
                        dp = [apply(ctm, 0, 0), apply(ctm, 1, 0), apply(ctm, 1, 1), apply(ctm, 0, 1)]
                        rec = ImageRec((min(p[0] for p in dp), min(p[1] for p in dp), max(p[0] for p in dp), max(p[1] for p in dp)),
                                       xo.objgen[0], str(operands[0]), xo, ctm)
                        self.scan.images.append(rec)
                        if self.rewrite and self.del_image and self.del_image(rec):
                            keep = False
                            self.changed = True
                    elif st_ == "/Form" and depth < 12 and xo.objgen not in self._seen_forms:
                        self._seen_forms.add(xo.objgen)
                        try:
                            fm = xo.get("/Matrix")
                            fmat = tuple(_f(v) for v in fm) if fm is not None else IDENT
                            sub = list(pikepdf.parse_content_stream(xo))
                            fres = xo.get("/Resources", res)
                            before = self.changed
                            self.changed = False
                            new_sub = self._run(sub, fres, mul(fmat, ctm), depth + 1)  # type: ignore[arg-type]
                            if self.rewrite and self.changed:
                                # Ortak (birden çok kez çizilen) form başka yerlerde de değişmesin diye
                                # düzenlenen kopya YENİ bir form olarak eklenir; bu çağrı ona yönlendirilir.
                                clone = self.pdf.make_stream(pikepdf.unparse_content_stream(new_sub))
                                for k in list(xo.keys()):
                                    if k not in ("/Length", "/Filter", "/DecodeParms"):
                                        clone[k] = xo[k]
                                self._nclone += 1
                                nm = pikepdf.Name(f"/NbF{self._nclone}")
                                res.XObject[nm] = clone
                                replacement = [pikepdf.ContentStreamInstruction([nm], pikepdf.Operator("Do"))]
                            self.changed = before or self.changed
                        finally:
                            self._seen_forms.discard(xo.objgen)
            elif ops_name == "BI":
                dp = [apply(ctm, 0, 0), apply(ctm, 1, 0), apply(ctm, 1, 1), apply(ctm, 0, 1)]
                rec = ImageRec((min(p[0] for p in dp), min(p[1] for p in dp), max(p[0] for p in dp), max(p[1] for p in dp)),
                               0, "", None, ctm)
                self.scan.images.append(rec)

            if keep:
                if replacement is not None:
                    out.extend(replacement)
                else:
                    out.append(ins)
        return out


def scan_page(pdf: pikepdf.Pdf, page: pikepdf.Page) -> Scan:
    it = Interp(pdf, base_matrix(page))
    it.run_page(page)
    return it.scan


def remove_in_rects(
    pdf: pikepdf.Pdf,
    page: pikepdf.Page,
    rects: Sequence[Tuple[float, float, float, float]],
    *,
    text: bool = True,
    paths: bool = False,
    paths_covered_only: bool = True,
    images: bool = False,
    glyph_filter: Optional[Callable[[Glyph], bool]] = None,
) -> bool:
    """`rects` (görünen koordinat) ile kesişen harfleri (text), tamamen örtülen çizimleri (paths)
    ve tamamen örtülen görselleri (images) içerik akışından kaldırır. Değişti mi → bool."""

    def _hit(r: Tuple[float, float, float, float], a: Tuple[float, float, float, float]) -> bool:
        return a[0] < r[2] and a[2] > r[0] and a[1] < r[3] and a[3] > r[1]

    def _covered(r: Tuple[float, float, float, float], a: Tuple[float, float, float, float], tol: float = 0.5) -> bool:
        return a[0] >= r[0] - tol and a[1] >= r[1] - tol and a[2] <= r[2] + tol and a[3] <= r[3] + tol

    def dg(g: Glyph) -> bool:
        if not text:
            return False
        box = (g.x0, g.y0, g.x1, g.y1)
        if not any(_hit(r, box) for r in rects):
            return False
        return glyph_filter(g) if glyph_filter else True

    def dp(p: PathRec) -> bool:
        if not paths:
            return False
        a = p.rect
        return any(_covered(r, a, 0.5 + (p.width if p.stroke else 0.0)) if paths_covered_only else _hit(r, a) for r in rects)

    def di(im: ImageRec) -> bool:
        if not images:
            return False
        return any(_covered(r, im.rect, 1.0) for r in rects)

    it = Interp(pdf, base_matrix(page), rewrite=True, del_glyph=dg, del_path=dp, del_image=di)
    it.run_page(page)
    return it.changed

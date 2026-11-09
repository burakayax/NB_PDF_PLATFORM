"""PDF Düzenle — zengin metin (HTML alt kümesi) kutusu çizimi.

Eskiden PyMuPDF `insert_htmlbox` kullanılıyordu; yerine burada küçük bir yerleşim motoru var:
kelime kaydırma, kalın/italik/renk/font-family (span), <br>, hizalama (sol/orta/sağ/iki yana),
satır aralığı ve «kutuya sığmıyorsa yazıyı küçült» (scale_low=0 davranışı).

Desteklenen etiketler: div/p/span/b/strong/i/em/u/br. Desteklenen stiller: color, font-family,
font-size (px = punto), font-weight, font-style, text-align, line-height, text-decoration.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any, Callable

from app.core import edit_fonts as _ef


@dataclass
class _Style:
    color: tuple[float, float, float] = (0.0, 0.0, 0.0)
    family: str = ""
    size: float = 11.0
    bold: bool = False
    italic: bool = False
    underline: bool = False
    align: str = "left"
    line_height: float = 1.2  # çarpan

    def copy(self) -> "_Style":
        return _Style(self.color, self.family, self.size, self.bold, self.italic, self.underline, self.align, self.line_height)


@dataclass
class _Word:
    text: str
    style: _Style
    brk: bool = False  # bu kelimeden ÖNCE zorunlu satır kırma


def _parse_color(v: str) -> tuple[float, float, float] | None:
    v = v.strip().lower()
    m = re.fullmatch(r"#([0-9a-f]{6})", v)
    if m:
        h = m.group(1)
        return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)
    m = re.fullmatch(r"#([0-9a-f]{3})", v)
    if m:
        h = m.group(1)
        return (int(h[0] * 2, 16) / 255, int(h[1] * 2, 16) / 255, int(h[2] * 2, 16) / 255)
    m = re.fullmatch(r"rgba?\(([^)]*)\)", v)
    if m:
        parts = [p.strip() for p in m.group(1).split(",")]
        try:
            return tuple(min(1.0, max(0.0, float(p) / 255)) for p in parts[:3])  # type: ignore[return-value]
        except Exception:
            return None
    return None


def _apply_css(st: _Style, css: str) -> None:
    for decl in css.split(";"):
        if ":" not in decl:
            continue
        k, v = decl.split(":", 1)
        k, v = k.strip().lower(), v.strip()
        if k == "color":
            c = _parse_color(v)
            if c:
                st.color = c
        elif k == "font-family":
            fam = v.split(",")[0].strip().strip("'\"")
            if fam:
                st.family = fam
        elif k == "font-size":
            m = re.match(r"([0-9.]+)\s*(px|pt)?", v)
            if m:
                st.size = float(m.group(1))
        elif k == "font-weight":
            st.bold = v in ("bold", "bolder") or (v.isdigit() and int(v) >= 600)
        elif k == "font-style":
            st.italic = v in ("italic", "oblique")
        elif k == "text-align":
            st.align = v
        elif k == "line-height":
            m = re.match(r"([0-9.]+)\s*(px|pt)?$", v)
            if m:
                lh = float(m.group(1))
                st.line_height = lh / st.size if m.group(2) else lh
        elif k == "text-decoration":
            st.underline = "underline" in v


class _Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[_Style] = [_Style()]
        self.words: list[_Word] = []
        self._pending_break = False
        self._root_align = "left"
        self._block_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        st = self.stack[-1].copy()
        a = dict(attrs)
        if tag in ("b", "strong"):
            st.bold = True
        elif tag in ("i", "em"):
            st.italic = True
        elif tag == "u":
            st.underline = True
        elif tag == "br":
            self._pending_break = True
            return
        elif tag in ("div", "p"):
            if self.words:
                self._pending_break = True
        if a.get("style"):
            _apply_css(st, a["style"] or "")
        self.stack.append(st)

    def handle_endtag(self, tag: str) -> None:
        if tag == "br":
            return
        if len(self.stack) > 1:
            self.stack.pop()
        if tag in ("div", "p") and self.words:
            self._pending_break = True

    def handle_data(self, data: str) -> None:
        st = self.stack[-1]
        # Kelimelere böl; baştaki/sondaki boşluk kelime ayırıcıdır.
        parts = re.split(r"(\s+)", data.replace("\xa0", " "))
        for p in parts:
            if not p:
                continue
            if p.isspace():
                self.words.append(_Word(" ", st))
                continue
            self.words.append(_Word(p, st, brk=self._pending_break))
            self._pending_break = False


# ─── yazı tipi çözümleme ──────────────────────────────────────────────────

def _resolve_font(family: str, bold: bool, italic: bool, name_to_key: dict[str, str],
                  edit_fonts: dict[str, str]) -> tuple[str, str, bool, bool]:
    """(yol, yedek_yol, sahte_kalın, sahte_italik). Ölçü-uyumlu ailede gerçek kesit; diğerlerinde
    yalnız Regular dosya var → kalın/italik sahte uygulanır."""
    css_to_metric = {v[0]: k for k, v in _ef.METRIC_FAMILIES.items()}
    mk = css_to_metric.get(family)
    if mk:
        return (_ef.family_path(mk, bold, italic), _ef.FALLBACK_BY_CLASS[_ef.family_class(mk)], False, False)
    key = name_to_key.get(family) or "serif"
    path = edit_fonts.get(key) or edit_fonts.get("serif") or next(iter(edit_fonts.values()))
    return (path, path, bold, italic)


@dataclass
class _Run:
    text: str
    st: _Style
    path: str
    fb: str
    fbold: bool
    fital: bool
    width: float = 0.0


def draw_html_box(
    cv: Any,
    rect: tuple[float, float, float, float],
    html: str,
    *,
    name_to_key: dict[str, str],
    edit_fonts: dict[str, str],
) -> None:
    """`html` içeriğini `rect` (görünen koordinat, üst-sol) kutusuna çizer; sığmıyorsa küçültür."""
    x0, y0, x1, y1 = rect
    box_w, box_h = max(1.0, x1 - x0), max(1.0, y1 - y0)
    ps = _Parser()
    ps.feed(html)
    words = ps.words
    if not any(w.text.strip() for w in words):
        return

    def build(scale: float) -> tuple[list[list[tuple[_Run, float]]], list[float], list[bool], float]:
        """Satırlar: [(run, x)], satır yükseklikleri, satır-sonu(zorunlu) bayrakları, toplam yükseklik."""
        lines: list[list[_Run]] = [[]]
        widths: list[float] = [0.0]
        forced: list[bool] = [False]
        for w in words:
            st = w.style
            size = st.size * scale
            path, fb, fbold, fital = _resolve_font(st.family, st.bold, st.italic, name_to_key, edit_fonts)
            if w.brk and lines[-1]:
                forced[-1] = True
                lines.append([])
                widths.append(0.0)
                forced.append(False)
            if w.text == " ":
                if not lines[-1]:
                    continue
                wd = _ef.text_width(" ", path, fb, size)
                lines[-1].append(_Run(" ", st, path, fb, fbold, fital, wd))
                widths[-1] += wd
                continue
            wd = _ef.text_width(w.text, path, fb, size)
            if lines[-1] and widths[-1] + wd > box_w + 0.01 and widths[-1] > 0:
                # satır sonundaki boşluğu at
                while lines[-1] and lines[-1][-1].text == " ":
                    widths[-1] -= lines[-1][-1].width
                    lines[-1].pop()
                lines.append([])
                widths.append(0.0)
                forced.append(False)
            lines[-1].append(_Run(w.text, st, path, fb, fbold, fital, wd))
            widths[-1] += wd
        # yerleşim
        out_lines: list[list[tuple[_Run, float]]] = []
        heights: list[float] = []
        for li, ln in enumerate(lines):
            while ln and ln[-1].text == " ":
                widths[li] -= ln[-1].width
                ln.pop()
            mx = max((r.st.size * scale for r in ln), default=words[0].style.size * scale)
            lh = max((r.st.size * scale * r.st.line_height for r in ln), default=mx * 1.2)
            heights.append(lh)
            out_lines.append([(r, 0.0) for r in ln])
        return out_lines, heights, forced, sum(heights)

    scale = 1.0
    lines, heights, forced, total = build(scale)
    guard = 0
    while total > box_h + 0.5 and scale > 0.25 and guard < 80:
        scale -= 0.02 if scale > 0.6 else 0.01
        lines, heights, forced, total = build(scale)
        guard += 1

    y = y0
    for li, ln in enumerate(lines):
        lh = heights[li]
        if not ln:
            y += lh
            continue
        sizes = [r.st.size * scale for r, _ in ln]
        mx = max(sizes)
        # CSS yarım-aralık: taban çizgisi = üst + (lh - (A+D)·mx)/2 + A·mx
        asc = max(_ef.ascent_ratio(r.path) for r, _ in ln)
        desc = max(_ef.descent_ratio(r.path) for r, _ in ln)
        baseline = y + (lh - (asc + desc) * mx) / 2 + asc * mx
        total_w = sum(_ef.text_width(r.text, r.path, r.fb, r.st.size * scale) for r, _ in ln)
        align = ln[0][0].st.align
        is_last = li == len(lines) - 1 or forced[li]
        x = x0
        gap_extra = 0.0
        if align == "center":
            x = x0 + (box_w - total_w) / 2
        elif align == "right":
            x = x1 - total_w
        elif align == "justify" and not is_last:
            n_sp = sum(1 for r, _ in ln if r.text == " ")
            if n_sp:
                gap_extra = (box_w - total_w) / n_sp
        for r, _ in ln:
            size = r.st.size * scale
            w = _ef.text_width(r.text, r.path, r.fb, size)
            if r.text != " ":
                _ef.draw_runs(cv, x, baseline, r.text, size, r.st.color, r.path, r.fb) if not r.fital else _draw_italic(cv, x, baseline, r, size)
                if r.fbold:
                    _ef.draw_runs(cv, x + max(0.25, size * 0.03), baseline, r.text, size, r.st.color, r.path, r.fb)
                if r.st.underline:
                    cv.line(x, baseline + size * 0.12, x + w, baseline + size * 0.12, color=r.st.color, width=max(0.5, size * 0.05))
            x += w + (gap_extra if r.text == " " else 0.0)
        y += lh


def _draw_italic(cv: Any, x: float, baseline: float, r: _Run, size: float) -> None:
    cx = x
    for t, p in _ef.split_runs(r.text, r.path, r.fb):
        cv.text(cx, baseline, t, font=p, size=size, color=r.st.color, shear=0.2)
        cx += _ef.font_obj(p).text_length(t, fontsize=size)

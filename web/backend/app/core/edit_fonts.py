"""PDF Düzenle — ölçüsü BİREBİR uyumlu (metric-compatible) font aileleri.

Düzenlenen metin, orijinal fontun harf genişlikleriyle AYNI genişlikte fontla yazılır →
satır uzunluğu, hizalama ve komşu metinlerle mesafe orijinaldeki gibi kalır.

Eşleşmeler Windows'taki gerçek Microsoft fontlarıyla harf harf ölçülerek doğrulandı
(ASCII + Türkçe + tipografik işaretler, 122 harf; en büyük genişlik farkı):
  Calibri          → Carlito          0.00/1000 em (4 kesit)
  Cambria          → Caladea (2013)   ≤0.50/1000 em (kalın-italikte yalnız "$" ve "`" farklı)
  Arial/Helvetica  → Liberation Sans  0.00/1000 em (PDF standart Helvetica ile ≤0.17)
  Times New Roman  → Liberation Serif 0.00/1000 em
  Courier New      → Liberation Mono  0.00/1000 em
  Georgia          → Gelasio          0.00 (italikte yalnız "Ö"/"Î" ≤13.7/1000 em)
NOT: Google Fonts'taki güncel Caladea Cambria ile UYUMLU DEĞİL (73 harf farklı) — bu yüzden
Chromium'un crosextrafonts-20130214 arşivindeki orijinal sürüm kullanılır.

Lisanslar: Carlito/Gelasio SIL OFL 1.1, Liberation SIL OFL 1.1, Caladea Apache 2.0
(dosyalar `assets/editfonts/` içinde).

Hiçbir fontta olmayan harfler (ör. "₺") aynı sınıftaki yedek fonttan (Roboto / Noto Serif /
Roboto Mono) harf bazında tamamlanır.
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_DIR = Path(__file__).resolve().parent.parent / "assets" / "editfonts"
_ASSETS = Path(__file__).resolve().parent.parent / "assets"

# anahtar → (CSS/tarayıcı aile adı, dosya kökü, sınıf)
METRIC_FAMILIES: dict[str, tuple[str, str, str]] = {
    "carlito": ("Carlito", "Carlito", "sans"),
    "caladea": ("Caladea", "Caladea", "serif"),
    "lsans": ("Liberation Sans", "LiberationSans", "sans"),
    "lserif": ("Liberation Serif", "LiberationSerif", "serif"),
    "lmono": ("Liberation Mono", "LiberationMono", "mono"),
    "gelasio": ("Gelasio", "Gelasio", "serif"),
}

# Sınıf → eksik harf yedeği (mevcut gömülü fontlar; Türkçe + ₺ içerir).
FALLBACK_BY_CLASS = {
    "sans": str(_ASSETS / "Roboto-Regular.ttf"),
    "serif": str(_ASSETS / "NotoSerif-Regular.ttf"),
    "mono": str(_ASSETS / "RobotoMono-Regular.ttf"),
}

_STYLE_SUFFIX = {(False, False): "Regular", (True, False): "Bold", (False, True): "Italic", (True, True): "BoldItalic"}


def metric_family_for(font_name: str | None) -> str | None:
    """PDF'teki font adından (alt küme öneki dahil olabilir) ölçü-uyumlu aile anahtarı."""
    f = re.sub(r"^[A-Z]{6}\+", "", font_name or "")
    n = re.sub(r"[\s_\-,]", "", f).lower()
    if not n:
        return None
    # Aynı adı taşıyan ama ölçüsü FARKLI kesitler (dar/siyah/Neue) eşleşmesin.
    if "calibri" in n and "light" not in n:
        return "carlito"
    if "cambria" in n and "math" not in n:
        return "caladea"
    if "georgia" in n or "gelasio" in n:
        return "gelasio"
    if any(k in n for k in ("couriernew", "courier", "liberationmono", "cousine", "nimbusmono")):
        return "lmono"
    if any(k in n for k in ("timesnewroman", "times", "liberationserif", "tinos", "nimbusrom")):
        return "lserif"
    if any(k in n for k in ("narrow", "black", "neue", "condensed", "rounded")):
        return None
    if n.startswith("arial") or "arialmt" in n or n.startswith("helvetica") or any(
        k in n for k in ("liberationsans", "arimo", "nimbussans")
    ):
        return "lsans"
    return None


def family_path(key: str, bold: bool = False, italic: bool = False) -> str:
    _css, stem, _cls = METRIC_FAMILIES[key]
    return str(_DIR / f"{stem}-{_STYLE_SUFFIX[(bool(bold), bool(italic))]}.ttf")


def family_class(key: str) -> str:
    return METRIC_FAMILIES[key][2]


def pdf_fontname(path: str) -> str:
    """insert_text için sayfa içinde benzersiz, geçerli PDF font kaynak adı."""
    return "EF" + re.sub(r"[^A-Za-z0-9]", "", Path(path).stem)[:24]


@lru_cache(maxsize=64)
def font_obj(path: str) -> Any:
    import fitz

    return fitz.Font(fontfile=path)


def split_runs(text: str, primary: str, fallback: str) -> list[tuple[str, str]]:
    """Metni, birincil fontta glifi OLAN/OLMAYAN harflere göre ardışık parçalara böler."""
    pf = font_obj(primary)
    runs: list[tuple[str, str]] = []
    for ch in text:
        path = primary if (ch.isspace() or pf.has_glyph(ord(ch))) else fallback
        if runs and runs[-1][1] == path:
            runs[-1] = (runs[-1][0] + ch, path)
        else:
            runs.append((ch, path))
    return runs


def text_width(text: str, primary: str, fallback: str, size: float) -> float:
    return sum(font_obj(p).text_length(t, fontsize=size) for t, p in split_runs(text, primary, fallback))


def insert_runs(page: Any, x: float, baseline: float, text: str, size: float, color: Any,
                primary: str, fallback: str, morph: Any = None) -> float:
    """Metni harf-bazlı yedekle yazar (birincil fontta olmayan harf yedekten). Genişliği döner."""
    import fitz

    cx = x
    for t, p in split_runs(text, primary, fallback):
        kw: dict[str, Any] = dict(fontsize=size, color=color, fontname=pdf_fontname(p), fontfile=p)
        if morph is not None:
            kw["morph"] = morph
        page.insert_text(fitz.Point(cx, baseline), t, **kw)
        cx += font_obj(p).text_length(t, fontsize=size)
    return cx - x


def span_spacing(raw_span: dict, span: dict, trace_size: float | None) -> dict:
    """Orijinal span'in yatay ölçeği (hs, Tz), harf aralığı (cs, Tc) ve kelime aralığı (ws, Tw)
    — yeni yazı bunlarla çizilir → aralıklı başlık / sıkıştırılmış yazı görünümünü korur.

    hs: MuPDF span boyutu √(Tfs²·Th), texttrace boyutu ise yatay boyut (Tfs·Th) → Th =
        (trace/span)². Gerçek içerik akışlarındaki Tz/Tm ile doğrulandı (BM Şartı Tz 82 → 0.82,
        makale Tm 1.02 → 1.02, reportlab Tz 70 → 0.70). Yalnız ≥%5 sapma dikkate alınır
        (daha küçüğü görünmez; eşleştirme gürültüsünü de eler).
    cs/ws: rawdict'te ardışık harflerin adımı − glif genişliği = Tc·Th (boşlukta + Tw·Th).
        Kerning gürültüsü yanlış alarm vermesin diye ölçümlerin ≥%60'ı medyana ±0.05 pt
        yakın olmalı. Yalnız yatay (dönmemiş) satırlar."""
    out: dict = {}
    chars = raw_span.get("chars") or []
    size = float(span.get("size") or 0)
    if len(chars) < 3 or size <= 0:
        return out
    if trace_size and trace_size > 0:
        th = (float(trace_size) / size) ** 2
        if 0.3 < th < 3 and abs(th - 1) >= 0.05:
            out["hs"] = round(th, 3)
            out["size"] = round(size / th ** 0.5, 2)

    def _consistent(vals: list[float]) -> float | None:
        # ≥4 harf çifti: kısa kelimede kerning çiftleri (ör. "over") harf aralığı sanılmasın.
        if len(vals) < 4:
            return None
        m = sorted(vals)[len(vals) // 2]
        if sum(1 for v in vals if abs(v - m) <= 0.05) / len(vals) < 0.6:
            return None
        return m

    cs_l, ws_l = [], []
    for a, b in zip(chars, chars[1:], strict=False):
        extra = (b["origin"][0] - a["origin"][0]) - (a["bbox"][2] - a["bbox"][0])
        if a["c"] == " ":
            ws_l.append(extra)
        elif not b["c"].isspace():
            cs_l.append(extra)
    cs = _consistent(cs_l) or 0.0
    if abs(cs) > 0.05:
        out["cs"] = round(cs, 2)
    if len(ws_l) >= 2:
        m = sorted(ws_l)[len(ws_l) // 2]
        if sum(1 for v in ws_l if abs(v - m) <= 0.05) / len(ws_l) >= 0.6:
            ws = m - cs
            if abs(ws) > 0.1:
                out["ws"] = round(ws, 2)
    return out


def spaced_width(text: str, primary: str, fallback: str, size: float, hs: float = 1.0, cs: float = 0.0, ws: float = 0.0) -> float:
    w = 0.0
    for t, p in split_runs(text, primary, fallback):
        w += font_obj(p).text_length(t, fontsize=size) * hs
        w += cs * len(t) + ws * t.count(" ")
    return w


def insert_spaced(page: Any, x: float, baseline: float, text: str, size: float, color: Any,
                  primary: str, fallback: str, hs: float = 1.0, cs: float = 0.0, ws: float = 0.0) -> float:
    """Harf harf yazar: yatay ölçek (hs) + harf aralığı (cs) + kelime aralığı (ws) — orijinal
    Tc/Tw/Tz davranışı. Genişliği döner."""
    import fitz

    cx = x
    for t, p in split_runs(text, primary, fallback):
        f = font_obj(p)
        for ch in t:
            if not ch.isspace():
                kw: dict[str, Any] = dict(fontsize=size, color=color, fontname=pdf_fontname(p), fontfile=p)
                if abs(hs - 1) > 1e-3:
                    kw["morph"] = (fitz.Point(cx, baseline), fitz.Matrix(hs, 0, 0, 1, 0, 0))
                page.insert_text(fitz.Point(cx, baseline), ch, **kw)
            cx += f.text_length(ch, fontsize=size) * hs + cs + (ws if ch == " " else 0.0)
    return cx - x


_FALLBACK_CSS = {"sans": "Roboto", "serif": "Noto Serif", "mono": "Roboto Mono"}


def wrap_missing_glyphs(html: str) -> str:
    """insert_htmlbox, font-family listesindeki yedeği KULLANMAZ; eksik harfi (ör. ₺) kendi
    seçtiği fonta (ölçüldü: Noto Serif) düşürür → tarayıcı önizlemesiyle (Roboto) farklı çıkar.
    Ölçü-uyumlu aile içindeki eksik harfleri açıkça sınıfın yedek ailesine sarar."""
    m = re.search(r"font-family:\s*'([^']+)'", html)
    if not m:
        return html
    key = next((k for k, v in METRIC_FAMILIES.items() if v[0] == m.group(1)), None)
    if not key:
        return html
    pf = font_obj(family_path(key))
    fb = _FALLBACK_CSS[family_class(key)]

    def _fix(text: str) -> str:
        return "".join(
            ch if (ch.isspace() or pf.has_glyph(ord(ch))) else f"<span style=\"font-family:'{fb}'\">{ch}</span>"
            for ch in text
        )

    # Yalnız etiket DIŞINDAKİ metin; HTML varlıkları (&amp; …) bütün kalır.
    parts = re.split(r"(<[^>]+>|&[#\w]+;)", html)
    return "".join(p if (p.startswith("<") or (p.startswith("&") and p.endswith(";"))) else _fix(p) for p in parts)


def html_css() -> str:
    """insert_htmlbox için @font-face'ler: her ailenin 4 kesiti (gerçek kalın/italik)."""
    out = []
    for key, (css, _stem, _cls) in METRIC_FAMILIES.items():
        for (b, i), _suf in _STYLE_SUFFIX.items():
            out.append(
                f'@font-face {{font-family: "{css}"; src: url({Path(family_path(key, b, i)).name});'
                f' font-weight: {"bold" if b else "normal"}; font-style: {"italic" if i else "normal"};}}'
            )
    return "".join(out)


def add_to_archive(ar: Any) -> None:
    for key in METRIC_FAMILIES:
        for (b, i) in _STYLE_SUFFIX:
            p = family_path(key, b, i)
            ar.add(p, Path(p).name)

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
    if ("calibri" in n and "light" not in n) or "carlito" in n:
        return "carlito"
    if ("cambria" in n and "math" not in n) or "caladea" in n:
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


_MONO_HINTS = ("mono", "courier", "consol", "menlo", "typewriter", "cmtt", "sftt", "lucidaconsole", "inconsolata", "sourcecodepro", "firacode")
_SERIF_HINTS = ("serif", "times", "georgia", "garamond", "minion", "cambria", "palatino", "baskerville", "caslon",
                "bodoni", "didot", "century", "bookman", "bookantiqua", "constantia", "charter", "cmr", "cmbx", "cmti",
                "nimbusrom", "merriweather", "playfair", "sabon", "utopia", "plantin", "perpetua", "rockwell")
_SANS_HINTS = ("sans", "helvetica", "arial", "verdana", "tahoma", "segoe", "calibri", "roboto", "opensans", "lato",
               "inter", "univers", "frutiger", "myriad", "futura", "avenir", "franklin", "gothic", "grotesk", "trebuchet",
               "gill", "optima", "montserrat", "oswald", "ubuntu", "noto", "source", "din", "gotham", "proxima")


def class_family(font_name: str | None, flags: int = 0) -> str:
    """Ölçü-uyumlu karşılığı OLMAYAN font için sınıfa göre aile (gerçek kalın/italik kesitli).

    Önce AD (MuPDF'in serif bayrağı güvenilmez: HelveticaNeue'yi serif işaretliyor — ölçüldü),
    sonra eşit-genişlik bayrağı (8). "Roman" ağırlık adıdır ("HelveticaNeue-Roman" = normal),
    serif ipucu DEĞİL — eskiden bu yüzden Helvetica Neue tırnaklı fonta dönüşüyordu."""
    n = re.sub(r"[\s_\-,]", "", _base_name(font_name or "")).lower()
    if any(k in n for k in _MONO_HINTS):
        return "lmono"
    if any(k in n for k in _SANS_HINTS):
        return "lsans"
    if any(k in n for k in _SERIF_HINTS):
        return "lserif"
    if flags & 8:
        return "lmono"
    if flags & 4:
        return "lserif"
    return "lsans"


def fit_scale(text: str, key: str, bold: bool, italic: bool, size: float, natural_width: float) -> float | None:
    """Yedek aile, orijinal fonttan dar/geniş olabilir → orijinal metnin GERÇEK genişliğine yatay
    ölçekle uydur (profesyonel editörlerin yaklaşımı). Satır uzunluğu korunur; ±%3 içindeyse ölçek yok."""
    t = text.strip()
    if len(t) < 3 or natural_width <= 1 or size <= 0:
        return None
    p = family_path(key, bold, italic)
    w = text_width(t, p, FALLBACK_BY_CLASS[family_class(key)], size)
    if w <= 1:
        return None
    r = natural_width / w
    if abs(r - 1) < 0.03 or not (0.55 <= r <= 1.6):
        return None
    return round(r, 3)


def family_path(key: str, bold: bool = False, italic: bool = False) -> str:
    _css, stem, _cls = METRIC_FAMILIES[key]
    return str(_DIR / f"{stem}-{_STYLE_SUFFIX[(bool(bold), bool(italic))]}.ttf")


def family_class(key: str) -> str:
    return METRIC_FAMILIES[key][2]


def pdf_fontname(path: str) -> str:
    """insert_text için sayfa içinde benzersiz, geçerli PDF font kaynak adı."""
    return "EF" + re.sub(r"[^A-Za-z0-9]", "", Path(path).stem)[:24]


class MetricFont:
    """TTF harf ölçüleri (fontTools): glif var mı + metin genişliği. PyMuPDF `Font` karşılığı."""

    def __init__(self, path: str) -> None:
        from fontTools.ttLib import TTFont

        tt = TTFont(path, lazy=True)
        self._cmap = tt.getBestCmap() or {}
        self._hmtx = tt["hmtx"].metrics
        self._upm = float(tt["head"].unitsPerEm)
        self._notdef = self._hmtx.get(".notdef", (self._upm * 0.5, 0))[0]
        hh = tt["hhea"]
        self.ascent = float(hh.ascent) / self._upm
        self.descent = abs(float(hh.descent)) / self._upm
        tt.close()

    def has_glyph(self, cp: int) -> bool:
        return cp in self._cmap

    def _adv(self, cp: int) -> float:
        g = self._cmap.get(cp)
        if g is None:
            return self._notdef
        return self._hmtx.get(g, (self._notdef, 0))[0]

    def text_length(self, text: str, fontsize: float = 11.0) -> float:
        return sum(self._adv(ord(ch)) for ch in text) * fontsize / self._upm


@lru_cache(maxsize=64)
def font_obj(path: str) -> MetricFont:
    return MetricFont(path)


def ascent_ratio(path: str) -> float:
    return font_obj(path).ascent


def descent_ratio(path: str) -> float:
    return font_obj(path).descent


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


def draw_runs(cv: Any, x: float, baseline: float, text: str, size: float, color: Any,
              primary: str, fallback: str) -> float:
    """Metni harf-bazlı yedekle çizer (birincil fontta olmayan harf yedekten). `cv`: overlay.Canvas2D.
    Genişliği döner."""
    cx = x
    for t, p in split_runs(text, primary, fallback):
        cv.text(cx, baseline, t, font=p, size=size, color=color)
        cx += font_obj(p).text_length(t, fontsize=size)
    return cx - x


def span_spacing(glyphs: list[Any]) -> dict:
    """Orijinal span'in yatay ölçeği (hs, Tz), harf aralığı (cs, Tc) ve kelime aralığı (ws, Tw)
    — yeni yazı bunlarla çizilir → aralıklı başlık / sıkıştırılmış yazı görünümünü korur.

    `glyphs`: span'i oluşturan `pdfcore.content.Glyph` listesi (içerik akışından, okuma sırasıyla).
    hs: içerik akışındaki Tz (yalnız ≥%5 sapma dikkate alınır). size: gerçek dikey boyut.
    cs/ws: ardışık harflerin köken adımı − doğal glif genişliği (Tc ve TJ düzeltmelerini birlikte
        yakalar). Kerning gürültüsü yanlış alarm vermesin diye ölçümlerin ≥%60'ı medyana ±0.05 pt
        yakın olmalı. Yalnız yatay (dönmemiş) satırlar."""
    out: dict = {}
    if len(glyphs) < 3:
        return out
    size = float(glyphs[0].size)
    if size <= 0:
        return out
    ths = sorted(g.th for g in glyphs)
    th = ths[len(ths) // 2]
    if 0.3 < th < 3 and abs(th - 1) >= 0.05:
        out["hs"] = round(th, 3)
        out["size"] = round(size, 2)

    def _consistent(vals: list[float]) -> float | None:
        # ≥4 harf çifti: kısa kelimede kerning çiftleri (ör. "over") harf aralığı sanılmasın.
        if len(vals) < 4:
            return None
        m = sorted(vals)[len(vals) // 2]
        if sum(1 for v in vals if abs(v - m) <= 0.05) / len(vals) < 0.6:
            return None
        return m

    cs_l, ws_l = [], []
    for a, b in zip(glyphs, glyphs[1:], strict=False):
        extra = (b.ox - a.ox) - a.nat
        if a.ch == " ":
            ws_l.append(extra)
        elif not b.ch.isspace():
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


def draw_spaced(cv: Any, x: float, baseline: float, text: str, size: float, color: Any,
                primary: str, fallback: str, hs: float = 1.0, cs: float = 0.0, ws: float = 0.0) -> float:
    """Harf harf çizer: yatay ölçek (hs) + harf aralığı (cs) + kelime aralığı (ws) — orijinal
    Tc/Tw/Tz davranışı. Genişliği döner."""
    cx = x
    for t, p in split_runs(text, primary, fallback):
        f = font_obj(p)
        for ch in t:
            if not ch.isspace():
                cv.text(cx, baseline, ch, font=p, size=size, color=color, hscale=hs * 100.0)
            cx += f.text_length(ch, fontsize=size) * hs + cs + (ws if ch == " " else 0.0)
    return cx - x


# ─── Orijinal (PDF'e gömülü) fontun yeniden kullanımı ────────────────────────────────────
# Alt küme (subset) fontlarda belgede KULLANILMAYAN harfler BOŞ gliftir (ölçüldü: Calibri alt
# kümesinde "ş/ğ/Z" boş) ve Word bazen harf tablosunu (cmap) boş/bozuk bırakır → font körü
# körüne kullanılamaz. Güvenli yol: belgede o fontla GERÇEKTEN çizilmiş harflerin (texttrace:
# unicode → glif no) doğrulanmış eşlemesinden cmap'i YENİDEN kur; yalnız bu harflerden oluşan
# yeni metin orijinal fontla yazılır (glif şekli birebir), diğerleri ölçü-uyumlu aileye düşer.
# Yalnız TrueType (glyf) fontlar: tarayıcı önizlemesi de aynı dosyayı yükleyebilsin diye.
_ORIG_MAX_BYTES = 400_000
_ORIG_MAX_PAGES = 60


def _base_name(name: str) -> str:
    return re.sub(r"^[A-Z]{6}\+", "", name or "")


def _embedded_ttf(font: Any) -> bytes | None:
    """PDF yazı tipi sözlüğündeki gömülü TrueType (FontFile2) baytları; yoksa None."""
    try:
        fd = font.obj
        if font.composite:
            fd = fd.DescendantFonts[0]
        ff = fd.FontDescriptor.get("/FontFile2")
        return bytes(ff.read_bytes()) if ff is not None else None
    except Exception:
        return None


def original_fonts(pdf: Any) -> dict[str, dict]:
    """Belgedeki yeniden kullanılabilir gömülü TrueType fontlar.

    Dönüş: {font_adı (alt küme öneki yok): {"key": nesne no, "buf": onarılmış TTF, "chars": str}}.
    Aynı adı taşıyan birden çok gömülü font varsa (hangi span'in hangisini kullandığı
    bilinemez) o ad ATLANIR — yanlış glif riski alınmaz."""
    import io

    from fontTools.ttLib import TTFont, newTable
    from fontTools.ttLib.tables._c_m_a_p import cmap_format_4

    from src.pdfcore import content as _ct

    fonts_by_name: dict[str, dict[Any, Any]] = {}
    use: dict[str, dict[int, set[int]]] = {}
    ttcache: dict[Any, Any] = {}
    for pi in range(min(len(pdf.pages), _ORIG_MAX_PAGES)):
        try:
            sc = _ct.scan_page(pdf, pdf.pages[pi])
        except Exception:
            continue
        for g in sc.glyphs:
            if g.mode == 3:  # görünmez katman: şekil doğrulanamaz
                continue
            nm = _base_name(g.font.name)
            key = g.font.obj.objgen if g.font.obj.objgen != (0, 0) else id(g.font.obj)
            fonts_by_name.setdefault(nm, {})[key] = g.font
            gid = g.font.gid(g.code)
            if gid is None:  # basit font: gömülü fontun kendi cmap'inden çöz
                if key not in ttcache:
                    raw = _embedded_ttf(g.font)
                    try:
                        ttcache[key] = TTFont(io.BytesIO(raw)) if raw else None
                    except Exception:
                        ttcache[key] = None
                tt0 = ttcache[key]
                if tt0 is None:
                    continue
                gid = _simple_gid(tt0, g.font, g.code)
                if gid is None:
                    continue
            if not g.ch:
                continue
            use.setdefault(nm, {}).setdefault(ord(g.ch[0]), set()).add(int(gid))
    out: dict[str, dict] = {}
    for name, fs_ in fonts_by_name.items():
        if len(fs_) != 1 or name not in use:
            continue
        pf = next(iter(fs_.values()))
        try:
            buf = _embedded_ttf(pf)
            if not buf or len(buf) > _ORIG_MAX_BYTES:
                continue
            tt = TTFont(io.BytesIO(buf))
            if "glyf" not in tt:
                continue
            if "post" not in tt:  # PDF'e gömülü alt kümelerde 'post' tablosu olmayabilir
                _post = newTable("post")
                _post.formatType = 3.0
                _post.italicAngle = 0
                _post.underlinePosition = -100
                _post.underlineThickness = 50
                _post.isFixedPitch = 0
                _post.minMemType42 = _post.maxMemType42 = _post.minMemType1 = _post.maxMemType1 = 0
                _post.glyphOrder = None
                tt["post"] = _post
                tt.setGlyphOrder([".notdef"] + [f"glyph{i:05d}" for i in range(1, tt["maxp"].numGlyphs)])
            order = tt.getGlyphOrder()
            glyf = tt["glyf"]
            verified: dict[int, str] = {}
            for u, gids in use[name].items():
                if len(gids) != 1:
                    continue
                g = next(iter(gids))
                if g >= len(order):
                    continue
                gn = order[g]
                if u == 32 or glyf[gn].numberOfContours != 0:
                    verified[u] = gn
            if 32 not in verified and "space" in order:
                verified[32] = "space"
            if len(verified) < 2:
                continue
            tabs = []
            for pid, eid in ((0, 3), (3, 1)):
                st = cmap_format_4(4)
                st.platformID, st.platEncID, st.language = pid, eid, 0
                st.cmap = dict(verified)
                tabs.append(st)
            tt["cmap"] = newTable("cmap")
            tt["cmap"].tableVersion = 0
            tt["cmap"].tables = tabs
            # reportlab yazı tipi yüzlerini AD'a göre kaydeder; farklı belgelerin aynı adlı alt kümeleri
            # çakışıp harfleri bozmasın diye (sunucu süreci uzun yaşar) içeriğe özgü benzersiz ad ver.
            import hashlib

            _h = hashlib.sha1(buf).digest()
            tag = "".join(chr(65 + b % 26) for b in _h[:6])  # PDF alt küme etiketi (ABCDEF+Ad)
            uniq = f"{tag}+{name}"
            if "name" in tt:
                for rec in tt["name"].names:
                    if rec.nameID in (1, 3, 4, 6, 16):
                        try:
                            rec.string = uniq
                        except Exception:
                            pass
            bio = io.BytesIO()
            tt.save(bio)
            xr = pf.obj.objgen[0] if pf.obj.objgen != (0, 0) else abs(hash(name)) % 10**8
            out[name] = {"key": str(xr), "buf": bio.getvalue(),
                         "chars": "".join(sorted(chr(u) for u in verified))}
        except Exception:
            continue
    return out


def _simple_gid(tt: Any, font: Any, code: int) -> int | None:
    """Basit (tek baytlı) TrueType fontta kod → glif no (cmap (3,1) → (3,0) 0xF000+kod/kod → (1,0))."""
    order = tt.getGlyphOrder()
    cm = tt["cmap"]
    cands: list[tuple[Any, int]] = []
    u = font.enc_map.get(code, "")
    if u:
        cands.append(((3, 1), ord(u[0])))
    cands += [((3, 0), 0xF000 + code), ((3, 0), code), ((1, 0), code)]
    for (pid, eid), c in cands:
        t = cm.getcmap(pid, eid)
        if t is not None and c in t.cmap:
            gn = t.cmap[c]
            if gn in order:
                return order.index(gn)
    return None


def original_font_covers(info: dict, text: str) -> bool:
    return bool(text) and all(ch in info["chars"] for ch in text)


def remove_image_placement(pdf: Any, page: Any, rect: Any) -> str | None:
    """Silinen görseli (logo/amblem) BOYAMADAN kaldırır: altındaki zemin (degrade, fotoğraf, yazı)
    olduğu gibi kalır. Eski yöntem görselin kutusunu örneklenen renkle boyuyordu → düz olmayan
    zeminde kare kutu kalıyordu (ölçüldü).

    Sayfanın içerik akışında bu görselin TEK çizim komutu ("/Ad Do") varsa yalnız o kaldırılır
    (başka sayfalardaki aynı logo etkilenmez). Kutuya başka görsel değmiyorsa yalnız görsel
    kaldırılır (yazı/çizgiye dokunulmaz). Başarılıysa "content", değilse None (çağıran eski dolgu
    yöntemine düşer)."""
    from src.pdfcore import content as _ct

    r = tuple(float(v) for v in rect)
    sc = _ct.scan_page(pdf, page)
    infos = sc.images

    def _iou(a: Any, b: Any) -> float:
        iw = min(a[2], b[2]) - max(a[0], b[0])
        ih = min(a[3], b[3]) - max(a[1], b[1])
        inter = max(0.0, iw) * max(0.0, ih)
        u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
        return inter / u if u > 0 else 0.0

    matches = [i for i in infos if _iou(i.rect, r) > 0.85]
    if len(matches) != 1:
        return None
    m = matches[0]
    others = [
        i for i in infos if i is not m
        and max(0.0, min(i.rect[2], r[2]) - max(i.rect[0], r[0])) * max(0.0, min(i.rect[3], r[3]) - max(i.rect[1], r[1])) > 1
    ]
    if m.xref > 0 and sum(1 for i in infos if i.xref == m.xref) > 1 and others:
        return None
    if others and sum(1 for i in infos if i.xref == m.xref and m.xref > 0) != 1:
        return None
    target = (m.xref, tuple(round(v, 2) for v in m.rect))

    def _dimg(im: Any) -> bool:
        return (im.xref, tuple(round(v, 2) for v in im.rect)) == target

    it = _ct.Interp(pdf, _ct.base_matrix(page), rewrite=True, del_image=_dimg)
    it.run_page(page)
    return "content" if it.changed else None


def vector_emblems(pdf: Any, page: Any, image_rects: list[Any], max_clusters: int = 40) -> list[tuple[float, float, float, float]]:
    """Çizim komutlarından (eğri/çokgen) oluşan amblem/logo kümelerini bulur.

    Piksel görsel bilgisi yalnız resimleri verir; vektör çizilmiş amblemler seçilemiyordu.
    Yalnız ŞEKİL benzeri çizimler (eğri ya da kapalı çokgen) aday olur — tablo çizgisi, düz
    dikdörtgen dolgu ve tek çizgiler değil. Aday kutular birbirine yakınsa tek amblemde birleşir.
    Sayfayı kaplayan, çok küçük ya da bir görselle neredeyse aynı yerde olan kümeler atılır;
    çok sayıda küme (harita/grafik) çıkarsa hiçbiri döndürülmez (arayüz kalabalıklaşmasın)."""
    from src.pdfcore import content as _ct
    from src.pdfcore.pages import page_visual_size

    try:
        sc = _ct.scan_page(pdf, page)
    except Exception:
        return []
    pw, ph = page_visual_size(page)
    boxes: list[list[float]] = []
    for d in sc.paths:
        kinds = d.kinds
        has_curve = "c" in kinds
        poly = kinds.count("l") >= 3
        if not (has_curve or poly):
            continue
        if d.fill_color is None and d.color is None:
            continue
        x0, y0, x1, y1 = d.rect
        w, h = x1 - x0, y1 - y0
        if w <= 0 or h <= 0 or w > pw * 0.7 or h > ph * 0.7:
            continue
        boxes.append([x0, y0, x1, y1])
    if not boxes or len(boxes) > 4000:
        return []
    # Yakın/üst üste kutuları birleştir (3 pt tolerans).
    gap = 3.0

    def _inter(a: list[float], b: list[float]) -> bool:
        return a[0] - gap < b[2] and a[2] + gap > b[0] and a[1] - gap < b[3] and a[3] + gap > b[1]

    changed = True
    while changed and len(boxes) > 1:
        changed = False
        out: list[list[float]] = []
        for b in boxes:
            for i, o in enumerate(out):
                if _inter(b, o):
                    out[i] = [min(o[0], b[0]), min(o[1], b[1]), max(o[2], b[2]), max(o[3], b[3])]
                    changed = True
                    break
            else:
                out.append(list(b))
        boxes = out
    res: list[tuple[float, float, float, float]] = []
    for b in boxes:
        bw, bh = b[2] - b[0], b[3] - b[1]
        if bw < 8 or bh < 8 or bw * bh > pw * ph * 0.25:
            continue
        area = bw * bh
        covered = False
        for ir in image_rects:
            iw = min(b[2], ir[2]) - max(b[0], ir[0])
            ih = min(b[3], ir[3]) - max(b[1], ir[1])
            if area > 0 and max(0.0, iw) * max(0.0, ih) / area > 0.8:
                covered = True
                break
        if covered:
            continue
        res.append((b[0], b[1], b[2], b[3]))
    return res if len(res) <= max_clusters else []


def vector_lines(pdf: Any, page: Any, taken_rects: list[Any], max_items: int = 60) -> list[tuple[float, float, float, float]]:
    """Tek başına duran ÇİZGİ ve DİKDÖRTGENLERİ (tablo/ayraç çizgisi, kutu, dolgu şeridi) bulur.

    `vector_emblems` bunları bilerek atlar (sayfa kalabalıklaşmasın). Burada her biri AYRI bir
    öğe olur; kullanıcı seçip silebilir. Atlananlar: bir görsel/amblemin içinde kalanlar (onlar
    zaten o öğeyle silinir), sayfanın çoğunu kaplayan zemin dolguları, çok kısa kırıntılar,
    eğri/çokgen şekiller (amblem işi). Çok sayıda çizgi çıkarsa (ızgara/grafik) hiçbiri
    döndürülmez — arayüz boğulmasın."""
    from src.pdfcore import content as _ct
    from src.pdfcore.pages import page_visual_size

    try:
        sc = _ct.scan_page(pdf, page)
    except Exception:
        return []
    pw, ph = page_visual_size(page)

    def _area(r: Any) -> float:
        return max(0.0, r[2] - r[0]) * max(0.0, r[3] - r[1])

    def _inter(a: Any, b: Any) -> float:
        return max(0.0, min(a[2], b[2]) - max(a[0], b[0])) * max(0.0, min(a[3], b[3]) - max(a[1], b[1]))

    uniq: list[tuple[float, float, float, float]] = []
    for d in sc.paths:
        kinds = d.kinds
        if not kinds or any(k not in ("l", "re") for k in kinds) or kinds.count("l") >= 3:
            continue  # eğri/çokgen = amblem/şekil (vector_emblems işi)
        if d.fill_color is None and d.color is None:
            continue
        r = tuple(float(v) for v in d.rect)
        if max(r[2] - r[0], r[3] - r[1]) < 8:
            continue
        if _area(r) > pw * ph * 0.6:
            continue  # sayfa zemini
        if any(t[0] <= r[0] and t[1] <= r[1] and t[2] >= r[2] and t[3] >= r[3] for t in taken_rects):
            continue
        if any(_area(r) > 0 and _inter(r, t) >= 0.8 * _area(r) for t in taken_rects):
            continue
        if any(abs(r[0] - u[0]) < 0.5 and abs(r[1] - u[1]) < 0.5 and abs(r[2] - u[2]) < 0.5 and abs(r[3] - u[3]) < 0.5 for u in uniq):
            continue  # aynı yere çizilmiş yinelenen
        uniq.append(r)  # type: ignore[arg-type]
    return uniq if len(uniq) <= max_items else []


_FALLBACK_CSS ={"sans": "Roboto", "serif": "Noto Serif", "mono": "Roboto Mono"}


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

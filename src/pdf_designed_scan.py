"""
Tasarımlı taranmış sayfa (özgeçmiş, broşür, renkli yan panelli belge) → Word.

Neden ayrı bir yol: düz "tüm sayfayı OCR'la" yaklaşımı bu belgelerde çöküyor:
  * Koyu yan paneldeki açık renkli yazı hiç okunmuyor (iletişim, eğitim bilgisi kayboluyor).
  * Fotoğraf atılıyor, renkler/başlık şeridi gidiyor.
  * Sol ve sağ sütun satır satır birbirine karışıyor (okuma sırası bozuluyor).

Bu modül sayfayı ÖNCE bölgelere ayırır (yan panel / ana sütun), her bölgeyi kendi
zemin rengine göre ayrı OCR'lar (koyu zemin ters çevrilir), fotoğrafları kırpıp
yerine koyar ve Word'de panel renkli iki hücreli bir tablo olarak kurar.
Tasarım tespit edilmezse False döner; çağıran eski düz OCR yoluna düşer.
"""
from __future__ import annotations

import io
import statistics
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageOps

_LINE_FACTOR = 1.17      # Word'de tek satır yüksekliği ≈ 1.17 × punto
_GLYPH_TO_PT = 1.0 / 0.92  # OCR kelime kutusu yüksekliği ≈ 0.8 × punto
_MAX_PAGES = 6


# ───────────────────────── renk yardımcıları ─────────────────────────

def _keys(a: np.ndarray) -> np.ndarray:
    q = (a >> 4).astype(np.int32)
    return (q[..., 0] << 8) | (q[..., 1] << 4) | q[..., 2]


def _dominant(pixels: np.ndarray) -> Tuple[Tuple[int, int, int], float]:
    """(N,3) piksel kümesinin baskın rengi ve payı."""
    if pixels.size == 0:
        return (255, 255, 255), 0.0
    k = _keys(pixels.reshape(-1, 3))
    cnt = np.bincount(k, minlength=4096)
    top = int(cnt.argmax())
    sel = pixels.reshape(-1, 3)[k == top]
    col = tuple(int(v) for v in sel.mean(axis=0))
    return col, float(cnt[top]) / float(len(k))  # type: ignore[return-value]


def _dist(a, b) -> float:
    return float(sum((int(x) - int(y)) ** 2 for x, y in zip(a, b)) ** 0.5)


def _luma(c) -> float:
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def _hex(c) -> str:
    return "%02X%02X%02X" % tuple(max(0, min(255, int(v))) for v in c)


def _snap_text_color(c) -> Tuple[int, int, int]:
    if all(v < 120 for v in c):
        return (0, 0, 0)
    if all(v > 170 for v in c):
        return (255, 255, 255)
    return (int(c[0]), int(c[1]), int(c[2]))


# ───────────────────────── sayfa çözümleme ─────────────────────────

def _small(img: Image.Image, width: int = 400) -> Tuple[np.ndarray, float]:
    f = img.width / float(width)
    h = max(1, int(round(img.height / f)))
    return np.asarray(img.convert("RGB").resize((width, h), Image.NEAREST)), f


def _find_sidebar(small: np.ndarray) -> Optional[Dict[str, Any]]:
    """Sayfanın sol/sağ kenarına yaslı, zemin renginden belirgin farklı dikey şerit."""
    H, W, _ = small.shape
    keys = _keys(small)
    doms: List[Tuple[int, int, int]] = []
    fracs: List[float] = []
    for x in range(W):
        col, fr = _dominant(small[:, x, :])
        doms.append(col)
        fracs.append(fr)

    segs: List[Tuple[int, int, Tuple[int, int, int]]] = []
    x = 0
    while x < W:
        if fracs[x] < 0.5:
            x += 1
            continue
        x0, ref = x, doms[x]
        while x + 1 < W and fracs[x + 1] >= 0.5 and _dist(doms[x + 1], ref) < 40:
            x += 1
        segs.append((x0, x, ref))
        x += 1

    best = None
    for x0, x1, col in segs:
        w = x1 - x0 + 1
        if not (0.12 * W <= w <= 0.55 * W):
            continue
        left = x0 <= 0.04 * W
        right = x1 >= 0.96 * W - 1
        if not (left or right):
            continue
        rest = np.concatenate([small[:, :x0, :], small[:, x1 + 1:, :]], axis=1)
        if rest.size == 0:
            continue
        paper, _ = _dominant(rest)
        if _dist(col, paper) < 70:
            continue
        if best is None or w > best["w"]:
            best = {"x0": x0, "x1": x1, "w": w, "color": col, "paper": paper,
                    "side": "left" if left else "right"}
    return best


def _find_bands(small: np.ndarray, x0: int, x1: int, paper) -> List[Dict[str, Any]]:
    """Ana sütundaki renkli yatay şeritler (ad/başlık şeridi). Gri şeritler sayılmaz."""
    H = small.shape[0]
    zone = small[:, x0:x1, :]
    rows: List[Optional[Tuple[int, int, int]]] = []
    for y in range(H):
        col, fr = _dominant(zone[y])
        sat = max(col) - min(col)
        if fr >= 0.35 and _dist(col, paper) > 40 and sat > 40:
            rows.append(col)
        else:
            rows.append(None)

    bands = []
    y = 0
    while y < H:
        if rows[y] is None:
            y += 1
            continue
        y0, ref = y, rows[y]
        last = y
        while y + 1 < H and (rows[y + 1] is not None and _dist(rows[y + 1], ref) < 40 or
                             (y + 2 < H and rows[y + 2] is not None and _dist(rows[y + 2], ref) < 40)):
            y += 1
            if rows[y] is not None:
                last = y
        if last - y0 + 1 >= max(4, int(0.025 * H)):
            bands.append({"y0": y0, "y1": last + 1, "color": ref})
        y += 1
    return bands


def analyze_page(img: Image.Image) -> Optional[Dict[str, Any]]:
    """Tasarımlı sayfa ise bölge bilgisi (px, tam çözünürlük), değilse None."""
    small, f = _small(img)
    side = _find_sidebar(small)
    W = small.shape[1]
    if side:
        if side["side"] == "left":
            m0, m1 = side["x1"] + 1, W
        else:
            m0, m1 = 0, side["x0"]
        paper = side["paper"]
    else:
        m0, m1 = 0, W
        paper, _ = _dominant(small.reshape(-1, 3))
    bands = _find_bands(small, m0, m1, paper)
    if not side and not bands:
        return None

    page_w, page_h = img.width, img.height
    zones: List[Dict[str, Any]] = []
    sb = None
    if side:
        if side["side"] == "left":
            sb = {"x0": 0, "x1": int(round((side["x1"] + 1) * f)), "bg": side["color"], "role": "side"}
            zones.append(sb)
            zones.append({"x0": sb["x1"], "x1": page_w, "bg": paper, "role": "main"})
        else:
            cut = int(round(side["x0"] * f))
            zones.append({"x0": 0, "x1": cut, "bg": paper, "role": "main"})
            sb = {"x0": cut, "x1": page_w, "bg": side["color"], "role": "side"}
            zones.append(sb)
    else:
        zones.append({"x0": 0, "x1": page_w, "bg": paper, "role": "main"})

    for z in zones:
        if z["role"] == "main":
            z["bands"] = [{"y0": int(b["y0"] * f), "y1": int(b["y1"] * f), "color": b["color"]} for b in bands]
        else:
            z["bands"] = []
    return {"zones": zones, "paper": paper, "w": page_w, "h": page_h}


# ───────────────────────── fotoğraf tespiti ─────────────────────────

def _find_photos(arr: np.ndarray, bg, x0: int, x1: int) -> List[Tuple[int, int, int, int]]:
    """Bölgedeki büyük, dolgun, kareye yakın görsel bloklar (fotoğraf/logo)."""
    try:
        import cv2
    except Exception:
        return []
    zone = arr[:, x0:x1, :].astype(np.int32)
    d = np.sqrt(((zone - np.array(bg, dtype=np.int32)) ** 2).sum(axis=2))
    mask = (d > 60).astype(np.uint8)
    k = max(3, int(arr.shape[1] * 0.008))
    merged = cv2.dilate(mask, np.ones((k, k), np.uint8))
    n, _lab, stats, _c = cv2.connectedComponentsWithStats(merged, connectivity=8)
    zw = x1 - x0
    out = []
    for i in range(1, n):
        x, y, w, h, _a = stats[i]
        if min(w, h) < 0.12 * zw or max(w, h) > 0.98 * arr.shape[0]:
            continue
        if not (0.4 <= w / float(h) <= 2.5):
            continue
        fill = float(mask[y:y + h, x:x + w].sum()) / float(w * h)
        if fill < 0.4:
            continue
        out.append((x0 + int(x), int(y), int(w), int(h)))
    return out


# ───────────────────────── OCR ─────────────────────────

def _ocr_zone(img: Image.Image, arr: np.ndarray, zone: Dict[str, Any],
              photos: List[Tuple[int, int, int, int]]) -> List[Dict[str, Any]]:
    import pytesseract
    from pytesseract import Output

    x0, x1 = zone["x0"], zone["x1"]
    work = arr[:, x0:x1, :].copy()
    for (px, py, pw, ph) in photos:
        work[max(0, py - 2):py + ph + 2, max(0, px - x0 - 2):px - x0 + pw + 2, :] = np.array(zone["bg"], dtype=np.uint8)
    crop = Image.fromarray(work).convert("L")
    dark = _luma(zone["bg"]) < 110
    if dark:
        crop = ImageOps.invert(crop)
    up = 2.0 if crop.width < 1100 else (1.5 if crop.width < 1600 else 1.0)
    if up != 1.0:
        crop = crop.resize((int(crop.width * up), int(crop.height * up)), Image.LANCZOS)
    crop = ImageOps.autocontrast(crop, cutoff=1)

    data = None
    for lang in ("tur+eng", "eng"):
        try:
            data = pytesseract.image_to_data(crop, lang=lang, config="--oem 3 --psm 4",
                                             output_type=Output.DICT)
            break
        except Exception:
            data = None
    if not data:
        return []

    groups: Dict[Tuple[int, int, int], List[Dict[str, Any]]] = {}
    for i, t in enumerate(data["text"]):
        t = (t or "").strip()
        try:
            conf = float(data["conf"][i])
        except Exception:
            conf = -1.0
        if not t or conf < 25:
            continue
        w = {
            "text": t, "conf": conf,
            "left": x0 + int(data["left"][i] / up), "top": int(data["top"][i] / up),
            "width": int(data["width"][i] / up), "height": int(data["height"][i] / up),
        }
        groups.setdefault((data["block_num"][i], data["par_num"][i], data["line_num"][i]), []).append(w)

    lines: List[Dict[str, Any]] = []
    for ws in groups.values():
        ws.sort(key=lambda w: w["left"])
        # satır başındaki simge artıkları (e-posta/telefon ikonu → "©", "ois")
        while len(ws) > 1 and (not any(c.isalnum() for c in ws[0]["text"]) or
                               (ws[0]["conf"] < 55 and len(ws[0]["text"]) <= 3)):
            ws.pop(0)
        for w in ws:
            if "©" in w["text"] and "." in w["text"]:
                w["text"] = w["text"].replace("©", "@")
        if len(ws) >= 2 and len(ws[0]["text"]) == 1 and ws[0]["text"] in "OoeEcCQ0" and                 ws[1]["left"] - (ws[0]["left"] + ws[0]["width"]) > 0.8 * ws[0]["height"]:
            ws.pop(0)
        text = " ".join(w["text"] for w in ws)
        if sum(c.isalnum() for c in text) < 2:
            continue
        if statistics.mean(w["conf"] for w in ws) < 40:
            continue
        hs = sorted(w["height"] for w in ws)
        h = hs[len(hs) // 2]
        lines.append({
            "words": ws, "text": text,
            "left": min(w["left"] for w in ws),
            "right": max(w["left"] + w["width"] for w in ws),
            "top": min(w["top"] for w in ws),
            "bottom": max(w["top"] + w["height"] for w in ws),
            "h": h,
        })
    lines.sort(key=lambda l: (l["top"], l["left"]))
    return lines


def _style_line(arr: np.ndarray, zone: Dict[str, Any], line: Dict[str, Any]) -> None:
    """Satırın metin rengini ve kelime bazlı kalınlığını ölç."""
    y0, y1 = max(0, line["top"]), min(arr.shape[0], line["bottom"])
    x0, x1 = max(0, line["left"]), min(arr.shape[1], line["right"])
    if y1 <= y0 or x1 <= x0:
        line["color"], line["bold_flags"] = (0, 0, 0), [False] * len(line["words"])
        return
    reg = arr[y0:y1, x0:x1, :]
    bg, _ = _dominant(reg)
    line["local_bg"] = bg
    dd = np.sqrt(((reg.astype(np.int32) - np.array(bg, dtype=np.int32)) ** 2).sum(axis=2))
    ink = reg[dd > 120]
    col = tuple(int(v) for v in np.median(ink[np.argsort(-dd[dd > 120])[: max(5, len(ink) // 3)]], axis=0)) if len(ink) > 4 else ((255, 255, 255) if _luma(bg) < 110 else (0, 0, 0))
    line["color"] = _snap_text_color(col)

    dens = []
    for w in line["words"]:
        wy0, wy1 = max(0, w["top"]), min(arr.shape[0], w["top"] + w["height"])
        wx0, wx1 = max(0, w["left"]), min(arr.shape[1], w["left"] + w["width"])
        if wy1 <= wy0 or wx1 <= wx0:
            dens.append(None)
            continue
        r = arr[wy0:wy1, wx0:wx1, :].astype(np.int32)
        d = np.sqrt(((r - np.array(bg, dtype=np.int32)) ** 2).sum(axis=2))
        dens.append(float((d > 100).sum()) / float(d.size) if len(w["text"]) >= 4 else None)
    line["dens"] = dens


def _mark_bold(lines: List[Dict[str, Any]]) -> None:
    """Aynı boy sınıfındaki kelimelerin mürekkep yoğunluğunu karşılaştırıp kalın olanları işaretle."""
    buckets: Dict[int, List[float]] = {}
    for l in lines:
        b = int(round(l["h"] / 3.0))
        for d in l.get("dens", []):
            if d is not None:
                buckets.setdefault(b, []).append(d)
    for l in lines:
        b = int(round(l["h"] / 3.0))
        vals = buckets.get(b, [])
        flags: List[bool] = []
        if len(vals) >= 8:
            med = statistics.median(vals)
            prev = False
            for d in l.get("dens", []):
                if d is None:
                    flags.append(prev)
                else:
                    prev = d > med * 1.45
                    flags.append(prev)
        else:
            flags = [False] * len(l["words"])
        l["bold_flags"] = flags


def _find_rules(arr: np.ndarray, zone: Dict[str, Any], lines: List[Dict[str, Any]]) -> List[Tuple[int, int]]:
    """Metin satırlarının dışında kalan ince, uzun yatay çizgiler → [(y, kalınlık_px)]."""
    if not lines:
        return []
    x0 = min(l["left"] for l in lines)
    x1 = max(l["right"] for l in lines)
    if x1 - x0 < 40:
        return []
    reg = arr[:, x0:x1, :].astype(np.int32)
    d = np.sqrt(((reg - np.array(zone["bg"], dtype=np.int32)) ** 2).sum(axis=2))
    frac = (d > 100).mean(axis=1)
    rows = np.where(frac > 0.55)[0]
    out: List[Tuple[int, int]] = []
    for y in rows:
        if any(l["top"] - 2 <= y <= l["bottom"] + 2 for l in lines):
            continue
        if out and y - out[-1][0] <= 2:
            continue
        out.append((int(y), 1))
    return out


def _build_items(arr: np.ndarray, zone: Dict[str, Any], photos) -> List[Dict[str, Any]]:
    lines = _ocr_zone(Image.fromarray(arr), arr, zone, photos)
    for l in lines:
        _style_line(arr, zone, l)
    _mark_bold(lines)
    rules = _find_rules(arr, zone, lines) if _luma(zone["bg"]) >= 110 else []

    # çizgi hangi satırın altında
    for l in lines:
        l["rule_below"] = None
        for (ry, _t) in rules:
            if 0 <= ry - l["bottom"] <= max(6, 1.3 * l["h"]):
                l["rule_below"] = ry

    # satırları paragraflara birleştir (aynı boy, aynı sol hiza, sağ kenara kadar dolu satır)
    right_ref = 0
    if lines:
        rs = sorted(l["right"] for l in lines)
        right_ref = rs[int(len(rs) * 0.9)]
    zw = zone["x1"] - zone["x0"]
    paras: List[Dict[str, Any]] = []
    for l in lines:
        prev = paras[-1] if paras else None
        in_band = any(b["y0"] - 4 <= (l["top"] + l["bottom"]) / 2 <= b["y1"] + 4 for b in zone["bands"])
        l["band"] = next((b for b in zone["bands"] if b["y0"] - 4 <= (l["top"] + l["bottom"]) / 2 <= b["y1"] + 4), None)
        if (prev and not in_band and prev["kind"] == "text" and not prev["band"]
                and prev["rule_below"] is None
                and abs(prev["h"] - l["h"]) <= 0.18 * l["h"]
                and abs(prev["left"] - l["left"]) <= 0.03 * zw
                and prev["last_right"] >= right_ref - 0.05 * zw
                and 0 < l["top"] - prev["last_bottom"] <= 0.9 * l["h"]):
            prev["lines"].append(l)
            prev["last_right"], prev["last_bottom"] = l["right"], l["bottom"]
            prev["rule_below"] = l["rule_below"]
            continue
        paras.append({"kind": "text", "lines": [l], "h": l["h"], "left": l["left"], "top": l["top"],
                      "last_right": l["right"], "last_bottom": l["bottom"],
                      "rule_below": l["rule_below"], "band": l["band"]})

    items: List[Dict[str, Any]] = list(paras)
    for (px, py, pw, ph) in photos:
        items.append({"kind": "pic", "box": (px, py, pw, ph), "top": py, "left": px})
    items.sort(key=lambda it: it["top"])
    return items


# ───────────────────────── Word üretimi ─────────────────────────

def _ppr_border(p, sides: Dict[str, Tuple[str, int, int]]) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    ppr = p._p.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr")
    for side in ("top", "left", "bottom", "right"):
        if side not in sides:
            continue
        color, sz, space = sides[side]
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(sz))
        el.set(qn("w:space"), str(max(0, min(31, space))))
        el.set(qn("w:color"), color)
        bdr.append(el)
    ppr.append(bdr)


def _ppr_shade(p, fill: str) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    p._p.get_or_add_pPr().append(shd)


def _cell_fill(cell, fill: str) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcpr.append(shd)


def _cell_margins(cell, left: float, right: float) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    tcpr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for side, v in (("top", 0), ("left", left), ("bottom", 0), ("right", right)):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:w"), str(int(v * 20)))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    tcpr.append(mar)


_LEVELS: List[float] = []


def _set_levels(heights: List[float]) -> None:
    """Satır yüksekliklerini birkaç punto seviyesine topla (OCR gürültüsü punto kaydırmasın)."""
    _LEVELS.clear()
    cur: List[float] = []
    for h in sorted(heights):
        if cur and h > cur[0] * 1.3:
            _LEVELS.append(statistics.median(cur))
            cur = []
        cur.append(h)
    if cur:
        _LEVELS.append(statistics.median(cur))


def _font_pt(h_px: float, k: float) -> float:
    if _LEVELS:
        h_px = min(_LEVELS, key=lambda v: abs(v - h_px))
    return max(6.5, min(42.0, round(h_px * k * _GLYPH_TO_PT * 2) / 2.0))


def _fill_cell(cell, zone: Dict[str, Any], items: List[Dict[str, Any]], arr: np.ndarray,
               k: float, base_left_px: int) -> None:
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_LINE_SPACING
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    _set_levels([l["h"] for it in items if it["kind"] == "text" for l in it["lines"]])
    first = True
    prev_top = 0
    prev_flow = 0.0
    zone_dark = _luma(zone["bg"]) < 110

    for it in items:
        p = cell.paragraphs[0] if first else cell.add_paragraph()
        pf = p.paragraph_format
        pf.space_after = Pt(0)
        pf.line_spacing = 1.0

        if it["kind"] == "pic":
            px, py, pw, ph = it["box"]
            crop = Image.fromarray(arr[py:py + ph, px:px + pw, :])
            buf = io.BytesIO()
            crop.save(buf, "PNG")
            buf.seek(0)
            gap = it["top"] * k - 0.0 if first else (it["top"] - prev_top) * k - prev_flow
            pf.space_before = Pt(max(0.0, gap))
            run = p.add_run()
            run.add_picture(buf, width=Pt(pw * k))
            cx = px + pw / 2.0 - zone["x0"]
            from docx.enum.text import WD_ALIGN_PARAGRAPH
            if abs(cx - (zone["x1"] - zone["x0"]) / 2.0) < 0.06 * (zone["x1"] - zone["x0"]):
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            else:
                pf.left_indent = Pt(max(0.0, (px - zone["x0"] - base_left_px) * k))
            prev_top, prev_flow, first = it["top"], ph * k + 2, False
            continue

        lines = it["lines"]
        size = _font_pt(it["h"], k)
        band = it.get("band")
        gap = (it["top"] * k - 0.2 * size) if first else ((it["top"] - prev_top) * k - prev_flow)
        pad = 0.0
        if band:
            band_h = (band["y1"] - band["y0"]) * k
            pad = max(0.0, min(30.0, (band_h - _LINE_FACTOR * size) / 2.0))
            gap -= pad
        pf.space_before = Pt(max(0.0, gap))
        ind = (it["left"] - zone["x0"] - base_left_px) * k
        if ind > 4:
            pf.left_indent = Pt(ind)

        # kelimeleri kalınlık/renk koşularına göre run'lara böl
        color = lines[0]["color"]
        runs: List[Tuple[str, bool]] = []
        for l in lines:
            for w, b in zip(l["words"], l["bold_flags"]):
                txt = w["text"]
                if runs and runs[-1][1] == b:
                    runs[-1] = (runs[-1][0] + " " + txt, b)
                else:
                    runs.append((((" " if runs else "") + txt), b))
        text_all = "".join(t for t, _ in runs)
        # madde işareti artığı
        if runs and runs[0][0][:1] in ("*", "«", "¢", "•", "·", "e") and len(runs[0][0]) > 1 and runs[0][0][1] == " " \
                and runs[0][0][:1] != "e":
            runs[0] = ("• " + runs[0][0][2:], runs[0][1])
        for t, b in runs:
            r = p.add_run(t)
            r.font.size = Pt(size)
            r.font.name = "Arial"
            r._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Arial")
            r.bold = b
            r.font.color.rgb = RGBColor(*color)
        del text_all

        if band:
            fill = _hex(band["color"])
            _ppr_shade(p, fill)
            _ppr_border(p, {s: (fill, 4, pad) for s in ("top", "bottom", "left", "right")})
        elif it.get("rule_below") is not None:
            gap_px = it["rule_below"] - it["last_bottom"]
            rule_col = "FFFFFF" if zone_dark else "000000"
            _ppr_border(p, {"bottom": (rule_col, 6, max(1, int(gap_px * k)))})

        n = len(lines)
        prev_top = it["top"]
        prev_flow = _LINE_FACTOR * size * n + (2 * pad if band else 0.0) + (
            (it["rule_below"] - it["last_bottom"]) * k + 1 if (it.get("rule_below") is not None and not band) else 0.0)
        # bir sonraki öğeye geçişte, bu öğenin gerçek yüksekliğini kullan
        first = False


def _set_no_borders(tbl) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    pr = tbl._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "nil")
        b.append(el)
    pr.append(b)
    lay = OxmlElement("w:tblLayout")
    lay.set(qn("w:type"), "fixed")
    pr.append(lay)


def build_docx(pages: List[Dict[str, Any]], docx_path: str, page_pt: Tuple[float, float]) -> None:
    from docx import Document
    from docx.shared import Pt
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    dw = Document()
    sec = dw.sections[0]
    sec.page_width, sec.page_height = Pt(page_pt[0]), Pt(page_pt[1])
    sec.left_margin = sec.right_margin = sec.top_margin = sec.bottom_margin = Pt(0)
    sec.header_distance = sec.footer_distance = Pt(0)
    dw.styles["Normal"].font.name = "Arial"

    for pi, page in enumerate(pages):
        if pi > 0:
            dw.add_page_break()
        zones = page["zones"]
        k = page_pt[0] / float(page["w"])
        tbl = dw.add_table(rows=1, cols=len(zones))
        tbl.autofit = False
        _set_no_borders(tbl)
        row = tbl.rows[0]
        trpr = row._tr.get_or_add_trPr()
        h = OxmlElement("w:trHeight")
        h.set(qn("w:val"), str(int((page_pt[1] - 48) * 20)))
        h.set(qn("w:hRule"), "atLeast")
        trpr.append(h)
        for zi, z in enumerate(zones):
            cell = row.cells[zi]
            cell.width = Pt((z["x1"] - z["x0"]) * k)
            if z["role"] == "side":
                _cell_fill(cell, _hex(z["bg"]))
            items = z["items"]
            lefts = [it["left"] for it in items if it["kind"] == "text"]
            rights = [l["right"] for it in items if it["kind"] == "text" for l in it["lines"]]
            base_left = (min(lefts) - z["x0"]) if lefts else 0
            right_pad = max(0, z["x1"] - max(rights)) if rights else 0
            _cell_margins(cell, base_left * k, min(right_pad, (z["x1"] - z["x0"]) * 0.2) * k)
            _fill_cell(cell, z, items, page["arr"], k, base_left)
            if not items:
                cell.paragraphs[0].add_run("")
        tail = dw.add_paragraph()
        tail.paragraph_format.space_before = tail.paragraph_format.space_after = Pt(0)
        tail.paragraph_format.line_spacing = Pt(1)
        tr = tail.add_run("")
        tr.font.size = Pt(1)
    dw.save(docx_path)


# ───────────────────────── giriş noktası ─────────────────────────

def try_designed_pdf_to_word(pdf_path: str, docx_path: str, password: Optional[str] = None,
                             progress_callback=None) -> bool:
    """Tasarımlı (yan panelli / renkli şeritli) taranmış PDF'i Word'e çevir. Uygun değilse False."""
    try:
        import fitz
    except ImportError:
        return False
    doc = fitz.open(pdf_path)
    try:
        if doc.needs_pass and not doc.authenticate(password or ""):
            return False
        n = len(doc)
        if n == 0 or n > _MAX_PAGES:
            return False

        designed = False
        for i in range(n):
            pg = doc.load_page(i)
            s = 400.0 / max(1.0, pg.rect.width)
            pix = pg.get_pixmap(matrix=fitz.Matrix(s, s), alpha=False, colorspace=fitz.csRGB)
            im = Image.open(io.BytesIO(pix.tobytes("png")))
            if analyze_page(im):
                designed = True
                break
        if not designed:
            return False

        pages: List[Dict[str, Any]] = []
        page_pt = (doc.load_page(0).rect.width, doc.load_page(0).rect.height)
        for i in range(n):
            if progress_callback:
                progress_callback(i + 1, n, f"Tasarım korunarak okunuyor: sayfa {i + 1}/{n}")
            pg = doc.load_page(i)
            scale = max(1.5, min(3.0, 1700.0 / max(1.0, pg.rect.width)))
            pix = pg.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False, colorspace=fitz.csRGB)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            arr = np.asarray(img).copy()
            lay = analyze_page(img) or {
                "zones": [{"x0": 0, "x1": img.width, "bg": _dominant(arr.reshape(-1, 3))[0],
                           "role": "main", "bands": []}],
                "w": img.width, "h": img.height,
            }
            for z in lay["zones"]:
                photos = _find_photos(arr, z["bg"], z["x0"], z["x1"])
                z["items"] = _build_items(arr, z, photos)
            lay["arr"] = arr
            pages.append(lay)

        build_docx(pages, docx_path, page_pt)
        import os
        return os.path.isfile(docx_path) and os.path.getsize(docx_path) > 0
    finally:
        doc.close()

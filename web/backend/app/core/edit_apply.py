"""PDF Düzenle — düzenleme işlemlerini (silme + yeniden yazma) PDF'e uygular. PyMuPDF'siz.

Akış (her sayfa için):
  1. Silinen görsel/vektör amblemler içerik akışından çıkarılır.
  2. Seçili bölgelerdeki harfler içerik akışından GERÇEKTEN silinir (örtme değil); komşu harfler
     yerinden oynamaz (bkz. pdfcore.content).
  3. Yeni metin / çizgi / görsel, sayfa üstüne bir bindirme (reportlab) olarak çizilir.
"""

from __future__ import annotations

import base64
import io
import logging
import math
import zlib
from pathlib import Path
from typing import Any, Callable

import pikepdf

from app.core import edit_fonts as _ef
from app.core import edit_html as _eh

logger = logging.getLogger(__name__)

Rect = tuple[float, float, float, float]


def hex_to_rgb01(hex_str: str | None) -> tuple[float, float, float]:
    """'#RRGGBB' → (r,g,b) 0..1. Geçersizse siyah."""
    try:
        h = (hex_str or "").lstrip("#")
        if len(h) == 6:
            return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)
    except Exception:
        pass
    return (0.0, 0.0, 0.0)


# ─── görsel: bölge piksellerini boya (redaction images=PIXELS karşılığı) ───────────

def blank_image_pixels(pdf: pikepdf.Pdf, page: pikepdf.Page, rects: list[Rect],
                       fill: tuple[float, float, float] | None) -> int:
    """`rects` ile kesişen görsellerde ilgili piksel bölgesini `fill` rengine boyar (geri
    getirilemez). Maske/şablon ve çözülemeyen görsellere dokunulmaz. Değişen görsel sayısı."""
    from PIL import Image
    from pikepdf import PdfImage
    from src.pdfcore import content as _ct

    sc = _ct.scan_page(pdf, page)
    done: set[Any] = set()
    n = 0
    col = tuple(int(round(255 * v)) for v in (fill or (1.0, 1.0, 1.0)))
    for im in sc.images:
        if im.obj is None or im.xref in done:
            continue
        hits = [r for r in rects if im.rect[0] < r[2] and im.rect[2] > r[0] and im.rect[1] < r[3] and im.rect[3] > r[1]]
        if not hits:
            continue
        try:
            obj = im.obj
            if bool(obj.get("/ImageMask", False)):
                continue
            pil = PdfImage(obj).as_pil_image()
            W, H = pil.size
            inv = _ct.inv(im.ctm)
            changed = False
            if pil.mode not in ("RGB", "L"):
                pil = pil.convert("RGB")
            draw_col: Any = col if pil.mode == "RGB" else int(round(sum(col) / 3))
            for r in hits:
                pts = [_ct.apply(inv, x, y) for x in (r[0], r[2]) for y in (r[1], r[3])]
                us = [p[0] for p in pts]
                vs = [p[1] for p in pts]
                c0 = max(0, int(math.floor(min(us) * W)))
                c1 = min(W, int(math.ceil(max(us) * W)))
                r0 = max(0, int(math.floor((1 - max(vs)) * H)))
                r1 = min(H, int(math.ceil((1 - min(vs)) * H)))
                if c1 > c0 and r1 > r0:
                    pil.paste(draw_col, (c0, r0, c1, r1))
                    changed = True
            if not changed:
                continue
            flt = str(obj.get("/Filter", ""))
            if "DCTDecode" in flt:
                buf = io.BytesIO()
                pil.save(buf, "JPEG", quality=92)
                obj.write(buf.getvalue(), filter=pikepdf.Name.DCTDecode)
            else:
                obj.write(zlib.compress(pil.tobytes()), filter=pikepdf.Name.FlateDecode)
            obj["/ColorSpace"] = pikepdf.Name.DeviceRGB if pil.mode == "RGB" else pikepdf.Name.DeviceGray
            obj["/BitsPerComponent"] = 8
            obj["/Width"], obj["/Height"] = W, H
            for k in ("/Decode", "/DecodeParms"):
                if k in obj:
                    del obj[k]
            done.add(im.xref)
            n += 1
        except Exception:
            logger.debug("blank_image_pixels: görsel atlandı", exc_info=True)
    return n


# ─── ana uygulama ──────────────────────────────────────────────────────────

def apply_edit_ops(
    pdf: pikepdf.Pdf,
    ops: list[dict[str, Any]],
    *,
    edit_fonts: dict[str, str],
    font_family_names: dict[str, str],
    orig_paths: dict[str, tuple[str, str]],
) -> None:
    """`ops` düzenlemelerini `pdf`'e uygular (yerinde). Biçim: bkz. /edit-text açıklaması.

    edit_fonts: {anahtar: TTF yolu}; font_family_names: {anahtar: css adı}; orig_paths:
    {orijinal font anahtarı: (TTF yolu, doğrulanmış harfler)}."""
    from src.pdfcore import content as _ct
    from src.pdfcore import overlay as _ov
    from src.pdfcore import pages as _pc

    n = len(pdf.pages)
    for pg in pdf.pages:
        try:
            _pc.remove_rotation(pdf, pg)
        except Exception:
            pass
    name_to_key = {v: k for k, v in font_family_names.items()}

    by_page: dict[int, list] = {}
    for op in ops:
        try:
            pi = int(op.get("page", 0))
            bb = op.get("bbox") or []
            if 0 <= pi < n and len(bb) == 4:
                by_page.setdefault(pi, []).append(op)
        except Exception:
            continue

    _fcache: dict[str, Any] = {}

    def _font(fkey: str) -> Any | None:
        f = _fcache.get(fkey)
        if f is None:
            try:
                f = _ef.font_obj(edit_fonts[fkey])
            except Exception:
                return None
            _fcache[fkey] = f
        return f

    def _metric(op: dict) -> tuple[str, str] | None:
        k = op.get("font")
        if k not in _ef.METRIC_FAMILIES:
            return None
        return (_ef.family_path(k, bool(op.get("bold")), bool(op.get("italic"))),
                _ef.FALLBACK_BY_CLASS[_ef.family_class(k)])

    def _fit_size(text: str, fkey: str, box_w: float, fs: float) -> float:
        if box_w <= 1:
            return fs
        if fkey in _ef.METRIC_FAMILIES:
            _p = _ef.family_path(fkey)
            tw0 = _ef.text_width(text, _p, _ef.FALLBACK_BY_CLASS[_ef.family_class(fkey)], fs)
            return max(fs * (box_w / tw0), 5.0) if tw0 > box_w and tw0 > 0 else fs
        fobj = _font(fkey)
        if fobj is None:
            return fs
        tw = fobj.text_length(text, fontsize=fs)
        if tw > box_w and tw > 0:
            return max(fs * (box_w / tw), 5.0)  # okunur taban 5pt
        return fs

    def _fit_block_size(text: str, fkey: str, box_w: float, box_h: float, fs: float) -> float:
        """Sarmalı (çok satırlı) blok: kelime kaydırmayla gereken satır × satır yüksekliği box_h'yi
        aşıyorsa fontu küçült (çeviri paragraf kutusuna sığsın)."""
        if box_w <= 1 or box_h <= 1:
            return fs
        fobj = _font(fkey)
        if fobj is None:
            return fs
        words = text.split()
        if not words:
            return fs

        def _lines_at(size: float) -> int:
            space = fobj.text_length(" ", fontsize=size)
            lines = 1
            cur = 0.0
            for w in words:
                wl = fobj.text_length(w, fontsize=size)
                if cur <= 0:
                    cur = wl
                elif cur + space + wl > box_w:
                    lines += 1
                    cur = wl
                else:
                    cur += space + wl
            return lines

        size = fs
        for _ in range(60):
            if _lines_at(size) * size * 1.28 <= box_h or size <= 5.0:
                break
            size = max(5.0, size - 0.5)
        return size

    def _wrap_text(text: str, path: str, fb: str, size: float, box_w: float) -> list[str]:
        out: list[str] = []
        for para in text.split("\n"):
            cur = ""
            for w in para.split(" "):
                trial = w if not cur else cur + " " + w
                if cur and _ef.text_width(trial, path, fb, size) > box_w:
                    out.append(cur)
                    cur = w
                else:
                    cur = trial
            out.append(cur)
        return out

    builders: dict[int, Callable[[Any], None]] = {}

    for pi, page_ops in by_page.items():
        page = pdf.pages[pi]
        text_ops = [o for o in page_ops if not o.get("image") and not o.get("deco")]
        deco_ops = [o for o in page_ops if o.get("deco")]
        image_ops = [o for o in page_ops if o.get("image")]
        image_moves: list[tuple[int, list[float]]] = []
        fills: list[tuple[Rect, tuple[float, float, float]]] = []

        # 0) Silinen GÖRSEL (logo/amblem): boyamadan gerçekten kaldır.
        for o in [o for o in text_ops if o.get("img") and not (o.get("text") or "").strip()]:
            try:
                if o.get("vec"):
                    vb = tuple(float(v) for v in o["bbox"])
                    sc = _ct.scan_page(pdf, page)
                    pad = 1.0
                    for d in sc.paths:
                        dr = d.rect
                        if (vb[0] < dr[2] and vb[2] > dr[0] and vb[1] < dr[3] and vb[3] > dr[1]
                                and dr[0] >= vb[0] - 3 and dr[1] >= vb[1] - 3 and dr[2] <= vb[2] + 3 and dr[3] <= vb[3] + 3):
                            pad = max(pad, d.width + 1.0)
                    _ct.remove_in_rects(pdf, page, [(vb[0] - pad, vb[1] - pad, vb[2] + pad, vb[3] + pad)],
                                        text=False, paths=True)
                    text_ops.remove(o)
                else:
                    if _ef.remove_image_placement(pdf, page, o["bbox"]):
                        text_ops.remove(o)
                    mv = o.get("move")
                    if mv and o.get("xref"):
                        image_moves.append((int(o["xref"]), [float(v) for v in mv]))
            except Exception:
                logger.debug("görsel silme atlandı", exc_info=True)

        # 1a) VEKTÖR yazı (op.vt): taban çizgisi etrafında ince ŞERİT; dolgu yok.
        vt_ops = [o for o in text_ops if o.get("vt") and o.get("by") is not None]
        other_ops = [o for o in text_ops if not (o.get("vt") and o.get("by") is not None)]
        strips: list[Rect] = []
        for op in vt_ops:
            cb = op.get("clear") or op["bbox"]
            x0, y0, x1, y1 = (float(v) for v in cb)
            by_ = float(op["oby"]) if op.get("oby") is not None else float(op["by"])
            osz = float(op.get("osz") or op.get("size") or max(1.0, (y1 - y0) / 1.2))
            ins = min(0.3, max(0.0, (x1 - x0) / 4))
            strips.append((x0 + ins, by_ - 0.35 * osz, x1 - ins, by_ - 0.15 * osz))
        if strips:
            _ct.remove_in_rects(pdf, page, strips, text=True)
            # Altı çizili yazının ayrı ince çizgisi: yazı genişliğine oturan çizgi kaldırılır.
            try:
                sc = _ct.scan_page(pdf, page)
                ul_rects: list[Rect] = []
                for op in vt_ops:
                    cb = op.get("clear") or op["bbox"]
                    x0, y0, x1, y1 = (float(v) for v in cb)
                    by_ = float(op["oby"]) if op.get("oby") is not None else float(op["by"])
                    osz = float(op.get("osz") or op.get("size") or max(1.0, (y1 - y0) / 1.2))
                    for d in sc.paths:
                        dr = d.rect
                        w_ = d.width
                        if not d.stroke or (dr[3] - dr[1]) > 0.8:
                            continue
                        if not (by_ - 0.1 * osz <= dr[1] <= by_ + 0.35 * osz):
                            continue
                        if dr[0] < x0 - 3 or dr[2] > x1 + 3 or (dr[2] - dr[0]) < 0.6 * (x1 - x0):
                            continue
                        ul_rects.append((dr[0] - 3, dr[1] - (10 * w_ + 1), dr[2] + 3, dr[3] + (10 * w_ + 1)))
                if ul_rects:
                    _ct.remove_in_rects(pdf, page, ul_rects, text=False, paths=True)
            except Exception:
                logger.debug("altı çizgi temizliği atlandı", exc_info=True)

        # 1b) Görüntüdeki yazı (OCR / görünmez katman) ve görsel silme: piksel de örtülmeli.
        if other_ops:
            regions: list[Rect] = []
            for op in other_ops:
                cb = op.get("clear") or op["bbox"]
                x0, y0, x1, y1 = (float(v) for v in cb)
                fill = hex_to_rgb01(op.get("bg")) if op.get("bg") else (1.0, 1.0, 1.0)
                r_ = (x0, y0, x1, y1)
                regions.append(r_)
                fills.append((r_, fill))
                try:
                    blank_image_pixels(pdf, page, [r_], fill)
                except Exception:
                    pass
            _ct.remove_in_rects(pdf, page, regions, text=True)

        # ── çizim (bindirme) ─────────────────────────────────────────
        def _build(cv: Any, text_ops=text_ops, deco_ops=deco_ops, image_ops=image_ops,
                   image_moves=image_moves, fills=fills, page=page) -> None:
            for r_, fill in fills:
                cv.rect(r_, fill=fill)
            for op in text_ops:
                html = op.get("html")
                if html:
                    x0, y0, x1, y1 = (float(v) for v in op["bbox"])
                    try:
                        _eh.draw_html_box(cv, (x0, y0, x1, y1), _ef.wrap_missing_glyphs(str(html)),
                                          name_to_key=name_to_key, edit_fonts=edit_fonts)
                    except Exception:
                        import re as _re
                        plain = _re.sub(r"<[^>]+>", "", str(html))
                        plain = (plain.replace("&amp;", "&").replace("&lt;", "<")
                                 .replace("&gt;", ">").replace("&#160;", " ")).strip()
                        if plain:
                            fkey = op.get("font") if op.get("font") in edit_fonts else "serif"
                            bfs = _fit_block_size(plain, fkey, x1 - x0, y1 - y0, float(op.get("size") or 11))
                            p_ = edit_fonts[fkey]
                            by0 = y0 + bfs
                            for ln in _wrap_text(plain, p_, p_, bfs, x1 - x0):
                                _ef.draw_runs(cv, x0, by0, ln, bfs, (0, 0, 0), p_, p_)
                                by0 += bfs * 1.28
                    continue
                t = op.get("text") or ""
                if not t.strip():
                    continue
                x0, y0, x1, y1 = (float(v) for v in op["bbox"])
                fs = float(op.get("size") or 11)
                by = op.get("by")
                baseline = float(by) if by is not None else (y0 + fs)
                col = hex_to_rgb01(op.get("color"))
                _mt = _metric(op)
                _of = orig_paths.get(str(op.get("ofont") or ""))
                if _of and all(ch in _of[1] for ch in (op.get("text") or "")):
                    _fb0 = _mt[1] if _mt else _ef.FALLBACK_BY_CLASS["sans"]
                    _mt = (_of[0], _fb0)
                fkey = op.get("font") if op.get("font") in edit_fonts else "sans"
                lw_ = max(0.5, fs * 0.05)

                def _lines(dx: float, tw_: float, fs_: float, base_: float) -> None:
                    lw2 = max(0.5, fs_ * 0.05)
                    if op.get("underline"):
                        uy = base_ + fs_ * 0.12
                        cv.line(dx, uy, dx + tw_, uy, color=col, width=lw2)
                    if op.get("strike"):
                        sy = base_ - fs_ * 0.30
                        cv.line(dx, sy, dx + tw_, sy, color=col, width=lw2)

                # WRAP modu (konum-koruyan ÇEVİRİ): paragraf bloğu → kutuya kelime-kaydırmayla sar.
                if op.get("wrap") and _mt:
                    lh = fs * 1.2
                    yy = y0 + fs
                    for ln in _wrap_text(t, _mt[0], _mt[1], fs, x1 - x0):
                        if yy > y1 + fs:
                            break
                        _ef.draw_runs(cv, x0, yy, ln, fs, col, _mt[0], _mt[1])
                        yy += lh
                    continue
                if op.get("wrap"):
                    bfs = _fit_block_size(t, fkey, x1 - x0, y1 - y0, fs)
                    p_ = edit_fonts[fkey]
                    lh = bfs * 1.2
                    yy = y0 + bfs
                    for ln in _wrap_text(t, p_, p_, bfs, x1 - x0):
                        _ef.draw_runs(cv, x0, yy, ln, bfs, col, p_, p_)
                        if op.get("bold"):
                            _ef.draw_runs(cv, x0 + max(0.25, bfs * 0.03), yy, ln, bfs, col, p_, p_)
                        yy += lh
                    continue
                # noshrink → fontu KÜÇÜLTME (komşu metin frontend'de sağa kaydırıldı).
                if not op.get("noshrink"):
                    if _mt:
                        _tw0 = _ef.text_width(t, _mt[0], _mt[1], fs)
                        if _tw0 > (x1 - x0) > 1:
                            fs = max(fs * ((x1 - x0) / _tw0), 5.0)
                    else:
                        fs = _fit_size(t, fkey, x1 - x0, fs)
                _af = _font(fkey)
                try:
                    if _mt:
                        tw = _ef.text_width(t, _mt[0], _mt[1], fs)
                    else:
                        tw = _af.text_length(t, fontsize=fs) if _af else (x1 - x0)
                except Exception:
                    tw = x1 - x0
                box_w = x1 - x0
                draw_x = x0
                _align = op.get("align")
                if _align == "center" and box_w > tw:
                    draw_x = x0 + (box_w - tw) / 2
                elif _align == "right" and box_w > tw:
                    draw_x = x1 - tw
                _hs = float(op.get("hs") or 1.0)
                _cs = float(op.get("cs") or 0.0)
                _uses_orig = bool(_of and all(ch in _of[1] for ch in (op.get("text") or "")))
                if _uses_orig:
                    _cs += float(op.get("ocs") or 0.0)
                else:
                    _hs *= float(op.get("fit") or 1.0)
                _ws = float(op.get("ws") or 0.0)
                if abs(_hs - 1) > 1e-3 or _cs or _ws:
                    _pp, _fb = _mt if _mt else (edit_fonts[fkey], edit_fonts[fkey])
                    _tw2 = _ef.spaced_width(t, _pp, _fb, fs, _hs, _cs, _ws)
                    _dx = draw_x
                    if _align == "center" and box_w > _tw2:
                        _dx = x0 + (box_w - _tw2) / 2
                    elif _align == "right" and box_w > _tw2:
                        _dx = x1 - _tw2
                    _ef.draw_spaced(cv, _dx, baseline, t, fs, col, _pp, _fb, _hs, _cs, _ws)
                    if not _mt and op.get("bold"):
                        _ef.draw_spaced(cv, _dx + max(0.25, fs * 0.03), baseline, t, fs, col, _pp, _fb, _hs, _cs, _ws)
                    _lines(_dx, _tw2, fs, baseline)
                    continue
                if _mt:
                    _ef.draw_runs(cv, draw_x, baseline, t, fs, col, _mt[0], _mt[1])
                    _lines(draw_x, tw, fs, baseline)
                    continue
                p_ = edit_fonts[fkey]
                shear = 0.2 if op.get("italic") else 0.0
                cv.text(draw_x, baseline, t, font=p_, size=fs, color=col, shear=shear)
                if op.get("bold"):
                    cv.text(draw_x + max(0.25, fs * 0.03), baseline, t, font=p_, size=fs, color=col, shear=shear)
                _lines(draw_x, tw, fs, baseline)
            # 2a) Yalnız çizgi
            for op in deco_ops:
                try:
                    dx0, dy0, dx1, _dy1 = (float(v) for v in op["bbox"])
                    dfs = float(op.get("size") or 11)
                    dbase = float(op["by"]) if op.get("by") is not None else dy0 + dfs
                    dcol = hex_to_rgb01(op.get("color"))
                    dlw = max(0.5, dfs * 0.05)
                    if op.get("underline"):
                        cv.line(dx0, dbase + dfs * 0.12, dx1, dbase + dfs * 0.12, color=dcol, width=dlw)
                    if op.get("strike"):
                        cv.line(dx0, dbase - dfs * 0.30, dx1, dbase - dfs * 0.30, color=dcol, width=dlw)
                except Exception:
                    continue
            # 2b) Taşınan mevcut görseller (özgün piksel + saydamlık maskesi)
            for xr, nb in image_moves:
                try:
                    pil = _image_by_objnum(pdf, xr)
                    if pil is not None:
                        cv.image(tuple(nb), pil, keep_proportion=False)  # type: ignore[arg-type]
                except Exception:
                    continue
            # 3) Kullanıcının eklediği resimler (serbest açıyla)
            for op in image_ops:
                try:
                    data = str(op.get("image") or "")
                    raw = base64.b64decode(data.split(",")[-1])
                    x0, y0, x1, y1 = (float(v) for v in op["bbox"])
                    deg = float(op.get("rotate") or 0) % 360
                    if abs(deg) < 0.5:
                        cv.image((x0, y0, x1, y1), raw, keep_proportion=False)
                        continue
                    from PIL import Image as _Image

                    img = _Image.open(io.BytesIO(raw)).convert("RGBA")
                    rot = img.rotate(-deg, expand=True, resample=_Image.BICUBIC)
                    r = math.radians(deg)
                    w0, h0 = (x1 - x0), (y1 - y0)
                    bw = abs(w0 * math.cos(r)) + abs(h0 * math.sin(r))
                    bh = abs(w0 * math.sin(r)) + abs(h0 * math.cos(r))
                    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                    cv.image((cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2), rot, keep_proportion=False)
                except Exception:
                    continue

        builders[pi] = _build

    if builders:
        _ov.stamp_pages(pdf, builders)


def _image_by_objnum(pdf: pikepdf.Pdf, objnum: int) -> Any | None:
    """Nesne numarasıyla görseli PIL olarak döndürür (SMask varsa alfa kanalı eklenir)."""
    from pikepdf import PdfImage

    obj = pdf.get_object((objnum, 0))
    pil = PdfImage(obj).as_pil_image()
    sm = obj.get("/SMask")
    if sm is not None:
        try:
            mask = PdfImage(sm).as_pil_image().convert("L")
            if mask.size != pil.size:
                mask = mask.resize(pil.size)
            pil = pil.convert("RGBA")
            pil.putalpha(mask)
            return pil
        except Exception:
            pass
    if pil.mode not in ("RGB", "RGBA", "L"):
        pil = pil.convert("RGB")
    return pil

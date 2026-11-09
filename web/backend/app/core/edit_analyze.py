"""PDF Düzenle — sayfa analizi: metin span'leri + görseller + vektör amblemler. PyMuPDF'siz.

Eskiden PyMuPDF `get_text("dict"/"rawdict")` + `get_texttrace` + `get_image_info` kullanılıyordu.
Şimdi tek kaynak: `pdfcore.content` içerik akışı yorumlayıcısı (harf konumu, Tc/Tw/Tz, renk,
görünmezlik, görsel yerleşimleri, çizimler). Taranmış sayfalar için isteğe bağlı Tesseract OCR.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Any

import pikepdf

from app.core import edit_fonts as _ef
from src.pdfcore import layout as _lay

logger = logging.getLogger(__name__)


def _mupdf_flags(font: Any) -> int:
    """MuPDF tarzı span bayrakları: 2 italik, 4 serifli, 8 eşit-genişlik, 16 kalın."""
    f = 0
    d = int(getattr(font, "desc_flags", 0) or 0)
    nm = (font.name or "").lower()
    if (d & 64) or abs(getattr(font, "italic_angle", 0.0)) > 0.5 or "italic" in nm or "oblique" in nm:
        f |= 2
    if d & 2:
        f |= 4
    if d & 1:
        f |= 8
    if (d & 262144) or any(k in nm for k in ("bold", "black", "heavy")):
        f |= 16
    return f


def _hex(c: tuple[float, float, float]) -> str:
    r, g, b = (max(0, min(255, int(round(v * 255)))) for v in c)
    return f"#{r:02x}{g:02x}{b:02x}"


def _ocr_spans(page_img: Any, dpi: float, width_pt: float) -> list[dict[str, Any]]:
    """Taranmış sayfa: Tesseract ile satır bazlı span'ler (puntoda koordinat)."""
    import pytesseract

    from src.pdf_engine import _TESSERACT_CONFIG, _tessdata_dir

    cfg = _TESSERACT_CONFIG
    td = _tessdata_dir()
    if td:
        cfg += f' --tessdata-dir "{td}"'
    data = pytesseract.image_to_data(page_img, lang="tur+eng", config=cfg, output_type=pytesseract.Output.DICT)
    k = 72.0 / dpi
    lines: dict[tuple[int, int, int], list[int]] = {}
    for i, txt in enumerate(data["text"]):
        if not str(txt).strip() or float(data["conf"][i]) < 0:
            continue
        lines.setdefault((data["block_num"][i], data["par_num"][i], data["line_num"][i]), []).append(i)
    spans: list[dict[str, Any]] = []
    for (bn, pn, ln), idxs in lines.items():
        idxs.sort(key=lambda i: data["left"][i])
        x0 = min(data["left"][i] for i in idxs) * k
        x1 = max(data["left"][i] + data["width"][i] for i in idxs) * k
        y0 = min(data["top"][i] for i in idxs) * k
        y1 = max(data["top"][i] + data["height"][i] for i in idxs) * k
        text = " ".join(str(data["text"][i]).strip() for i in idxs)
        h = y1 - y0
        spans.append({"bbox": (x0, y0, x1, y1), "text": text, "size": h * 0.9, "by": y1 - h * 0.2, "blk": f"{bn}:{pn}"})
    return spans


def analyze_pdf(pdf: pikepdf.Pdf, *, want_ocr: bool = False, reader_factory: Any = None) -> dict[str, Any]:
    """Düzenlenebilir öğeleri döndürür: {"pages": [...], "fonts": {...}}."""
    from src.pdfcore import content as _ct
    from src.pdfcore import pages as _pc
    from src.pdfcore.pages import page_visual_size

    for pg in pdf.pages:
        try:
            _pc.remove_rotation(pdf, pg)
        except Exception:
            pass
    try:
        orig = _ef.original_fonts(pdf)
    except Exception:
        orig = {}
    used_orig: set[str] = set()
    pages: list[dict[str, Any]] = []
    for pi, page in enumerate(pdf.pages):
        els: list[dict[str, Any]] = []
        ei = 0
        pw, ph = page_visual_size(page)
        try:
            sc = _ct.scan_page(pdf, page)
        except Exception:
            logger.debug("analiz: sayfa %d taranamadı", pi, exc_info=True)
            sc = _ct.Scan()
        glyphs = [g for g in sc.glyphs if g.font is not None and (g.ch.strip() or g.ch == " " or not g.ch)]
        blocks = _lay.build_blocks(glyphs)
        has_text = any("".join(g.ch for g in sp).strip() for bl in blocks for ln in bl for sp in ln)

        if want_ocr and not has_text:
            try:
                from src.pdfcore import PdfiumReader  # noqa: F401
                # Sayfayı görüntüle (taranmış belge: görsel zaten sayfayı kaplar).
                import io as _io

                buf = _io.BytesIO()
                one = _pc.new_pdf()
                one.pages.append(page)
                one.save(buf)
                dpi = 200.0
                with PdfiumReader(buf.getvalue()) as rd:
                    img = rd.render(0, dpi=dpi)
                for si, sp in enumerate(_ocr_spans(img, dpi, pw)):
                    x0, y0, x1, y1 = sp["bbox"]
                    els.append({
                        "id": f"t{pi}_{ei}", "type": "text",
                        "bbox": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
                        "text": sp["text"], "size": round(sp["size"], 2), "color": "#000000",
                        "by": round(sp["by"], 1), "font": "sans", "bold": False, "italic": False,
                        "line": f"{pi}:{sp['blk']}:{si}", "inv": False,
                    })
                    ei += 1
            except Exception:
                logger.debug("OCR başarısız → sayfa görüntü olarak kalır", exc_info=True)

        for bi, bl in enumerate(blocks):
            for li, ln in enumerate(bl):
                for si, sp in enumerate(ln):
                    txt = "".join(g.ch if g.ch else "�" for g in sp)
                    if not txt.strip():
                        continue
                    x0 = min(g.x0 for g in sp)
                    y0 = min(g.y0 for g in sp)
                    x1 = max(g.x1 for g in sp)
                    y1 = max(g.y1 for g in sp)
                    g0 = sp[0]
                    fname = _ef._base_name(g0.font.name)
                    fl = fname.lower()
                    flags = _mupdf_flags(g0.font)
                    bold = bool(flags & 16) or "bold" in fl or "black" in fl or "heavy" in fl
                    italic = bool(flags & 2) or "italic" in fl or "oblique" in fl
                    mk = _ef.metric_family_for(fname)
                    horizontal = abs(g0.slope) < 0.5
                    spc: dict = {}
                    if horizontal:
                        try:
                            spc = _ef.span_spacing(sp)
                        except Exception:
                            spc = {}
                    size = float(spc.get("size", g0.size))
                    legacy = _legacy_key(fname)
                    if mk:
                        fkey = mk
                    elif legacy in ("lato", "montserrat", "oswald", "merriweather"):
                        fkey = legacy
                    else:
                        fkey = _ef.class_family(fname, flags)
                        try:
                            chs = [g for g in sp if g.ch and not g.ch.isspace()]
                            if len(chs) >= 3:
                                nat = (chs[-1].ox + chs[-1].nat) - chs[0].ox
                                n_ = len(txt.strip())
                                nat -= float(spc.get("cs", 0)) * (n_ - 1) + float(spc.get("ws", 0)) * txt.strip().count(" ")
                                fit = _ef.fit_scale(txt, fkey, bold, italic, size, nat)
                                if fit:
                                    spc["fit"] = round(fit / float(spc.get("hs", 1.0)), 3)
                        except Exception:
                            pass
                    if fname in orig:
                        try:
                            n2 = len("".join(g.ch for g in sp).rstrip())
                            if n2 >= 4:
                                import io as _io2

                                of = orig[fname].setdefault("_font", _ef.MetricFont(_io2.BytesIO(orig[fname]["buf"])))
                                t2 = "".join(g.ch for g in sp).rstrip()
                                hs2 = float(spc.get("hs", 1.0))
                                nat2 = (sp[n2 - 1].ox + sp[n2 - 1].nat) - sp[0].ox
                                exp2 = (of.text_length(t2, fontsize=size) * hs2
                                        + float(spc.get("cs", 0)) * (n2 - 1) + float(spc.get("ws", 0)) * t2.count(" "))
                                ocs = (nat2 - exp2) / (n2 - 1)
                                if 0.004 < abs(ocs) < 0.15 * size:
                                    spc["ocs"] = round(ocs, 4)
                        except Exception:
                            pass
                    spc.pop("size", None)
                    els.append({
                        "id": f"t{pi}_{ei}", "type": "text",
                        "bbox": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
                        "text": txt, "size": round(size, 2),
                        "color": _hex(g0.color), "by": round(float(g0.oy), 1),
                        "font": fkey, "bold": bold, "italic": italic,
                        "line": f"{pi}:{bi}:{li}",
                        "inv": all(g.mode == 3 for g in sp),
                        **spc,
                        **({"ofont": orig[fname]["key"]} if fname in orig else {}),
                    })
                    ei += 1
        img_rects: list[tuple[float, float, float, float]] = []
        for im in sc.images:
            x0, y0, x1, y1 = im.rect
            if (x1 - x0) < 4 or (y1 - y0) < 4:
                continue
            img_rects.append(im.rect)
            els.append({
                "id": f"i{pi}_{ei}", "type": "image",
                "bbox": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
                **({"xref": int(im.xref)} if im.xref else {}),
            })
            ei += 1
        for vr in _ef.vector_emblems(pdf, page, img_rects):
            els.append({
                "id": f"i{pi}_{ei}", "type": "image", "vec": True,
                "bbox": [round(vr[0], 1), round(vr[1], 1), round(vr[2], 1), round(vr[3], 1)],
            })
            ei += 1
        pages.append({"width": round(pw, 1), "height": round(ph, 1), "elements": els})
    for e in (e for p_ in pages for e in p_["elements"]):
        if e.get("ofont"):
            used_orig.add(e["ofont"])
    fonts = {
        v["key"]: {"b64": base64.b64encode(v["buf"]).decode("ascii"), "chars": v["chars"]}
        for v in orig.values() if v["key"] in used_orig
    }
    return {"pages": pages, "fonts": fonts}


def _legacy_key(font_name: str) -> str:
    """PDF span font adını gömülü ailelere eşler (serif/sans/mono/lato/…)."""
    f = (font_name or "").lower()
    if any(k in f for k in ("mono", "courier", "consol", "menlo", "typewriter")):
        return "mono"
    for k in ("montserrat", "lato", "oswald", "merriweather"):
        if k in f:
            return k
    if any(k in f for k in ("times", "serif", "georgia", "garamond", "minion", "roman", "cambria", "palatino")):
        return "serif"
    return "sans"

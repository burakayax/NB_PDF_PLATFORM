"""Dijital (metin katmanlı) PDF → düzenlenebilir DOCX. PyMuPDF'siz; pdf2docx'in yerini alır.

Yaklaşım (pdfcore içerik akışı yorumlayıcısından):
  * Sayfa tek sütunsa AKIŞ kipi: her blok bir Word paragrafı (hizalama, girinti, satır aralığı, boşluk,
    PDF'teki satır sonları korunur); resimler akışta sırasıyla yer alır.
  * Yan yana bloklar (sütun/panel/kartlar) varsa ÇERÇEVE kipi: her blok sayfada PDF'tekiyle aynı
    konuma sabitlenen (w:framePr) düzenlenebilir bir metin çerçevesi olur.
  * Her span: yazı tipi adı, punto, kalın/italik, renk; satırlar arası büyük boşluk sekme (tab).
Kapsam dışı (bilinçli): vektör çizimler (çizgi/şekil), bağlantılar, üst/alt bilgi tanıma.
Tablolar için üst katman (`_looks_table_heavy` → `_pdf_tables_to_docx`) ayrı çalışır.
"""

from __future__ import annotations

import io
import os
import re
from typing import Any, Callable, List, Optional, Tuple

import pikepdf

from src.pdfcore import content as _ct
from src.pdfcore import layout as _lay
from src.pdfcore import pages as _pc
from src.pdfcore.pages import page_visual_size

_TWIP = 20  # 1 pt = 20 twip


def _clean_font_name(name: str) -> str:
    n = re.sub(r"^[A-Z]{6}\+", "", name or "")
    n = re.sub(r"[-,](Bold|Italic|Oblique|BoldItalic|BoldOblique|Regular|Roman|Medium|MT|PSMT|PS).*$", "", n, flags=re.I)
    n = n.replace("PSMT", "").replace("MT", "") if n.endswith("MT") else n
    # CamelCase → boşluklu ("LiberationSans" → "Liberation Sans")
    n = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", n)
    return n.strip() or "Arial"


def _flags(font: Any) -> Tuple[bool, bool]:
    nm = (font.name or "").lower()
    d = int(getattr(font, "desc_flags", 0) or 0)
    bold = bool(d & 262144) or any(k in nm for k in ("bold", "black", "heavy", "semibold"))
    italic = bool(d & 64) or abs(getattr(font, "italic_angle", 0.0)) > 0.5 or "italic" in nm or "oblique" in nm
    return bold, italic


def _block_bbox(block: List[List[List[Any]]]) -> Tuple[float, float, float, float]:
    gs = [g for ln in block for sp in ln for g in sp]
    return (min(g.x0 for g in gs), min(g.y0 for g in gs), max(g.x1 for g in gs), max(g.y1 for g in gs))


def _line_stats(line: List[List[Any]]) -> Tuple[float, float, float, float, float]:
    gs = [g for sp in line for g in sp]
    return (min(g.x0 for g in gs), max(g.x1 for g in gs), gs[0].oy, max(g.size for g in gs),
            min(g.y0 for g in gs))


def _side_by_side(boxes: List[Tuple[float, float, float, float]]) -> bool:
    """Yatayda ayrık ama dikeyde örtüşen iki blok var mı → sütun/panel düzeni."""
    n = len(boxes)
    for i in range(n):
        a = boxes[i]
        for j in range(i + 1, n):
            b = boxes[j]
            v_ov = min(a[3], b[3]) - max(a[1], b[1])
            if v_ov <= 0.3 * min(a[3] - a[1], b[3] - b[1]):
                continue
            h_gap = max(a[0], b[0]) - min(a[2], b[2])
            if h_gap > 8:
                return True
    return False


def _add_runs(par: Any, block: List[List[List[Any]]], ml: float, Pt: Any, RGBColor: Any) -> None:
    """Bloğun satırlarını (PDF satır sonlarıyla) paragrafa yazar."""
    from docx.oxml.ns import qn

    for li, line in enumerate(block):
        if li > 0:
            par.add_run().add_break()
        prev_end: Optional[float] = None
        for sp in line:
            gs = [g for g in sp]
            text = "".join(g.ch if g.ch else "�" for g in gs)
            if not text:
                continue
            x_start = gs[0].ox
            if prev_end is not None and x_start - prev_end > 3.0 * max(gs[0].size, 1.0):
                # büyük boşluk → sekme (sekme durağı paragrafa eklenir)
                par.paragraph_format.tab_stops.add_tab_stop(Pt(max(1.0, x_start - ml)))
                par.add_run("\t")
                text = text.lstrip(" ")
            run = par.add_run(text)
            g0 = gs[0]
            bold, italic = _flags(g0.font)
            run.bold = bold or None
            run.italic = italic or None
            run.font.size = Pt(max(1.0, round(g0.size * 2) / 2))
            fam = _clean_font_name(g0.font.name)
            run.font.name = fam
            rpr = run._element.get_or_add_rPr()
            rfonts = rpr.find(qn("w:rFonts"))
            if rfonts is not None:
                for att in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
                    rfonts.set(qn(att), fam)
            r, g, b = (int(round(255 * v)) for v in g0.color)
            if (r, g, b) != (0, 0, 0):
                run.font.color.rgb = RGBColor(r, g, b)
            prev_end = gs[-1].ox + gs[-1].adv


def _align_of(block: List[List[List[Any]]], page_w: float, ml: float, mr_x: float) -> str:
    stats = [_line_stats(ln) for ln in block]
    x0s = [s[0] for s in stats]
    x1s = [s[1] for s in stats]
    if len(block) >= 3:
        left_same = max(x0s) - min(x0s) < 2.0
        right_flush = sum(1 for x in x1s[:-1] if abs(x - max(x1s)) < 2.5) >= max(1, len(x1s) - 2)
        if left_same and right_flush and (max(x1s) - min(x0s)) > 0.5 * page_w:
            return "justify"
    centers = [(a + b) / 2 for a, b, *_ in stats]
    if all(abs(c - page_w / 2) < 8 for c in centers) and min(x0s) > ml + 12:
        return "center"
    if len(block) == 1 and abs(x1s[0] - mr_x) < 3 and x0s[0] > ml + 0.3 * (mr_x - ml):
        return "right"
    return "left"


def pdf_to_docx_digital(
    pdf_path: str,
    docx_path: str,
    password: Optional[str] = None,
    progress_callback: Optional[Callable[[int, int, str], None]] = None,
) -> bool:
    """Metin katmanlı PDF'i DOCX'e çevirir. Başarısızsa/metin yoksa False."""
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor
    from pikepdf import PdfImage

    pdf = _pc.open_pdf(pdf_path, password)
    n_pages = len(pdf.pages)
    dw = Document()
    # python-docx varsayılan boş paragrafı sil
    body0 = dw.element.body
    for p in list(body0.iterchildren(qn("w:p"))):
        body0.remove(p)
    # varsayılan stil: boşluk yok
    st = dw.styles["Normal"]
    st.paragraph_format.space_after = Pt(0)
    st.paragraph_format.space_before = Pt(0)
    st.font.size = Pt(10)
    any_text = False
    try:
        for pi, page in enumerate(pdf.pages):
            if progress_callback:
                progress_callback(pi + 1, n_pages, f"Metin katmanı Word'e aktarılıyor: sayfa {pi + 1}/{n_pages}")
            W, H = page_visual_size(page)
            sc = _ct.scan_page(pdf, page)
            glyphs = [g for g in sc.glyphs if g.mode != 3 and g.font is not None]
            blocks = _lay.build_blocks(glyphs)
            blocks = [b for b in blocks if any(g.ch.strip() for ln in b for sp in ln for g in sp)]
            imgs = [im for im in sc.images
                    if im.obj is not None and (im.rect[2] - im.rect[0]) > 8 and (im.rect[3] - im.rect[1]) > 8
                    and not ((im.rect[2] - im.rect[0]) * (im.rect[3] - im.rect[1]) > 0.85 * W * H and blocks)]
            if blocks:
                any_text = True
            bg_png: Optional[bytes] = None
            if (sc.images or any(pr.fill or (pr.rect[2] - pr.rect[0]) > 40 for pr in sc.paths)):
                bg_png = _background_jpeg(page, W, H)
            if bg_png:
                imgs = []  # resimler arka plana gömüldü
            boxes = [_block_bbox(b) for b in blocks]
            all_x0 = [b[0] for b in boxes] + [im.rect[0] for im in imgs]
            all_x1 = [b[2] for b in boxes] + [im.rect[2] for im in imgs]
            all_y0 = [b[1] for b in boxes] + [im.rect[1] for im in imgs]
            all_y1 = [b[3] for b in boxes] + [im.rect[3] for im in imgs]
            if pi == 0:
                sec = dw.sections[0]
            else:
                from docx.enum.section import WD_SECTION

                sec = dw.add_section(WD_SECTION.NEW_PAGE)
                _shrink_section_paragraph(dw, OxmlElement, qn)
            sec.page_width, sec.page_height = Pt(W), Pt(H)
            slack = 0.0
            frame_mode = _side_by_side(boxes) if boxes else False
            if frame_mode or not all_x0:
                sec.left_margin = sec.right_margin = Pt(0)
                sec.top_margin = Pt(0)
                sec.bottom_margin = Pt(24)  # çerçeveler mutlak konumlu; akış taşıp fazladan sayfa açmasın
                ml, mr_x = 0.0, W
            else:
                ml = max(0.0, min(all_x0))
                mr_x = min(W, max(all_x1))
                # Word/LibreOffice'te yedek yazı tipi biraz geniş olabilir; sarmayı önlemek için sağda pay bırak.
                slack = min(0.06 * (mr_x - ml), max(0.0, W - mr_x))
                sec.left_margin = Pt(ml)
                sec.right_margin = Pt(max(0.0, W - mr_x - slack))
                sec.top_margin = Pt(max(0.0, min(all_y0)))
                sec.bottom_margin = Pt(12)
            sec.header_distance = sec.footer_distance = Pt(0)

            items: List[Tuple[float, str, Any]] = []
            for b, bb in zip(blocks, boxes):
                items.append((bb[1], "b", b))
            for im in imgs:
                items.append((im.rect[1], "i", im))
            items.sort(key=lambda t: (t[0], 0 if t[1] == "b" else 1))

            if bg_png:
                bgp = dw.add_paragraph()
                bgp.paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY
                bgp.paragraph_format.line_spacing = Pt(1)
                bgp.add_run().add_picture(io.BytesIO(bg_png), width=Pt(W), height=Pt(H))
                _make_behind(bgp, OxmlElement, qn)
            prev_bottom: Optional[float] = None
            prev_baseline: Optional[float] = None
            first = True
            for _y, kind, it in items:
                if kind == "i":
                    im = it
                    try:
                        pil = PdfImage(im.obj).as_pil_image()
                        if pil.mode not in ("RGB", "L", "RGBA"):
                            pil = pil.convert("RGB")
                        buf = io.BytesIO()
                        pil.save(buf, "PNG" if pil.mode == "RGBA" else "JPEG", **({} if pil.mode == "RGBA" else {"quality": 92}))
                        buf.seek(0)
                    except Exception:
                        continue
                    par = dw.add_paragraph()
                    w_pt, h_pt = im.rect[2] - im.rect[0], im.rect[3] - im.rect[1]
                    par.add_run().add_picture(buf, width=Pt(w_pt), height=Pt(h_pt))
                    if frame_mode:
                        _frame(par, OxmlElement, qn, im.rect[0], im.rect[1], w_pt + 2, h_pt)
                    else:
                        par.paragraph_format.left_indent = Pt(max(0.0, im.rect[0] - ml))
                        sb = 0.0 if prev_bottom is None else max(0.0, im.rect[1] - prev_bottom)
                        par.paragraph_format.space_before = Pt(sb)
                        prev_bottom = im.rect[3]
                        prev_baseline = None
                    first = False
                    continue
                block = it
                bb = _block_bbox(block)
                stats = [_line_stats(ln) for ln in block]
                size = max(s[3] for s in stats)
                pitch = None
                if len(stats) >= 2:
                    ds = sorted(stats[i + 1][2] - stats[i][2] for i in range(len(stats) - 1))
                    pitch = ds[len(ds) // 2]
                if not pitch or pitch <= 0:
                    pitch = size * 1.2
                par = dw.add_paragraph()
                pf = par.paragraph_format
                pf.line_spacing_rule = WD_LINE_SPACING.EXACTLY
                pf.line_spacing = Pt(max(1.0, pitch))
                al = _align_of(block, W, ml, mr_x)
                par.alignment = {"left": WD_ALIGN_PARAGRAPH.LEFT, "center": WD_ALIGN_PARAGRAPH.CENTER,
                                 "right": WD_ALIGN_PARAGRAPH.RIGHT, "justify": WD_ALIGN_PARAGRAPH.JUSTIFY}[al]
                _add_runs(par, block, bb[0] if frame_mode else ml, Pt, RGBColor)
                if frame_mode:
                    _frame(par, OxmlElement, qn, bb[0], bb[1], (bb[2] - bb[0]) + 6, bb[3] - bb[1])
                else:
                    if al == "left":
                        pf.left_indent = Pt(max(0.0, bb[0] - ml))
                    elif al == "justify":
                        pf.left_indent = Pt(max(0.0, bb[0] - ml))
                        pf.right_indent = Pt(max(0.0, mr_x - bb[2]))
                    elif slack > 0:
                        pf.right_indent = Pt(slack)  # ortalı/sağa dayalı: pay kadar geri çek
                    # boşluk: taban çizgisi farkı − bu bloğun satır aralığı
                    first_base = stats[0][2]
                    if prev_baseline is not None:
                        pf.space_before = Pt(max(0.0, first_base - prev_baseline - pitch))
                    elif prev_bottom is not None:
                        pf.space_before = Pt(max(0.0, bb[1] - prev_bottom))
                    prev_baseline = stats[-1][2]
                    prev_bottom = bb[3]
                first = False
            if not items:
                dw.add_paragraph()
        if not any_text:
            return False
        dw.save(docx_path)
    finally:
        pdf.close()
    return os.path.isfile(docx_path) and os.path.getsize(docx_path) > 0


def _background_jpeg(page: Any, W: float, H: float) -> Optional[bytes]:
    """Sayfanın METİNSİZ görüntüsü (vektör şekiller + resimler) — Word'de metnin arkasına konur."""
    try:
        from src.pdfcore import PdfiumReader

        one = _pc.new_pdf()
        one.pages.append(page)
        _ct.remove_in_rects(one, one.pages[0], [(-5.0, -5.0, W + 5.0, H + 5.0)], text=True, paths=False, images=False)
        data = _pc.pdf_to_bytes(one)
        with PdfiumReader(data) as rd:
            im = rd.render(0, dpi=150.0).convert("RGB")
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=88)
        return buf.getvalue()
    except Exception:
        return None


def _make_behind(par: Any, OxmlElement: Any, qn: Any) -> None:
    """Paragraftaki satır içi resmi sayfaya (0,0) sabit, metnin ARKASINDA duran çapalı resme çevirir."""
    from lxml import etree

    run = par.runs[-1]._element
    inline = run.xpath(".//wp:inline")[0]
    WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
    ext = inline.find("{%s}extent" % WP)
    anchor = etree.SubElement(inline.getparent(), "{%s}anchor" % WP)
    for k, v in (("distT", "0"), ("distB", "0"), ("distL", "0"), ("distR", "0"), ("simplePos", "0"),
                 ("relativeHeight", "0"), ("behindDoc", "1"), ("locked", "0"), ("layoutInCell", "1"),
                 ("allowOverlap", "1")):
        anchor.set(k, v)
    sp = etree.SubElement(anchor, "{%s}simplePos" % WP); sp.set("x", "0"); sp.set("y", "0")
    for tag in ("positionH", "positionV"):
        pos = etree.SubElement(anchor, "{%s}%s" % (WP, tag))
        pos.set("relativeFrom", "page")
        off = etree.SubElement(pos, "{%s}posOffset" % WP)
        off.text = "0"
    anchor.append(ext)
    eff = etree.SubElement(anchor, "{%s}effectExtent" % WP)
    for k in ("l", "t", "r", "b"):
        eff.set(k, "0")
    etree.SubElement(anchor, "{%s}wrapNone" % WP)
    for child in list(inline):
        if child.tag in ("{%s}docPr" % WP, "{%s}cNvGraphicFramePr" % WP) or child.tag.endswith("}graphic"):
            anchor.append(child)
    inline.getparent().remove(inline)


def _shrink_section_paragraph(dw: Any, OxmlElement: Any, qn: Any) -> None:
    """Bölüm sonu taşıyan paragrafı 1 pt'ye indirir (sayfa taşması/fazladan sayfa olmasın)."""
    ps = dw.element.body.xpath("w:p[w:pPr/w:sectPr]")
    if not ps:
        return
    ppr = ps[-1].find(qn("w:pPr"))
    sp = OxmlElement("w:spacing")
    sp.set(qn("w:before"), "0")
    sp.set(qn("w:after"), "0")
    sp.set(qn("w:line"), "20")
    sp.set(qn("w:lineRule"), "exact")
    ppr.insert(0, sp)


def _frame(par: Any, OxmlElement: Any, qn: Any, x: float, y: float, w: float, h: float) -> None:
    """Paragrafı sayfada (x, y) konumuna sabitleyen çerçeve (w:framePr)."""
    ppr = par._element.get_or_add_pPr()
    fr = OxmlElement("w:framePr")
    fr.set(qn("w:w"), str(int(max(1.0, w) * _TWIP)))
    fr.set(qn("w:hRule"), "auto")
    fr.set(qn("w:hAnchor"), "page")
    fr.set(qn("w:vAnchor"), "page")
    fr.set(qn("w:x"), str(int(max(0.0, x) * _TWIP)))
    fr.set(qn("w:y"), str(int(max(0.0, y) * _TWIP)))
    fr.set(qn("w:wrap"), "notBeside")
    ppr.insert(0, fr)

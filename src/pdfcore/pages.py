"""Sayfa düzeyi işlemler: açma, ayıklama, sıralama, birleştirme, döndürme, yer imleri.

Motor: pikepdf (MPL-2.0, qpdf üzerine). PyMuPDF'in `insert_pdf` / `select` / `set_toc` işlerinin
karşılığı. Sayfa kaynakları (yazı tipi, görsel) kaynak belge başına BİR KEZ kopyalanır
(qpdf foreign-copy önbelleği) — aynı belgeden çok aralık alınca dosya şişmez.
"""

from __future__ import annotations

import io
import os
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union

import pikepdf

from .errors import (
    MSG_NEED_PASSWORD,
    MSG_WRONG_PASSWORD,
    PdfCoreError,
    PdfPasswordRequired,
    PdfPasswordWrong,
)

PdfSource = Union[str, "os.PathLike[str]", bytes]


def open_pdf(src: PdfSource, password: Optional[str] = None, **kwargs: Any) -> pikepdf.Pdf:
    """pikepdf.Pdf açar. Şifreliyse parola ister; hata iletileri eski (PyMuPDF) metinlerle aynı."""
    pwd = (password or "").strip()
    target: Any = io.BytesIO(src) if isinstance(src, (bytes, bytearray)) else os.fspath(src)
    try:
        return pikepdf.open(target, password=pwd, **kwargs)
    except pikepdf.PasswordError:
        if not pwd:
            raise PdfPasswordRequired(MSG_NEED_PASSWORD) from None
        raise PdfPasswordWrong(MSG_WRONG_PASSWORD) from None


def needs_password(src: PdfSource) -> bool:
    """Boş kullanıcı parolasıyla açılamıyorsa True (PyMuPDF `needs_pass` karşılığı)."""
    target: Any = io.BytesIO(src) if isinstance(src, (bytes, bytearray)) else os.fspath(src)
    try:
        with pikepdf.open(target, suppress_warnings=True):
            return False
    except pikepdf.PasswordError:
        return True


def page_count(src: PdfSource, password: Optional[str] = None) -> int:
    with open_pdf(src, password, suppress_warnings=True) as pdf:
        return len(pdf.pages)


def new_pdf() -> pikepdf.Pdf:
    return pikepdf.Pdf.new()


def save_pdf(
    pdf: pikepdf.Pdf,
    out_path: Union[str, "os.PathLike[str]"],
    *,
    compress: bool = True,
    linearize: bool = False,
    object_streams: bool = False,
) -> None:
    """Kaydeder. Kullanılmayan nesneler qpdf tarafından kendiliğinden atılır (garbage=3 karşılığı)."""
    kwargs: Dict[str, Any] = dict(compress_streams=compress, linearize=linearize)
    if object_streams:
        kwargs["object_stream_mode"] = pikepdf.ObjectStreamMode.generate
    pdf.save(os.fspath(out_path), **kwargs)


def pdf_to_bytes(pdf: pikepdf.Pdf, **kwargs: Any) -> bytes:
    buf = io.BytesIO()
    pdf.save(buf, **kwargs)
    return buf.getvalue()


# ── yer imleri (içindekiler) ────────────────────────────────────────────────
def _page_index_map(pdf: pikepdf.Pdf) -> Dict[Tuple[int, int], int]:
    return {tuple(p.objgen): i for i, p in enumerate(pdf.pages)}


def _resolve_named_dest(pdf: pikepdf.Pdf, name: Any) -> Any:
    key = str(name)
    try:
        dests = pdf.Root.get("/Dests")
        if dests is not None:
            v = dests.get(key if key.startswith("/") else "/" + key)
            if v is not None:
                return v.get("/D") if isinstance(v, pikepdf.Dictionary) else v
    except Exception:
        pass
    try:
        names = pdf.Root.get("/Names")
        if names is not None and "/Dests" in names:
            tree = pikepdf.NameTree(names.Dests)
            v = tree.get(key.lstrip("/")) if key.startswith("/") else tree.get(key)
            if v is None and key.startswith("/"):
                v = tree.get(key)
            if v is not None:
                return v.get("/D") if isinstance(v, pikepdf.Dictionary) else v
    except Exception:
        pass
    return None


def _dest_page_index(pdf: pikepdf.Pdf, item: Any, pmap: Dict[Tuple[int, int], int]) -> int:
    """Yer imi öğesinin hedef sayfa dizini (0 tabanlı); bulunamazsa -1."""
    dest = None
    try:
        dest = item.destination
        if dest is None and item.action is not None:
            act = item.action
            if str(act.get("/S", "")) == "/GoTo":
                dest = act.get("/D")
    except Exception:
        return -1
    if dest is None:
        return -1
    if isinstance(dest, (pikepdf.Name, pikepdf.String, str, bytes)):
        dest = _resolve_named_dest(pdf, dest)
        if dest is None:
            return -1
    try:
        first = dest[0]
    except Exception:
        return -1
    if isinstance(first, int):  # uzak (remote) hedef: sayfa dizini doğrudan
        return int(first)
    try:
        return pmap.get(tuple(first.objgen), -1)
    except Exception:
        return -1


def get_toc(pdf: pikepdf.Pdf) -> List[Tuple[int, str, int]]:
    """[(düzey, başlık, sayfa_1_tabanlı)] — düz liste (PyMuPDF get_toc(simple=True) karşılığı).
    Sayfaya çözülemeyen öğelerin sayfası -1'dir."""
    out: List[Tuple[int, str, int]] = []
    try:
        pmap = _page_index_map(pdf)
        with pdf.open_outline() as outline:

            def walk(items: Iterable[Any], level: int) -> None:
                for it in items:
                    try:
                        idx = _dest_page_index(pdf, it, pmap)
                        out.append((level, str(it.title), idx + 1 if idx >= 0 else -1))
                        walk(it.children, level + 1)
                    except Exception:
                        continue

            walk(outline.root, 1)
    except Exception:
        return []
    return out


def set_toc(pdf: pikepdf.Pdf, toc: Sequence[Sequence[Any]]) -> None:
    """[[düzey, başlık, sayfa_1_tabanlı], ...] yer imlerini yazar (mevcut olanların yerine).
    Düzey atlamaları (1 → 3) düzeltilir."""
    if not toc:
        return
    n = len(pdf.pages)
    with pdf.open_outline() as outline:
        outline.root.clear()
        stack: List[Tuple[int, List[pikepdf.OutlineItem]]] = [(0, outline.root)]
        prev_level = 0
        for lvl, title, page_no, *_ in toc:
            page_idx = int(page_no) - 1
            if page_idx < 0 or page_idx >= n:
                continue
            level = max(1, min(int(lvl), prev_level + 1))
            item = pikepdf.OutlineItem(str(title), page_idx)
            while stack and stack[-1][0] >= level:
                stack.pop()
            parent_children = stack[-1][1] if stack else outline.root
            parent_children.append(item)
            stack.append((level, item.children))
            prev_level = level


def transfer_outline(
    src: pikepdf.Pdf,
    dest: pikepdf.Pdf,
    source_pages: Sequence[int],
) -> None:
    """Kaynak yer imlerini yeni belgeye taşır. `source_pages[k]` = çıktının k'ıncı sayfasının
    kaynaktaki 0 tabanlı sayfası. Yalnız çıktıda kalan sayfalara işaret edenler yazılır.
    Hata olursa sessizce geçer — çıktı yer imsiz kalsa da geçerlidir."""
    try:
        old_to_new: Dict[int, int] = {}
        for new, old in enumerate(source_pages):
            old_to_new.setdefault(old, new)
        new_toc: List[List[Any]] = []
        prev = 0
        for lvl, title, page_no in get_toc(src):
            if page_no < 1:
                continue
            new = old_to_new.get(page_no - 1)
            if new is None:
                continue
            level = min(max(1, int(lvl)), prev + 1)
            prev = level
            new_toc.append([level, title, new + 1])
        if new_toc:
            set_toc(dest, new_toc)
    except Exception:
        pass


# ── sayfa kopyalama / seçme ─────────────────────────────────────────────────
def append_pages(dest: pikepdf.Pdf, src: pikepdf.Pdf, indices: Iterable[int]) -> None:
    """Kaynaktan belirtilen (0 tabanlı) sayfaları, verilen sırayla hedefin sonuna ekler."""
    for i in indices:
        dest.pages.append(src.pages[i])


def write_selected_pages(
    src: pikepdf.Pdf,
    out_path: Union[str, "os.PathLike[str]"],
    keep_indices: Sequence[int],
    *,
    carry_outline: bool = True,
    carry_docinfo: bool = True,
) -> int:
    """Açık kaynak belgeden `keep_indices` (0 tabanlı, SIRAYLA) sayfalarını yeni PDF olarak yazar.
    Silme, ayıklama ve yeniden sıralamanın ortak yolu. Yer imleri ve belge bilgisi (başlık,
    yazar…) taşınır. Dönen: yazılan sayfa sayısı."""
    n = len(src.pages)
    for i in keep_indices:
        if i < 0 or i >= n:
            raise PdfCoreError(f"Geçersiz sayfa dizini: {i}")
    out = new_pdf()
    try:
        append_pages(out, src, keep_indices)
        if carry_outline:
            transfer_outline(src, out, list(keep_indices))
        if carry_docinfo:
            try:
                for k, v in src.docinfo.items():
                    out.docinfo[k] = v
            except Exception:
                pass
        save_pdf(out, out_path)
    finally:
        out.close()
    return len(keep_indices)


def select_pages(
    src: PdfSource,
    out_path: Union[str, "os.PathLike[str]"],
    keep_indices: Sequence[int],
    password: Optional[str] = None,
    *,
    carry_outline: bool = True,
) -> int:
    """`write_selected_pages` için dosya yolu alan kısayol."""
    with open_pdf(src, password, suppress_warnings=True) as s:
        return write_selected_pages(s, out_path, keep_indices, carry_outline=carry_outline)


def merge_pdfs_pikepdf(
    paths: Sequence[str],
    out_path: Union[str, "os.PathLike[str]"],
    passwords: Optional[Dict[str, str]] = None,
) -> int:
    """Birden çok PDF'i sırayla birleştirir. Dönen: toplam sayfa."""
    passwords = passwords or {}
    out = new_pdf()
    srcs: List[pikepdf.Pdf] = []
    try:
        for p in paths:
            s = open_pdf(p, passwords.get(p), suppress_warnings=True)
            srcs.append(s)
            out.pages.extend(s.pages)
        total = len(out.pages)
        save_pdf(out, out_path)
        return total
    finally:
        for s in srcs:
            try:
                s.close()
            except Exception:
                pass
        out.close()


def _inherited(page: pikepdf.Page, key: str, default: Any = None) -> Any:
    """Sayfa özelliği (Rotate/MediaBox/CropBox...) — sayfada yoksa /Parent zincirinden miras alınır."""
    node = page.obj
    for _ in range(32):
        if key in node:
            return node[key]
        parent = node.get("/Parent")
        if parent is None:
            break
        node = parent
    return default


def page_rotation(page: pikepdf.Page) -> int:
    return int(_inherited(page, "/Rotate", 0)) % 360


def rotate_page(page: pikepdf.Page, add_degrees: int) -> None:
    """Sayfanın mevcut döndürmesine `add_degrees` (90'ın katı) ekler."""
    page.obj["/Rotate"] = (page_rotation(page) + int(add_degrees)) % 360


def page_box(page: pikepdf.Page) -> Tuple[float, float, float, float]:
    """Sayfanın görünür kutusu (CropBox yoksa MediaBox), normalize: (x0, y0, x1, y1), x0<x1, y0<y1."""
    box = _inherited(page, "/CropBox") or _inherited(page, "/MediaBox")
    if box is None:
        return (0.0, 0.0, 612.0, 792.0)
    x0, y0, x1, y1 = (float(v) for v in box)
    return (min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))


def page_visual_size(page: pikepdf.Page) -> Tuple[float, float]:
    """Sayfanın GÖRÜNEN genişlik × yükseklik (CropBox + /Rotate uygulanmış), punto."""
    x0, y0, x1, y1 = page_box(page)
    w, h = x1 - x0, y1 - y0
    return (h, w) if page_rotation(page) in (90, 270) else (w, h)


def add_image_page(
    pdf: pikepdf.Pdf,
    jpeg_bytes: bytes,
    width_px: int,
    height_px: int,
    page_w: float,
    page_h: float,
    *,
    gray: bool = False,
) -> pikepdf.Page:
    """JPEG baytlarını (yeniden kodlamadan, DCTDecode olarak) `page_w` × `page_h` punto büyüklüğünde
    yeni bir sayfaya tam sayfa yerleştirir. Sıkıştırma / taranmış-belge üretiminin ortak yapı taşı."""
    img = pikepdf.Stream(pdf, jpeg_bytes)
    img["/Type"] = pikepdf.Name.XObject
    img["/Subtype"] = pikepdf.Name.Image
    img["/Width"] = int(width_px)
    img["/Height"] = int(height_px)
    img["/ColorSpace"] = pikepdf.Name.DeviceGray if gray else pikepdf.Name.DeviceRGB
    img["/BitsPerComponent"] = 8
    img["/Filter"] = pikepdf.Name.DCTDecode
    pdf.add_blank_page(page_size=(float(page_w), float(page_h)))
    page = pdf.pages[len(pdf.pages) - 1]
    page.obj["/Resources"] = pikepdf.Dictionary(XObject=pikepdf.Dictionary(Im0=img))
    page.obj["/Contents"] = pdf.make_stream(f"q {page_w:.4f} 0 0 {page_h:.4f} 0 0 cm /Im0 Do Q\n".encode("ascii"))
    return page


def place_page(
    dest: pikepdf.Pdf,
    dest_page: pikepdf.Page,
    src: pikepdf.Pdf,
    src_index: int,
    rect: Tuple[float, float, float, float],
    *,
    keep_proportion: bool = True,
) -> None:
    """Kaynak sayfayı (vektör olarak, form nesnesi biçiminde) hedef sayfadaki `rect` kutusuna yerleştirir
    (PyMuPDF `show_pdf_page` karşılığı). `rect` = ÜST-SOL başlangıçlı (x0, y0, x1, y1), punto;
    hedef sayfa döndürülmemiş olmalı (yeni oluşturulmuş sayfa). keep_proportion → oran korunur ve
    kutuda ortalanır. Kaynak sayfanın /Rotate ve CropBox değerleri uygulanır."""
    form = src.pages[src_index].as_form_xobject()
    m = [float(v) for v in form.get("/Matrix", [1, 0, 0, 1, 0, 0])]
    bx0, by0, bx1, by1 = (float(v) for v in form.BBox)
    xs, ys = [], []
    for px, py in ((bx0, by0), (bx1, by0), (bx0, by1), (bx1, by1)):
        xs.append(m[0] * px + m[2] * py + m[4])
        ys.append(m[1] * px + m[3] * py + m[5])
    tx0, ty0, tx1, ty1 = min(xs), min(ys), max(xs), max(ys)
    tw, th = tx1 - tx0, ty1 - ty0
    if tw <= 0 or th <= 0:
        raise PdfCoreError("Kaynak sayfa boyutu geçersiz.")
    _dx0, _dy0, _dx1, dy1 = page_box(dest_page)
    hd = dy1 - _dy0
    rx0, ry0, rx1, ry1 = rect
    X0, X1 = rx0, rx1
    Y0, Y1 = hd - ry1, hd - ry0  # PDF uzayı (y yukarı)
    bw, bh = X1 - X0, Y1 - Y0
    if keep_proportion:
        s = min(bw / tw, bh / th)
        sx = sy = s
        ox = X0 + (bw - tw * s) / 2.0
        oy = Y0 + (bh - th * s) / 2.0
    else:
        sx, sy = bw / tw, bh / th
        ox, oy = X0, Y0
    e = ox - sx * tx0
    f = oy - sy * ty0
    foreign = dest.copy_foreign(form)
    name = dest_page.add_resource(foreign, pikepdf.Name.XObject, prefix="NbPg")
    cmd = f"q {sx:.6f} 0 0 {sy:.6f} {e:.6f} {f:.6f} cm {name} Do Q\n"
    dest_page.contents_add(pikepdf.Stream(dest, cmd.encode("ascii")), prepend=False)


def remove_rotation(pdf: pikepdf.Pdf, page: pikepdf.Page) -> bool:
    """/Rotate'li sayfayı GÖRÜNÜMÜ KORUYARAK rotasyonsuz yapar (içerik döndürülür, kutular yenilenir).
    Düzenleme/analiz aynı koordinat uzayında çalışsın diye. Döndürme yoksa False."""
    from .overlay import visual_to_user_matrix

    rot = page_rotation(page)
    box_changed = False
    x0, y0, x1, y1 = page_box(page)
    if rot == 0 and not (x0 or y0):
        return False
    u = visual_to_user_matrix(page)
    det = u[0] * u[3] - u[1] * u[2]
    a, b, c, d = u[3] / det, -u[1] / det, -u[2] / det, u[0] / det
    e = -(u[4] * a + u[5] * c)
    f = -(u[4] * b + u[5] * d)
    w, h = page_visual_size(page)
    cmd = f"q {a:.8f} {b:.8f} {c:.8f} {d:.8f} {e:.8f} {f:.8f} cm\n".encode("ascii")
    page.contents_add(pikepdf.Stream(pdf, cmd), prepend=True)
    page.contents_add(pikepdf.Stream(pdf, b"\nQ\n"), prepend=False)
    page.obj["/MediaBox"] = pikepdf.Array([0, 0, w, h])
    for k in ("/CropBox", "/TrimBox", "/BleedBox", "/ArtBox"):
        if k in page.obj:
            del page.obj[k]
    page.obj["/Rotate"] = 0
    try:
        for an in page.obj.get("/Annots", []):
            r = an.get("/Rect")
            if r is None:
                continue
            xs = [float(r[0]), float(r[2])]
            ys = [float(r[1]), float(r[3])]
            pts = [(a * x + c * y + e, b * x + d * y + f) for x in xs for y in ys]
            an["/Rect"] = pikepdf.Array([min(p_[0] for p_ in pts), min(p_[1] for p_ in pts),
                                          max(p_[0] for p_ in pts), max(p_[1] for p_ in pts)])
    except Exception:
        pass
    return True

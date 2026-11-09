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


def select_pages(
    src: PdfSource,
    out_path: Union[str, "os.PathLike[str]"],
    keep_indices: Sequence[int],
    password: Optional[str] = None,
    *,
    carry_outline: bool = True,
) -> int:
    """Kaynaktan `keep_indices` (0 tabanlı, SIRAYLA) sayfalarını yeni PDF olarak yazar.
    Silme, ayıklama ve yeniden sıralamanın ortak yolu. Dönen: yazılan sayfa sayısı."""
    with open_pdf(src, password, suppress_warnings=True) as s:
        n = len(s.pages)
        for i in keep_indices:
            if i < 0 or i >= n:
                raise PdfCoreError(f"Geçersiz sayfa dizini: {i}")
        out = new_pdf()
        try:
            append_pages(out, s, keep_indices)
            if carry_outline:
                transfer_outline(s, out, list(keep_indices))
            save_pdf(out, out_path)
        finally:
            out.close()
        return len(keep_indices)


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

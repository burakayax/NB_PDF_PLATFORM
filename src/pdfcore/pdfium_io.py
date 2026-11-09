"""Sayfa görüntüleme / metin okuma / sayfa bilgisi — PDFium (pypdfium2) üzerinden.

Lisans: pypdfium2 = Apache-2.0 / BSD-3-Clause, PDFium = BSD-3-Clause.

ÖNEMLİ — İŞ PARÇACIĞI GÜVENLİĞİ: PDFium iş parçacığı güvenli DEĞİLDİR (pypdfium2 belgesi:
"not allowed to call pdfium functions simultaneously across different threads, not even with
different documents"). Bu yüzden her PDFium çağrısı tek bir süreç-geneli kilit altında yapılır.
Üretimde her ağır iş zaten ayrı bir süreçte (pdf_sandbox, fork) koşar; kilit, Windows
geliştirme ortamındaki iş parçacığı havuzunu ve masaüstü uygulamasını korur.
`fork` sonrası çocuk süreçte kilit sıfırlanır (başka bir iş parçacığı kilidi tutarken fork
edilmişse çocuk sonsuza dek beklemesin).
"""

from __future__ import annotations

import io
import os
import threading
from typing import Any, List, Optional, Sequence, Tuple, Union

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
from PIL import Image

from .errors import (
    MSG_NEED_PASSWORD,
    MSG_WRONG_PASSWORD,
    PdfCoreError,
    PdfPasswordRequired,
    PdfPasswordWrong,
)

PdfSource = Union[str, "os.PathLike[str]", bytes]

_LOCK = threading.RLock()


def _reset_lock_after_fork() -> None:  # pragma: no cover - yalnız POSIX fork
    global _LOCK
    _LOCK = threading.RLock()


if hasattr(os, "register_at_fork"):
    os.register_at_fork(after_in_child=_reset_lock_after_fork)


def pdfium_lock() -> "threading.RLock":
    """Başka PDFium çağıran kod (ör. editör) aynı kilidi kullanabilsin diye."""
    return _LOCK


def _normalize_text(txt: str) -> str:
    """PDFium satır sonlarını '\\r\\n' verir; eski davranış ('\\n') korunur."""
    return (txt or "").replace("\r\n", "\n").replace("\r", "\n")


def _load_document(src: PdfSource, password: Optional[str]) -> "pdfium.PdfDocument":
    """PdfDocument açar; parola hatalarını Türkçe, eski metinlerle yükseltir."""
    pwd = (password or "").strip() or None
    try:
        return pdfium.PdfDocument(os.fspath(src) if not isinstance(src, bytes) else src, password=pwd)
    except pdfium.PdfiumError as e:
        if getattr(e, "err_code", None) == pdfium_c.FPDF_ERR_PASSWORD:
            if not pwd:
                raise PdfPasswordRequired(MSG_NEED_PASSWORD) from None
            raise PdfPasswordWrong(MSG_WRONG_PASSWORD) from None
        code = getattr(e, "err_code", None)
        raise PdfCoreError(
            f"PDF açılamadı: {e}",
            corrupt=code in (pdfium_c.FPDF_ERR_FORMAT, pdfium_c.FPDF_ERR_FILE),
        ) from e
    except FileNotFoundError:
        raise


class PdfiumReader:
    """Bir PDF'i açık tutar; sayfa görüntüsü, metin, boyut ve görsel sayısı verir.

    Kullanım::

        with PdfiumReader(path, password) as r:
            for i in range(r.page_count):
                img = r.render(i, dpi=200)

    Her yöntem kilidi KENDİ süresince tutar; yöntemler arasında bırakır (uzun bir döngüde
    başka bir iş parçacığı araya girebilir ama asla aynı anda PDFium çağrılmaz).
    """

    def __init__(self, src: PdfSource, password: Optional[str] = None) -> None:
        with _LOCK:
            self._doc = _load_document(src, password)
            self.page_count = len(self._doc)

    # ── yaşam döngüsü ────────────────────────────────────────────────
    def close(self) -> None:
        with _LOCK:
            doc, self._doc = getattr(self, "_doc", None), None
            if doc is not None:
                try:
                    doc.close()
                except Exception:
                    pass

    def __enter__(self) -> "PdfiumReader":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    def __len__(self) -> int:
        return self.page_count

    def _page(self, index: int) -> "pdfium.PdfPage":
        if self._doc is None:
            raise PdfCoreError("PDF kapalı.")
        if index < 0 or index >= self.page_count:
            raise IndexError(f"Sayfa dizini aralık dışı: {index}")
        return self._doc[index]

    # ── boyut ────────────────────────────────────────────────────────
    def page_size(self, index: int) -> Tuple[float, float]:
        """Sayfanın GÖRÜNEN (döndürme uygulanmış) genişlik × yüksekliği, punto cinsinden."""
        with _LOCK:
            page = self._page(index)
            try:
                w, h = page.get_size()
                return float(w), float(h)
            finally:
                page.close()

    # ── görüntü ──────────────────────────────────────────────────────
    def render(
        self,
        index: int,
        scale: Optional[float] = None,
        *,
        dpi: Optional[float] = None,
        grayscale: bool = False,
        crop: Optional[Tuple[float, float, float, float]] = None,
    ) -> Image.Image:
        """Sayfayı PIL görüntüsüne çevirir (beyaz zemin, saydamlık yok).

        scale: 1.0 = 72 DPI. dpi verilirse scale = dpi / 72.
        grayscale: True → "L" kipinde gri tonlama görüntü.
        crop: (x0, y0, x1, y1) — GÖRÜNEN sayfa koordinatında (üst-sol başlangıç, punto) kırpma
              penceresi; yalnız o bölge çizilir (büyük sayfada bellek tasarrufu).
        """
        if scale is None:
            scale = (float(dpi) / 72.0) if dpi else 1.0
        with _LOCK:
            page = self._page(index)
            try:
                kwargs: dict = dict(scale=float(scale), may_draw_forms=False)
                if grayscale:
                    kwargs["grayscale"] = True
                if crop is not None:
                    pw, ph = page.get_size()
                    x0, y0, x1, y1 = (float(v) for v in crop)
                    x0, x1 = max(0.0, min(x0, x1)), min(pw, max(x0, x1))
                    y0, y1 = max(0.0, min(y0, y1)), min(ph, max(y0, y1))
                    # pypdfium2 crop = (sol, alt, sağ, üst) kenarlardan KESİLEN miktar.
                    kwargs["crop"] = (x0, ph - y1, pw - x1, y0)
                bitmap = page.render(**kwargs)
                img = bitmap.to_pil()
                if grayscale and img.mode != "L":
                    img = img.convert("L")
                elif not grayscale and img.mode != "RGB":
                    img = img.convert("RGB")
                return img
            finally:
                page.close()

    # ── metin ────────────────────────────────────────────────────────
    def text(self, index: int) -> str:
        """Sayfanın düz metni (satır sonları '\\n')."""
        with _LOCK:
            page = self._page(index)
            try:
                tp = page.get_textpage()
                try:
                    return _normalize_text(tp.get_text_range())
                finally:
                    tp.close()
            finally:
                page.close()

    def text_len(self, index: int) -> int:
        """Boşluk dışı karakter sayısı (taranmış/dijital ayrımı için)."""
        return len("".join(self.text(index).split()))

    def search_rects(self, index: int, term: str, match_case: bool = False) -> List[Tuple[float, float, float, float]]:
        """Sayfada `term` geçtiği yerlerin kutuları (x0, y0, x1, y1) — GÖRÜNEN koordinat, üst-sol
        başlangıç, punto. (PyMuPDF `search_for` karşılığı; çok satırlı eşleşmede her satır ayrı kutu.)
        Sayfada /Rotate yoksa ve kutu başlangıcı (0,0) ise koordinatlar doğrudan örtüşür."""
        out: List[Tuple[float, float, float, float]] = []
        if not term:
            return out
        with _LOCK:
            page = self._page(index)
            try:
                _w, h = page.get_size()
                tp = page.get_textpage()
                try:
                    searcher = tp.search(term, match_case=match_case)
                    try:
                        while True:
                            hit = searcher.get_next()
                            if hit is None:
                                break
                            start, count = hit
                            line: Optional[List[float]] = None
                            last_y = None
                            for ci in range(start, start + count):
                                l, b, r, t = tp.get_charbox(ci)
                                if r <= l or t <= b:
                                    continue
                                if line is not None and abs(((b + t) / 2) - (line[1] + line[3]) / 2) > max(line[3] - line[1], t - b) * 0.8:
                                    out.append((line[0], h - line[3], line[2], h - line[1]))
                                    line = None
                                if line is None:
                                    line = [l, b, r, t]
                                else:
                                    line = [min(line[0], l), min(line[1], b), max(line[2], r), max(line[3], t)]
                                last_y = (b + t) / 2
                            if line is not None:
                                out.append((line[0], h - line[3], line[2], h - line[1]))
                    finally:
                        searcher.close()
                finally:
                    tp.close()
            finally:
                page.close()
        return out

    # ── görseller ────────────────────────────────────────────────────
    def image_count(self, index: int) -> int:
        """Sayfadaki (form içindekiler dahil) görsel nesnesi sayısı."""
        with _LOCK:
            page = self._page(index)
            try:
                n = 0
                for _o in page.get_objects(filter=(pdfium_c.FPDF_PAGEOBJ_IMAGE,)):
                    n += 1
                return n
            finally:
                page.close()

    def has_images(self, index: int) -> bool:
        with _LOCK:
            page = self._page(index)
            try:
                for _o in page.get_objects(filter=(pdfium_c.FPDF_PAGEOBJ_IMAGE,)):
                    return True
                return False
            finally:
                page.close()


# ── tek seferlik yardımcılar ─────────────────────────────────────────────
def render_pdf_pages(
    src: PdfSource,
    password: Optional[str] = None,
    *,
    scale: Optional[float] = None,
    dpi: Optional[float] = None,
    pages: Optional[Sequence[int]] = None,
    grayscale: bool = False,
):
    """Sayfaları sırayla üreten üreteç: (sayfa_indeksi, PIL görüntüsü). Bellek tek sayfalık kalır."""
    with PdfiumReader(src, password) as r:
        idxs = list(pages) if pages is not None else range(r.page_count)
        for i in idxs:
            yield i, r.render(i, scale, dpi=dpi, grayscale=grayscale)


def pdfium_page_count(src: PdfSource, password: Optional[str] = None) -> int:
    """PDFium ile sayfa sayısı (pypdf/pikepdf okuyamazsa dayanıklı yedek)."""
    with PdfiumReader(src, password) as r:
        return r.page_count


def pdfium_text_stats(src: PdfSource, password: Optional[str] = None) -> Tuple[int, int]:
    """(sayfa sayısı, toplam metin uzunluğu) — taranmış PDF ayrımı için."""
    with PdfiumReader(src, password) as r:
        total = 0
        for i in range(r.page_count):
            total += len(r.text(i))
        return r.page_count, total


def pdfium_merge(
    paths: Sequence[str],
    out_path: Union[str, "os.PathLike[str]"],
    passwords: Optional[dict] = None,
    on_progress=None,
) -> int:
    """Birden çok PDF'i PDFium ile birleştirir (pikepdf'in okuyamadığı dosyalar için yedek yol).
    `on_progress(k, toplam, yol)` her kaynak aktarıldıktan sonra çağrılır; False dönerse iptal.
    Dönen: toplam sayfa."""
    passwords = passwords or {}
    with _LOCK:
        out = pdfium.PdfDocument.new()
        opened: List[Any] = []
        try:
            for k, p in enumerate(paths, 1):
                src = _load_document(p, passwords.get(p))
                opened.append(src)
                out.import_pages(src)
                if on_progress is not None and on_progress(k, len(paths), p) is False:
                    raise PdfCoreError("İşlem iptal edildi.")
            out.save(os.fspath(out_path))
            return len(out)
        finally:
            for d in opened:
                try:
                    d.close()
                except Exception:
                    pass
            try:
                out.close()
            except Exception:
                pass

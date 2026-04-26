"""
Ek PDF araçları (sayfa yönetimi, dönüşüm, güvenlik).
pymupdf (fitz), pikepdf, PyPDF2 ve mevcut pdf_engine yardımcılarıyla.
"""

from __future__ import annotations

import io
import os
import shutil
import tempfile
import zipfile
from typing import List, Optional

import fitz

# pdf_engine'den parola açma
from src.pdf_engine import _open_pdf_reader, extract_pages, is_pdf_encrypted, get_num_pages


def _fitz_open(pdf_path: str, password: Optional[str] = None):
    doc = fitz.open(pdf_path)
    if doc.needs_pass:
        if not (password or "").strip():
            raise Exception("Şifreli PDF için parola gerekli.")
        if not doc.authenticate(password or ""):
            raise Exception("Girilen PDF parolası hatalı.")
    return doc


def delete_pages_pdf(
    pdf_path: str,
    output_path: str,
    pages_to_delete: List[int],
    password: Optional[str] = None,
) -> bool:
    """1 tabanlı sayfa numaralarını listeden çıkarılmış yeni PDF üretir."""
    n = get_num_pages(pdf_path, password=password)
    s = set(pages_to_delete)
    keep = [p for p in range(1, n + 1) if p not in s]
    if not keep:
        raise Exception("Tüm sayfalar silinemez; en az bir sayfa kalmalıdır.")
    return extract_pages(pdf_path, keep, output_path, password=password)


def rotate_pdf(
    pdf_path: str,
    output_path: str,
    degrees: int,
    pages_1based: Optional[List[int]],
    password: Optional[str] = None,
) -> bool:
    """degrees: 90, 180 veya 270. pages_1based None ise tüm sayfalar."""
    if degrees not in (90, 180, 270):
        raise Exception("Dönüş açısı 90, 180 veya 270 olmalıdır.")
    doc = _fitz_open(pdf_path, password=password)
    try:
        n = doc.page_count
        targets = [p - 1 for p in (pages_1based or list(range(1, n + 1)))]
        for i in targets:
            if i < 0 or i >= n:
                continue
            page = doc[i]
            cur = int(page.rotation) % 360
            page.set_rotation((cur + degrees) % 360)
        # normalize rotation into redacted box — fitz applies visually
        doc.save(output_path, garbage=4, deflate=True, linear=True)
    finally:
        doc.close()
    return True


def organize_pdf(
    pdf_path: str,
    output_path: str,
    new_order_1based: List[int],
    password: Optional[str] = None,
) -> bool:
    """Sayfaları yeni sıraya göre düzenler (ör. [3,1,2])."""
    n = get_num_pages(pdf_path, password=password)
    for p in new_order_1based:
        if p < 1 or p > n:
            raise Exception(f"Geçersiz sayfa: {p} (1–{n})")
    if len(new_order_1based) != n:
        raise Exception("Sıra listesi, tüm sayfaları tam olarak bir kez içermelidir.")
    if len(set(new_order_1based)) != n:
        raise Exception("Aynı sayfa iki kez kullanılamaz.")
    src = _fitz_open(pdf_path, password=password)
    out = fitz.open()
    try:
        for p in new_order_1based:
            out.insert_pdf(src, from_page=p - 1, to_page=p - 1)
        out.save(output_path, garbage=4, deflate=True, linear=True)
    finally:
        out.close()
        src.close()
    return True


def unlock_pdf_pikepdf(input_path: str, output_path: str, password: str) -> bool:
    """Kullanıcı parolası ile açıp şifresiz PDF kaydeder."""
    try:
        import pikepdf
    except ImportError as e:
        raise Exception("pikepdf gerekli.") from e
    if not (password or "").strip():
        raise Exception("PDF şifresini girmeniz gerekir.")
    if not is_pdf_encrypted(input_path):
        shutil.copy2(input_path, output_path)
        return True
    with pikepdf.open(input_path, password=password.strip(), allow_overwriting_input=False) as pdf:
        pdf.save(output_path, linearize=True)
    return True


def add_watermark_text(
    input_path: str,
    output_path: str,
    text: str,
    opacity: float = 0.12,
    password: Optional[str] = None,
) -> bool:
    if not (text or "").strip():
        raise Exception("Filigran metni boş olamaz.")
    _ = max(0.01, min(0.5, float(opacity)))
    doc = _fitz_open(input_path, password=password)
    try:
        for i in range(doc.page_count):
            page = doc[i]
            r = page.rect
            c = (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2
            page.insert_text(
                c,
                text,
                fontsize=22,
                color=(0.55, 0.55, 0.55),
                render_mode=0,
            )
        doc.save(output_path, garbage=4, deflate=True, linear=True)
    finally:
        doc.close()
    return True


def add_page_numbers(
    input_path: str,
    output_path: str,
    start_at: int = 1,
    position: str = "footer",
    password: Optional[str] = None,
) -> bool:
    doc = _fitz_open(input_path, password=password)
    try:
        num = start_at
        for i in range(doc.page_count):
            page = doc[i]
            r = page.rect
            label = str(num)
            if position == "header":
                p = (r.width / 2 - 10, 24)
            else:
                p = (r.width / 2 - 10, r.height - 30)
            page.insert_text(p, label, fontsize=9, color=(0, 0, 0))
            num += 1
        doc.save(output_path, garbage=4, deflate=True, linear=True)
    finally:
        doc.close()
    return True


def repair_pdf(input_path: str, output_path: str, password: Optional[str] = None) -> bool:
    try:
        import pikepdf
    except ImportError as e:
        raise Exception("pikepdf gerekli.") from e
    op = (password or "").strip()
    try:
        with pikepdf.open(input_path, password=op or None) as pdf:
            pdf.save(output_path, linearize=True, compress_streams=True)
    except Exception as e1:
        try:
            doc = _fitz_open(input_path, password=password)
            try:
                doc.save(output_path, garbage=3, deflate=True, clean=True)
            finally:
                doc.close()
        except Exception as e2:
            raise Exception(f"Onarma başarısız: {e1} / {e2}") from e1
    return True


def pdf_to_images_zip(
    pdf_path: str,
    workdir: str,
    image_format: str = "jpg",
    dpi: int = 150,
    password: Optional[str] = None,
) -> str:
    """ZIP dosya yolunu döndürür; pdf2image + Poppler gerekir."""
    from pdf2image import convert_from_path

    fmt = (image_format or "jpg").lower()
    if fmt not in ("jpg", "jpeg", "png"):
        raise Exception("Görüntü formatı jpg veya png olmalıdır.")
    ext = "png" if fmt == "png" else "jpg"
    # Poppler: pdf_engine poppler yolu
    import src.pdf_engine as pe

    poppler = getattr(pe, "poppler_bin_path", None) or None
    kwargs = {"dpi": dpi, "fmt": "png" if ext == "png" else "jpeg"}
    if poppler and os.path.isdir(poppler):
        kwargs["poppler_path"] = poppler
    _open_pdf_reader(pdf_path, password=password)  # validate password
    images = convert_from_path(pdf_path, **kwargs)
    zip_path = os.path.join(workdir, "sayfalar.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, im in enumerate(images, start=1):
            buf = io.BytesIO()
            if ext == "png":
                im.save(buf, format="PNG")
                name = f"page_{i:04d}.png"
            else:
                im.save(buf, format="JPEG", quality=90)
                name = f"page_{i:04d}.jpg"
            zf.writestr(name, buf.getvalue())
    return zip_path


def images_to_pdf(image_paths: List[str], output_path: str) -> bool:
    try:
        import img2pdf
    except ImportError:
        merged = fitz.open()
        try:
            for p in image_paths:
                imgdoc = fitz.open(p)
                try:
                    pdfb = imgdoc.convert_to_pdf()
                finally:
                    imgdoc.close()
                m = fitz.open("pdf", pdfb)
                try:
                    merged.insert_pdf(m)
                finally:
                    m.close()
            merged.save(output_path, garbage=4, deflate=True)
        finally:
            merged.close()
        return True
    with open(output_path, "wb") as f:
        f.write(img2pdf.convert(image_paths))
    return True


def html_to_pdf_file(html: str, output_path: str, base_url: Optional[str] = None) -> bool:
    try:
        from xhtml2pdf import pisa
    except ImportError as e:
        raise Exception("HTML→PDF için 'xhtml2pdf' gerekli: pip install xhtml2pdf") from e
    with open(output_path, "wb") as out:
        status = pisa.CreatePDF(
            src=io.StringIO(html),
            dest=out,
            path_base=base_url or None,
        )
    if status.err:
        raise Exception("HTML PDF'e dönüştürülemedi.")
    return True


def html_url_to_pdf(url: str, output_path: str) -> bool:
    import httpx

    u = (url or "").strip()
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    r = httpx.get(u, timeout=60.0, follow_redirects=True)
    r.raise_for_status()
    ct = r.headers.get("content-type", "")
    if "html" not in ct.lower() and "text" not in ct.lower() and "application" not in ct.lower():
        pass
    return html_to_pdf_file(r.text, output_path, base_url=u)


def pdf_to_pptx(pdf_path: str, pptx_path: str, password: Optional[str] = None, dpi: int = 120) -> bool:
    from pdf2image import convert_from_path
    from pptx import Presentation
    from pptx.util import Inches, Emu
    import src.pdf_engine as pe

    poppler = getattr(pe, "poppler_bin_path", None) or None
    kw = {"dpi": dpi, "fmt": "png"}
    if poppler and os.path.isdir(poppler):
        kw["poppler_path"] = poppler
    _open_pdf_reader(pdf_path, password=password)
    images = convert_from_path(pdf_path, **kw)
    prs = Presentation()
    try:
        blank = prs.slide_layouts[6]
    except (IndexError, KeyError):
        blank = prs.slide_layouts[0]
    for im in images:
        slide = prs.slides.add_slide(blank)
        fd, tmp = tempfile.mkstemp(suffix=".png")
        os.close(fd)
        try:
            im.save(tmp, "PNG")
            slide.shapes.add_picture(tmp, 0, 0, width=prs.slide_width, height=prs.slide_height)
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass
    prs.save(pptx_path)
    return True


def pptx_to_pdf(pptx_path: str, pdf_path: str) -> bool:
    if os.name == "nt":
        try:
            import pythoncom
            from win32com.client import DispatchEx

            pythoncom.CoInitialize()
            app = None
            try:
                app = DispatchEx("PowerPoint.Application")
                app.Visible = False
                pres = app.Presentations.Open(os.path.abspath(pptx_path), WithWindow=False)
                out = os.path.abspath(pdf_path)
                pres.SaveAs(out, 32)  # ppSaveAsPDF
                pres.Close()
            finally:
                if app:
                    app.Quit()
            return os.path.isfile(pdf_path)
        except Exception as e:
            raise Exception(f"PowerPoint PDF dışa aktarma hatası (Windows gerekir): {e}") from e
    raise Exception("PPTX→PDF dışa aktarma yalnızca Windows + PowerPoint kurulumunda desteklenir.")

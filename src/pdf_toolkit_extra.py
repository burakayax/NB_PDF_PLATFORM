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
from typing import Dict, List, Optional

import fitz

# pdf_engine'den parola açma
from src.pdf_engine import _open_pdf_reader, is_pdf_encrypted, get_num_pages

# Web SaaS: single quality tier (DPI not user-configurable).
PDF_EXPORT_DPI_WEB = 300
_RASTER_PAGE_BATCH = 6


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
    """İstenen sayfaları kaynakta silerek tek geçişte kaydeder (büyük PDF’lerde insert_pdf döngüsünden çok daha verimli)."""
    n = get_num_pages(pdf_path, password=password)
    to_del = {int(p) for p in pages_to_delete}
    if any(p < 1 or p > n for p in to_del):
        raise Exception("Geçersiz sayfa numarası.")
    if len(to_del) >= n:
        raise Exception("Tüm sayfalar silinemez; en az bir sayfa kalmalıdır.")
    doc = _fitz_open(pdf_path, password=password)
    try:
        for p in sorted(to_del, reverse=True):
            doc.delete_page(p - 1)
        doc.save(output_path, garbage=4, deflate=True, linear=False)
    finally:
        doc.close()
    return True


def rotate_pdf(
    pdf_path: str,
    output_path: str,
    degrees: int,
    pages_1based: Optional[List[int]],
    password: Optional[str] = None,
    per_page_degrees: Optional[Dict[int, int]] = None,
) -> bool:
    """Rotate pages. Use either legacy (degrees + pages_1based) or per_page_degrees (1-based page -> add 90/180/270)."""
    doc = _fitz_open(pdf_path, password=password)
    try:
        n = doc.page_count
        if per_page_degrees is not None:
            for p in range(1, n + 1):
                add_deg = int(per_page_degrees.get(p, 0))
                if add_deg == 0:
                    continue
                if add_deg not in (90, 180, 270):
                    raise Exception("Sayfa başına dönüş yalnızca 90, 180 veya 270 olabilir.")
                page = doc[p - 1]
                cur = int(page.rotation) % 360
                page.set_rotation((cur + add_deg) % 360)
        else:
            if degrees not in (90, 180, 270):
                raise Exception("Dönüş açısı 90, 180 veya 270 olmalıdır.")
            targets = [p - 1 for p in (pages_1based or list(range(1, n + 1)))]
            for i in targets:
                if i < 0 or i >= n:
                    continue
                page = doc[i]
                cur = int(page.rotation) % 360
                page.set_rotation((cur + degrees) % 360)
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
    op = max(0.01, min(0.5, float(opacity)))
    doc = _fitz_open(input_path, password=password)
    try:
        for i in range(doc.page_count):
            page = doc[i]
            r = page.rect
            c = fitz.Point((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
            page.insert_text(
                c,
                (text or "").strip(),
                fontsize=22,
                color=(0.55, 0.55, 0.55),
                render_mode=0,
                fill_opacity=op,
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
        num = int(start_at)
        for i in range(doc.page_count):
            page = doc[i]
            r = page.rect
            label = str(num)
            if position == "header":
                pt = fitz.Point(r.x0 + r.width / 2, r.y0 + 20)
            else:
                pt = fitz.Point(r.x0 + r.width / 2, r.y1 - 18)
            page.insert_text(pt, label, fontsize=9, color=(0, 0, 0))
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
    dpi: int = PDF_EXPORT_DPI_WEB,
    password: Optional[str] = None,
) -> str:
    """ZIP dosya yolunu döndürür; pdf2image + Poppler gerekir. Sayfalar partiler halinde rasterize edilir (bellek)."""
    from pdf2image import convert_from_path

    fmt = (image_format or "jpg").lower()
    if fmt not in ("jpg", "jpeg", "png"):
        raise Exception("Görüntü formatı jpg veya png olmalıdır.")
    ext = "png" if fmt == "png" else "jpg"
    import src.pdf_engine as pe

    poppler = getattr(pe, "poppler_bin_path", None) or None
    kw_base: dict = {"dpi": int(dpi), "fmt": "png" if ext == "png" else "jpeg"}
    if poppler and os.path.isdir(poppler):
        kw_base["poppler_path"] = poppler
    pwd = (password or "").strip()
    if pwd:
        kw_base["userpw"] = pwd
    _open_pdf_reader(pdf_path, password=password)
    n = get_num_pages(pdf_path, password=password)
    zip_path = os.path.join(workdir, "sayfalar.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        page_index = 0
        for start in range(1, n + 1, _RASTER_PAGE_BATCH):
            end = min(start + _RASTER_PAGE_BATCH - 1, n)
            kw = {**kw_base, "first_page": start, "last_page": end}
            images = convert_from_path(pdf_path, **kw)
            for im in images:
                page_index += 1
                buf = io.BytesIO()
                if ext == "png":
                    im.save(buf, format="PNG")
                    name = f"page_{page_index:04d}.png"
                else:
                    im.save(buf, format="JPEG", quality=90)
                    name = f"page_{page_index:04d}.jpg"
                zf.writestr(name, buf.getvalue())
                del im
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
    """Önce wkhtmltopdf (daha uyumlu), sonra xhtml2pdf dener."""
    wk = shutil.which("wkhtmltopdf")
    if wk:
        try:
            import pdfkit

            cfg = pdfkit.configuration(wkhtmltopdf=wk)
            pdfkit.from_string(
                html or "<html><body></body></html>",
                output_path,
                configuration=cfg,
                options={
                    "quiet": "",
                    "enable-local-file-access": "",
                    "disable-smart-shrinking": "",
                },
            )
            if os.path.isfile(output_path) and os.path.getsize(output_path) > 32:
                return True
        except Exception:
            if os.path.isfile(output_path):
                try:
                    os.remove(output_path)
                except OSError:
                    pass
    try:
        from xhtml2pdf import pisa
    except ImportError as e:
        raise Exception("HTML→PDF için 'xhtml2pdf' veya sistemde wkhtmltopdf gerekli.") from e
    with open(output_path, "wb") as out:
        status = pisa.CreatePDF(
            src=io.StringIO(html or ""),
            dest=out,
            path_base=base_url or None,
        )
    if status.err or not (os.path.isfile(output_path) and os.path.getsize(output_path) > 32):
        raise Exception(
            "HTML PDF'e dönüştürülemedi. wkhtmltopdf veya geçerli HTML ile tekrar deneyin."
        )
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


def pdf_to_pptx(pdf_path: str, pptx_path: str, password: Optional[str] = None, dpi: int = PDF_EXPORT_DPI_WEB) -> bool:
    from pdf2image import convert_from_path
    from pptx import Presentation
    import src.pdf_engine as pe

    poppler = getattr(pe, "poppler_bin_path", None) or None
    kw_base: dict = {"dpi": int(dpi), "fmt": "png"}
    if poppler and os.path.isdir(poppler):
        kw_base["poppler_path"] = poppler
    pwd = (password or "").strip()
    if pwd:
        kw_base["userpw"] = pwd
    _open_pdf_reader(pdf_path, password=password)
    n = get_num_pages(pdf_path, password=password)
    prs = Presentation()
    try:
        blank = prs.slide_layouts[6]
    except (IndexError, KeyError):
        blank = prs.slide_layouts[0]
    for start in range(1, n + 1, _RASTER_PAGE_BATCH):
        end = min(start + _RASTER_PAGE_BATCH - 1, n)
        kw = {**kw_base, "first_page": start, "last_page": end}
        images = convert_from_path(pdf_path, **kw)
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
            del im
    prs.save(pptx_path)
    return True


def pptx_to_pdf(pptx_path: str, pdf_path: str) -> bool:
    import shutil
    import subprocess

    timeout_sec = max(30, int(os.environ.get("NB_PDF_TOOL_TIMEOUT_SEC", "300")))

    def _soffice_executable() -> Optional[str]:
        for c in (shutil.which("soffice"), shutil.which("libreoffice")):
            if c:
                return c
        if os.name == "nt":
            for pf in (
                os.environ.get("ProgramFiles", r"C:\Program Files"),
                os.environ.get("ProgramFiles(x86)", ""),
            ):
                if not pf:
                    continue
                for sub in (
                    os.path.join(pf, "LibreOffice", "program", "soffice.com"),
                    os.path.join(pf, "LibreOffice", "program", "soffice.exe"),
                ):
                    if os.path.isfile(sub):
                        return sub
        return None

    def _via_libreoffice() -> bool:
        soffice = _soffice_executable()
        if not soffice:
            return False
        pptx_abs = os.path.abspath(pptx_path)
        out_dir = os.path.dirname(os.path.abspath(pdf_path))
        os.makedirs(out_dir, exist_ok=True)
        try:
            subprocess.run(
                [soffice, "--headless", "--convert-to", "pdf", "--outdir", out_dir, pptx_abs],
                check=True,
                timeout=timeout_sec,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            raise Exception(f"LibreOffice dönüşümü başarısız: {e.stderr or e}") from e
        base = os.path.splitext(os.path.basename(pptx_abs))[0]
        produced = os.path.join(out_dir, base + ".pdf")
        if not os.path.isfile(produced):
            raise Exception("LibreOffice çıktı dosyası oluşmadı.")
        if os.path.abspath(produced) != os.path.abspath(pdf_path):
            shutil.move(produced, pdf_path)
        return os.path.isfile(pdf_path)

    if os.name == "nt":
        try:
            import pythoncom
            from win32com.client import DispatchEx

            com_inited = False
            try:
                pythoncom.CoInitialize()
                com_inited = True
            except Exception:
                com_inited = False
            app = None
            pres = None
            try:
                app = DispatchEx("PowerPoint.Application")
                app.Visible = False
                app.DisplayAlerts = 0
                pres = app.Presentations.Open(os.path.abspath(pptx_path), WithWindow=False, ReadOnly=True)
                out = os.path.abspath(pdf_path)
                pres.SaveAs(out, 32)  # ppSaveAsPDF
                pres.Close()
                pres = None
            finally:
                if pres is not None:
                    try:
                        pres.Close()
                    except Exception:
                        pass
                if app is not None:
                    try:
                        app.Quit()
                    except Exception:
                        pass
                if com_inited:
                    try:
                        pythoncom.CoUninitialize()
                    except Exception:
                        pass
            return os.path.isfile(pdf_path)
        except Exception:
            if _soffice_executable():
                return _via_libreoffice()
            raise

    if not _soffice_executable():
        raise Exception(
            "PPTX→PDF: LibreOffice gerekli (`soffice` veya `libreoffice` PATH'te). "
            "Windows'ta PowerPoint yüklüyse o da denenir."
        )
    return _via_libreoffice()

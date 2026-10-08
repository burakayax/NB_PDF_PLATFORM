"""
Ek PDF araçları (sayfa yönetimi, dönüşüm, güvenlik).
pymupdf (fitz), pikepdf, PyPDF2 ve mevcut pdf_engine yardımcılarıyla.
"""

from __future__ import annotations

import io
import os
import shutil
import subprocess
import tempfile
import zipfile
from typing import Callable, Dict, List, Optional
from urllib.parse import urlsplit

import fitz

# pdf_engine'den parola açma + OCR (taranmış sayfalar için)
from src.pdf_engine import (
    _open_pdf_reader,
    is_pdf_encrypted,
    get_num_pages,
    ocr_page_text,
    gotenberg_convert_to_pdf,
)

# Web SaaS: single quality tier (DPI not user-configurable).
PDF_EXPORT_DPI_WEB = 300

# SAYFA SAYFA İŞLE — TOPLU DEĞİL.
#
# NEDEN 1: A4 bir sayfa 300 DPI'da 2480x3508 piksele açılır; ham hâlde ~26 MB.
# Altı sayfayı dört iş parçacığıyla aynı anda açmak tek seferde 150 MB+ ham veri
# demekti. Sunucunun toplam belleği 512 MB olduğu için 30 sayfalık sıradan bir
# belge SÜRECİ ÖLDÜRÜYORDU: canlı ölçümde yalnız o istek değil, TÜM PDF servisi
# yaklaşık bir dakika kapandı (sağlık ucu dâhil 502). Yani tek bir kullanıcının
# isteği sitedeki herkesi etkiliyordu.
#
# NEDEN 2: Sayfa sayfa işlemek aynı zamanda daha hızlı — bellek baskısı altında
# takas/çöp toplama maliyeti, paralellikten kazanılandan fazlaydı.
_RASTER_PAGE_BATCH = 1


def _guvenli_raster_dpi(sayfa_sayisi: int, istenen_dpi: int) -> int:
    """Sayfa sayısına göre güvenli çözünürlük.

    Çok sayfalı belgelerde 300 DPI hem dakikalar sürer hem de yüzlerce megabaytlık
    bir arşiv üretir; kullanıcı onu indiremez bile. Kısa belgelerde tam kalite
    korunur, uzun belgelerde ekran kalitesine düşülür.
    """
    if sayfa_sayisi <= 30:
        return istenen_dpi
    if sayfa_sayisi <= 80:
        return min(istenen_dpi, 200)
    return min(istenen_dpi, 150)


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
    *,
    total_pages: Optional[int] = None,
) -> bool:
    """İstenen sayfalar çıkarılmış yeni belge oluşturur (insert_pdf aralık aktarımı ile büyük PDF’lerde çok daha hızlı)."""
    import fitz as _fitz_local
    src = _fitz_open(pdf_path, password=password)
    try:
        n = src.page_count
        to_del = {int(p) for p in pages_to_delete}
        if any(p < 1 or p > n for p in to_del):
            raise Exception("Geçersiz sayfa numarası.")
        if len(to_del) >= n:
            raise Exception("Tüm sayfalar silinemez; en az bir sayfa kalmalıdır.")
        keep = [i for i in range(n) if (i + 1) not in to_del]
        # NEDEN select(): Bitişik olmayan sayfalar silinince aralık aralık insert_pdf
        # her aralıkta yazı tipi/görselleri YENİDEN kopyalıyordu (2 aralık = dosya ~2 kat,
        # garbage=0 olduğu için tekilleştirme de yok). select() aynı belge üzerinde
        # çalışır, ortak kaynaklar bir kez kalır; garbage=3 kullanılmayan nesneleri atar.
        src.select(keep)
        src.save(output_path, garbage=3, deflate=True, linear=False)
    finally:
        src.close()
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
        # Döndürme yalnızca sayfa sözlüğündeki /Rotate meta-verisini değiştirir;
        # içerik akışları dokunulmaz — yeniden sıkıştırmaya gerek yok.
        doc.save(output_path, garbage=0, deflate=False, linear=False)
    finally:
        doc.close()
    return True


def organize_pdf(
    pdf_path: str,
    output_path: str,
    new_order_1based: List[int],
    password: Optional[str] = None,
    *,
    total_pages: Optional[int] = None,
) -> bool:
    """Sayfaları yeni sıraya göre düzenler (ör. [3,1,2]).

    insert_pdf ile ardışık aralık aktarımı kullanır — büyük PDF'lerde
    select()+save() tam dosya yeniden yazımından çok daha hızlıdır.
    """
    import fitz as _fitz_local
    src = _fitz_open(pdf_path, password=password)
    try:
        n = src.page_count
        for p in new_order_1based:
            if p < 1 or p > n:
                raise Exception(f"Geçersiz sayfa: {p} (1–{n})")
        if len(new_order_1based) != n:
            raise Exception("Sıra listesi, tüm sayfaları tam olarak bir kez içermelidir.")
        if len(set(new_order_1based)) != n:
            raise Exception("Aynı sayfa iki kez kullanılamaz.")
        order_0 = [p - 1 for p in new_order_1based]
        ranges: list[tuple[int, int]] = []
        s = order_0[0]; e = order_0[0]
        for k in order_0[1:]:
            if k == e + 1:
                e = k
            else:
                ranges.append((s, e))
                s = e = k
        ranges.append((s, e))
        new_doc = _fitz_local.open()
        try:
            for from_p, to_p in ranges:
                new_doc.insert_pdf(src, from_page=from_p, to_page=to_p)
            new_doc.save(output_path, garbage=0, deflate=False, linear=False)
        finally:
            new_doc.close()
    finally:
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


def _hex_to_rgb(hex_color: str) -> tuple:
    """#RRGGBB → (r, g, b) 0-1 aralığında."""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return (0.55, 0.55, 0.55)
    try:
        return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))
    except ValueError:
        return (0.55, 0.55, 0.55)


def add_watermark_text(
    input_path: str,
    output_path: str,
    text: str,
    opacity: float = 0.12,
    password: Optional[str] = None,
    font_name: str = "helv",
    font_color: str = "#8C8C8C",
    rotation: float = 45.0,
    size_pct: float = 70.0,
    from_page: int = 1,
    to_page: int = 0,
) -> bool:
    """rotation: derece (0 = yatay, 45 = çapraz). size_pct: metnin sayfa genişliğine oranı (%).
    from_page/to_page: filigranlanacak aralık (1 tabanlı, to_page=0 → son sayfa)."""
    if not (text or "").strip():
        raise Exception("Filigran metni boş olamaz.")
    # Üst sınır %100: rakiplerde tam opak filigran var; kullanıcı isterse okunaklı basabilmeli.
    op = max(0.01, min(1.0, float(opacity)))
    rot = max(-360.0, min(360.0, float(rotation)))
    boyut_orani = max(10.0, min(100.0, float(size_pct))) / 100.0
    color = _hex_to_rgb(font_color)
    metin = (text or "").strip()

    # TÜRKÇE HARFLER İÇİN GÖMÜLÜ YAZI TİPİ.
    #
    # NEDEN: PDF'in yerleşik yazı tipleri (helv/tiro/cour) WinAnsi kodlamasıyla
    # sınırlı; İ, Ş, Ğ, ı harfleri yok. "GİZLİ ŞİRKET BİLGİSİ" yazan bir filigran
    # çıktıda "G·ZL· ··RKET B·LG·S·" görünüyordu. Ürün Türkçe olduğu için bu
    # kabul edilemez. Aynı klasördeki gömülü TTF'ler (metin düzenleme aracının
    # kullandığı yazı tipleri) tam Türkçe destekler; yazı tipi seçimi kullanıcıya
    # göründüğü gibi (düz / tırnaklı / daktilo) bunlara eşlenir.
    _ttf = {
        "helv": "Roboto-Regular.ttf",
        "tiro": "NotoSerif-Regular.ttf",
        "cour": "RobotoMono-Regular.ttf",
    }.get(font_name, "Roboto-Regular.ttf")
    _yollar = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "backend", "app", "assets", _ttf),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", _ttf),
    ]
    ttf_yolu = next((y for y in _yollar if os.path.isfile(y)), None)

    doc = _fitz_open(input_path, password=password)
    try:
        ilk = max(1, int(from_page))
        son = doc.page_count if int(to_page) <= 0 else min(doc.page_count, int(to_page))
        for i in range(ilk - 1, son):
            page = doc[i]
            r = page.rect
            genislik = r.x1 - r.x0
            yukseklik = r.y1 - r.y0

            # Boyut sayfaya göre: metin sayfanın (varsayılan) yaklaşık %70'ini kaplasın.
            # Sabit 22 punto A4'te kaybolacak kadar küçük kalıyordu.
            punto = max(14.0, min(150.0, (genislik * boyut_orani) / max(1, len(metin)) * 1.9))

            if ttf_yolu:
                yazici = fitz.TextWriter(r)
                font = fitz.Font(fontfile=ttf_yolu)
                uzunluk = font.text_length(metin, fontsize=punto)
                # Önce sayfanın TAM ORTASINA yatay yazılır, sonra aynı nokta
                # etrafında döndürülür: böylece filigran her sayfa ölçüsünde
                # ortada kalır (önce köşegene göre hesaplanıyordu ve metin sağ
                # alt köşeye kayıyordu).
                orta_x = r.x0 + genislik / 2
                orta_y = r.y0 + yukseklik / 2
                baslangic = fitz.Point(orta_x - uzunluk / 2, orta_y)
                yazici.append(baslangic, metin, font=font, fontsize=punto)
                # Varsayılan 45 derece çapraz: filigranın beklenen görünümü budur.
                yazici.write_text(page, color=color, opacity=op, morph=(
                    fitz.Point(orta_x, orta_y),
                    fitz.Matrix(rot),
                ))
            else:
                # Gömülü yazı tipi bulunamazsa eski davranış (yalnız acil yedek).
                c = fitz.Point((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
                page.insert_text(
                    c, metin, fontname="helv", fontsize=22,
                    color=color, render_mode=0, fill_opacity=op,
                )
        # Gömülü yazı tipi tamamı eklenip dosyayı şişiriyordu (+100-166 KB). Alt kümeleme yalnızca
        # kullanılan harfleri tutar; fontTools yoksa ya da başarısız olursa sessizce atlanır.
        try:
            doc.subset_fonts()
        except Exception:
            pass
        # garbage=3 + deflate: kullanılmayan nesneleri atar, akışları sıkıştırır.
        doc.save(output_path, garbage=3, deflate=True, linear=False)
    finally:
        doc.close()
    return True


def add_watermark_image(
    input_path: str,
    output_path: str,
    image_bytes: bytes,
    opacity: float = 0.3,
    password: Optional[str] = None,
    rotation: float = 0.0,
    size_pct: float = 40.0,
    from_page: int = 1,
    to_page: int = 0,
    position: str = "center",
) -> bool:
    """Logo/görsel filigranı ekler.

    size_pct: görselin sayfa genişliğine oranı (%). rotation: derece. opacity: 0.05–1.
    position: center | top-left | top-right | bottom-left | bottom-right.
    Saydam PNG'lerin saydamlığı korunur; opaklık görselin alfa kanalına uygulanır.
    """
    import io

    from PIL import Image

    if not image_bytes:
        raise Exception("Filigran görseli boş.")
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
    except Exception as e:
        raise Exception("Filigran görseli okunamadı. PNG, JPG veya WebP kullanın.") from e
    img = img.convert("RGBA")
    # Çok büyük görseller dosyayı şişirmesin: en uzun kenar 1600 px ile sınırlı.
    if max(img.size) > 1600:
        oran = 1600 / max(img.size)
        img = img.resize((max(1, int(img.width * oran)), max(1, int(img.height * oran))), Image.LANCZOS)
    op = max(0.05, min(1.0, float(opacity)))
    alfa = img.getchannel("A").point(lambda v: int(v * op))
    img.putalpha(alfa)
    rot = max(-360.0, min(360.0, float(rotation)))
    if rot % 360 != 0:
        img = img.rotate(rot, expand=True, resample=Image.BICUBIC)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    png = buf.getvalue()
    oran_genislik = max(5.0, min(100.0, float(size_pct))) / 100.0
    kenar = 24.0

    doc = _fitz_open(input_path, password=password)
    try:
        ilk = max(1, int(from_page))
        son = doc.page_count if int(to_page) <= 0 else min(doc.page_count, int(to_page))
        xref = 0
        for i in range(ilk - 1, son):
            page = doc[i]
            r = page.rect
            w = r.width * oran_genislik
            h = w * img.height / img.width
            if h > r.height * 0.95:  # sayfadan uzun olmasın
                h = r.height * 0.95
                w = h * img.width / img.height
            if position == "top-left":
                x0, y0 = r.x0 + kenar, r.y0 + kenar
            elif position == "top-right":
                x0, y0 = r.x1 - kenar - w, r.y0 + kenar
            elif position == "bottom-left":
                x0, y0 = r.x0 + kenar, r.y1 - kenar - h
            elif position == "bottom-right":
                x0, y0 = r.x1 - kenar - w, r.y1 - kenar - h
            else:
                x0, y0 = r.x0 + (r.width - w) / 2, r.y0 + (r.height - h) / 2
            kutu = fitz.Rect(x0, y0, x0 + w, y0 + h)
            if xref:
                page.insert_image(kutu, xref=xref, overlay=True, keep_proportion=True)
            else:
                xref = page.insert_image(kutu, stream=png, overlay=True, keep_proportion=True)
        doc.save(output_path, garbage=3, deflate=True, linear=False)
    finally:
        doc.close()
    return True


# ═══════════════════════════════════════════════════════════════════════════
# GRİ TONLAMA · SAYFA BOYUTLANDIRMA · AYNA · DÖNÜŞÜMLÜ BİRLEŞTİRME · BÖLME KİPLERİ
# (Rakip karşılaştırması, 8 Ekim 2026: Sejda'da olup bizde olmayan araçlar)
# ═══════════════════════════════════════════════════════════════════════════

_GRI_RENK_OPERATORLERI = {"rg", "RG", "k", "K", "sc", "SC", "scn", "SCN"}


def _luma(r: float, g: float, b: float) -> float:
    return max(0.0, min(1.0, 0.299 * r + 0.587 * g + 0.114 * b))


def _cmyk_gri(c: float, m: float, y: float, k: float) -> float:
    return max(0.0, min(1.0, 1.0 - min(1.0, 0.299 * c + 0.587 * m + 0.114 * y + k)))


def _icerik_akisini_griye_cevir(pdf, nesne, pikepdf) -> bool:
    """Bir sayfa/form içerik akışındaki renk komutlarını gri komutlarına çevirir.

    rg/RG (RGB) ve k/K (CMYK) → g/G; sc/scn/SC/SCN yalnızca 3 ya da 4 SAYI işlenenliyse
    (DeviceRGB/CMYK) çevrilir. Desen/gölgeleme/ICC tabanlı renk uzayları (işlenen
    sayısı farklı ya da ad içeren) olduğu gibi bırakılır. Değişiklik olduysa True döner.
    """
    try:
        komutlar = pikepdf.parse_content_stream(nesne)
    except Exception:
        return False
    yeni = []
    degisti = False
    for ops, op in komutlar:
        o = str(op)
        if o in _GRI_RENK_OPERATORLERI:
            try:
                sayilar = [float(x) for x in ops]
            except (TypeError, ValueError):
                sayilar = None
            if sayilar is not None and len(sayilar) == 3:
                g = _luma(*sayilar)
            elif sayilar is not None and len(sayilar) == 4:
                g = _cmyk_gri(*sayilar)
            else:
                g = None
            if g is not None:
                yeni_op = "G" if o in ("RG", "K", "SC", "SCN") else "g"
                yeni.append(pikepdf.ContentStreamInstruction([round(g, 4)], pikepdf.Operator(yeni_op)))
                degisti = True
                continue
        yeni.append(pikepdf.ContentStreamInstruction(ops, op))
    if degisti:
        nesne.write(pikepdf.unparse_content_stream(yeni))
    return degisti


def _gorseli_griye_cevir(xobj, pikepdf, io, Image, kalite: int = 85) -> bool:
    """Görsel XObject'i 8 bit gri JPEG'e çevirir. Maske/ardıl yapılar bozulmasın diye yalnızca
    düz renkli (RGB/CMYK/gri-olmayan) görsellerde çalışır. Başarısızsa False (görsel olduğu gibi kalır)."""
    try:
        cs = xobj.get("/ColorSpace")
        ad = str(cs) if cs is not None and not isinstance(cs, pikepdf.Array) else (str(cs[0]) if cs is not None else "")
        if ad in ("/DeviceGray", "/CalGray") or xobj.get("/ImageMask", False):
            return False
        pdfimg = pikepdf.PdfImage(xobj)
        im = pdfimg.as_pil_image()
        if im.mode in ("1", "L"):
            return False
        gri = im.convert("L")
        buf = io.BytesIO()
        gri.save(buf, format="JPEG", quality=kalite, optimize=True)
        veri = buf.getvalue()
        xobj.write(veri, filter=pikepdf.Name.DCTDecode)
        xobj.ColorSpace = pikepdf.Name.DeviceGray
        xobj.BitsPerComponent = 8
        for anahtar in ("/Decode", "/DecodeParms", "/Intent"):
            if anahtar in xobj:
                del xobj[anahtar]
        return True
    except Exception:
        return False


def grayscale_pdf(input_path: str, output_path: str, password: Optional[str] = None) -> dict:
    """PDF'in tüm renklerini gri tonlamaya çevirir (metin ve vektörler seçilebilir kalır).

    Görseller 8 bit gri JPEG olur, renk komutları (RGB/CMYK) gri komutlarına çevrilir.
    Döner: {"gorsel": n, "icerik": m} (çevrilen görsel ve içerik akışı sayısı).
    SINIRLAMA: Desen, gölgeleme ve ICC/Separation renk uzaylarındaki renkler değişmeyebilir.
    """
    import io

    import pikepdf
    from PIL import Image

    op = (password or "").strip()
    try:
        pdf = pikepdf.open(input_path, password=op) if op else pikepdf.open(input_path)
    except pikepdf.PasswordError:
        raise Exception("PDF şifreli; doğru parolayı girin.")
    gorsel = icerik = 0
    try:
        gorulen: set = set()

        def nesne_isle(obj) -> None:
            nonlocal gorsel, icerik
            try:
                anahtar = obj.objgen
            except Exception:
                anahtar = None
            if anahtar and anahtar != (0, 0):
                if anahtar in gorulen:
                    return
                gorulen.add(anahtar)
            res = obj.get("/Resources") if hasattr(obj, "get") else None
            if res is not None:
                xobjs = res.get("/XObject")
                if xobjs is not None:
                    for ad in list(xobjs.keys()):
                        x = xobjs[ad]
                        alt = str(x.get("/Subtype", ""))
                        if alt == "/Image":
                            k = x.objgen
                            if k not in gorulen:
                                gorulen.add(k)
                                if _gorseli_griye_cevir(x, pikepdf, io, Image):
                                    gorsel += 1
                        elif alt == "/Form":
                            if _icerik_akisini_griye_cevir(pdf, x, pikepdf):
                                icerik += 1
                            nesne_isle(x)

        for page in pdf.pages:
            for ic in (page.Contents if isinstance(page.get("/Contents"), pikepdf.Array) else [page.get("/Contents")]):
                if ic is None:
                    continue
                if _icerik_akisini_griye_cevir(pdf, ic, pikepdf):
                    icerik += 1
            nesne_isle(page.obj)
        pdf.save(output_path, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
    finally:
        pdf.close()
    return {"gorsel": gorsel, "icerik": icerik}


_SAYFA_BOYUTLARI_MM = {
    "a3": (297.0, 420.0),
    "a4": (210.0, 297.0),
    "a5": (148.0, 210.0),
    "a6": (105.0, 148.0),
    "letter": (215.9, 279.4),
    "legal": (215.9, 355.6),
}


def resize_pdf_pages(
    input_path: str,
    output_path: str,
    size: str = "a4",
    custom_w_mm: float = 0.0,
    custom_h_mm: float = 0.0,
    orientation: str = "auto",
    fit: str = "fit",
    margin_mm: float = 0.0,
    password: Optional[str] = None,
) -> dict:
    """Her sayfayı hedef kâğıt boyutuna getirir (vektör içerik korunur, görüntülenemez hale gelmez).

    size: a3|a4|a5|a6|letter|legal|custom (custom_w_mm × custom_h_mm).
    orientation: auto (her sayfanın yönü korunur) | portrait | landscape.
    fit: fit (oranı koru, sığdır, ortala) | fill (oranı koru, doldur, taşan kırpılır) | stretch (esnet).
    margin_mm: hedef sayfanın her kenarında bırakılacak boşluk.
    """
    if size == "custom":
        w_mm, h_mm = float(custom_w_mm), float(custom_h_mm)
        if not (20 <= w_mm <= 2000 and 20 <= h_mm <= 2000):
            raise Exception("Özel ölçü 20 ile 2000 mm arasında olmalıdır.")
    elif size in _SAYFA_BOYUTLARI_MM:
        w_mm, h_mm = _SAYFA_BOYUTLARI_MM[size]
    else:
        raise Exception("Sayfa boyutu geçersiz.")
    if orientation not in ("auto", "portrait", "landscape"):
        orientation = "auto"
    if fit not in ("fit", "fill", "stretch"):
        fit = "fit"
    marj = max(0.0, min(100.0, float(margin_mm))) * _MM

    src = _fitz_open(input_path, password=password)
    out = fitz.open()
    try:
        for pno in range(src.page_count):
            kaynak_sayfa = src[pno]
            r = kaynak_sayfa.rect
            w, h = w_mm * _MM, h_mm * _MM
            yatay = r.width > r.height
            if orientation == "landscape" or (orientation == "auto" and yatay):
                w, h = max(w, h), min(w, h)
            else:
                w, h = min(w, h), max(w, h)
            yeni = out.new_page(width=w, height=h)
            hedef = fitz.Rect(marj, marj, w - marj, h - marj)
            if hedef.is_empty:
                raise Exception("Boşluk sayfadan büyük.")
            if fit == "stretch":
                yeni.show_pdf_page(hedef, src, pno, keep_proportion=False)
            elif fit == "fill":
                oran = max(hedef.width / r.width, hedef.height / r.height)
                gw, gh = r.width * oran, r.height * oran
                dx = hedef.x0 + (hedef.width - gw) / 2
                dy = hedef.y0 + (hedef.height - gh) / 2
                kutu = fitz.Rect(dx, dy, dx + gw, dy + gh)
                # Taşan kısım sayfa sınırının dışında kaldığı için görünmez (kenar boşluğu 0 iken kesilir).
                yeni.show_pdf_page(kutu, src, pno, keep_proportion=True)
            else:
                yeni.show_pdf_page(hedef, src, pno, keep_proportion=True)
        out.save(output_path, garbage=3, deflate=True, linear=False)
        return {"sayfa": src.page_count, "genislik_mm": round(w_mm, 1), "yukseklik_mm": round(h_mm, 1)}
    finally:
        out.close()
        src.close()


def flip_pdf(
    input_path: str,
    output_path: str,
    direction: str = "horizontal",
    from_page: int = 1,
    to_page: int = 0,
    password: Optional[str] = None,
) -> dict:
    """Sayfaları ayna gibi çevirir: horizontal (soldan sağa), vertical (baş aşağı).

    Görünen yöne göre uygulanır (döndürülmüş sayfalarda da "yatay" ekrandaki yataydır).
    Not: Etkileşimli form alanı/not gibi açıklamalar çevrilmez, yalnızca sayfa içeriği çevrilir.
    """
    import pikepdf

    if direction not in ("horizontal", "vertical"):
        raise Exception("Çevirme yönü geçersiz.")
    op = (password or "").strip()
    try:
        pdf = pikepdf.open(input_path, password=op) if op else pikepdf.open(input_path)
    except pikepdf.PasswordError:
        raise Exception("PDF şifreli; doğru parolayı girin.")
    try:
        toplam = len(pdf.pages)
        ilk = max(1, int(from_page))
        son = toplam if int(to_page) <= 0 else min(toplam, int(to_page))
        if ilk > son:
            raise Exception("Sayfa aralığı geçersiz.")
        for i in range(ilk - 1, son):
            page = pdf.pages[i]
            kutu = [float(x) for x in (page.get("/CropBox") or page.MediaBox)]
            x0, y0, x1, y1 = kutu
            donus = int(page.get("/Rotate", 0)) % 360
            # Döndürülmüş sayfada görünen "yatay" eksen, döndürülmemiş koordinatta dikeydir.
            yatay = direction == "horizontal"
            if donus in (90, 270):
                yatay = not yatay
            if yatay:
                m = f"-1 0 0 1 {x0 + x1:.4f} 0 cm"
            else:
                m = f"1 0 0 -1 0 {y0 + y1:.4f} cm"
            on = pikepdf.Stream(pdf, f"q {m}\n".encode())
            arka = pikepdf.Stream(pdf, b"\nQ")
            page.contents_add(on, prepend=True)
            page.contents_add(arka, prepend=False)
        pdf.save(output_path, compress_streams=True)
        return {"cevrilen": son - ilk + 1}
    finally:
        pdf.close()


def alternate_mix_pdfs(
    input_paths: List[str],
    output_path: str,
    reverse_second: bool = False,
    passwords: Optional[List[Optional[str]]] = None,
) -> dict:
    """Birden çok PDF'in sayfalarını sırayla serpiştirir: A1, B1, A2, B2 …

    reverse_second: ikinci (ve sonraki) belge ters sırada okunur. Çift taraflı tarayıcıda
    önce ön yüzleri sonra arka yüzleri (ters sırada) taradıysanız doğru sıra budur.
    Belgelerin sayfa sayıları farklıysa uzun olanın kalan sayfaları sona eklenir.
    """
    if len(input_paths) < 2:
        raise Exception("Serpiştirmek için en az 2 PDF gerekli.")
    if len(input_paths) > 10:
        raise Exception("En fazla 10 PDF serpiştirilebilir.")
    passwords = passwords or [None] * len(input_paths)
    docs = []
    out = fitz.open()
    try:
        for i, yol in enumerate(input_paths):
            docs.append(_fitz_open(yol, password=(passwords[i] if i < len(passwords) else None)))
        sirali = []
        for i, d in enumerate(docs):
            idx = list(range(d.page_count))
            if reverse_second and i >= 1:
                idx.reverse()
            sirali.append(idx)
        en_uzun = max(len(x) for x in sirali)
        for k in range(en_uzun):
            for d, idx in zip(docs, sirali):
                if k < len(idx):
                    out.insert_pdf(d, from_page=idx[k], to_page=idx[k])
        out.save(output_path, garbage=3, deflate=True, linear=False)
        return {"sayfa": out.page_count, "belge": len(docs)}
    finally:
        out.close()
        for d in docs:
            d.close()


def _egrilik_acisi(gri, azami: float = 10.0) -> float:
    """Gri (0-255) bir sayfa görüntüsünün eğriliğini derece cinsinden tahmin eder.

    Yöntem: yazı satırları düz olduğunda yatay izdüşüm profili (satır satır koyu piksel sayısı)
    en keskin ZIT değişimi gösterir. Görüntü küçük açılarla döndürülür, profilin varyansı en
    büyük olan açı seçilir (önce kaba 0,5°, sonra ince 0,1° adımlarla). Boş/yazısız sayfada 0 döner.
    Dönüş: görüntüyü DÜZELTMEK için uygulanması gereken PIL.rotate açısı (saat yönünün tersi pozitif).
    """
    import numpy as np
    from PIL import Image

    im = Image.fromarray(gri)
    # Hız için ~1000 piksel genişliğe indir.
    if im.width > 1000:
        oran = 1000 / im.width
        im = im.resize((1000, max(1, int(im.height * oran))), Image.BILINEAR)
    a = np.asarray(im, dtype=np.uint8)
    esik = a.mean() - 0.5 * a.std()
    ikili = (a < esik).astype(np.uint8) * 255
    if ikili.mean() < 1.0:  # neredeyse boş sayfa
        return 0.0
    ikili_im = Image.fromarray(ikili)

    def puan(aci: float) -> float:
        r = np.asarray(ikili_im.rotate(aci, resample=Image.NEAREST, fillcolor=0), dtype=np.float32)
        profil = r.sum(axis=1)
        return float(np.var(profil))

    en_iyi_aci, en_iyi = 0.0, puan(0.0)
    aci = -azami
    while aci <= azami + 1e-9:
        v = puan(aci)
        if v > en_iyi:
            en_iyi, en_iyi_aci = v, aci
        aci += 0.5
    aci = en_iyi_aci - 0.5
    ince_en_iyi, ince_aci = en_iyi, en_iyi_aci
    while aci <= en_iyi_aci + 0.5 + 1e-9:
        v = puan(aci)
        if v > ince_en_iyi:
            ince_en_iyi, ince_aci = v, aci
        aci += 0.1
    return round(ince_aci, 2)


def deskew_pdf(
    input_path: str,
    output_path: str,
    azami_aci: float = 10.0,
    esik_aci: float = 0.3,
    dpi: int = 200,
    password: Optional[str] = None,
) -> dict:
    """Taranmış (yalnızca görüntüden oluşan) sayfalardaki eğriliği düzeltir.

    Metin katmanı olan sayfalara DOKUNULMAZ (OCR'lı ya da dijital sayfa zaten düz; yeniden
    resme çevirmek metni seçilemez yapardı). `esik_aci`'ndan az eğri sayfa da olduğu gibi kalır.
    Düzeltilen sayfa aynı ölçüde yeni bir sayfa olur; dönen köşeler beyazla dolar.
    Döner: {"duzeltilen": n, "atlanan_metinli": m, "atlanan_duz": k, "acilar": {sayfa: derece}}.
    """
    import io

    import numpy as np
    from PIL import Image

    azami = max(1.0, min(20.0, float(azami_aci)))
    src = _fitz_open(input_path, password=password)
    out = fitz.open()
    try:
        n = src.page_count
        if n > 300:
            raise Exception("Eğri düzeltme en fazla 300 sayfalık belgelerde çalışır.")
        duzeltilen = atlanan_metin = atlanan_duz = 0
        acilar: dict = {}
        for i in range(n):
            sayfa = src[i]
            metin_var = bool(sayfa.get_text().strip())
            taranmis = (not metin_var) and bool(sayfa.get_images())
            if not taranmis:
                out.insert_pdf(src, from_page=i, to_page=i)
                if metin_var:
                    atlanan_metin += 1
                continue
            pix = sayfa.get_pixmap(dpi=int(dpi), colorspace=fitz.csGRAY)
            gri = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w)
            aci = _egrilik_acisi(gri, azami)
            if abs(aci) < float(esik_aci):
                out.insert_pdf(src, from_page=i, to_page=i)
                atlanan_duz += 1
                continue
            renkli = sayfa.get_pixmap(dpi=int(dpi), colorspace=fitz.csRGB)
            im = Image.frombytes("RGB", (renkli.w, renkli.h), renkli.samples)
            im = im.rotate(aci, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=88, optimize=True, dpi=(int(dpi), int(dpi)))
            yeni = out.new_page(width=sayfa.rect.width, height=sayfa.rect.height)
            yeni.insert_image(yeni.rect, stream=buf.getvalue())
            duzeltilen += 1
            acilar[i + 1] = aci
        if duzeltilen == 0:
            if atlanan_metin == n:
                raise Exception("Bu PDF taranmış görüntü değil (yazı katmanı var); eğri düzeltme gerekmiyor.")
            raise Exception("Eğri taranmış sayfa bulunamadı; sayfalar zaten düz görünüyor.")
        out.save(output_path, garbage=3, deflate=True, linear=False)
        return {
            "duzeltilen": duzeltilen, "atlanan_metinli": atlanan_metin,
            "atlanan_duz": atlanan_duz, "acilar": acilar,
        }
    finally:
        out.close()
        src.close()


def _guvenli_ad(metin: str, varsayilan: str = "bolum") -> str:
    import re

    ad = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', " ", metin or "").strip().strip(".")
    ad = re.sub(r"\s+", " ", ad)
    return (ad[:60] or varsayilan)


def _aralik_boyutu(src, a: int, b: int) -> int:
    """src'nin [a, b] (0 tabanlı, dahil) sayfa aralığının gerçek (sıkıştırılmış) dosya boyutu."""
    d = fitz.open()
    try:
        d.insert_pdf(src, from_page=a, to_page=b)
        return len(d.tobytes(garbage=3, deflate=True))
    finally:
        d.close()


def split_pdf_advanced(
    input_path: str,
    out_dir: str,
    mode: str,
    every_n: int = 1,
    max_mb: float = 5.0,
    base_name: str = "belge",
    password: Optional[str] = None,
) -> dict:
    """Gelişmiş bölme. Çıktı dosyalarını out_dir'e yazar.

    mode:
      "every"   → her `every_n` sayfada bir dosya.
      "size"    → her dosya en fazla `max_mb` MB (gerçek dosya boyutuna göre).
      "outline" → üst düzey yer imlerinde böl (dosya adı yer imi başlığı).
    Döner: {"dosyalar": [yollar], "asan": [tek başına limiti aşan sayfa numaraları]}
    """
    os.makedirs(out_dir, exist_ok=True)
    src = _fitz_open(input_path, password=password)
    try:
        n = src.page_count
        aralıklar: list[tuple[int, int, str]] = []  # (ilk, son, ad) 0 tabanlı, dahil
        asan: list[int] = []
        if mode == "every":
            k = max(1, int(every_n))
            for a in range(0, n, k):
                b = min(n - 1, a + k - 1)
                aralıklar.append((a, b, f"{base_name}_{a + 1}-{b + 1}"))
        elif mode == "size":
            limit = int(float(max_mb) * 1024 * 1024)
            if limit < 20 * 1024:
                raise Exception("En küçük sınır 0,02 MB'tır.")
            a = 0
            while a < n:
                # Üstel büyüt, sonra ikili arama: en büyük sığan aralığı bul.
                if _aralik_boyutu(src, a, a) > limit:
                    asan.append(a + 1)
                    aralıklar.append((a, a, f"{base_name}_{a + 1}"))
                    a += 1
                    continue
                dogru = a
                adim = 1
                while dogru + adim < n and _aralik_boyutu(src, a, dogru + adim) <= limit:
                    dogru += adim
                    adim *= 2
                alt, ust = dogru, min(n - 1, dogru + adim)
                while alt < ust:
                    orta = (alt + ust + 1) // 2
                    if _aralik_boyutu(src, a, orta) <= limit:
                        alt = orta
                    else:
                        ust = orta - 1
                aralıklar.append((a, alt, f"{base_name}_{a + 1}-{alt + 1}"))
                a = alt + 1
        elif mode == "outline":
            toc = [t for t in src.get_toc(simple=True) if t[0] == 1 and 1 <= t[2] <= n]
            if not toc:
                raise Exception("Bu PDF'te üst düzey yer imi (bookmark) bulunamadı.")
            toc.sort(key=lambda t: t[2])
            baslangiclar = []
            for _lvl, baslik, sayfa in toc:
                if baslangiclar and baslangiclar[-1][1] == sayfa - 1:
                    continue  # aynı sayfada birden çok yer imi → ilki
                baslangiclar.append((baslik, sayfa - 1))
            if baslangiclar[0][1] > 0:
                baslangiclar.insert(0, ("Giriş", 0))
            for idx, (baslik, a) in enumerate(baslangiclar):
                b = (baslangiclar[idx + 1][1] - 1) if idx + 1 < len(baslangiclar) else n - 1
                if b >= a:
                    aralıklar.append((a, b, f"{idx + 1:02d} {_guvenli_ad(baslik)}"))
        else:
            raise Exception("Bölme kipi geçersiz.")

        if len(aralıklar) > 300:
            raise Exception(f"Bu ayarla {len(aralıklar)} dosya çıkıyor; en fazla 300 olabilir. Ayarı büyütün.")
        if len(aralıklar) <= 1 and mode != "outline":
            raise Exception("Bu ayarla belge zaten tek parça; bölünecek bir şey yok.")
        yollar: list[str] = []
        kullanilan: set = set()
        for a, b, ad in aralıklar:
            temiz = _guvenli_ad(ad, "bolum")
            ham, sayac = temiz, 2
            while ham.lower() in kullanilan:
                ham = f"{temiz} ({sayac})"
                sayac += 1
            kullanilan.add(ham.lower())
            yol = os.path.join(out_dir, f"{ham}.pdf")
            d = fitz.open()
            try:
                d.insert_pdf(src, from_page=a, to_page=b)
                d.save(yol, garbage=3, deflate=True, linear=False)
            finally:
                d.close()
            yollar.append(yol)
        return {"dosyalar": yollar, "asan": asan}
    finally:
        src.close()


_MM = 72.0 / 25.4  # 1 mm = 2,8346 punto


def _icerik_kutusu(page) -> "Optional[fitz.Rect]":
    """Sayfadaki GÖRÜNÜR içeriğin (metin, görsel, çizim) birleşik sınır kutusu; yoksa None.

    Sayfayı tamamen kaplayan arka plan dikdörtgenleri (beyaz zemin vb.) sayılmaz, yoksa
    otomatik kırpma hiçbir şey kırpamaz.
    """
    kutu = None
    alan = page.rect.width * page.rect.height

    def ekle(r) -> None:
        nonlocal kutu
        r = fitz.Rect(r)
        if r.is_empty or r.is_infinite:
            return
        kutu = fitz.Rect(r) if kutu is None else (kutu | r)

    try:
        for b in page.get_text("blocks"):
            if len(b) > 6 and b[6] != 0:  # 0 = metin bloğu; 1 = görsel bloğu
                continue
            if (b[4] or "").strip():
                ekle((b[0], b[1], b[2], b[3]))
    except Exception:
        pass
    try:
        for g in page.get_image_info():
            r = fitz.Rect(g.get("bbox", (0, 0, 0, 0)))
            if r.width * r.height < alan * 0.97:
                ekle(r)
    except Exception:
        pass
    try:
        for d in page.get_drawings():
            r = fitz.Rect(d.get("rect", (0, 0, 0, 0)))
            if r.width * r.height >= alan * 0.97:
                continue
            ekle(r)
    except Exception:
        pass
    try:
        for a in page.annots() or []:
            ekle(a.rect)
    except Exception:
        pass
    return kutu


def crop_pdf(
    input_path: str,
    output_path: str,
    mode: str = "margins",
    top_mm: float = 0.0,
    bottom_mm: float = 0.0,
    left_mm: float = 0.0,
    right_mm: float = 0.0,
    pad_mm: float = 5.0,
    uniform: bool = False,
    from_page: int = 1,
    to_page: int = 0,
    password: Optional[str] = None,
) -> dict:
    """Sayfaları kırpar (CropBox ayarlar; görünür alan küçülür).

    mode="margins": her kenardan verilen mm kadar kırpar.
    mode="auto":    içeriğin etrafındaki boş kenarları kendisi bulur; pad_mm kadar pay bırakır.
                    uniform=True → seçili tüm sayfalar aynı (en geniş içerik) kutusuyla kırpılır.
    Döner: {"kirpilan": n, "atlanan": m} (içeriksiz sayfalar auto modda atlanır).

    NOT: CropBox görünürlüğü değiştirir; kırpılan kısım dosyada kalır. Gizlilik için
    «Hassas veri gizle» kullanılmalıdır (arayüzde bu uyarı yazılıdır).
    """
    if mode not in ("margins", "auto"):
        raise Exception("Kırpma kipi geçersiz.")
    vals = [float(top_mm), float(bottom_mm), float(left_mm), float(right_mm), float(pad_mm)]
    if any(v < 0 or v > 500 for v in vals):
        raise Exception("Kenar boşlukları 0 ile 500 mm arasında olmalıdır.")
    if mode == "margins" and not any(vals[:4]):
        raise Exception("En az bir kenardan kırpma değeri girin.")

    doc = _fitz_open(input_path, password=password)
    try:
        toplam = doc.page_count
        ilk = max(1, int(from_page))
        son = toplam if int(to_page) <= 0 else min(toplam, int(to_page))
        if ilk > son:
            raise Exception("Sayfa aralığı geçersiz.")
        pad = float(pad_mm) * _MM
        kirpilan = 0
        atlanan = 0

        ortak = None
        if mode == "auto" and uniform:
            for i in range(ilk - 1, son):
                k = _icerik_kutusu(doc[i])
                if k is not None:
                    ortak = k if ortak is None else (ortak | k)

        for i in range(ilk - 1, son):
            page = doc[i]
            r = page.rect  # döndürülmüş (görünen) koordinatlar
            if mode == "margins":
                yeni = fitz.Rect(
                    r.x0 + float(left_mm) * _MM, r.y0 + float(top_mm) * _MM,
                    r.x1 - float(right_mm) * _MM, r.y1 - float(bottom_mm) * _MM,
                )
            else:
                k = ortak if (uniform and ortak is not None) else _icerik_kutusu(page)
                if k is None:
                    atlanan += 1
                    continue
                yeni = fitz.Rect(k.x0 - pad, k.y0 - pad, k.x1 + pad, k.y1 + pad) & r
            if yeni.is_empty or yeni.width < 20 or yeni.height < 20:
                if mode == "margins":
                    raise Exception(f"Sayfa {i + 1}: kırpma sayfayı yok edecek kadar büyük.")
                atlanan += 1
                continue
            # set_cropbox döndürülmemiş sayfa koordinatı ister.
            page.set_cropbox(yeni * page.derotation_matrix)
            kirpilan += 1
        if kirpilan == 0:
            raise Exception("Kırpılacak içerik bulunamadı; sayfalar boş görünüyor.")
        doc.save(output_path, garbage=3, deflate=True, linear=False)
    finally:
        doc.close()
    return {"kirpilan": kirpilan, "atlanan": atlanan}


_HF_KONUMLAR = (
    "header-left", "header-center", "header-right",
    "footer-left", "footer-center", "footer-right",
)


def add_header_footer(
    input_path: str,
    output_path: str,
    slots: dict,
    password: Optional[str] = None,
    font_size: float = 10.0,
    color: str = "#444444",
    from_page: int = 1,
    to_page: int = 0,
    start_at: int = 1,
    file_name: str = "",
    date_text: str = "",
) -> bool:
    """Üst/alt bilgi: altı konuma (header|footer × left|center|right) serbest metin yazar.

    Metinde yer tutucular kullanılabilir: {sayfa} (numara), {toplam} (toplam sayfa),
    {tarih} (bugün), {dosya} (dosya adı, uzantısız). {sayfa:6} gibi bir sayı eklenirse numara
    sıfırla doldurulur (000147) — Bates numarası: "DAVA-{sayfa:6}". Birden çok dosyayı
    kesintisiz numaralamak için start_at'a önceki dosyanın son numarası + 1 verilir.
    Türkçe harfler için gömülü Türkçe destekli yazı tipi kullanılır
    (yerleşik Helvetica ç, ğ, ş, İ çizemez).
    """
    import re

    _pad_re = re.compile(r"\{(sayfa|toplam)(?::(\d{1,2}))?\}")
    import datetime

    temiz = {
        k: (v or "").strip()
        for k, v in (slots or {}).items()
        if k in _HF_KONUMLAR and (v or "").strip()
    }
    if not temiz:
        raise Exception("Üst/alt bilgi için en az bir metin yazın.")
    for v in temiz.values():
        if len(v) > 200:
            raise Exception("Üst/alt bilgi metni en fazla 200 karakter olabilir.")

    ttf = "Roboto-Regular.ttf"
    yollar = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "backend", "app", "assets", ttf),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", ttf),
    ]
    ttf_yolu = next((y for y in yollar if os.path.isfile(y)), None)
    bugun = date_text or datetime.date.today().strftime("%d.%m.%Y")
    dosya_adi = os.path.splitext(os.path.basename(file_name or ""))[0]
    size = max(6.0, min(48.0, float(font_size)))
    strip_h = max(24.0, size * 2.0 + 8.0)
    rgb = _hex_to_rgb(color) if color else (0.27, 0.27, 0.27)
    margin_x = 36

    doc = _fitz_open(input_path, password=password)
    try:
        toplam = doc.page_count
        ilk = max(1, int(from_page))
        son = toplam if int(to_page) <= 0 else min(toplam, int(to_page))
        sayac = int(start_at)
        for i in range(ilk - 1, son):
            page = doc[i]
            r = page.rect
            for konum, sablon in temiz.items():
                def _doldur(m, sayac=sayac):
                    deger = sayac if m.group(1) == "sayfa" else toplam
                    return str(deger).zfill(int(m.group(2))) if m.group(2) else str(deger)

                metin = _pad_re.sub(_doldur, sablon).replace("{tarih}", bugun).replace("{dosya}", dosya_adi)
                dikey, _, yatay = konum.partition("-")
                if dikey == "header":
                    kutu = fitz.Rect(r.x0 + margin_x, r.y0 + 6, r.x1 - margin_x, r.y0 + strip_h)
                else:
                    kutu = fitz.Rect(r.x0 + margin_x, r.y1 - strip_h, r.x1 - margin_x, r.y1 - 6)
                hiza = {"left": fitz.TEXT_ALIGN_LEFT, "right": fitz.TEXT_ALIGN_RIGHT}.get(
                    yatay, fitz.TEXT_ALIGN_CENTER
                )
                kw = {"fontsize": size, "color": rgb, "align": hiza}
                if ttf_yolu:
                    kw.update(fontname="robotohf", fontfile=ttf_yolu)
                page.insert_textbox(kutu, metin, **kw)
            sayac += 1
        try:
            doc.subset_fonts()
        except Exception:
            pass
        doc.save(output_path, garbage=3, deflate=True, linear=False)
    finally:
        doc.close()
    return True


def add_page_numbers(
    input_path: str,
    output_path: str,
    start_at: int = 1,
    position: str = "footer",
    password: Optional[str] = None,
    fmt: str = "plain",
    font_size: float = 9.0,
    color: str = "#666666",
    from_page: int = 1,
    to_page: int = 0,
) -> bool:
    """
    fmt: "plain"    → "3"
         "page"     → "Sayfa 3"  / "Page 3"
         "of"       → "3 / 10"
         "page-of"  → "Sayfa 3 / 10"
    position: "footer" | "header" (ortada) ya da "footer-left|center|right",
              "header-left|center|right".
    from_page / to_page: numaralanacak aralık (1 tabanlı, to_page=0 → son sayfa).
        Numara, aralığın ilk sayfasında start_at değerinden başlar.
    """
    doc = _fitz_open(input_path, password=password)
    try:
        total = doc.page_count
        num = int(start_at)
        margin_x = 36
        size = max(6.0, min(48.0, float(font_size)))
        # Kutu, yazıyı sığdıracak kadar yüksek olmalı: sığmazsa insert_textbox yazıyı
        # SESSİZCE çizmez (negatif döner), numara hiç görünmez.
        strip_h = max(24.0, size * 2.0 + 8.0)
        rgb = _hex_to_rgb(color) if color else (0.4, 0.4, 0.4)
        vert, _, horiz = (position or "footer").partition("-")
        vert = "header" if vert == "header" else "footer"
        align = {
            "left": fitz.TEXT_ALIGN_LEFT,
            "right": fitz.TEXT_ALIGN_RIGHT,
        }.get(horiz, fitz.TEXT_ALIGN_CENTER)
        first = max(1, int(from_page))
        last = total if int(to_page) <= 0 else min(total, int(to_page))
        for i in range(first - 1, last):
            page = doc[i]
            r = page.rect
            if fmt == "page":
                label = f"Sayfa {num}"
            elif fmt == "of":
                label = f"{num} / {total}"
            elif fmt == "page-of":
                label = f"Sayfa {num} / {total}"
            else:
                label = str(num)
            # Use a full-width rect so insert_textbox can align the text.
            if vert == "header":
                rect = fitz.Rect(r.x0 + margin_x, r.y0 + 6, r.x1 - margin_x, r.y0 + strip_h)
            else:
                rect = fitz.Rect(r.x0 + margin_x, r.y1 - strip_h, r.x1 - margin_x, r.y1 - 6)
            page.insert_textbox(
                rect, label,
                fontsize=size,
                color=rgb,
                align=align,
            )
            num += 1
        doc.save(output_path, garbage=0, deflate=False, linear=False)
    finally:
        doc.close()
    return True


def _onarim_kazanci(output_path: str) -> tuple[int, int]:
    """Onarım çıktısını ölçer: (sayfa sayısı, içerik taşıyan sayfa sayısı).

    NEDEN: Onarım stratejileri "dosya yazıldı" diye başarılı sayılıyordu; ağır
    hasarlı bir belgede bu, kullanıcıya BOŞ bir PDF vermek demekti ve hiçbir
    uyarı çıkmıyordu. Metni ya da görseli olan sayfa sayısı, gerçekten bir şey
    kurtarılıp kurtarılmadığının ölçüsüdür.
    """
    try:
        doc = fitz.open(output_path)
    except Exception:
        return (0, 0)
    try:
        icerikli = 0
        for sayfa in doc:
            try:
                if sayfa.get_text().strip() or sayfa.get_images():
                    icerikli += 1
            except Exception:
                continue
        return (doc.page_count, icerikli)
    finally:
        doc.close()


def _beklenen_sayfa_sayisi(yol: str, ust_sinir_mb: int = 100) -> int:
    """Ham dosyada görünen /Type /Page nesnesi sayısı (0 = bilinmiyor).

    Yalnızca nesneleri sıkıştırılmamış (düz) bölgelerde çalışır; nesne akışı içine
    gömülmüş sayfaları göremez, o durumda düşük sayı verir. Bu yüzden yalnızca
    "en az bu kadar sayfa olmalı" ipucu olarak kullanılır. Büyük dosyalarda atlanır.
    """
    import re

    try:
        if os.path.getsize(yol) > ust_sinir_mb * 1024 * 1024:
            return 0
        with open(yol, "rb") as f:
            veri = f.read()
        return len(re.findall(rb"/Type\s*/Page(?![a-zA-Z])", veri))
    except OSError:
        return 0


def _onarim_bozuk_sayfa(output_path: str) -> int:
    """Çizilirken eksik kaynak (görsel/yazı tipi) hatası veren sayfa sayısı.

    NEDEN: Onarım, "en az bir sayfada yazı/görsel var" diye ilk yöntemde duruyordu;
    ama o yöntem bazı sayfalardaki görseli düşürebiliyor (sayfa var, içi bozuk).
    Aynı dosyayı başka yöntem kusursuz kurtarabildiği halde kullanıcıya bozuk sayfa
    veriliyordu. Hata sayımı, yöntemleri birbiriyle kıyaslamamızı sağlar.
    """
    try:
        doc = fitz.open(output_path)
    except Exception:
        return 10**6
    bozuk = 0
    try:
        try:
            fitz.TOOLS.mupdf_display_errors(False)
        except Exception:
            pass
        for sayfa in doc:
            try:
                fitz.TOOLS.reset_mupdf_warnings()
                sayfa.get_pixmap(dpi=24)
                uyarilar = (fitz.TOOLS.mupdf_warnings() or "").lower()
                if "cannot find" in uyarilar or "error" in uyarilar:
                    bozuk += 1
            except Exception:
                bozuk += 1
    finally:
        doc.close()
        try:
            fitz.TOOLS.mupdf_display_errors(True)
        except Exception:
            pass
    return bozuk


def repair_pdf(input_path: str, output_path: str, password: Optional[str] = None) -> bool:
    """Bozuk PDF'i çok aşamalı strateji ile onarır. Tüm yöntemler başarısız olursa açıklayıcı hata verir.

    Her yöntem denenir; çıktıda bozuk sayfa varsa sonuç aday olarak saklanır ve diğer
    yöntemler de denenir. En az bozuk sayfalı (eşitlikte en çok içerikli) aday seçilir.
    """
    import shutil
    # (eksik_sayfa, bozuk_sayfa, -icerikli, dosya): küçük olan daha iyi.
    adaylar: list[tuple[int, int, int, str]] = []
    beklenen = _beklenen_sayfa_sayisi(input_path)

    def _aday_degerlendir(yol: str) -> bool:
        """True → kusursuz (eksik/bozuk sayfa yok), hemen kullan. Aksi halde aday olarak saklanır."""
        sayfa, icerikli = _onarim_kazanci(yol)
        if icerikli <= 0:
            return False
        # Ham dosyada daha çok sayfa nesnesi görünüyorsa, az sayfalı sonuç "kusursuz" sayılmaz:
        # bir yöntem sayfa ağacını yarım kurtarıp kalan sayfaları sessizce atabilir.
        eksik = max(0, beklenen - sayfa) if beklenen else 0
        bozuk = _onarim_bozuk_sayfa(yol)
        if bozuk == 0 and eksik == 0:
            for _e, _b, _i, eski in adaylar:
                try:
                    os.remove(eski)
                except OSError:
                    pass
            adaylar.clear()
            return True
        kopya = f"{output_path}.aday{len(adaylar)}"
        shutil.copyfile(yol, kopya)
        adaylar.append((eksik, bozuk, -icerikli, kopya))
        return False

    def _en_iyi_adayi_yaz() -> bool:
        if not adaylar:
            return False
        adaylar.sort()
        shutil.copyfile(adaylar[0][3], output_path)
        for _e, _b, _i, yol in adaylar:
            try:
                os.remove(yol)
            except OSError:
                pass
        return True

    try:
        import pikepdf
    except ImportError as e:
        raise Exception("pikepdf kütüphanesi bulunamadı; sunucu yapılandırmasını kontrol edin.") from e

    op = (password or "").strip()
    errors: list[str] = []

    # Strateji 1: pikepdf — çapraz referans tablosunu yeniden oluşturur, bozuk akışları atlar
    try:
        with pikepdf.open(input_path, password=op, suppress_warnings=True) as pdf:
            pdf.save(output_path, compress_streams=True, recompress_flate=True)
        if os.path.isfile(output_path) and os.path.getsize(output_path) > 32:
            if _aday_degerlendir(output_path):
                return True
            if not adaylar:
                errors.append("pikepdf: dosya yazıldı ama sayfalar boş çıktı")
    except pikepdf.PasswordError:
        raise Exception("PDF şifreli; onarım için doğru parolayı girin.")
    except Exception as e1:
        errors.append(f"pikepdf: {e1!s:.150}")

    # Strateji 2: PyMuPDF — xref tablosunu yeniden oluşturur, stream'leri temizler
    try:
        doc = _fitz_open(input_path, password=password)
        try:
            doc.save(output_path, garbage=4, deflate=True, clean=True, linear=False)
        finally:
            doc.close()
        if os.path.isfile(output_path) and os.path.getsize(output_path) > 32:
            if _aday_degerlendir(output_path):
                return True
            if not adaylar:
                errors.append("fitz: dosya yazıldı ama sayfalar boş çıktı")
    except Exception as e2:
        if "password" in str(e2).lower() or "encrypted" in str(e2).lower():
            raise Exception("PDF şifreli; onarım için doğru parolayı girin.")
        errors.append(f"fitz: {e2!s:.150}")

    # Strateji 3: pikepdf lenient mode (çok bozuk dosyalar için, kurtarılabilir sayfalar)
    try:
        with pikepdf.open(input_path, password=op, suppress_warnings=True, ignore_xref_streams=True) as pdf:
            if len(pdf.pages) == 0:
                errors.append("pikepdf-lenient: sayfa bulunamadı")
            else:
                pdf.save(output_path, compress_streams=True)
                if os.path.isfile(output_path) and os.path.getsize(output_path) > 32:
                    if _aday_degerlendir(output_path):
                        return True
                    if not adaylar:
                        errors.append("pikepdf-lenient: sayfalar boş çıktı")
    except Exception as e3:
        errors.append(f"pikepdf-lenient: {e3!s:.150}")

    # Kusursuz sonuç yok ama kısmen kurtarılmış (bazı sayfalar bozuk) adaylar varsa en iyisi verilir.
    if _en_iyi_adayi_yaz():
        return True

    # Buraya gelindiyse ya hiç dosya üretilemedi ya da üretilen dosya BOŞTU.
    # Kullanıcıya boş bir PDF verip "onarıldı" demek en kötü sonuçtur: dosyasını
    # kurtardığını sanır, yedeğini silebilir.
    bos_cikti = any("boş çıktı" in e for e in errors)
    err_summary = " | ".join(errors[:3])
    if bos_cikti:
        try:
            if os.path.isfile(output_path):
                os.remove(output_path)
        except OSError:
            pass
        raise Exception(
            "Dosyanın yapısı onarıldı ama içeriği kurtarılamadı: sayfalar boş çıkıyor. "
            "Bu, belgenin yazı ve görsel verisinin bulunduğu bölümün zarar gördüğü "
            "anlamına gelir. Varsa dosyanın önceki bir kopyasını kullanın."
        )
    raise Exception(
        f"PDF onarılamadı. Dosya kurtarılamayacak kadar ciddi biçimde bozulmuş olabilir. "
        f"Orijinal dosyanın yedeği varsa onu kullanın. ({err_summary})"
    )


def pdf_to_text(input_path: str, output_path: str, password: Optional[str] = None) -> bool:
    """PDF içindeki metin katmanını düz metin dosyasına yazar (sayfa başlıkları dahil)."""
    doc = _fitz_open(input_path, password=password)
    try:
        lines: list[str] = []
        for page_num, page in enumerate(doc, 1):
            text = page.get_text("text").strip()
            if not text:
                # Metin katmanı yok (taranmış/görüntü sayfa) → Tesseract OCR ile metni tanı.
                text = ocr_page_text(page).strip()
            if text:
                lines.append(f"--- Sayfa {page_num} ---")
                lines.append(text)
        if not lines:
            raise Exception("PDF içinde metin bulunamadı (OCR de metin çıkaramadı — görüntü kalitesi düşük olabilir).")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
    finally:
        doc.close()
    return True


def flatten_pdf(input_path: str, output_path: str, password: Optional[str] = None) -> bool:
    """Etkileşimli form alanlarını ve açıklamaları PDF içeriğine gömer (düzleştirir)."""
    try:
        import pikepdf
    except ImportError as e:
        raise Exception("pikepdf kütüphanesi bulunamadı.") from e
    op = (password or "").strip()
    try:
        # pikepdf password varsayılanı "" (parolasız); None geçmek bazı sürümlerde
        # TypeError verir. Her zaman string geçiyoruz.
        with pikepdf.open(input_path, password=op) as pdf:
            # Form alanlarını sil — içerik zaten sayfaya render edilmiş olarak kalır
            if "/AcroForm" in pdf.Root:
                del pdf.Root["/AcroForm"]
            for page in pdf.pages:
                if "/Annots" in page:
                    annots = page["/Annots"]
                    keep = []
                    for annot in annots:
                        atype = str(annot.get("/Subtype", ""))
                        if atype not in ("/Widget", "/FreeText", "/Stamp", "/Highlight",
                                         "/Underline", "/StrikeOut", "/Squiggly", "/Caret"):
                            keep.append(annot)
                    if keep:
                        page["/Annots"] = pikepdf.Array(keep)
                    else:
                        del page["/Annots"]
            pdf.save(output_path, compress_streams=True)
    except pikepdf.PasswordError:
        raise Exception("PDF şifreli; düzleştirmek için doğru parolayı girin.")
    except Exception as e:
        if "password" in str(e).lower():
            raise Exception("PDF şifreli; düzleştirmek için doğru parolayı girin.")
        raise
    return True


def pdf_to_images_zip(
    pdf_path: str,
    workdir: str,
    image_format: str = "jpg",
    dpi: int = PDF_EXPORT_DPI_WEB,
    password: Optional[str] = None,
    progress_callback=None,
    pages: Optional[List[int]] = None,
) -> str:
    """ZIP dosya yolunu döndürür; sayfalar TEK TEK rasterize edilip doğrudan arşive yazılır.

    pages: yalnızca bu sayfalar (1 tabanlı) çevrilir; None → tüm sayfalar. Dosya adındaki
    numara özgün sayfa numarasıdır (sayfa_0003.jpg = belgenin 3. sayfası).
    Çıktı dosyalarına DPI bilgisi yazılır (yazdırırken doğru fiziksel boyut için).

    Bellek, sayfa sayısından bağımsız olarak tek sayfalık kalır (bkz.
    `_RASTER_PAGE_BATCH`); çözünürlük uzun belgelerde otomatik düşürülür
    (bkz. `_guvenli_raster_dpi`).
    """
    from pdf2image import convert_from_path

    fmt = (image_format or "jpg").lower()
    if fmt not in ("jpg", "jpeg", "png", "tif", "tiff"):
        raise Exception("Görüntü formatı jpg, png veya tiff olmalıdır.")
    ext = "png" if fmt == "png" else ("tiff" if fmt in ("tif", "tiff") else "jpg")
    import src.pdf_engine as pe

    poppler = getattr(pe, "poppler_bin_path", None) or None
    pwd = (password or "").strip()
    _open_pdf_reader(pdf_path, password=password)
    n = get_num_pages(pdf_path, password=password)

    # Tek sayfa işlendiği için ek iş parçacığı kazanç sağlamaz, yalnızca bellek
    # tüketir: bilerek 1.
    guvenli_dpi = _guvenli_raster_dpi(n, int(dpi))
    kw_base: dict = {"dpi": guvenli_dpi, "fmt": "png" if ext in ("png", "tiff") else "jpeg", "thread_count": 1}
    if poppler and os.path.isdir(poppler):
        kw_base["poppler_path"] = poppler
    if pwd:
        kw_base["userpw"] = pwd

    zip_path = os.path.join(workdir, "sayfalar.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        page_index = 0
        if pages:
            secili = sorted({int(p) for p in pages if 1 <= int(p) <= n})
            if not secili:
                raise Exception("Seçilen sayfalar belgede yok.")
            # Seçili sayfalar tek tek çevrilir (bitişik olmayabilirler).
            parcalar = [(p, p) for p in secili]
        else:
            parcalar = [
                (st, min(st + _RASTER_PAGE_BATCH - 1, n))
                for st in range(1, n + 1, _RASTER_PAGE_BATCH)
            ]
        toplam_cevrilecek = len(secili) if pages else n
        for start, end in parcalar:
            kw = {**kw_base, "first_page": start, "last_page": end}
            images = convert_from_path(pdf_path, **kw)
            for im in images:
                page_index += 1
                sayfa_no = start if pages else page_index
                # Sayfa sayfa ilerleme: 150 sayfalık bir belgede işlem dakikayı
                # aşıyor; kullanıcı kaçıncı sayfada olduğunu görmezse sekmeyi
                # kapatıyor.
                if progress_callback:
                    progress_callback(page_index, max(1, toplam_cevrilecek), f"Sayfa {page_index}/{toplam_cevrilecek} görsele çevriliyor")
                buf = io.BytesIO()
                dpi_etiketi = (guvenli_dpi, guvenli_dpi)
                if ext == "png":
                    im.save(buf, format="PNG", dpi=dpi_etiketi)
                    name = f"sayfa_{sayfa_no:04d}.png"
                elif ext == "tiff":
                    im.save(buf, format="TIFF", dpi=dpi_etiketi, compression="tiff_lzw")
                    name = f"sayfa_{sayfa_no:04d}.tiff"
                else:
                    im.save(buf, format="JPEG", quality=90, dpi=dpi_etiketi)
                    name = f"sayfa_{sayfa_no:04d}.jpg"
                zf.writestr(name, buf.getvalue())
                del im
    return zip_path


def extract_images_zip(
    pdf_path: str,
    workdir: str,
    password: Optional[str] = None,
) -> str:
    """PDF'e GÖMÜLÜ ham görselleri (sayfa rasterize DEĞİL) ayıklayıp ZIP yolunu döndürür.

    - pdf_to_images_zip sayfaları resme çevirir; bu ise dokümanın içindeki asıl
      görsel akışlarını (fotoğraf/logo vb.) özgün formatıyla (jpg/png…) çıkarır.
    - Aynı görsel birden çok sayfada kullanılıyorsa xref ile TEKİLLEŞTİRİLİR.
    - Hiç görsel yoksa açıklayıcı hata verir (boş ZIP dönmez).
    """
    doc = _fitz_open(pdf_path, password=password)
    try:
        zip_path = os.path.join(workdir, "gorseller.zip")
        seen_xrefs: set[int] = set()
        count = 0
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for page_number in range(doc.page_count):
                page = doc.load_page(page_number)
                for img in page.get_images(full=True):
                    xref = img[0]
                    if xref in seen_xrefs:
                        continue
                    seen_xrefs.add(xref)
                    try:
                        info = doc.extract_image(xref)
                    except Exception:
                        continue
                    data = info.get("image")
                    if not data:
                        continue
                    ext = (info.get("ext") or "png").lower()
                    count += 1
                    zf.writestr(f"gorsel_{count:04d}.{ext}", data)
        if count == 0:
            try:
                os.remove(zip_path)
            except OSError:
                pass
            raise Exception("Bu PDF'de ayıklanabilir gömülü görsel bulunamadı.")
        return zip_path
    finally:
        doc.close()


def images_to_pdf(
    image_paths: List[str],
    output_path: str,
    page_size: str = "a4",
) -> bool:
    """Görselleri tek PDF'te toplar.

    page_size:
        "a4"       → görsel, yönü korunarak A4 sayfaya sığdırılır (VARSAYILAN)
        "original" → sayfa, görselin kendi ölçüsü kadar olur (eski davranış)

    NEDEN A4 VARSAYILAN: Görselin piksel ölçüsü doğrudan sayfa ölçüsü sayıldığında
    1600x1200 piksellik sıradan bir fotoğraf 56x42 cm'lik bir sayfa üretiyordu;
    yazdırmak isteyen kullanıcı ölçeklenmiş, kenarları taşan bir çıktı alıyordu.
    """
    if page_size not in ("a4", "original"):
        page_size = "a4"

    if page_size == "original":
        try:
            import img2pdf
            with open(output_path, "wb") as f:
                f.write(img2pdf.convert(image_paths))
            return True
        except ImportError:
            pass

    A4_W, A4_H = 595.28, 841.89
    BOSLUK = 18.0
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
                if page_size == "original":
                    merged.insert_pdf(m)
                    continue
                kaynak = m[0].rect
                yatay = kaynak.width > kaynak.height
                sayfa_w, sayfa_h = (A4_H, A4_W) if yatay else (A4_W, A4_H)
                sayfa = merged.new_page(width=sayfa_w, height=sayfa_h)
                olcek = min(
                    (sayfa_w - 2 * BOSLUK) / kaynak.width,
                    (sayfa_h - 2 * BOSLUK) / kaynak.height,
                )
                w = kaynak.width * olcek
                h = kaynak.height * olcek
                hedef = fitz.Rect(
                    (sayfa_w - w) / 2,
                    (sayfa_h - h) / 2,
                    (sayfa_w + w) / 2,
                    (sayfa_h + h) / 2,
                )
                sayfa.show_pdf_page(hedef, m, 0)
            finally:
                m.close()
        merged.save(output_path, garbage=1, deflate=False)
    finally:
        merged.close()
    return True


def render_url_via_browser(
    url: str,
    output_path: str,
    request_guard: Optional[Callable[[str], bool]] = None,
    timeout_ms: int = 45000,
) -> bool:
    """Gerçek Chromium (Playwright) ile URL'yi olduğu gibi PDF'e basar.

    iLovePDF gibi rakiplerin kullandığı yaklaşım: sayfa gerçek bir tarayıcıda
    açılır, CSS/webfont/görseller tam yüklenir, ardından tarayıcının kendi
    "yazdır" motoruyla PDF üretilir. wkhtmltopdf/xhtml2pdf modern CSS'i
    (flexbox/grid, webfont) düzgün işleyemediği için stilsiz, bozuk karakterli
    çıktı veriyordu; bu fonksiyon birincil motor olarak onların yerini alır.

    request_guard verilirse, sayfanın yaptığı HER alt istek (görsel/CSS/font)
    bu callback'ten geçer — SSRF/DNS-rebinding koruması ana belgeyle sınırlı
    kalmaz, tüm kaynaklara uygulanır. Playwright kurulu değilse veya render
    başarısız olursa False döner (çağıran yedek motora düşer).
    """
    try:
        from playwright.sync_api import Error as _PwError, sync_playwright
    except ImportError:
        return False
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
            try:
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (compatible; PDFPlatformBot/1.0; +https://pdfplatform.app)",
                )
                page = context.new_page()
                if request_guard is not None:
                    # Host başına önbellek: aynı alan adına (ör. Wikipedia'da
                    # tek sayfa ~40 alt istek yapıyor, çoğu aynı CDN host'una)
                    # her seferinde DNS sorgusu yapmak hem yavaş hem de
                    # Playwright'ın eşzamanlı istek dağıtıcısında ara sıra
                    # yarış durumuna (route.request erişiminde TypeError)
                    # yol açıp ana belge isteğini iptal ettirebiliyordu —
                    # kullanıcıya boş sayfa olarak yansıyordu.
                    _guard_cache: Dict[str, bool] = {}

                    # DİKKAT: Playwright, handler'ın parametre SAYISINA bakıp
                    # 2+ parametreli fonksiyonları (route, request) ikilisiyle
                    # çağırıyor. request_guard/_guard_cache'i "varsayılan
                    # parametre" hilesiyle bağlamak handler'ı 2 parametreliymiş
                    # gibi gösteriyor; Playwright ikinci argümana GERÇEK
                    # request nesnesini basıp closure'ı bozuyordu (ana belge
                    # isteği sessizce iptal oluyor, kullanıcı boş PDF görüyordu).
                    # Bu yüzden TEK parametreli, dış değişkenlere closure ile
                    # erişen bir fonksiyon kullanılmalı.
                    def _route(route):
                        try:
                            req_url = route.request.url
                            host = urlsplit(req_url).netloc
                            if host in _guard_cache:
                                allowed = _guard_cache[host]
                            else:
                                allowed = bool(request_guard(req_url))
                                _guard_cache[host] = allowed
                        except Exception:
                            allowed = False
                        try:
                            if allowed:
                                route.continue_()
                            else:
                                route.abort()
                        except Exception:
                            pass
                    page.route("**/*", _route)
                try:
                    page.goto(url, wait_until="networkidle", timeout=timeout_ms)
                except _PwError:
                    # Ağ hiç durulmadı (ör. sürekli analytics isteği) — sayfa
                    # yine de DOM'a yüklenmiş olabilir, elimizdekiyle devam et.
                    pass
                page.emulate_media(media="print")
                page.pdf(
                    path=output_path,
                    format="A4",
                    print_background=True,
                    margin={"top": "12mm", "bottom": "12mm", "left": "10mm", "right": "10mm"},
                )
            finally:
                browser.close()
    except Exception:
        return False
    return os.path.isfile(output_path) and os.path.getsize(output_path) > 32


def html_to_pdf_file(html: str, output_path: str, base_url: Optional[str] = None) -> bool:
    """Önce wkhtmltopdf (daha uyumlu), sonra xhtml2pdf dener.

    Bu, render_url_via_browser (Playwright) kullanılamadığında ya da ham HTML
    metni (URL değil) verildiğinde devreye giren YEDEK yoldur.
    wkhtmltopdf sistemde yoksa xhtml2pdf ile devam eder (sınırlı CSS desteği).
    Her ikisi de başarısız olursa kullanıcı dostu bir hata mesajı fırlatır.
    """
    wk = shutil.which("wkhtmltopdf")
    if wk:
        # NOT: pdfkit (Python sarmalayıcısı) CVE-2025-26240 nedeniyle kaldırıldı;
        # wkhtmltopdf ikilisini doğrudan çağırıyoruz.
        # GÜVENLİK: Girdi (ham HTML veya çekilen URL içeriği) tamamen kullanıcı
        # kontrolünde. Güvenilmeyen girdi için wkhtmltopdf sıkılaştırması:
        #   --disable-javascript      → sayfa içi JS çalıştırılmaz (CVE kök nedeni)
        #   --disable-local-file-access → file:// ile yerel dosya sızdırma (LFI)
        #     engellenir; URL yolundaki SSRF korumasını render katmanında tamamlar.
        # Uzak http(s) CSS/görseller bu bayraklarla yine yüklenir.
        try:
            html_bytes = (html or "<html><body></body></html>").encode("utf-8")
            proc = subprocess.run(
                [
                    wk,
                    "--quiet",
                    "--disable-javascript",
                    "--disable-local-file-access",
                    "--disable-smart-shrinking",
                    "-",  # HTML'i stdin'den oku
                    output_path,
                ],
                input=html_bytes,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=120,
            )
            if (
                proc.returncode == 0
                and os.path.isfile(output_path)
                and os.path.getsize(output_path) > 32
            ):
                return True
        except Exception:
            pass
        if os.path.isfile(output_path) and os.path.getsize(output_path) <= 32:
            try:
                os.remove(output_path)
            except OSError:
                pass
    try:
        from xhtml2pdf import pisa
    except ImportError as e:
        raise Exception(
            "HTML→PDF dönüşümü şu anda kullanılamıyor. "
            "Sunucuda wkhtmltopdf kurulu değil ve xhtml2pdf paketi de bulunamadı. "
            "Lütfen daha sonra tekrar deneyin veya destek ekibiyle iletişime geçin."
        ) from e
    html_src = html or "<html><body></body></html>"
    # xhtml2pdf modern CSS'i parse edemez; tüm stylesheet referanslarını ve inline style bloklarını kaldır
    import re as _re
    html_src = _re.sub(r'<link[^>]+rel=["\']stylesheet["\'][^>]*>', '', html_src, flags=_re.IGNORECASE)
    html_src = _re.sub(r'<link[^>]+href=["\'][^"\']*\.css[^"\']*["\'][^>]*>', '', html_src, flags=_re.IGNORECASE)
    html_src = _re.sub(r'<style[^>]*>.*?</style>', '', html_src, flags=_re.IGNORECASE | _re.DOTALL)
    html_src = _re.sub(r'@import\s+["\'][^"\']+["\'];?', '', html_src, flags=_re.IGNORECASE)
    if "<meta charset" not in html_src[:1000].lower():
        if "<head>" in html_src.lower():
            html_src = html_src.replace("<head>", '<head><meta charset="utf-8">', 1)
        else:
            html_src = f'<html><head><meta charset="utf-8"></head><body>{html_src}</body></html>'
    def _run_pisa(src: str) -> bool:
        with open(output_path, "wb") as out:
            status = pisa.CreatePDF(
                src=src.encode("utf-8"),
                dest=out,
                encoding="utf-8",
                path_base=base_url or None,
            )
        return not status.err and os.path.isfile(output_path) and os.path.getsize(output_path) > 32

    try:
        ok = _run_pisa(html_src)
    except Exception:
        ok = False

    if not ok:
        # xhtml2pdf/reportlab, rowspan/colspan uyuşmayan karmaşık tablolarda
        # (ör. Wikipedia infobox tabloları) çöküyor. Tabloları kaldırıp yeniden dene.
        html_no_tables = _re.sub(r'<table\b.*?</table>', '', html_src, flags=_re.IGNORECASE | _re.DOTALL)
        if html_no_tables != html_src:
            try:
                ok = _run_pisa(html_no_tables)
            except Exception:
                ok = False

    if not ok:
        raise Exception(
            "HTML PDF'e dönüştürülemedi. "
            "Sayfanın geçerli HTML içerdiğinden emin olun ve JavaScript gerektirmeyen basit sayfalar deneyin. "
            "Karmaşık CSS/JS/tablo içeren sayfalar için URL yerine sayfa kaynağını (HTML metnini) kullanın."
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


def _slayta_gorunmez_metin(slide, sayfa, slide_w, slide_h, sayfa_w_pt, sayfa_h_pt) -> int:
    """Slayttaki görselin üzerine, PDF'teki yerlerinde GÖRÜNMEZ metin kutuları koyar.

    NEDEN: PDF→PowerPoint çıktısı her sayfayı tek parça GÖRSEL olarak koyuyordu;
    tanıtımda "düzenlenebilir slayt" dendiği hâlde kullanıcı tek bir kelimeyi bile
    seçemiyor, kopyalayamıyordu. Görselin üstüne saydam (alfa=0) metin konunca
    slayt göze aynı görünür ama metin seçilebilir, aranabilir ve kopyalanabilir
    olur — arama motorları için ürettiğimiz "aranabilir PDF" ile aynı yaklaşım.

    Satır bazında çalışır (kelime bazında değil): büyük belgelerde slayt başına
    binlerce şekil üretmemek için. Dönüş: eklenen kutu sayısı.
    """
    from pptx.util import Emu, Pt

    PT_TO_EMU = 12700
    try:
        satirlar = sayfa.extract_text_lines(layout=False, strip=True, return_chars=False) or []
    except Exception:
        return 0

    # Aşırı yoğun sayfalarda (tablo dökümleri) şekil sayısını sınırla: dosya
    # şişer, PowerPoint yavaşlar. 300 satır pratikte tüm normal belgeleri kapsar.
    if len(satirlar) > 300:
        satirlar = satirlar[:300]

    olcek_x = slide_w / (sayfa_w_pt * PT_TO_EMU) if sayfa_w_pt else 1.0
    olcek_y = slide_h / (sayfa_h_pt * PT_TO_EMU) if sayfa_h_pt else 1.0
    eklenen = 0

    for ln in satirlar:
        metin = (ln.get("text") or "").strip()
        if not metin:
            continue
        x0 = float(ln.get("x0", 0.0))
        ust = float(ln.get("top", 0.0))
        x1 = float(ln.get("x1", x0 + 10))
        alt = float(ln.get("bottom", ust + 10))
        yukseklik_pt = max(4.0, alt - ust)

        kutu = slide.shapes.add_textbox(
            Emu(int(x0 * PT_TO_EMU * olcek_x)),
            Emu(int(ust * PT_TO_EMU * olcek_y)),
            Emu(int(max(1.0, x1 - x0) * PT_TO_EMU * olcek_x)),
            Emu(int(yukseklik_pt * PT_TO_EMU * olcek_y)),
        )
        tf = kutu.text_frame
        tf.word_wrap = False
        try:
            tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        except Exception:
            pass
        par = tf.paragraphs[0]
        run = par.add_run()
        run.text = metin
        run.font.size = Pt(max(4.0, yukseklik_pt * 0.82))

        # Metni GÖRÜNMEZ yap: rengin alfa değeri 0. python-pptx'te doğrudan alfa
        # ayarı yok; renk düğümüne alfa çocuğu eklenir.
        try:
            from pptx.oxml.ns import qn
            rPr = run._r.get_or_add_rPr()
            fill = rPr.makeelement(qn("a:solidFill"), {})
            srgb = rPr.makeelement(qn("a:srgbClr"), {"val": "000000"})
            alpha = rPr.makeelement(qn("a:alpha"), {"val": "0"})
            srgb.append(alpha)
            fill.append(srgb)
            rPr.append(fill)
        except Exception:
            # Alfa eklenemezse metni hiç koyma: görünür metin, görselin üstüne
            # binip çıktıyı bozardı.
            try:
                slide.shapes._spTree.remove(kutu._element)
            except Exception:
                pass
            continue
        eklenen += 1

    return eklenen


def pdf_to_pptx(
    pdf_path: str,
    pptx_path: str,
    password: Optional[str] = None,
    dpi: int = PDF_EXPORT_DPI_WEB,
    progress_callback=None,
) -> bool:
    from pdf2image import convert_from_path
    from pptx import Presentation
    from pptx.util import Emu
    import pdfplumber
    import src.pdf_engine as pe

    poppler = getattr(pe, "poppler_bin_path", None) or None
    pwd = (password or "").strip()
    _open_pdf_reader(pdf_path, password=password)
    n = get_num_pages(pdf_path, password=password)

    # Sayfa sayfa ve tek iş parçacığıyla — PDF→Görsel ile aynı sebep: 300 DPI'da
    # birkaç sayfayı birden açmak 512 MB'lık sunucuda süreci öldürüyor ve TÜM
    # servisi düşürüyordu. Uzun belgelerde çözünürlük de otomatik düşer.
    guvenli_dpi = _guvenli_raster_dpi(n, int(dpi))
    kw_base: dict = {"dpi": guvenli_dpi, "fmt": "png", "thread_count": 1}
    if poppler and os.path.isdir(poppler):
        kw_base["poppler_path"] = poppler
    if pwd:
        kw_base["userpw"] = pwd

    # PDF'in gerçek sayfa boyutunu al (ilk sayfa referans)
    # pdfplumber sayfa boyutunu pt cinsinden verir; 1 pt = 12700 EMU
    PT_TO_EMU = 12700
    page_w_pt, page_h_pt = 595.0, 842.0  # A4 varsayılan
    try:
        with pdfplumber.open(pdf_path, password=pwd or "") as _pdf:
            if _pdf.pages:
                p0 = _pdf.pages[0]
                page_w_pt = float(p0.width)
                page_h_pt = float(p0.height)
    except Exception:
        pass

    prs = Presentation()
    # Slayt boyutunu PDF sayfa boyutuna eşitle → görüntü bozulmadan yerleşir
    prs.slide_width = Emu(int(page_w_pt * PT_TO_EMU))
    prs.slide_height = Emu(int(page_h_pt * PT_TO_EMU))

    try:
        blank = prs.slide_layouts[6]
    except (IndexError, KeyError):
        blank = prs.slide_layouts[0]

    slide_w = prs.slide_width
    slide_h = prs.slide_height

    # Metin katmanı için pdfplumber belgesi döngü boyunca açık kalır. Sayfalar
    # tembel yüklenir ve her sayfadan sonra önbelleği boşaltılır: 200 sayfalık bir
    # belgede bellek sayfa sayısıyla büyümesin (sunucu 512 MB ile çalışıyor).
    _pdfplumber_belge = None
    _pdfplumber_sayfalari = None
    try:
        _pdfplumber_belge = pdfplumber.open(pdf_path, password=pwd or "")
        _pdfplumber_sayfalari = _pdfplumber_belge.pages
    except Exception:
        _pdfplumber_belge = None
        _pdfplumber_sayfalari = None

    _done = 0
    for start in range(1, n + 1, _RASTER_PAGE_BATCH):
        end = min(start + _RASTER_PAGE_BATCH - 1, n)
        kw = {**kw_base, "first_page": start, "last_page": end}
        images = convert_from_path(pdf_path, **kw)
        for im in images:
            # Arka plan isinde kullaniciya GERCEK ilerleme gosterilir; islem
            # dakikalar surdugu icin donuk bir cubuk "takildi" izlenimi verir.
            _done += 1
            if progress_callback:
                progress_callback(_done, n, f"Sayfa {_done}/{n} slayta aktarılıyor")
            slide = prs.slides.add_slide(blank)
            fd, tmp = tempfile.mkstemp(suffix=".png")
            os.close(fd)
            try:
                im.save(tmp, "PNG")
                img_w_px, img_h_px = im.size
                # En-boy oranını koruyarak slayta sığdır (letterbox)
                scale = min(slide_w / img_w_px, slide_h / img_h_px)
                pic_w = Emu(int(img_w_px * scale))
                pic_h = Emu(int(img_h_px * scale))
                left = Emu(int((slide_w - pic_w) / 2))
                top = Emu(int((slide_h - pic_h) / 2))
                slide.shapes.add_picture(tmp, left, top, width=pic_w, height=pic_h)
                # Görselin üzerine seçilebilir (görünmez) metin katmanı.
                try:
                    if _pdfplumber_sayfalari is not None:
                        _sayfa_no = _done - 1
                        if 0 <= _sayfa_no < len(_pdfplumber_sayfalari):
                            _slayta_gorunmez_metin(
                                slide,
                                _pdfplumber_sayfalari[_sayfa_no],
                                slide_w,
                                slide_h,
                                page_w_pt,
                                page_h_pt,
                            )
                except Exception:
                    # Metin katmanı eklenemezse slayt yine geçerlidir (yalnız görsel).
                    pass
            finally:
                try:
                    os.remove(tmp)
                except OSError:
                    pass
            # Sayfa önbelleğini bırak: uzun belgelerde bellek birikmesin.
            try:
                if _pdfplumber_sayfalari is not None and 0 <= _done - 1 < len(_pdfplumber_sayfalari):
                    _s = _pdfplumber_sayfalari[_done - 1]
                    _s.flush_cache()
                    _s.get_textmap.cache_clear()
            except Exception:
                pass
            del im

    if _pdfplumber_belge is not None:
        try:
            _pdfplumber_belge.close()
        except Exception:
            pass

    prs.save(pptx_path)
    return True


def pptx_to_pdf(pptx_path: str, pdf_path: str) -> bool:
    import shutil
    import subprocess

    # Sunucuda (GOTENBERG_URL tanımlıysa) önce Gotenberg denenir — aynı
    # LibreOffice motoru, ama process açıp kapatma maliyeti yok. Masaüstünde
    # (env yok) hemen False döner, aşağıdaki PowerPoint COM/LibreOffice
    # yoluna sorunsuz düşülür.
    if gotenberg_convert_to_pdf(pptx_path, pdf_path):
        return True

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
        os.makedirs(os.path.dirname(os.path.abspath(pdf_path)), exist_ok=True)
        # İzole kullanıcı profili: eşzamanlı dönüşümlerde profil kilidini önler.
        profile_dir = tempfile.mkdtemp(prefix="lo_profile_")
        # İzole çıktı dizini: LibreOffice çıktıyı kaynak basename'iyle üretir →
        # hedef dizindeki aynı isimli mevcut dosyayı ezmesin diye ayrı dizine üretilir.
        conv_dir = tempfile.mkdtemp(prefix="lo_out_")
        try:
            subprocess.run(
                [
                    soffice,
                    f"-env:UserInstallation=file://{profile_dir}",
                    "--headless", "--convert-to", "pdf", "--outdir", conv_dir, pptx_abs,
                ],
                check=True,
                timeout=timeout_sec,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            shutil.rmtree(conv_dir, ignore_errors=True)
            raise Exception(f"LibreOffice dönüşümü başarısız: {e.stderr or e}") from e
        finally:
            shutil.rmtree(profile_dir, ignore_errors=True)
        base = os.path.splitext(os.path.basename(pptx_abs))[0]
        produced = os.path.join(conv_dir, base + ".pdf")
        try:
            if not os.path.isfile(produced):
                raise Exception("LibreOffice çıktı dosyası oluşmadı.")
            shutil.move(produced, pdf_path)
        finally:
            shutil.rmtree(conv_dir, ignore_errors=True)
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
                try:
                    app.DisplayAlerts = 0
                except Exception:
                    pass
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


# ─────────────────────────────────────────────────────────────────────────────
#  PDF/A — ARŞİV BİÇİMİ
# ─────────────────────────────────────────────────────────────────────────────
#
#  NEDEN GEREKLİ: Kamu ihaleleri, e-arşiv, mahkeme ve üniversite tesliminde
#  belgenin "PDF/A" olması isteniyor. PDF/A, belgenin 20 yıl sonra da aynı
#  görünmesini garanti eden ISO biçimidir: yazı tipleri dosyanın İÇİNE gömülür,
#  renkler cihazdan bağımsız tanımlanır, dış kaynağa bağlanma ve şifreleme
#  yasaktır.
#
#  NASIL: Ghostscript'in belgelenmiş yolu kullanılır — `-dPDFA=<1|2|3>` ve bir
#  "PDF/A tanım dosyası" (PDFA_def.ps). Tanım dosyası, çıktının hangi renk
#  uzayına göre yorumlanacağını söyleyen ICC profilini bildirir; belgelerde bu
#  dosyanın ICC yolunun ELLE düzeltilmesi gerektiği yazar, biz de çalışma anında
#  üretiyoruz.
#
#  `-dPDFACompatibilityPolicy=1`: PDF/A'ya aykırı bir öğe (ör. dış bağlantı,
#  gömülemeyen yazı tipi) görülürse o öğe ATILIR ve belge uyumlu kalır.
#  Varsayılan olan 0 seçilseydi öğe korunur ama dosya PDF/A SAYILMAZDI — yani
#  kullanıcı uyumlu sandığı bir dosyayı kuruma gönderirdi.
#
#  Ghostscript yalnızca "b" (temel) uyumluluk düzeyini üretebilir; PDF/A-1a gibi
#  etiketleme gerektiren düzeyler desteklenmez, bu yüzden kullanıcıya da
#  sunulmaz.

_PDFA_SURUMLERI = {"1b": 1, "2b": 2, "3b": 3}


def _ghostscript_yolu() -> str:
    """Ghostscript çalıştırılabiliri (Linux: gs, Windows: gswin64c)."""
    for ad in ("gs", "gswin64c", "gswin32c"):
        yol = shutil.which(ad)
        if yol:
            return yol
    raise Exception(
        "PDF/A dönüşümü için Ghostscript gerekli ancak sistemde bulunamadı."
    )


def _icc_profili_bul() -> str | None:
    """
    Çıktı niyeti (OutputIntent) için bir ICC profili bulur.

    Ghostscript kendi profillerini `iccprofiles/` klasöründe dağıtır; dağıtımdan
    dağıtıma yol değiştiği için sabit yol yazmak yerine aranır. Bulunamazsa
    çağıran taraf cihazdan bağımsız renk kipine düşer.
    """
    import glob

    adaylar: list[str] = []
    for kalip in (
        "/usr/share/ghostscript/*/iccprofiles/srgb.icc",
        "/usr/share/ghostscript/*/iccprofiles/default_rgb.icc",
        "/usr/lib/ghostscript/*/iccprofiles/srgb.icc",
        "/usr/share/color/icc/sRGB.icc",
        "/usr/share/color/icc/colord/sRGB.icc",
    ):
        adaylar.extend(sorted(glob.glob(kalip)))
    for yol in adaylar:
        if os.path.isfile(yol):
            return yol
    return None


def _pdfa_tanim_dosyasi(klasor: str, icc_yolu: str | None) -> str:
    """
    PDF/A tanım dosyasını (PostScript) üretir.

    İçeriği Ghostscript'in örnek dosyasıyla aynı işi yapar: belgeye bir
    "çıktı niyeti" ekler. ICC profili yoksa niyet bildirilmez; bu durumda
    renkler cihazdan bağımsız kipte dönüştürülür.
    """
    yol = os.path.join(klasor, "PDFA_def.ps")
    if icc_yolu:
        # PostScript dizgesinde ters bölü kaçış karakteridir; Windows yolları bozulmasın.
        icc_ps = icc_yolu.replace("\\", "/")
        icerik = f"""%!
% PDF/A tanım dosyası — çalışma anında üretildi.
[ /Title (Belge) /DOCINFO pdfmark

[/_objdef {{icc_PDFA}} /type /stream /OBJ pdfmark
[{{icc_PDFA}} <</N 3>> /PUT pdfmark
[{{icc_PDFA}} ({icc_ps}) (r) file /PUT pdfmark

[/_objdef {{OutputIntent_PDFA}} /type /dict /OBJ pdfmark
[{{OutputIntent_PDFA}} <<
  /Type /OutputIntent
  /S /GTS_PDFA1
  /DestOutputProfile {{icc_PDFA}}
  /OutputConditionIdentifier (sRGB)
>> /PUT pdfmark
[{{Catalog}} <</OutputIntents [ {{OutputIntent_PDFA}} ]>> /PUT pdfmark
"""
    else:
        icerik = "%!\n% ICC profili bulunamadı — çıktı niyeti bildirilmiyor.\n"
    with open(yol, "w", encoding="utf-8") as f:
        f.write(icerik)
    return yol


def pdfa_komutu(
    gs: str,
    surum: str,
    tanim_dosyasi: str,
    girdi: str,
    cikti: str,
    icc_var: bool,
) -> list[str]:
    """
    Ghostscript komutunu kurar (ayrı işlev: parametreler testle sabitlenebilsin).

    `-dPDFACompatibilityPolicy=1` kritik: PDF/A'ya aykırı bir öğe görülürse o öğe
    ATILIR ve belge uyumlu kalır. Varsayılan 0 olsaydı öğe korunur ama dosya
    PDF/A SAYILMAZDI — kullanıcı uyumlu sandığı bir belgeyi kuruma gönderirdi.
    """
    return [
        gs,
        "-dBATCH",
        "-dNOPAUSE",
        "-dQUIET",
        f"-dPDFA={_PDFA_SURUMLERI[surum]}",
        "-dPDFACompatibilityPolicy=1",
        "-sDEVICE=pdfwrite",
        # ICC varsa RGB'ye, yoksa cihazdan bağımsız renge dönüştür.
        "-sColorConversionStrategy=RGB" if icc_var else "-sColorConversionStrategy=UseDeviceIndependentColor",
        f"-sOutputFile={cikti}",
        tanim_dosyasi,
        girdi,
    ]


def pdf_to_pdfa(
    input_path: str,
    output_path: str,
    surum: str = "2b",
) -> dict:
    """
    PDF'i PDF/A arşiv biçimine dönüştürür.

    Args:
        surum: "1b", "2b" ya da "3b". Varsayılan 2b — şeffaflığı desteklediği
            için modern belgelerde en az bozulmayı veren düzey budur.

    Returns:
        {"surum": "2b", "cikti_niyeti": bool, "uyari": str | None}
    """
    if surum not in _PDFA_SURUMLERI:
        raise Exception("Geçersiz PDF/A sürümü. Seçenekler: 1b, 2b, 3b.")

    gs = _ghostscript_yolu()
    icc = _icc_profili_bul()

    with tempfile.TemporaryDirectory() as gecici:
        tanim = _pdfa_tanim_dosyasi(gecici, icc)
        komut = pdfa_komutu(gs, surum, tanim, input_path, output_path, bool(icc))
        try:
            proc = subprocess.run(
                komut,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=300,
            )
        except subprocess.TimeoutExpired as exc:
            raise Exception(
                "PDF/A dönüşümü çok uzun sürdü. Belge çok büyük olabilir."
            ) from exc

        if proc.returncode != 0 or not os.path.isfile(output_path) or os.path.getsize(output_path) < 64:
            hata = (proc.stderr or b"").decode("utf-8", "ignore").strip()
            # Ghostscript hatası kullanıcıya ham gösterilmez; son satır ipucu olarak taşınır.
            son = hata.splitlines()[-1][:200] if hata else ""
            raise Exception(
                "Belge PDF/A biçimine dönüştürülemedi."
                + (f" (Ayrıntı: {son})" if son else "")
            )

    uyari = None
    if not icc:
        uyari = (
            "Sistemde renk profili bulunamadığından belge, renkleri cihazdan "
            "bağımsız kipte dönüştürülerek üretildi."
        )
    return {"surum": surum, "cikti_niyeti": bool(icc), "uyari": uyari}

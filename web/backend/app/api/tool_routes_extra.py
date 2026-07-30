"""Ek PDF araç uç noktaları (result-store + doğrudan indirme). routes.py ile döngüsel import yok."""

from __future__ import annotations

import ipaddress
import json
import logging
import os as _os
import socket
import urllib.parse
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from app.limiter import limiter

from app.api.pdf_auth import extract_pdf_access_token
from app.core import operations
from app.core import editor_daily_limit as _edl
from app.core.operations import (
    cleanup_and_raise,
    cleanup_path,
    create_workdir,
    format_derived_filename,
    parse_pages_text,
    save_upload,
    save_office_upload,
    save_any_upload,
    max_bytes_from_decision,
)
from app.core.preview_thumbnail import (
    generate_blurred_pdf_thumbnail_from_path,
    generate_blurred_pdf_thumbnail_from_doc,
)
from app.core.result_store import (
    save_result_from_file,
    get_result,
    read_meta_only,
    delete_result,
)
from app.core.thread_pool import CpuCapacityTimeout, run_cpu_bound
from app.core.pdf_sandbox import run_sandboxed
from app.core.saas_gate import (
    consume_editor_download,
    entitlement_check,
    saas_current_user_id,
    saas_user_identity,
)
from app.core.pdf_security import (
    validate_pdf_before_processing,
    log_pdf_operation_error,
    log_suspicious_pdf,
)
from src import pdf_toolkit_extra as ptx

logger = logging.getLogger(__name__)

engine = operations.get_engine()

_PRIVATE_NETS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # AWS metadata + link-local
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _check_ip_not_private(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> None:
    """Raises HTTPException(400) if ip_address belongs to a private/reserved network."""
    for net in _PRIVATE_NETS:
        if addr in net:
            raise HTTPException(status_code=400, detail="İzin verilmeyen hedef: dahili/özel ağ adresi.")


def _resolve_ssrf_safe(url: str) -> tuple[str, urllib.parse.ParseResult]:
    """DNS'i bir kez çözümler, IP'yi doğrular ve (çözülmüş_ip, parsed_url) döndürür.

    DNS rebinding (TOCTOU) saldırısını engeller:
    - Hostname yalnızca BİR KEZ çözümlenir.
    - Dönen IP doğrulanır.
    - Çağıran, asıl HTTP isteğini bu IP üzerinden yapar; hostname tekrar çözümlenmez.
    """
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Yalnızca HTTP ve HTTPS URL'leri desteklenmektedir.")
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Geçersiz URL: sunucu adresi bulunamadı.")

    # IP literal mi? — doğrudan doğrula, DNS'e gerek yok.
    try:
        addr = ipaddress.ip_address(hostname)
        _check_ip_not_private(addr)
        return str(addr), parsed
    except ValueError:
        pass  # hostname, literal IP değil — DNS ile çözümle

    # DNS'i bir kez çözümle ve tüm dönen IP'leri doğrula.
    try:
        infos = socket.getaddrinfo(hostname, None)
    except OSError:
        raise HTTPException(status_code=400, detail="URL'deki sunucu adı çözümlenemedi.")

    if not infos:
        raise HTTPException(status_code=400, detail="URL'deki sunucu adı çözümlenemedi.")

    for info in infos:
        ip_str = info[4][0]
        try:
            addr = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        _check_ip_not_private(addr)

    # Tüm IP'ler doğrulandı; ilk çözümlenen IP'yi döndür.
    resolved_ip = infos[0][4][0]
    return resolved_ip, parsed

router = APIRouter(prefix="/api", tags=["nb-pdf-TOOLS-extras"])


def _client_ip(request: Request) -> str:
    """Mümkünse gerçek istemci IP'sini döndürür."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "<bilinmiyor>"


def _after_save_validate(
    saved: Path,
    request: Request,
    decision: dict,
    filename: str | None = None,
) -> None:
    """Dosya diske yazıldıktan sonra ek PDF güvenlik doğrulaması çalıştırır.

    save_upload'ın yaptığı content-type + magic byte + boyut kontrollerini
    tamamlar: sayfa sayısı sınırı, şüpheli oran kontrolü ve IP loglaması.
    """
    ip = _client_ip(request)
    validate_pdf_before_processing(
        saved,
        filename=filename or saved.name,
        expected_max_bytes=max_bytes_from_decision(decision),
        client_ip=ip,
    )


def _g_check(d: dict[str, Any]) -> dict[str, Any]:
    return {
        "allowed": bool(d.get("allowed")),
        "reason": str(d.get("reason", "")),
        "cost": int(d.get("cost") or 0),
        "creditsBefore": int(d.get("creditsBefore") or 0),
        "creditsAfter": int(d.get("creditsAfter") or 0),
        "watermarkEnabled": bool(d.get("watermarkEnabled", False)),
    }


def _maybe_watermark_pdf(p: Path, enabled: bool) -> None:
    """Plan-level watermark: FREE/Starter çıktılarına NB PDF Platform damgası ekler."""
    if not enabled:
        return
    tmp = p.parent / (p.stem + "__wm_tmp.pdf")
    try:
        from src import pdf_toolkit_extra as _ptx
        _ptx.add_watermark_text(
            str(p), str(tmp),
            "NB PDF Platform",
            opacity=0.12,
            font_name="helv",
            font_color="#8C8C8C",
        )
        _os.replace(str(tmp), str(p))
    except Exception as exc:
        logger.warning("Plan watermark uygulama başarısız (non-fatal): %s", exc)
        try:
            if tmp.exists():
                tmp.unlink(missing_ok=True)
        except Exception:
            pass


# --- result-store: önizleme + kredi indirmede


def _pack_text_result_file(out_p: Path, out_filename: str, user_id: str, tool: str) -> dict[str, Any]:
    h = save_result_from_file(
        out_p,
        out_filename,
        "text/plain; charset=utf-8",
        user_id=user_id,
        tool=tool,
    )
    return {
        "result_id": h.result_id,
        "filename": h.filename,
        "mime": h.mime,
        "size_bytes": h.size_bytes,
        "has_thumbnail": False,
    }


def _pack_pdf_result_file(out_p: Path, out_filename: str, user_id: str, tool: str) -> dict[str, Any]:
    thumb = generate_blurred_pdf_thumbnail_from_path(out_p)
    h = save_result_from_file(
        out_p,
        out_filename,
        "application/pdf",
        user_id=user_id,
        thumbnail_png=thumb,
        tool=tool,
    )
    return {
        "result_id": h.result_id,
        "filename": h.filename,
        "mime": h.mime,
        "size_bytes": h.size_bytes,
        "has_thumbnail": h.has_thumbnail,
    }


@router.post("/delete-pages")
@limiter.limit("20/minute")
async def tool_delete_pages(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    pages_to_delete: str = Form(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "delete-pages")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Silinmis", "pdf")
        out_p = workdir / out_n
        watermark = bool(decision.get("watermarkEnabled", False))

        def _run() -> dict[str, Any]:
            import fitz as _fitz
            src = _fitz.open(sp)
            if src.needs_pass:
                if not (pwd or ""):
                    raise Exception("Şifreli PDF için parola gerekli.")
                if not src.authenticate(pwd or ""):
                    raise Exception("Girilen PDF parolası hatalı.")
            thumb: bytes | None = None
            try:
                n = src.page_count
                to_del = parse_pages_text(pages_to_delete, max_page=n)
                to_del_set = {int(p) for p in to_del}
                if len(to_del_set) >= n:
                    raise HTTPException(
                        status_code=400,
                        detail="Tüm sayfalar silinemez; en az bir sayfa kalmalıdır.",
                    )
                keep = [i for i in range(n) if (i + 1) not in to_del_set]
                # Ardışık aralıkları tek insert_pdf çağrısıyla kopyala —
                # select()+save() tüm dosyayı yeniden yazarken bu yaklaşım
                # yalnızca tutulan sayfaları yeni boş doc'a aktarır.
                new_doc = _fitz.open()
                try:
                    ranges: list[tuple[int, int]] = []
                    if keep:
                        s = keep[0]; e = keep[0]
                        for k in keep[1:]:
                            if k == e + 1:
                                e = k
                            else:
                                ranges.append((s, e))
                                s = e = k
                        ranges.append((s, e))
                    for from_p, to_p in ranges:
                        new_doc.insert_pdf(src, from_page=from_p, to_page=to_p)
                    thumb = generate_blurred_pdf_thumbnail_from_doc(new_doc)
                    new_doc.save(str(out_p), garbage=0, deflate=False, linear=False)
                finally:
                    new_doc.close()
            finally:
                src.close()
            _maybe_watermark_pdf(out_p, watermark)
            h = save_result_from_file(
                out_p,
                out_n,
                "application/pdf",
                user_id=user_id,
                thumbnail_png=thumb,
                tool="delete-pages",
            )
            return {
                "result_id": h.result_id,
                "filename": h.filename,
                "mime": h.mime,
                "size_bytes": h.size_bytes,
                "has_thumbnail": h.has_thumbnail,
            }

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=file.filename or "<?>", client_ip=_client_ip(request), operation="delete-pages")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


# Gerçek metin düzenleme için gömülü Türkçe fontlar (hepsi Türkçe destekli).
_ASSETS = Path(__file__).resolve().parent.parent / "assets"
_EDIT_FONT_PATH = str(_ASSETS / "Roboto-Regular.ttf")
_EDIT_FONTS = {
    "sans": str(_ASSETS / "Roboto-Regular.ttf"),
    "serif": str(_ASSETS / "NotoSerif-Regular.ttf"),
    "mono": str(_ASSETS / "RobotoMono-Regular.ttf"),
    "lato": str(_ASSETS / "Lato-Regular.ttf"),
    "montserrat": str(_ASSETS / "Montserrat-Regular.ttf"),
    "merriweather": str(_ASSETS / "Merriweather-Regular.ttf"),
    "oswald": str(_ASSETS / "Oswald-Regular.ttf"),
}

# Kelime bazlı zengin biçim (insert_htmlbox) için: font-family adlarını (frontend'in
# gönderdiği FONT_LABEL adları) gerçek gömülü TTF'lere @font-face + archive ile bağla →
# 7 font DOĞRU çıkar (aksi halde htmlbox genel aileye düşerdi). Adlar tarayıcı önizlemesiyle
# birebir aynı (Roboto / Noto Serif / …) → önizleme = indirilen.
_EDIT_FONT_FAMILY = {
    "sans": "Roboto", "serif": "Noto Serif", "mono": "Roboto Mono",
    "lato": "Lato", "montserrat": "Montserrat", "merriweather": "Merriweather", "oswald": "Oswald",
}
_EDIT_FONT_CSS = "".join(
    f'@font-face {{font-family: "{_EDIT_FONT_FAMILY[_k]}"; src: url({Path(_v).name});}}'
    for _k, _v in _EDIT_FONTS.items()
)
_edit_font_archive_cache: Any = None


def _edit_font_archive():
    """insert_htmlbox'a verilecek font arşivi (gömülü TTF'ler, basename ile). Süreç başına bir kez."""
    global _edit_font_archive_cache
    if _edit_font_archive_cache is None:
        import fitz as _fitz

        ar = _fitz.Archive()
        for _v in _EDIT_FONTS.values():
            ar.add(_v, Path(_v).name)
        _edit_font_archive_cache = ar
    return _edit_font_archive_cache


def _map_font_to_key(font_name: str) -> str:
    """PDF span font adını mevcut gömülü fontlardan en yakınına eşler (serif/sans/mono).

    PDF'in gerçek fontu çoğu zaman lisanslı/gömülemez olduğundan bu EN-YAKIN
    eşlemedir (serif belge serif kalır, monospace mono kalır). Kalın/italik
    ayrımı korunmaz (yalnız Regular kesitler mevcut).
    """
    f = (font_name or "").lower()
    if any(k in f for k in ("mono", "courier", "consol", "menlo", "typewriter")):
        return "mono"
    if "montserrat" in f:
        return "montserrat"
    if "lato" in f:
        return "lato"
    if "oswald" in f:
        return "oswald"
    if "merriweather" in f:
        return "merriweather"
    if any(k in f for k in ("times", "serif", "georgia", "garamond", "minion", "roman", "cambria", "palatino")):
        return "serif"
    return "sans"


def _hex_to_rgb01(hex_str: str | None) -> tuple[float, float, float]:
    """'#RRGGBB' → (r,g,b) 0..1. Geçersizse siyah."""
    try:
        h = (hex_str or "").lstrip("#")
        if len(h) == 6:
            return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)
    except Exception:
        pass
    return (0.0, 0.0, 0.0)


@router.post("/edit-text")
@limiter.limit("15/minute")
async def tool_edit_text(
    request: Request,
    file: UploadFile = File(...),
    edits: str = Form("[]"),
    password: str = Form(""),
    store: str = Form(""),
):
    # Not: bu araç misafire de açık (token gerekmez). Kötüye kullanımı boyut (50MB),
    # oran (15/dk) ve sandbox sınırları önler; entitlement/kredi tüketmez.
    """Sunucu tarafı GERÇEK metin düzenleme: seçili bölgedeki mevcut metni PyMuPDF
    redaction ile GERÇEKTEN siler (örtmez), yerine yeni metni yazar. `edits`:
    JSON [{page, bbox:[x0,y0,x1,y1] (PDF nokta, üst-sol origin), text, size}].
    NOT: bu araçta dosya sunucuya yüklenir (frontend'de gizlilik uyarısı gösterilir)."""
    import json as _json

    decision = {"fileSizeLimitMB": 50}
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        try:
            ops = _json.loads(edits or "[]")
            if not isinstance(ops, list):
                ops = []
        except Exception:
            ops = []
        pwd = password.strip() or None
        sp = str(saved)
        out_p = workdir / format_derived_filename(file.filename or saved.name, "Duzenlenmis", "pdf")
        # Madde 1: hazırlanan PDF SUNUCUDA saklanır; indirme jetonu (dl) meta'nın user_id'si
        # olur → yalnız hazırlayan indirebilir (misafir dahil, Node token'ı gerekmeden).
        import secrets as _secrets
        dl_token = _secrets.token_urlsafe(18)
        _store_result = str(store).strip().lower() in ("1", "true", "yes")

        def _run() -> Any:
            import fitz as _fitz

            doc = _fitz.open(sp)
            try:
                if doc.needs_pass:
                    if not pwd or not doc.authenticate(pwd):
                        raise HTTPException(status_code=400, detail="Şifreli PDF için doğru parola gerekli.")
                n = doc.page_count
                by_page: dict[int, list] = {}
                for op in ops:
                    try:
                        pi = int(op.get("page", 0))
                        bb = op.get("bbox") or []
                        if 0 <= pi < n and len(bb) == 4:
                            by_page.setdefault(pi, []).append(op)
                    except Exception:
                        continue
                import base64 as _b64
                import io as _io
                import math as _math

                # Otomatik sığdır: çevrilmiş/düzenlenmiş metin orijinal kutudan genişse
                # fontu SIĞACAK şekilde küçült (tek satır kalır → alttaki içerikle çakışmaz).
                _font_cache: dict[str, _fitz.Font] = {}

                def _fit_size(text: str, fkey: str, box_w: float, fs: float) -> float:
                    if box_w <= 1:
                        return fs
                    fobj = _font_cache.get(fkey)
                    if fobj is None:
                        try:
                            fobj = _fitz.Font(fontfile=_EDIT_FONTS[fkey])
                        except Exception:
                            return fs
                        _font_cache[fkey] = fobj
                    try:
                        tw = fobj.text_length(text, fontsize=fs)
                    except Exception:
                        return fs
                    if tw > box_w and tw > 0:
                        return max(fs * (box_w / tw), 5.0)  # okunur taban 5pt
                    return fs

                def _fit_block_size(text: str, fkey: str, box_w: float, box_h: float, fs: float) -> float:
                    """Sarmalı (çok satırlı) blok için: metin, kelime kaydırmayla box_w'ye sarıldığında
                    gereken satır sayısı × satır yüksekliği box_h'yi aşıyorsa fontu küçült. Çeviri
                    (hedef dil çoğu kez daha uzun) paragraf kutusuna sığsın diye."""
                    if box_w <= 1 or box_h <= 1:
                        return fs
                    fobj = _font_cache.get(fkey)
                    if fobj is None:
                        try:
                            fobj = _fitz.Font(fontfile=_EDIT_FONTS[fkey])
                        except Exception:
                            return fs
                        _font_cache[fkey] = fobj
                    words = text.split()
                    if not words:
                        return fs

                    def _lines_at(size: float) -> int:
                        try:
                            space = fobj.text_length(" ", fontsize=size)
                        except Exception:
                            return 1
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

                for pi, page_ops in by_page.items():
                    page = doc[pi]
                    # Görsel EKLEME op'ları (op.image) altındaki içeriği silmemeli;
                    # metin/silme op'larından ayrılır.
                    text_ops = [o for o in page_ops if not o.get("image")]
                    image_ops = [o for o in page_ops if o.get("image")]

                    # 1) Seçili bölgelerin mevcut içeriğini GERÇEKTEN kaldır (yalnız metin op'ları).
                    #    Redaction fill = frontend'in canvas'tan örneklediği ARKA PLAN rengi
                    #    (varsayılan beyaz yerine) → kırmızı/siyah/renkli zeminde beyaz kutu kalmaz.
                    for op in text_ops:
                        # `clear` (kaydırmada ORİJİNAL konum) varsa onu, yoksa bbox'ı temizle.
                        cb = op.get("clear") or op["bbox"]
                        x0, y0, x1, y1 = (float(v) for v in cb)
                        fill = _hex_to_rgb01(op.get("bg")) if op.get("bg") else (1.0, 1.0, 1.0)
                        page.add_redact_annot(_fitz.Rect(x0, y0, x1, y1), fill=fill)
                    if text_ops:
                        page.apply_redactions()
                    # 2) Yeni metinleri aynı bölgeye yaz (varsa).
                    for op in text_ops:
                        # HTML modu (ZENGİN konum-koruyan ÇEVİRİ): op bir PARAGRAF bloğudur ve
                        # `html` alanı stil taşır (kalın <b>, renk <span style=color>, hizalama).
                        # insert_htmlbox → orijinalin KALIN/RENK/İKİ-YANA-YASLI düzenini korur;
                        # scale_low=0 → metin kutuya sığmıyorsa otomatik küçültür. (Düz insert_text
                        # bunu yapamıyordu → çeviri kalın/renk/justify kaybediyordu.)
                        html = op.get("html")
                        if html:
                            x0, y0, x1, y1 = (float(v) for v in op["bbox"])
                            rect = _fitz.Rect(x0, y0, x1, y1)
                            try:
                                # css + archive → font-family adları (Roboto/Noto Serif/…) gerçek
                                # gömülü TTF'lere çözülür (7 font kelime bazında doğru).
                                page.insert_htmlbox(rect, str(html), css=_EDIT_FONT_CSS, archive=_edit_font_archive(), scale_low=0)
                            except Exception:
                                # htmlbox yoksa/başarısızsa (eski PyMuPDF) blok BOŞ kalmasın:
                                # HTML etiketlerini sıyır, düz metni sarmalı yaz (stil kaybı olur ama okunur).
                                import re as _re
                                plain = _re.sub(r"<[^>]+>", "", str(html))
                                plain = (plain.replace("&amp;", "&").replace("&lt;", "<")
                                         .replace("&gt;", ">").replace("&#160;", " ")).strip()
                                if plain:
                                    fkey = op.get("font") if op.get("font") in _EDIT_FONTS else "serif"
                                    bfs = _fit_block_size(plain, fkey, x1 - x0, y1 - y0, float(op.get("size") or 11))
                                    page.insert_textbox(rect, plain, fontsize=bfs, fontname=fkey,
                                                        fontfile=_EDIT_FONTS[fkey], align=0)
                            continue
                        # Baştaki/sondaki BOŞLUKLARI KORU — kullanıcı elle hizalama/indent için
                        # boşluk ekleyebilir (ör. satırı ortaya çekmek). Yalnız tamamen boş op'u atla.
                        t = op.get("text") or ""
                        if not t.strip():
                            continue
                        x0, y0, x1, y1 = (float(v) for v in op["bbox"])
                        fs = float(op.get("size") or 11)
                        # Taban çizgisi: analyze'dan gelen gerçek origin.y (by) varsa onu kullan
                        # → metin orijinaliyle tam aynı yere oturur. Yoksa y0+fs'e düş.
                        by = op.get("by")
                        baseline = float(by) if by is not None else (y0 + fs)
                        col = _hex_to_rgb01(op.get("color"))
                        fkey = op.get("font") if op.get("font") in _EDIT_FONTS else "sans"
                        # WRAP modu (konum-koruyan ÇEVİRİ): op bir PARAGRAF bloğudur → metni
                        # blok dikdörtgenine kelime-kaydırmayla sar (insert_textbox). Tek satır
                        # baseline yerine kutuya sarma, çok satırlı paragrafı orijinal alanında tutar.
                        if op.get("wrap"):
                            rect = _fitz.Rect(x0, y0, x1, y1)
                            bfs = _fit_block_size(t, fkey, x1 - x0, y1 - y0, fs)
                            tb_kwargs: dict[str, Any] = dict(
                                fontsize=bfs, color=col, fontname=fkey,
                                fontfile=_EDIT_FONTS[fkey], align=0,
                            )
                            page.insert_textbox(rect, t, **tb_kwargs)
                            if op.get("bold"):  # çift-basım faux-bold (kutu minik dx kaydırılır)
                                page.insert_textbox(
                                    _fitz.Rect(x0 + max(0.25, bfs * 0.03), y0, x1 + max(0.25, bfs * 0.03), y1),
                                    t, **tb_kwargs,
                                )
                            continue
                        # Madde 3: noshrink → fontu KÜÇÜLTME (komşu metin frontend'de sağa
                        # kaydırıldığı için taşacak yer açıldı). Aksi halde eskisi gibi sığdır.
                        if not op.get("noshrink"):
                            fs = _fit_size(t, fkey, x1 - x0, fs)  # kutuya sığdır (taşmayı önle)
                        # Metin genişliği — hizalama + altı/üstü çizgi konumu için.
                        _af = _font_cache.get(fkey)
                        if _af is None:
                            try:
                                _af = _fitz.Font(fontfile=_EDIT_FONTS[fkey])
                                _font_cache[fkey] = _af
                            except Exception:
                                _af = None
                        try:
                            tw = _af.text_length(t, fontsize=fs) if _af else (x1 - x0)
                        except Exception:
                            tw = x1 - x0
                        # Hizalama (madde 8): sol/orta/sağ — orijinal kutu genişliği içinde.
                        box_w = x1 - x0
                        draw_x = x0
                        _align = op.get("align")
                        if _align == "center" and box_w > tw:
                            draw_x = x0 + (box_w - tw) / 2
                        elif _align == "right" and box_w > tw:
                            draw_x = x1 - tw
                        ins_kwargs: dict[str, Any] = dict(
                            fontsize=fs, color=col,
                            fontname=fkey, fontfile=_EDIT_FONTS[fkey],
                        )
                        # İtalik: taban çizgisi etrafında yatay kesme (shear) → sentetik italik
                        if op.get("italic"):
                            ins_kwargs["morph"] = (
                                _fitz.Point(draw_x, baseline),
                                _fitz.Matrix(1, 0, 0.2, 1, 0, 0),
                            )
                        page.insert_text(_fitz.Point(draw_x, baseline), t, **ins_kwargs)
                        # Kalın: metni çok küçük yatay offset'le İKİNCİ kez yaz (çift-basım
                        # faux-bold). render_mode/stroke yöntemi küçük punto'da glyph'leri
                        # birleştirip okunamaz SİYAH LEKE yapıyordu; çift-basım okunur kalır.
                        if op.get("bold"):
                            page.insert_text(
                                _fitz.Point(draw_x + max(0.25, fs * 0.03), baseline),
                                t, **ins_kwargs,
                            )
                        # Altı çizili / üstü çizili (madde 8): metin genişliği boyunca çizgi.
                        _lw = max(0.5, fs * 0.05)
                        if op.get("underline"):
                            uy = baseline + fs * 0.12
                            page.draw_line(_fitz.Point(draw_x, uy), _fitz.Point(draw_x + tw, uy), color=col, width=_lw)
                        if op.get("strike"):
                            sy = baseline - fs * 0.30
                            page.draw_line(_fitz.Point(draw_x, sy), _fitz.Point(draw_x + tw, sy), color=col, width=_lw)
                    # 3) Kullanıcının eklediği resimleri yerleştir (serbest açıyla).
                    for op in image_ops:
                        try:
                            data = str(op.get("image") or "")
                            raw = _b64.b64decode(data.split(",")[-1])
                            x0, y0, x1, y1 = (float(v) for v in op["bbox"])
                            deg = float(op.get("rotate") or 0) % 360
                            if abs(deg) < 0.5:
                                page.insert_image(_fitz.Rect(x0, y0, x1, y1), stream=raw, keep_proportion=False)
                                continue
                            # Serbest açı: PIL ile döndür (CSS saat yönü = PIL -deg), döndürülmüş
                            # görselin merkez-korumalı bounding box'ına oturt.
                            from PIL import Image as _Image
                            img = _Image.open(_io.BytesIO(raw)).convert("RGBA")
                            rot = img.rotate(-deg, expand=True, resample=_Image.BICUBIC)
                            buf = _io.BytesIO(); rot.save(buf, "PNG")
                            r = _math.radians(deg)
                            w0, h0 = (x1 - x0), (y1 - y0)
                            bw = abs(w0 * _math.cos(r)) + abs(h0 * _math.sin(r))
                            bh = abs(w0 * _math.sin(r)) + abs(h0 * _math.cos(r))
                            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                            page.insert_image(
                                _fitz.Rect(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2),
                                stream=buf.getvalue(), keep_proportion=False,
                            )
                        except Exception:
                            continue
                doc.save(str(out_p), garbage=3, deflate=True)
                # store=1 (PDF Düzenle editörü): sonucu (fork edilmiş süreç içinde) SUNUCUDA
                # sakla, handle döndür → bytes boşuna pickle edilmez. Aksi halde bytes döndür.
                if _store_result:
                    return save_result_from_file(
                        out_p, out_p.name, "application/pdf",
                        user_id=f"ed:{dl_token}", tool="pdf-edit",
                    )
                return out_p.read_bytes()
            finally:
                doc.close()

        result_or_bytes = await run_sandboxed(_run)
        # store=1 → bytes DÖNME; indirme, günlük limiti düşen ayrı uç noktadan yapılır.
        # Aksi halde (AI çeviri vb.) eski davranış: PDF bytes'ını doğrudan döndür (geriye uyumlu).
        if _store_result:
            handle = result_or_bytes
            return JSONResponse({"result_id": handle.result_id, "dl": dl_token})
        return Response(
            content=result_or_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": operations.content_disposition(out_p.name)},
        )
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except HTTPException:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=file.filename or "<?>", client_ip=_client_ip(request), operation="edit-text")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.get("/edit-text/download/{result_id}")
@limiter.limit("30/minute")
async def edit_text_download(
    request: Request,
    result_id: str,
    background_tasks: BackgroundTasks,
    dl: Annotated[str, Query()] = "",
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
):
    """PDF Düzenle sonucunun indirilmesi — günlük limit BURADA düşer ("indirmede say").

    Misafir: 2/gün (IP hash), oturum açmış FREE: 5/gün (user_id); PRO/PLUS/BUSINESS/ADMIN
    sınırsız. `dl` = hazırlamada dönen indirme jetonu (yalnız hazırlayan indirebilir)."""
    if not dl:
        raise HTTPException(status_code=400, detail="Geçersiz indirme jetonu.")

    # Sonuç var mı + jeton eşleşiyor mu? (limiti düşmeden ÖNCE doğrula → yarım kalan
    # indirmede hak yanmaz.)
    meta = read_meta_only(result_id)
    if meta.get("user_id") != f"ed:{dl}":
        raise HTTPException(status_code=403, detail="Forbidden")

    # Kimlik + plan çöz.
    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()

    unlimited = False
    key = _edl.guest_key(_client_ip(request))
    limit = _edl.GUEST_DAILY_LIMIT
    if token:
        try:
            ident = await saas_user_identity(token)
            if ident["role"] == "ADMIN" or ident["plan"] in ("PRO", "PLUS", "BUSINESS"):
                unlimited = True
            key = _edl.user_key(ident["user_id"])
            limit = _edl.FREE_DAILY_LIMIT
        except HTTPException:
            # Token geçersiz/eksik → misafir muamelesi (key/limit misafir kalır).
            token = ""

    if not unlimited:
        # Öncelik: Node/Postgres (instance'lar arası paylaşılan, kalıcı sayaç).
        # INTERNAL_SERVICE_SECRET yoksa/çağrı başarısızsa → yerel SQLite'a düş (kesinti yok).
        decision = await consume_editor_download(key)
        if decision is None:
            allowed, used, lim = _edl.consume(key, limit)
            decision = {"allowed": allowed, "used": used, "limit": lim, "resetAt": _edl.reset_at_iso(), "guest": not token}
        if not decision.get("allowed"):
            return JSONResponse(
                status_code=429,
                content={
                    "error": "daily_limit",
                    "used": decision.get("used"),
                    "limit": decision.get("limit"),
                    "resetAt": decision.get("resetAt"),
                    "guest": decision.get("guest", not token),
                },
            )

    read = get_result(result_id, f"ed:{dl}")
    background_tasks.add_task(delete_result, result_id)

    if read.presigned_url:
        from fastapi.responses import StreamingResponse
        from app.core.result_store import _get_s3, _s3_bucket, _PAYLOAD_FILENAME

        try:
            s3 = _get_s3()
            resp = s3.get_object(Bucket=_s3_bucket(), Key=f"{result_id}/{_PAYLOAD_FILENAME}")
            return StreamingResponse(
                resp["Body"].iter_chunks(8192),
                media_type=read.mime,
                headers={"Content-Disposition": operations.content_disposition(read.filename)},
            )
        except Exception as e:
            logger.error("edit_text_download S3 fetch failed result_id=%s: %s", result_id, e)
            raise HTTPException(status_code=500, detail="İndirme başarısız.")

    return FileResponse(
        path=str(read.payload_path),
        filename=read.filename,
        media_type=read.mime,
    )


@router.post("/redact-pdf")
@limiter.limit("15/minute")
async def tool_redact_pdf(
    request: Request,
    file: UploadFile = File(...),
    terms: str = Form("[]"),
    password: str = Form(""),
):
    """Hassas veri gizleme: verilen metin parçalarını (TC/IBAN/telefon/e-posta/isim…)
    PyMuPDF ile TÜM sayfalarda bulup GERÇEKTEN kaldırır. Siyah kutu yerine, kaldırılan
    bölgenin orijinal görüntüsü BULANIKLAŞTIRILARAK geri konur — renk korunur, metin
    PDF'ten silinir (geri getirilemez), örtme değil. `terms`: JSON string listesi. Misafire açık (token yok);
    boyut/oran/sandbox korur. NOT: dosya sunucuya yüklenir (frontend'de gizlilik uyarısı)."""
    import json as _json

    decision = {"fileSizeLimitMB": 50}
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        try:
            raw_terms = _json.loads(terms or "[]")
            term_list = [str(t) for t in raw_terms if isinstance(t, (str, int, float)) and str(t).strip()]
        except Exception:
            term_list = []
        # Uzun terimler önce (kısa alt-dizeleri gereksiz eşlemeyi azalt); tekilleştir.
        term_list = sorted(set(term_list), key=len, reverse=True)
        pwd = password.strip() or None
        sp = str(saved)
        out_p = workdir / format_derived_filename(file.filename or saved.name, "Gizlenmis", "pdf")

        def _run() -> bytes:
            import fitz as _fitz
            import io as _io
            from PIL import Image as _Image, ImageFilter as _ImageFilter

            doc = _fitz.open(sp)
            try:
                if doc.needs_pass:
                    if not pwd or not doc.authenticate(pwd):
                        raise HTTPException(status_code=400, detail="Şifreli PDF için doğru parola gerekli.")
                for page in doc:
                    # 1. Gizlenecek tüm bölgeleri bul.
                    rects = []
                    for term in term_list:
                        try:
                            for r in page.search_for(term, quads=False):
                                rects.append(r)
                        except Exception:
                            pass
                    if not rects:
                        continue

                    # 2. GÜVENLİ BLUR: metni siyahla ÖRTMEK yerine gerçekten kaldırıp
                    #    yerine orijinalin BULANIK rasterini koyarız. Böylece altta metin
                    #    kalmaz (geri getirilemez) ama renk korunur, siyah kutu olmaz.
                    #    Önce orijinal içerikten yüksek çözünürlüklü bulanık görüntü üret.
                    blur_imgs = []
                    for r in rects:
                        try:
                            pix = page.get_pixmap(clip=r, matrix=_fitz.Matrix(3, 3), alpha=False)
                            img = _Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                            radius = max(6, int(min(pix.width, pix.height) / 4))
                            blurred = img.filter(_ImageFilter.GaussianBlur(radius))
                            buf = _io.BytesIO()
                            blurred.save(buf, format="PNG")
                            blur_imgs.append((r, buf.getvalue()))
                        except Exception:
                            # Görüntü üretilemezse en azından içeriği kaldır (beyaz).
                            blur_imgs.append((r, None))

                    # 3. İçeriği (metin dahil) GERÇEKTEN kaldır.
                    for r in rects:
                        page.add_redact_annot(r, fill=(1, 1, 1))
                    page.apply_redactions()

                    # 4. Bulanık rasteri geri koy (redaction'dan SONRA).
                    for r, png in blur_imgs:
                        if png:
                            page.insert_image(r, stream=png)
                doc.save(str(out_p), garbage=3, deflate=True)
                return out_p.read_bytes()
            finally:
                doc.close()

        pdf_bytes = await run_sandboxed(_run)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": operations.content_disposition(out_p.name)},
        )
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except HTTPException:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=file.filename or "<?>", client_ip=_client_ip(request), operation="redact-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/pdf-analyze")
@limiter.limit("20/minute")
async def tool_pdf_analyze(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(""),
):
    """Her sayfadaki öğeleri (metin span'leri + görseller) bbox/renk/boyutla döndürür
    → frontend her öğeyi tıklanıp düzenlenebilir/silinebilir yapar. Misafire açık."""
    decision = {"fileSizeLimitMB": 50}
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)

        def _run() -> dict[str, Any]:
            import fitz as _fitz

            doc = _fitz.open(sp)
            try:
                if doc.needs_pass:
                    if not pwd or not doc.authenticate(pwd):
                        raise HTTPException(status_code=400, detail="Şifreli PDF için doğru parola gerekli.")
                pages: list[dict[str, Any]] = []
                for pi in range(doc.page_count):
                    page = doc[pi]
                    els: list[dict[str, Any]] = []
                    ei = 0
                    for bi, bl in enumerate(page.get_text("dict").get("blocks", [])):
                        for li, ln in enumerate(bl.get("lines", [])):
                            for span in ln.get("spans", []):
                                txt = span.get("text", "")
                                if not txt.strip():
                                    continue
                                x0, y0, x1, y1 = span["bbox"]
                                c = int(span.get("color", 0))
                                # Gerçek taban çizgisi (origin.y) — hem önizleme hem export
                                # bu değerle orijinal metnin tam yerine oturur.
                                oy = float(span.get("origin", (x0, y1))[1])
                                # Kalın/italik: PyMuPDF span flags (bit4=16 bold, bit1=2 italic)
                                # + font adı yedeği (ör. "Arial-BoldItalicMT").
                                _flags = int(span.get("flags", 0))
                                _fname = str(span.get("font", ""))
                                _fl = _fname.lower()
                                _bold = bool(_flags & 16) or "bold" in _fl or "black" in _fl or "heavy" in _fl
                                _italic = bool(_flags & 2) or "italic" in _fl or "oblique" in _fl
                                els.append({
                                    "id": f"t{pi}_{ei}", "type": "text",
                                    "bbox": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
                                    "text": txt, "size": round(float(span.get("size", 11)), 1),
                                    "color": f"#{c & 0xFFFFFF:06x}", "by": round(oy, 1),
                                    "font": _map_font_to_key(_fname),
                                    "bold": _bold, "italic": _italic,
                                    # Satır grubu (sayfa:blok:satır) — konum-koruyan çeviri span'ları
                                    # AYNI SATIRDA birleştirip tutarlı segment üretsin diye. PyMuPDF'in
                                    # kendi satır segmentasyonu blok/hücreye saygılıdır.
                                    "line": f"{pi}:{bi}:{li}",
                                })
                                ei += 1
                    for img in page.get_image_info():
                        x0, y0, x1, y1 = img["bbox"]
                        if (x1 - x0) < 4 or (y1 - y0) < 4:
                            continue
                        els.append({
                            "id": f"i{pi}_{ei}", "type": "image",
                            "bbox": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
                        })
                        ei += 1
                    pages.append({
                        "width": round(page.rect.width, 1),
                        "height": round(page.rect.height, 1),
                        "elements": els,
                    })
                return {"pages": pages}
            finally:
                doc.close()

        return await run_sandboxed(_run)
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except HTTPException:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=file.filename or "<?>", client_ip=_client_ip(request), operation="pdf-analyze")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/rotate-pdf")
@limiter.limit("20/minute")
async def tool_rotate_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    degrees: int = Form(90),
    pages: str = Form(""),
    password: str = Form(""),
    pages_rotation_json: str = Form(""),
):
    decision = await entitlement_check(token, "rotate-pdf")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)
        # Açı ve JSON doğrulaması — sayfa sayısına ihtiyaç duymayan kontroller burada
        per_page_raw: dict[int, int] | None = None
        raw_rot = (pages_rotation_json or "").strip()
        if raw_rot:
            try:
                parsed = json.loads(raw_rot)
                if not isinstance(parsed, dict):
                    raise ValueError("not an object")
                per_page_raw = {}
                for k, v in parsed.items():
                    pi = int(k)
                    deg = int(v)
                    if deg != 0 and deg not in (90, 180, 270):
                        raise HTTPException(
                            status_code=400,
                            detail="pages_rotation_json değerleri 0, 90, 180 veya 270 olmalı.",
                        )
                    if deg != 0:
                        per_page_raw[pi] = deg
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=400, detail="pages_rotation_json geçersiz.") from None
        if per_page_raw is None and degrees not in (90, 180, 270):
            raise HTTPException(status_code=400, detail="Açı 90, 180 veya 270 olmalı.")
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Dondurulmus", "pdf")
        out_p = workdir / out_n
        pages_str = (pages or "").strip()
        watermark = bool(decision.get("watermarkEnabled", False))

        def _run():
            # PDF sayfa sayısını burada alıyoruz — tek run_cpu_bound çağrısı yeterli
            import fitz as _fitz
            doc = _fitz.open(sp)
            if doc.needs_pass:
                if not (pwd or ""):
                    raise Exception("Şifreli PDF için parola gerekli.")
                if not doc.authenticate(pwd or ""):
                    raise Exception("Girilen PDF parolası hatalı.")
            try:
                n = doc.page_count
                pages_l = parse_pages_text(pages_str, max_page=n) if (per_page_raw is None and pages_str) else None
                if per_page_raw is not None:
                    for p in range(1, n + 1):
                        add_deg = int(per_page_raw.get(p, 0))
                        if add_deg == 0:
                            continue
                        page = doc[p - 1]
                        cur = int(page.rotation) % 360
                        page.set_rotation((cur + add_deg) % 360)
                else:
                    targets = [p - 1 for p in (pages_l or list(range(1, n + 1)))]
                    for i in targets:
                        if i < 0 or i >= n:
                            continue
                        page = doc[i]
                        cur = int(page.rotation) % 360
                        page.set_rotation((cur + int(degrees)) % 360)
                # Döndürme yalnızca /Rotate meta-verisini değiştirir — içerik akışı yok
                doc.save(str(out_p), garbage=0, deflate=False, linear=False)
            finally:
                doc.close()
            _maybe_watermark_pdf(out_p, watermark)
            return _pack_pdf_result_file(out_p, out_n, user_id, "rotate-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="rotate-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/organize-pdf")
@limiter.limit("20/minute")
async def tool_organize_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    page_order: str = Form(...),
    password: str = Form(""),
):
    """Virgülle 1 tabanlı yeni sıra, örn: 3,1,2,4"""
    decision = await entitlement_check(token, "organize-pdf")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Duzenlendi", "pdf")
        out_p = workdir / out_n
        watermark = bool(decision.get("watermarkEnabled", False))
        raw_order_str = page_order

        def _run() -> dict[str, Any]:
            import fitz as _fitz
            src = _fitz.open(sp)
            if src.needs_pass:
                if not (pwd or ""):
                    raise Exception("Şifreli PDF için parola gerekli.")
                if not src.authenticate(pwd or ""):
                    raise Exception("Girilen PDF parolası hatalı.")
            thumb: bytes | None = None
            try:
                n = src.page_count
                raw = [int(x.strip()) for x in raw_order_str.split(",") if x.strip().isdigit()]
                if len(raw) != n:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Tam {n} sayfa numarası verin (virgülle, örn. 2,1,3).",
                    )
                order_0 = [p - 1 for p in raw]
                ranges: list[tuple[int, int]] = []
                s = order_0[0]; e = order_0[0]
                for k in order_0[1:]:
                    if k == e + 1:
                        e = k
                    else:
                        ranges.append((s, e))
                        s = e = k
                ranges.append((s, e))
                new_doc = _fitz.open()
                try:
                    for from_p, to_p in ranges:
                        new_doc.insert_pdf(src, from_page=from_p, to_page=to_p)
                    thumb = generate_blurred_pdf_thumbnail_from_doc(new_doc)
                    new_doc.save(str(out_p), garbage=0, deflate=False, linear=False)
                finally:
                    new_doc.close()
            finally:
                src.close()
            _maybe_watermark_pdf(out_p, watermark)
            h = save_result_from_file(
                out_p, out_n, "application/pdf",
                user_id=user_id, thumbnail_png=thumb, tool="organize-pdf",
            )
            return {
                "result_id": h.result_id, "filename": h.filename,
                "mime": h.mime, "size_bytes": h.size_bytes, "has_thumbnail": h.has_thumbnail,
            }

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="organize-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/unlock-pdf")
@limiter.limit("15/minute")
async def tool_unlock_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(...),
):
    decision = await entitlement_check(token, "unlock-pdf")
    if not (password or "").strip():
        raise HTTPException(status_code=400, detail="PDF parolası gerekli.")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Acik", "pdf")
        out_p = workdir / out_n

        def _run():
            ptx.unlock_pdf_pikepdf(sp, str(out_p), password)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, out_n, user_id, "unlock-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="unlock-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/watermark")
@limiter.limit("15/minute")
async def tool_watermark(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    watermark_text: str = Form(...),
    watermark_color: str = Form("#8C8C8C"),
    watermark_font: str = Form("helv"),
    watermark_opacity: float = Form(0.15),
    password: str = Form(""),
):
    opacity = max(0.05, min(0.50, float(watermark_opacity)))
    decision = await entitlement_check(token, "watermark")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Filigran", "pdf")
        out_p = workdir / out_n

        def _run():
            ptx.add_watermark_text(
                sp, str(out_p), watermark_text,
                opacity=opacity, password=pwd,
                font_name=watermark_font, font_color=watermark_color,
            )
            return _pack_pdf_result_file(out_p, out_n, user_id, "watermark")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="watermark")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/page-numbers")
@limiter.limit("20/minute")
async def tool_page_numbers(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    start_at: int = Form(1),
    position: str = Form("footer"),
    fmt: str = Form("plain"),
    password: str = Form(""),
):
    if position not in ("footer", "header"):
        position = "footer"
    if fmt not in ("plain", "page", "of"):
        fmt = "plain"
    decision = await entitlement_check(token, "page-numbers")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Numarali", "pdf")
        out_p = workdir / out_n

        def _run():
            ptx.add_page_numbers(sp, str(out_p), start_at=int(start_at), position=position, password=pwd, fmt=fmt)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, out_n, user_id, "page-numbers")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="page-numbers")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/repair-pdf")
@limiter.limit("20/minute")
async def tool_repair_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "repair-pdf")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Onarilmis", "pdf")
        out_p = workdir / out_n

        def _run():
            ptx.repair_pdf(sp, str(out_p), password=pwd)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, out_n, user_id, "repair-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="repair-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/pdf-to-ppt")
@limiter.limit("8/minute")
async def tool_pdf_to_ppt(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "pdf-to-ppt")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Sunum", "pptx")
        out_p = workdir / out_n

        def _run():
            ptx.pdf_to_pptx(sp, str(out_p), password=pwd, dpi=int(ptx.PDF_EXPORT_DPI_WEB))
            try:
                thumb = generate_blurred_pdf_thumbnail_from_path(Path(sp))
            except OSError:
                thumb = None
            return save_result_from_file(
                out_p,
                out_n,
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                user_id=user_id,
                thumbnail_png=thumb,
                tool="pdf-to-ppt",
            )

        h = await run_sandboxed(_run)
        return {
            "result_id": h.result_id,
            "filename": h.filename,
            "mime": h.mime,
            "size_bytes": h.size_bytes,
            "has_thumbnail": h.has_thumbnail,
            "saasGating": _g_check(decision),
        }
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="pdf-to-ppt")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/ppt-to-pdf")
@limiter.limit("8/minute")
async def tool_ppt_to_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
):
    decision = await entitlement_check(token, "ppt-to-pdf")
    workdir = create_workdir()
    try:
        saved = await save_office_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        sp = str(saved)
        if not (saved.suffix.lower() in (".ppt", ".pptx", ".pptm", ".potx", ".potm", ".odp")):
            raise HTTPException(status_code=400, detail="PPT, PPTX veya uyumlu sunum dosyası yükleyin.")
        out_n = format_derived_filename(file.filename or saved.name, "PDF", "pdf")
        out_p = workdir / out_n
        await run_sandboxed(ptx.pptx_to_pdf, sp, str(out_p))
        user_id = await saas_current_user_id(token)

        def _store():
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            thumb_png = None
            try:
                thumb_png = generate_blurred_pdf_thumbnail_from_path(out_p)
            except OSError:
                thumb_png = None
            return save_result_from_file(
                out_p,
                out_p.name,
                "application/pdf",
                user_id=user_id,
                thumbnail_png=thumb_png,
                tool="ppt-to-pdf",
            )

        handle = await run_sandboxed(_store)

        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": handle.has_thumbnail,
            "saasGating": _g_check(decision),
        }
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="ppt-to-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/pdf-to-image")
@limiter.limit("10/minute")
async def tool_pdf_to_image(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    image_format: str = Form("jpg"),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "pdf-to-image")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)

        def _zip():
            zpath = ptx.pdf_to_images_zip(
                sp,
                str(workdir),
                image_format=image_format,
                dpi=int(ptx.PDF_EXPORT_DPI_WEB),
                password=pwd,
            )
            return save_result_from_file(
                Path(zpath),
                "sayfalar.zip",
                "application/zip",
                user_id=user_id,
                thumbnail_png=None,
                tool="pdf-to-image",
            )

        h = await run_sandboxed(_zip)
        return {
            "result_id": h.result_id,
            "filename": h.filename,
            "mime": h.mime,
            "size_bytes": h.size_bytes,
            "has_thumbnail": False,
            "saasGating": _g_check(decision),
        }
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="pdf-to-image")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/extract-images")
@limiter.limit("10/minute")
async def tool_extract_images(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "extract-images")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)

        def _zip():
            zpath = ptx.extract_images_zip(sp, str(workdir), password=pwd)
            return save_result_from_file(
                Path(zpath),
                "gorseller.zip",
                "application/zip",
                user_id=user_id,
                thumbnail_png=None,
                tool="extract-images",
            )

        h = await run_sandboxed(_zip)
        return {
            "result_id": h.result_id,
            "filename": h.filename,
            "mime": h.mime,
            "size_bytes": h.size_bytes,
            "has_thumbnail": False,
            "saasGating": _g_check(decision),
        }
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="extract-images")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/image-to-pdf")
@limiter.limit("15/minute")
async def tool_image_to_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    files: list[UploadFile] = File(...),
):
    if not files or len(files) < 1:
        raise HTTPException(status_code=400, detail="En az bir görüntü seçin.")
    decision = await entitlement_check(token, "image-to-pdf")
    workdir = create_workdir()
    try:
        paths: list[str] = []
        for i, up in enumerate(files):
            p = await save_any_upload(up, workdir, filename=f"{i:04d}_{Path(up.filename or 'img').name}", max_bytes=max_bytes_from_decision(decision))
            paths.append(str(p))
        user_id = await saas_current_user_id(token)
        out_p = workdir / "fotograflar.pdf"

        def _run():
            ptx.images_to_pdf(paths, str(out_p))
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, "fotograflar.pdf", user_id, "image-to-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="image-to-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/html-to-pdf")
@limiter.limit("5/minute")
async def tool_html_to_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    source_url: str = Form(""),
    html: str = Form(""),
):
    _url_stripped = (source_url or "").strip().rstrip("/")
    _url_valid = _url_stripped and _url_stripped not in ("http:", "https:", "http://", "https://")
    if not _url_valid and not (html or "").strip():
        raise HTTPException(status_code=400, detail="URL veya HTML metni gerekli.")
    if not _url_valid:
        source_url = ""

    # SSRF / DNS-rebinding önlemi:
    # Hostname'i yalnızca BİR KEZ çözümle, IP'yi doğrula, ardından
    # asıl HTTP isteğini doğrudan bu IP'ye yap (ikinci DNS çözümlemesi olmaz).
    pre_fetched_html: str | None = None
    pre_fetched_base_url: str | None = None
    if _url_valid:
        import httpx as _httpx
        resolved_ip, parsed_url = _resolve_ssrf_safe(_url_stripped)
        port = parsed_url.port or (443 if parsed_url.scheme == "https" else 80)
        path_qs = (parsed_url.path or "/") + (f"?{parsed_url.query}" if parsed_url.query else "")
        direct_url = f"{parsed_url.scheme}://{resolved_ip}:{port}{path_qs}"
        try:
            resp = _httpx.get(
                direct_url,
                headers={"Host": parsed_url.hostname or ""},
                timeout=30.0,
                follow_redirects=False,  # Yönlendirme iç ağa gidebilir
                verify=False,            # IP üzerinden bağlanıldığında SNI sertifika doğrulaması yapılamaz
            )
            resp.raise_for_status()
        except _httpx.HTTPError as exc:
            raise HTTPException(status_code=400, detail=f"URL içeriği alınamadı: {exc}") from exc
        pre_fetched_html = resp.text
        pre_fetched_base_url = _url_stripped  # xhtml2pdf için göreli URL çözümlemesi

    decision = await entitlement_check(token, "html-to-pdf")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        out_p = workdir / "web.pdf"
        _html_content = pre_fetched_html or html or "<html><body><p>Boş</p></body></html>"
        _base_url = pre_fetched_base_url

        def _run():
            ptx.html_to_pdf_file(_html_content, str(out_p), base_url=_base_url)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, "web.pdf", user_id, "html-to-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="html-to-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/pdf-to-text")
@limiter.limit("15/minute")
async def tool_pdf_to_text(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "pdf-to-text")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        sp = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(sp, request, decision, file.filename)
        out_p = workdir / "metin.txt"
        pwd = (password or "").strip() or None
        out_n = format_derived_filename(file.filename or "dosya.pdf", "metin", ".txt")

        def _run():
            ptx.pdf_to_text(str(sp), str(out_p), password=pwd)
            return _pack_text_result_file(out_p, out_n, user_id, "pdf-to-text")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="pdf-to-text")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/flatten-pdf")
@limiter.limit("20/minute")
async def tool_flatten_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "flatten-pdf")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        sp = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(sp, request, decision, file.filename)
        out_p = workdir / "duzlestir.pdf"
        pwd = (password or "").strip() or None
        out_n = format_derived_filename(file.filename or "dosya.pdf", "düz", ".pdf")

        def _run():
            ptx.flatten_pdf(str(sp), str(out_p), password=pwd)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, out_n, user_id, "flatten-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="flatten-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)

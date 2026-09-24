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
from app.core import edit_fonts as _ef
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
    save_result,
    get_result,
    read_meta_only,
    delete_result,
)
from app.core.thread_pool import CpuCapacityTimeout, run_cpu_bound
from app.core.pdf_sandbox import run_sandboxed
from app.core.jobs import create_conversion_job
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


def _ssrf_safe_request_guard(request_url: str) -> bool:
    """HTML→PDF tarayıcı render'ı sırasında yapılan HER alt istek (görsel/CSS/
    font) için True/False döner. _resolve_ssrf_safe ile aynı özel-ağ listesini
    kullanır; tek fark HTTPException fırlatmak yerine sessizce reddetmesi
    (Playwright route handler'ı sadece izin/red bekliyor)."""
    try:
        parsed = urllib.parse.urlparse(request_url)
    except Exception:
        return False
    if parsed.scheme not in ("http", "https"):
        return parsed.scheme in ("data", "blob")
    hostname = parsed.hostname
    if not hostname:
        return False
    try:
        addr = ipaddress.ip_address(hostname)
        _check_ip_not_private(addr)
        return True
    except ValueError:
        pass
    except HTTPException:
        return False
    try:
        infos = socket.getaddrinfo(hostname, None)
    except OSError:
        return False
    if not infos:
        return False
    for info in infos:
        try:
            addr = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        try:
            _check_ip_not_private(addr)
        except HTTPException:
            return False
    return True

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
) + _ef.html_css()
_edit_font_archive_cache: Any = None


def _edit_font_archive():
    """insert_htmlbox'a verilecek font arşivi (gömülü TTF'ler, basename ile). Süreç başına bir kez."""
    global _edit_font_archive_cache
    if _edit_font_archive_cache is None:
        import fitz as _fitz

        ar = _fitz.Archive()
        for _v in _EDIT_FONTS.values():
            ar.add(_v, Path(_v).name)
        _ef.add_to_archive(ar)
        _edit_font_archive_cache = ar
    return _edit_font_archive_cache


_tessdata_cache: str | None = None
_tessdata_resolved = False


def _tessdata_dir() -> str | None:
    """PyMuPDF get_textpage_ocr için Tesseract dil-verisi (tessdata) dizinini bul.
    TESSDATA_PREFIX env → yaygın Linux/Docker yolları → glob. Sürümden bağımsız."""
    global _tessdata_cache, _tessdata_resolved
    if _tessdata_resolved:
        return _tessdata_cache
    import glob as _glob

    _tessdata_resolved = True
    env = _os.environ.get("TESSDATA_PREFIX")
    cands: list[str] = []
    if env:
        cands += [env, str(Path(env) / "tessdata")]
    cands += [
        "/usr/share/tesseract-ocr/5/tessdata",
        "/usr/share/tesseract-ocr/4.00/tessdata",
        "/usr/share/tessdata",
        "/usr/local/share/tessdata",
    ]
    cands += sorted(_glob.glob("/usr/share/tesseract-ocr/*/tessdata"))
    for c in cands:
        try:
            if c and Path(c).is_dir() and any(Path(c).glob("*.traineddata")):
                _tessdata_cache = c
                return c
        except Exception:
            continue
    _tessdata_cache = None
    return None


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
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
):
    # Not: bu araç misafire de açık (token gerekmez). Kötüye kullanımı boyut (50MB),
    # oran (15/dk) ve sandbox sınırları önler; entitlement/kredi tüketmez.
    """Sunucu tarafı GERÇEK metin düzenleme: seçili bölgedeki mevcut metni PyMuPDF
    redaction ile GERÇEKTEN siler (örtmez), yerine yeni metni yazar. `edits`:
    JSON [{page, bbox:[x0,y0,x1,y1] (PDF nokta, üst-sol origin), text, size}].
    NOT: bu araçta dosya sunucuya yüklenir (frontend'de gizlilik uyarısı gösterilir)."""
    import json as _json

    decision = {"fileSizeLimitMB": 50}
    # store YOKSA PDF doğrudan döner (çeviri aracı yolu) → günlük indirme sınırı atlanmasın:
    # misafir reddedilir; ücretli plan/yönetici sınırsız; ücretsiz üye aynı günlük haktan düşer.
    # (Kontrol dosya işlenmeden ÖNCE — boşuna sunucu işi yapılmaz.)
    if str(store).strip().lower() not in ("1", "true", "yes"):
        _tok = authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else ""
        if not _tok:
            raise HTTPException(status_code=401, detail="Bu işlem için oturum açın.")
        _ident = await saas_user_identity(_tok)
        if not (_ident["role"] == "ADMIN" or _ident["plan"] in ("STARTER", "PLUS", "PRO", "BUSINESS")):
            _key = _edl.user_key(_ident["user_id"])
            _dec = await consume_editor_download(_key)
            if _dec is None:
                _ok, _used, _lim = _edl.consume(_key, _edl.FREE_DAILY_LIMIT)
                _dec = {"allowed": _ok, "used": _used, "limit": _lim, "resetAt": _edl.reset_at_iso(), "guest": False}
            if not _dec.get("allowed"):
                return JSONResponse(status_code=429, content={
                    "error": "daily_limit", "used": _dec.get("used"), "limit": _dec.get("limit"),
                    "resetAt": _dec.get("resetAt"), "guest": False,
                })
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
                # Orijinal font (op.ofont = xref): onarılmış TTF'i çalışma klasörüne yaz → yol tabanlı
                # yardımcılar (genişlik/harf bazlı yazım) aynen kullanılır.
                _orig_paths: dict[str, tuple[str, str]] = {}
                if any(o.get("ofont") for o in ops):
                    try:
                        for _v in _ef.original_fonts(doc).values():
                            _fp = str(Path(sp).parent / f"orig_{_v['key']}.ttf")
                            Path(_fp).write_bytes(_v["buf"])
                            _orig_paths[_v["key"]] = (_fp, _v["chars"])
                    except Exception:
                        _orig_paths = {}
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

                def _metric(op: dict) -> tuple[str, str] | None:
                    """op ölçü-uyumlu aile kullanıyorsa (birincil, yedek) font yolları."""
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
                    # 0) Silinen GÖRSEL (logo/amblem): boyamadan gerçekten kaldır — diğer silmeler içerik
                    #    akışını yeniden yazmadan ÖNCE (çizim komutu adıyla bulunur). Olmazsa eski dolgu yolu.
                    for o in [o for o in text_ops if o.get("img") and not (o.get("text") or "").strip()]:
                        try:
                            if _ef.remove_image_placement(doc, page, o["bbox"]):
                                text_ops.remove(o)
                        except Exception:
                            pass

                    # 1) Seçili bölgelerin mevcut içeriğini GERÇEKTEN kaldır (yalnız metin op'ları).
                    #    Redaction fill = frontend'in canvas'tan örneklediği ARKA PLAN rengi
                    #    (varsayılan beyaz yerine) → kırmızı/siyah/renkli zeminde beyaz kutu kalmaz.
                    # 1a) VEKTÖR yazı (op.vt): harf "kutuyla en ufak kesişim" kuralıyla silinir
                    #     (PyMuPDF belgesi) → tam yükseklikte kutu, sıkı satır aralığında ÜST/ALT
                    #     satırın harflerini de siler (0.82 em aralıkta 3 satır birden silindiği
                    #     ölçüldü). Bu yüzden taban çizgisi etrafında ince ŞERİT: satırın her harfi
                    #     keser, komşu satırlar kesmez. Dolgu YOK (arka plan/çizgi/görsel olduğu gibi
                    #     kalır — beyaz kutu tablo çizgisini örtüyordu), görsel ve çizgiye dokunulmaz.
                    vt_ops = [o for o in text_ops if o.get("vt") and o.get("by") is not None]
                    other_ops = [o for o in text_ops if not (o.get("vt") and o.get("by") is not None)]
                    for op in vt_ops:
                        cb = op.get("clear") or op["bbox"]
                        x0, y0, x1, y1 = (float(v) for v in cb)
                        _by = float(op["by"])
                        _osz = float(op.get("osz") or op.get("size") or max(1.0, (y1 - y0) / 1.2))
                        _ins = min(0.3, max(0.0, (x1 - x0) / 4))
                        page.add_redact_annot(
                            _fitz.Rect(x0 + _ins, _by - 0.35 * _osz, x1 - _ins, _by - 0.15 * _osz), fill=False,
                        )
                    if vt_ops:
                        page.apply_redactions(images=0, graphics=0, text=0)
                    # 1b) Görüntüdeki yazı (OCR / görünmez katman) ve görsel silme: piksel de örtülmeli.
                    for op in other_ops:
                        # `clear` (kaydırmada ORİJİNAL konum) varsa onu, yoksa bbox'ı temizle.
                        cb = op.get("clear") or op["bbox"]
                        x0, y0, x1, y1 = (float(v) for v in cb)
                        fill = _hex_to_rgb01(op.get("bg")) if op.get("bg") else (1.0, 1.0, 1.0)
                        page.add_redact_annot(_fitz.Rect(x0, y0, x1, y1), fill=fill)
                    if other_ops:
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
                                page.insert_htmlbox(rect, _ef.wrap_missing_glyphs(str(html)), css=_EDIT_FONT_CSS, archive=_edit_font_archive(), scale_low=0)
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
                        _mt = _metric(op)
                        _of = _orig_paths.get(str(op.get("ofont") or ""))
                        if _of and all(ch in _of[1] for ch in (op.get("text") or "")):
                            # Tüm harfler belgede bu fontla doğrulanmış → ORİJİNAL font (birebir glif).
                            _fb0 = _mt[1] if _mt else _ef.FALLBACK_BY_CLASS["sans"]
                            _mt = (_of[0], _fb0)
                        fkey = op.get("font") if op.get("font") in _EDIT_FONTS else "sans"
                        # WRAP modu (konum-koruyan ÇEVİRİ): op bir PARAGRAF bloğudur → metni
                        # blok dikdörtgenine kelime-kaydırmayla sar (insert_textbox). Tek satır
                        # baseline yerine kutuya sarma, çok satırlı paragrafı orijinal alanında tutar.
                        if op.get("wrap") and _mt:
                            # Ölçü-uyumlu aile: gerçek kesit dosyasıyla sar (sahte kalın yok).
                            rect = _fitz.Rect(x0, y0, x1, y1)
                            page.insert_textbox(rect, t, fontsize=fs, color=col, fontname=_ef.pdf_fontname(_mt[0]),
                                                fontfile=_mt[0], align=0)
                            continue
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
                            if _mt:  # seçilen gerçek fontun (orijinal / ölçü-uyumlu) genişliğiyle sığdır
                                _tw0 = _ef.text_width(t, _mt[0], _mt[1], fs)
                                if _tw0 > (x1 - x0) > 1:
                                    fs = max(fs * ((x1 - x0) / _tw0), 5.0)
                            else:
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
                            if _mt:
                                tw = _ef.text_width(t, _mt[0], _mt[1], fs)
                            else:
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
                        _hs = float(op.get("hs") or 1.0)
                        _cs = float(op.get("cs") or 0.0)
                        _uses_orig = bool(_of and all(ch in _of[1] for ch in (op.get("text") or "")))
                        if _uses_orig:
                            _cs += float(op.get("ocs") or 0.0)  # orijinal font: satır genişliği harf aralığıyla
                        else:
                            _hs *= float(op.get("fit") or 1.0)  # yedek font: genişlik yatay ölçekle
                        _ws = float(op.get("ws") or 0.0)
                        if abs(_hs - 1) > 1e-3 or _cs or _ws:
                            # Orijinal harf aralığı / kelime aralığı / yatay ölçek korunur.
                            _pp, _fb = _mt if _mt else (_EDIT_FONTS[fkey], _EDIT_FONTS[fkey])
                            _tw2 = _ef.spaced_width(t, _pp, _fb, fs, _hs, _cs, _ws)
                            _dx = draw_x
                            if _align == "center" and box_w > _tw2:
                                _dx = x0 + (box_w - _tw2) / 2
                            elif _align == "right" and box_w > _tw2:
                                _dx = x1 - _tw2
                            _ef.insert_spaced(page, _dx, baseline, t, fs, col, _pp, _fb, _hs, _cs, _ws)
                            if not _mt and op.get("bold"):
                                _ef.insert_spaced(page, _dx + max(0.25, fs * 0.03), baseline, t, fs, col, _pp, _fb, _hs, _cs, _ws)
                            _lw = max(0.5, fs * 0.05)
                            if op.get("underline"):
                                uy = baseline + fs * 0.12
                                page.draw_line(_fitz.Point(_dx, uy), _fitz.Point(_dx + _tw2, uy), color=col, width=_lw)
                            if op.get("strike"):
                                sy = baseline - fs * 0.30
                                page.draw_line(_fitz.Point(_dx, sy), _fitz.Point(_dx + _tw2, sy), color=col, width=_lw)
                            continue
                        if _mt:
                            # Ölçü-uyumlu aile: kesit dosyası kalınlığı/eğikliği ZATEN taşır →
                            # sahte (çift-basım/eğme) uygulanmaz; eksik harf (₺) yedekten.
                            _ef.insert_runs(page, draw_x, baseline, t, fs, col, _mt[0], _mt[1])
                            _lw = max(0.5, fs * 0.05)
                            if op.get("underline"):
                                uy = baseline + fs * 0.12
                                page.draw_line(_fitz.Point(draw_x, uy), _fitz.Point(draw_x + tw, uy), color=col, width=_lw)
                            if op.get("strike"):
                                sy = baseline - fs * 0.30
                                page.draw_line(_fitz.Point(draw_x, sy), _fitz.Point(draw_x + tw, sy), color=col, width=_lw)
                            continue
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
                try:
                    doc.subset_fonts()  # fontTools gerekir; yoksa tam font gömülü kalır (bozulmaz)
                except Exception:
                    pass
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

    Misafir: 1/gün (IP hash), oturum açmış FREE: 2/gün (user_id); PRO/PLUS/BUSINESS/ADMIN
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
    ocr: str = Form(""),
):
    """Her sayfadaki öğeleri (metin span'leri + görseller) bbox/renk/boyutla döndürür
    → frontend her öğeyi tıklanıp düzenlenebilir/silinebilir yapar. Misafire açık.

    ocr=1: metin katmanı OLMAYAN (taranmış) sayfalarda Tesseract OCR (get_textpage_ocr)
    çalıştırıp koordinatlı DÜZENLENEBİLİR metin döndürür → taranmış PDF de editörde düzenlenebilir."""
    decision = {"fileSizeLimitMB": 50}
    want_ocr = str(ocr).strip().lower() in ("1", "true", "yes")
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
                # Yeniden kullanılabilir gömülü fontlar (doğrulanmış harf kümesiyle) — yeni metin
                # yalnız bu harflerden oluşuyorsa orijinal fontla yazılır (glif şekli birebir).
                try:
                    _orig = _ef.original_fonts(doc)
                except Exception:
                    _orig = {}
                _used_orig: set[str] = set()
                for pi in range(doc.page_count):
                    page = doc[pi]
                    els: list[dict[str, Any]] = []
                    ei = 0
                    _tp0 = page.get_textpage()
                    text_dict = page.get_text("dict", textpage=_tp0)
                    raw_dict = page.get_text("rawdict", textpage=_tp0)
                    # Görünmez metin (Tr 3): yazı aslında altındaki GÖRÜNTÜDE → düzenlerken
                    # görüntü pikselleri de örtülmeli (vektör yazı gibi yalnız harf silinmez).
                    _inv_boxes: list[Any] = []
                    _trace: list[tuple[Any, str, float]] = []  # (kutu, font, yatay boyut) — Tz ölçümü
                    # Yalnız görünmez yazıda kullanılan fontlar (ör. OCR programlarının "GlyphLessFont"u):
                    # kutu eşleştirmesi texttrace kutuları daha dar olduğu için kelimelerin ~yarısını
                    # kaçırıyordu (ölçüldü: 31 kelimeden 16'sı) → font adına göre de işaretlenir.
                    _vis_fonts: set[str] = set()
                    _invis_fonts: set[str] = set()
                    try:
                        for _tt in page.get_texttrace():
                            _tf = str(_tt.get("font", ""))
                            if int(_tt.get("type", 0)) == 3:
                                _inv_boxes.append(_fitz.Rect(_tt["bbox"]))
                                _invis_fonts.add(_tf)
                            else:
                                _vis_fonts.add(_tf)
                            _trace.append((_fitz.Rect(_tt["bbox"]), _tf, float(_tt.get("size", 0))))
                    except Exception:
                        _inv_boxes = []
                    _invis_only = _invis_fonts - _vis_fonts
                    # Taranmış sayfa (metin katmanı yok) + ocr=1 → Tesseract OCR ile metni tanı,
                    # KOORDİNATLI span'ler döndür (aynı yapı) → editörde düzenlenebilir olsun.
                    if want_ocr:
                        _has_text = any(
                            (_s.get("text") or "").strip()
                            for _b in text_dict.get("blocks", [])
                            for _l in _b.get("lines", [])
                            for _s in _l.get("spans", [])
                        )
                        if not _has_text:
                            try:
                                _td = _tessdata_dir()
                                _ocr_kw: dict[str, Any] = dict(flags=0, language="tur+eng", dpi=200, full=True)
                                if _td:
                                    _ocr_kw["tessdata"] = _td
                                _tp = page.get_textpage_ocr(**_ocr_kw)
                                text_dict = page.get_text("dict", textpage=_tp)
                                raw_dict = page.get_text("rawdict", textpage=_tp)
                            except Exception:
                                pass  # OCR başarısız → sayfa görüntü olarak kalır
                    for bi, bl in enumerate(text_dict.get("blocks", [])):
                        for li, ln in enumerate(bl.get("lines", [])):
                            for si, span in enumerate(ln.get("spans", [])):
                                txt = span.get("text", "")
                                if not txt.strip():
                                    continue
                                try:
                                    _rs = raw_dict["blocks"][bi]["lines"][li]["spans"][si]
                                except Exception:
                                    _rs = None
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
                                _mk = _ef.metric_family_for(_fname)
                                # Harf/kelime aralığı + yatay ölçek (+ gerçek boyut) — orijinal görünüm.
                                _sp: dict = {}
                                try:
                                    if _rs and tuple(ln.get("dir", (1, 0))) == (1.0, 0.0):
                                        _r0 = _fitz.Rect(x0, y0, x1, y1)
                                        _best, _bo = None, 0.0
                                        for _tr, _tf, _tsz in _trace:
                                            if _tf != _fname:
                                                continue
                                            _o = (_r0 & _tr).get_area()
                                            if _o > _bo:
                                                _bo, _best = _o, _tsz
                                        _sp = _ef.span_spacing(_rs, span, _best)
                                except Exception:
                                    _sp = {}
                                # Font anahtarı: ölçü-uyumlu aile → aynı fontun kendisi (Lato/Montserrat/
                                # Oswald/Merriweather elimizde) → sınıf ailesi + GENİŞLİK UYDURMA (yedek
                                # font dar/geniş olabilir; orijinal satır genişliği korunur).
                                _legacy = _map_font_to_key(_fname)
                                if _mk:
                                    _fkey = _mk
                                elif _legacy in ("lato", "montserrat", "oswald", "merriweather"):
                                    _fkey = _legacy
                                else:
                                    _fkey = _ef.class_family(_fname, _flags)
                                    try:
                                        _chs = [c_ for c_ in (_rs or {}).get("chars", []) if not c_["c"].isspace()]
                                        if len(_chs) >= 3:
                                            _nat = _chs[-1]["bbox"][2] - _chs[0]["origin"][0]
                                            _n = len(txt.strip())
                                            _nat -= float(_sp.get("cs", 0)) * (_n - 1) + float(_sp.get("ws", 0)) * txt.strip().count(" ")
                                            _fit = _ef.fit_scale(txt, _fkey, _bold, _italic,
                                                                 float(_sp.get("size", span.get("size", 11))), _nat)
                                            if _fit:
                                                # Ölçüm GERÇEK genişlikten (Tz dahil) → yedek fontta hs yerine geçer.
                                                # Ayrı alan: orijinal font kullanılırsa UYGULANMAZ (o zaten doğru genişlikte).
                                                _sp["fit"] = round(_fit / float(_sp.get("hs", 1.0)), 3)
                                    except Exception:
                                        pass
                                # Orijinal fontla yazılırsa: Word vb. harfleri satır yerleşiminde mikro
                                # sıkıştırır (TJ); yeni yazı font genişliğiyle yazılınca satır sonu ~2 pt
                                # kayıyordu (ölçüldü) → farkı harf aralığına eşit dağıt (şekil bozulmaz).
                                if _fname in _orig:
                                    try:
                                        _chs2 = [c_ for c_ in (_rs or {}).get("chars", [])]
                                        _t2 = "".join(c_["c"] for c_ in _chs2).rstrip()
                                        _n2 = len(_t2)
                                        if _n2 >= 4:
                                            _of_font = _orig[_fname].setdefault("_font", _fitz.Font(fontbuffer=_orig[_fname]["buf"]))
                                            _sz2 = float(_sp.get("size", span.get("size", 11)))
                                            _hs2 = float(_sp.get("hs", 1.0))
                                            _nat2 = _chs2[_n2 - 1]["bbox"][2] - _chs2[0]["origin"][0]
                                            _exp2 = (_of_font.text_length(_t2, fontsize=_sz2) * _hs2
                                                     + float(_sp.get("cs", 0)) * (_n2 - 1) + float(_sp.get("ws", 0)) * _t2.count(" "))
                                            _ocs = (_nat2 - _exp2) / (_n2 - 1)
                                            if 0.004 < abs(_ocs) < 0.15 * _sz2:
                                                _sp["ocs"] = round(_ocs, 4)
                                    except Exception:
                                        pass
                                els.append({
                                    "id": f"t{pi}_{ei}", "type": "text",
                                    "bbox": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
                                    # 2 ondalık: 1 ondalık yuvarlama uzun satırda ~0.6 pt kayma yapıyordu (ölçüldü).
                                    "text": txt, "size": round(float(span.get("size", 11)), 2),
                                    "color": f"#{c & 0xFFFFFF:06x}", "by": round(oy, 1),
                                    "font": _fkey,
                                    "bold": _bold, "italic": _italic,
                                    # Satır grubu (sayfa:blok:satır) — konum-koruyan çeviri span'ları
                                    # AYNI SATIRDA birleştirip tutarlı segment üretsin diye. PyMuPDF'in
                                    # kendi satır segmentasyonu blok/hücreye saygılıdır.
                                    "line": f"{pi}:{bi}:{li}",
                                    "inv": _fname in _invis_only or (bool(_inv_boxes) and any(
                                        _r.contains(_fitz.Point((x0 + x1) / 2, (y0 + y1) / 2)) for _r in _inv_boxes
                                    )),
                                    **_sp,
                                    **({"ofont": _orig[_fname]["key"]} if _fname in _orig else {}),
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
                for _e in (e for p_ in pages for e in p_["elements"]):
                    if _e.get("ofont"):
                        _used_orig.add(_e["ofont"])
                import base64 as _b64m
                _fonts = {
                    v["key"]: {"b64": _b64m.b64encode(v["buf"]).decode("ascii"), "chars": v["chars"]}
                    for v in _orig.values() if v["key"] in _used_orig
                }
                return {"pages": pages, "fonts": _fonts}
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
    quality: str = Form("normal"),
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
                dpi=_gorsel_dpi(quality),
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


def _gorsel_dpi(kalite: str) -> int:
    """Kullanıcının seçtiği kaliteyi çözünürlüğe çevirir.

    NEDEN SEÇENEK VAR: Uzun belgelerde çözünürlük otomatik düşürülüyor (bellek ve
    süre için). Baskı kalitesi isteyen kullanıcının bunu isteyebilmesi, sadece
    ekranda bakacak olanın da hızlı ve küçük dosya alabilmesi gerekiyor.
    Değerler sabit listeden seçilir; serbest sayı kabul edilmez (çok yüksek bir
    değer sunucuyu zorlar).
    """
    return {"ekran": 150, "normal": 300, "baski": 400}.get((kalite or "").strip(), 300)


@router.post("/pdf-to-image/start")
@limiter.limit("10/minute")
async def tool_pdf_to_image_start(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    image_format: str = Form("jpg"),
    password: str = Form(""),
    # "ekran" (150 DPI, hızlı ve küçük) / "normal" (300) / "baski" (400).
    quality: str = Form("normal"),
):
    """PDF → Görsel dönüşümünü ARKA PLANDA başlatır.

    NEDEN: Ölçümde 150 sayfalık bir belge 48 saniye sürüyor. Tek istekte
    beklenince kullanıcı ekranda yalnızca "işlem sürüyor" görüyor, kaçıncı
    sayfada olduğunu bilmiyor ve çoğu kişi sekmeyi kapatıyor. Arka plan işinde
    sayfa sayfa ilerleme gösterilir ve bağlantı kopsa bile iş sunucuda sürer.
    """
    decision = await entitlement_check(token, "pdf-to-image")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(saved, request, decision, file.filename)
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)

        def _run(progress_cb):
            zpath = ptx.pdf_to_images_zip(
                sp,
                str(workdir),
                image_format=image_format,
                dpi=_gorsel_dpi(quality),
                password=pwd,
                progress_callback=progress_cb,
            )
            return Path(zpath)

        def _store(outp: Path):
            return save_result_from_file(
                outp,
                "sayfalar.zip",
                "application/zip",
                user_id=user_id,
                thumbnail_png=None,
                tool="pdf-to-image",
            )

        job_id = create_conversion_job(
            run=_run,
            store_result=_store,
            workdir=workdir,
            owner_id=user_id,
            saas_gating=_g_check(decision),
            running_message="Sayfalar görsele çevriliyor...",
            done_message="Görselleriniz hazır.",
            fail_message="Görsele çevirme başarısız oldu.",
        )
        return {"job_id": job_id, "saasGating": _g_check(decision)}
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="pdf-to-image")


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
    # "a4" (varsayılan): görsel A4'e sığdırılır — "original": sayfa görselin ölçüsünde olur.
    page_size: str = Form("a4"),
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
            ptx.images_to_pdf(paths, str(out_p), page_size=page_size)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, "fotograflar.pdf", user_id, "image-to-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        # `file` diye bir parametre YOK; bu uç `files` listesi alıyor. Eski kod
        # hata anında NameError üretiyor, gerçek hatayı ve temizliği gizliyordu.
        first_name = getattr(files[0], "filename", None) if files else None
        cleanup_and_raise(workdir, e, filename=first_name or "<?>", client_ip=_client_ip(request), operation="image-to-pdf")
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
        # BAĞLANTI IP'YE, KİMLİK ADRESE GÖRE.
        #
        # NEDEN: İç ağa sızmayı (SSRF) önlemek için bağlantı, doğrulanmış IP'ye
        # kurulur. Ancak TLS el sıkışmasında sunucuya "hangi site için geldim"
        # bilgisi (SNI) gönderilmezse günümüzdeki neredeyse tüm sunucular
        # bağlantıyı reddeder — ölçümde her adres SSLV3_ALERT_HANDSHAKE_FAILURE
        # veriyordu, yani araç hiç çalışmıyordu. `sni_hostname` uzantısı bunu
        # düzeltir: bağlantı yine IP'ye gider, el sıkışma ve sertifika denetimi
        # gerçek alan adı üzerinden yapılır. Böylece sertifika doğrulaması da
        # (verify=True) yeniden açılabildi.
        _host = parsed_url.hostname or ""
        # Kimliksiz istekleri reddeden siteler var (ölçüm: Wikipedia kimliksiz
        # istekte 403, kimlikle 200). Kendimizi açıkça tanıtıyoruz.
        _basliklar = {
            "Host": _host,
            "User-Agent": "Mozilla/5.0 (compatible; PDFPlatformBot/1.0; +https://pdfplatform.app)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "tr,en;q=0.8",
        }
        try:
            with _httpx.Client(verify=True, timeout=30.0, follow_redirects=False) as _istemci:
                resp = _istemci.send(
                    _istemci.build_request(
                        "GET",
                        direct_url,
                        headers=_basliklar,
                        extensions={"sni_hostname": _host},
                    )
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
            # Birincil motor: gerçek Chromium (Playwright) — sayfayı olduğu
            # gibi (CSS/görsel/webfont) render eder. Alt istekler dahi SSRF
            # filtresinden geçer. Yalnız URL girişinde denenir (ham HTML
            # metninde base_url/relatif kaynak çözümü daha kırılgan).
            rendered = False
            if _url_valid:
                rendered = ptx.render_url_via_browser(
                    _url_stripped, str(out_p), request_guard=_ssrf_safe_request_guard
                )
            if not rendered:
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
        # Bu uç dosya değil URL/HTML metni alıyor; `file` tanımsızdı ve hata
        # anında asıl hatanın üstünü örten ikinci bir hata oluşuyordu.
        cleanup_and_raise(workdir, e, filename=(source_url or "html"), client_ip=_client_ip(request), operation="html-to-pdf")
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


@router.post("/pdf-to-pdfa")
@limiter.limit("10/minute")
async def tool_pdf_to_pdfa(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    version: str = Form("2b"),
    password: str = Form(""),
):
    """
    PDF → PDF/A (arşiv biçimi).

    Kamu ihalesi, e-arşiv, mahkeme ve üniversite tesliminde istenen ISO biçimi.
    Yazı tipleri belgenin içine gömülür, renkler cihazdan bağımsız tanımlanır ve
    dış kaynağa bağımlılık kaldırılır; belge yıllar sonra da aynı görünür.
    """
    decision = await entitlement_check(token, "pdf-to-pdfa")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        sp = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(sp, request, decision, file.filename)
        surum = (version or "2b").strip().lower()
        if surum not in {"1b", "2b", "3b"}:
            surum = "2b"
        out_p = workdir / "arsiv.pdf"
        out_n = format_derived_filename(file.filename or "dosya.pdf", f"pdfa-{surum}", ".pdf")
        pwd = (password or "").strip() or None

        def _run():
            kaynak = sp
            # Şifreli belge: PDF/A şifrelemeye izin VERMEZ, bu yüzden önce çözülür.
            if pwd:
                cozulmus = workdir / "cozulmus.pdf"
                ptx.unlock_pdf_pikepdf(str(sp), str(cozulmus), pwd)
                kaynak = cozulmus
            bilgi = ptx.pdf_to_pdfa(str(kaynak), str(out_p), surum=surum)
            # NOT: Çıktıya filigran EKLENMEZ — sonradan yapılan her müdahale
            # belgenin PDF/A uyumluluğunu bozar.
            govde = _pack_pdf_result_file(out_p, out_n, user_id, "pdf-to-pdfa")
            govde["pdfa"] = bilgi
            return govde

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="pdf-to-pdfa")
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

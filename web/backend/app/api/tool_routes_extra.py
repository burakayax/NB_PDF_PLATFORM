"""Ek PDF araç uç noktaları (result-store + doğrudan indirme). routes.py ile döngüsel import yok."""

from __future__ import annotations

import ipaddress
import json
import logging
import os as _os
import re
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
    ensure_page_limit,
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
    record_output_proof,
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
            from src.pdfcore import pages as _pc
            src = _pc.open_pdf(sp, pwd)
            try:
                n = len(src.pages)
                to_del = parse_pages_text(pages_to_delete, max_page=n)
                to_del_set = {int(p) for p in to_del}
                if len(to_del_set) >= n:
                    raise HTTPException(
                        status_code=400,
                        detail="Tüm sayfalar silinemez; en az bir sayfa kalmalıdır.",
                    )
                keep = [i for i in range(n) if (i + 1) not in to_del_set]
                _pc.write_selected_pages(src, str(out_p), keep)
            finally:
                src.close()
            thumb = generate_blurred_pdf_thumbnail_from_path(out_p)
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
    # Ek aileler (hepsi Türkçe destekli; imza/başlık için el yazısı ve gösteri fontları dahil).
    "opensans": str(_ASSETS / "OpenSans-Regular.ttf"),
    "poppins": str(_ASSETS / "Poppins-Regular.ttf"),
    "playfair": str(_ASSETS / "PlayfairDisplay-Regular.ttf"),
    "lora": str(_ASSETS / "Lora-Regular.ttf"),
    "ptserif": str(_ASSETS / "PTSerif-Regular.ttf"),
    "dancing": str(_ASSETS / "DancingScript-Regular.ttf"),
    "greatvibes": str(_ASSETS / "GreatVibes-Regular.ttf"),
    "pacifico": str(_ASSETS / "Pacifico-Regular.ttf"),
    "anton": str(_ASSETS / "Anton-Regular.ttf"),
}

# Zengin metin (HTML) kutusu için: frontend'in gönderdiği font-family adları (FONT_LABEL) →
# gömülü TTF anahtarları. Adlar tarayıcı önizlemesiyle birebir aynı (Roboto / Noto Serif / …).
_EDIT_FONT_FAMILY = {
    "sans": "Roboto", "serif": "Noto Serif", "mono": "Roboto Mono",
    "lato": "Lato", "montserrat": "Montserrat", "merriweather": "Merriweather", "oswald": "Oswald",
    "opensans": "Open Sans", "poppins": "Poppins", "playfair": "Playfair Display", "lora": "Lora",
    "ptserif": "PT Serif", "dancing": "Dancing Script", "greatvibes": "Great Vibes",
    "pacifico": "Pacifico", "anton": "Anton",
}


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


async def _editor_quota_identity(request: Request, authorization: str | None) -> dict[str, Any]:
    """PDF Düzenle günlük hak kimliği: {unlimited, key, limit, guest, user_id}.

    Misafir → IP özeti (1/gün); oturum açmış ücretsiz → kullanıcı (2/gün), Başlangıç (10/gün);
    Plus/Pro/Business/yönetici sınırsız. Geçersiz jeton misafir sayılır."""
    key = _edl.guest_key(_client_ip(request))
    limit = _edl.GUEST_DAILY_LIMIT
    token = authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else ""
    if token:
        try:
            ident = await saas_user_identity(token)
            if ident["role"] == "ADMIN" or ident["plan"] in ("PLUS", "PRO", "BUSINESS"):
                return {"unlimited": True, "key": None, "limit": 0, "guest": False, "user_id": ident["user_id"]}
            _lim = _edl.STARTER_DAILY_LIMIT if ident["plan"] == "STARTER" else _edl.FREE_DAILY_LIMIT
            return {"unlimited": False, "key": _edl.user_key(ident["user_id"]), "limit": _lim,
                    "guest": False, "user_id": ident["user_id"], "plan": ident["plan"]}
        except HTTPException:
            pass  # geçersiz/eksik jeton → misafir muamelesi
    return {"unlimited": False, "key": key, "limit": limit, "guest": True, "user_id": None}


def _editor_limit_response(dec: dict[str, Any], guest: bool) -> JSONResponse:
    return JSONResponse(status_code=429, content={
        "error": "daily_limit", "used": dec.get("used"), "limit": dec.get("limit"),
        "resetAt": dec.get("resetAt"), "guest": guest,
    })


async def _editor_quota_peek(ident: dict[str, Any]) -> dict[str, Any]:
    """Hakkı DÜŞMEDEN oku (işlem başlamadan ön kontrol)."""
    dec = await consume_editor_download(ident["key"], peek=True, plan=ident.get("plan"))
    if dec is None:
        used = _edl.peek(ident["key"])
        dec = {"allowed": used < ident["limit"], "used": used, "limit": ident["limit"], "resetAt": _edl.reset_at_iso(), "guest": ident["guest"]}
    return dec


async def _editor_quota_consume(ident: dict[str, Any]) -> dict[str, Any]:
    """Hakkı atomik düş (işlem BAŞARIYLA bittiğinde)."""
    dec = await consume_editor_download(ident["key"], plan=ident.get("plan"))
    if dec is None:
        ok, used, lim = _edl.consume(ident["key"], ident["limit"])
        dec = {"allowed": ok, "used": used, "limit": lim, "resetAt": _edl.reset_at_iso(), "guest": ident["guest"]}
    return dec


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
    # store=1 (PDF Düzenle editörü): günlük hak «PDF'i Hazırla» anında düşer (indirmede değil).
    # İşlem başlamadan ön kontrol; hak BAŞARILI üretimden sonra düşer → hata olursa hak yanmaz.
    _quota_ident: dict[str, Any] | None = None
    if str(store).strip().lower() in ("1", "true", "yes"):
        _quota_ident = await _editor_quota_identity(request, authorization)
        if not _quota_ident["unlimited"]:
            _pk = await _editor_quota_peek(_quota_ident)
            if not _pk.get("allowed"):
                return _editor_limit_response(_pk, _quota_ident["guest"])
    # store YOKSA PDF doğrudan döner (çeviri aracı yolu) → günlük indirme sınırı atlanmasın:
    # misafir reddedilir; ücretli plan/yönetici sınırsız; ücretsiz üye aynı günlük haktan düşer.
    # (Kontrol dosya işlenmeden ÖNCE — boşuna sunucu işi yapılmaz.)
    if str(store).strip().lower() not in ("1", "true", "yes"):
        _tok = authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else ""
        if not _tok:
            raise HTTPException(status_code=401, detail="Bu işlem için oturum açın.")
        _ident = await saas_user_identity(_tok)
        # Tek kural (indirme yoluyla aynı): yalnız Plus/Pro/Business ve yönetici sınırsız; Başlangıç ve
        # ücretsiz üye günlük hakka tabidir.
        if not (_ident["role"] == "ADMIN" or _ident["plan"] in ("PLUS", "PRO", "BUSINESS")):
            _key = _edl.user_key(_ident["user_id"])
            _dec = await consume_editor_download(_key, plan=_ident["plan"])
            if _dec is None:
                _ok, _used, _lim = _edl.consume(_key, _edl.STARTER_DAILY_LIMIT if _ident["plan"] == "STARTER" else _edl.FREE_DAILY_LIMIT)
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
            from src.pdfcore import pages as _pc
            from src.pdfcore.errors import PdfPasswordRequired, PdfPasswordWrong
            from app.core import edit_apply as _ea

            try:
                doc = _pc.open_pdf(sp, pwd)
            except (PdfPasswordRequired, PdfPasswordWrong):
                raise HTTPException(status_code=400, detail="Şifreli PDF için doğru parola gerekli.")
            try:
                # Orijinal font (op.ofont): onarılmış TTF'i çalışma klasörüne yaz → yol tabanlı
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
                _ea.apply_edit_ops(
                    doc, ops, edit_fonts=_EDIT_FONTS, font_family_names=_EDIT_FONT_FAMILY,
                    orig_paths=_orig_paths,
                )
                _pc.save_pdf(doc, out_p)
                from src.pdfcore import overlay as _ovl
                for _fp, _ in _orig_paths.values():
                    _ovl.forget_font(_fp)
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
            quota: dict[str, Any] = {"unlimited": True}
            if _quota_ident and not _quota_ident["unlimited"]:
                _dec = await _editor_quota_consume(_quota_ident)
                if not _dec.get("allowed"):  # yarış: ön kontrolden sonra hak doldu
                    delete_result(handle.result_id)
                    return _editor_limit_response(_dec, _quota_ident["guest"])
                quota = {"unlimited": False, "used": _dec.get("used"), "limit": _dec.get("limit"),
                         "resetAt": _dec.get("resetAt"), "guest": _quota_ident["guest"]}
            return JSONResponse({"result_id": handle.result_id, "dl": dl_token, "quota": quota})
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
    """PDF Düzenle sonucunun indirilmesi — günlük hak BURADA DÜŞMEZ (hazırlama anında düştü).

    `dl` = hazırlamada dönen indirme jetonu (yalnız hazırlayan indirebilir)."""
    if not dl:
        raise HTTPException(status_code=400, detail="Geçersiz indirme jetonu.")

    # Sonuç var mı + jeton eşleşiyor mu?
    meta = read_meta_only(result_id)
    if meta.get("user_id") != f"ed:{dl}":
        raise HTTPException(status_code=403, detail="Forbidden")

    # Kanıt kaydı için kimlik (oturum açmışsa).
    proof_user_id: str | None = None
    if authorization and authorization.startswith("Bearer "):
        try:
            ident = await saas_user_identity(authorization[7:].strip())
            proof_user_id = ident["user_id"]
        except HTTPException:
            proof_user_id = None

    read = get_result(result_id, f"ed:{dl}")
    if proof_user_id:
        background_tasks.add_task(
            record_output_proof,
            proof_user_id,
            str(meta.get("tool") or "edit-text"),
            result_id,
            sha256=meta.get("sha256"),
            size_bytes=meta.get("size_bytes"),
            produced_at=meta.get("created_at"),
            path=read.payload_path,
        )
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
    TÜM sayfalarda bulup GERÇEKTEN kaldırır. Siyah kutu yerine, kaldırılan
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
            import io as _io
            from PIL import ImageFilter as _ImageFilter
            from src.pdfcore import PdfiumReader
            from src.pdfcore import content as _ct
            from src.pdfcore import overlay as _ov
            from src.pdfcore import pages as _pc
            from src.pdfcore.errors import PdfPasswordRequired, PdfPasswordWrong
            from app.core import edit_apply as _ea

            try:
                doc = _pc.open_pdf(sp, pwd)
            except (PdfPasswordRequired, PdfPasswordWrong):
                raise HTTPException(status_code=400, detail="Şifreli PDF için doğru parola gerekli.")
            try:
                # Koordinatlar tek uzayda (görünen sayfa) kalsın diye döndürme kaldırılır.
                for _pg in doc.pages:
                    try:
                        _pc.remove_rotation(doc, _pg)
                    except Exception:
                        pass
                reader = PdfiumReader(_pc.pdf_to_bytes(doc))
                builders: dict[int, Any] = {}
                try:
                    for pi in range(len(doc.pages)):
                        page = doc.pages[pi]
                        # 1. Gizlenecek tüm bölgeleri bul (büyük/küçük harf duyarsız).
                        rects: list[tuple[float, float, float, float]] = []
                        for term in term_list:
                            try:
                                rects.extend(reader.search_rects(pi, term))
                            except Exception:
                                pass
                        if not rects:
                            continue

                        # 2. GÜVENLİ BLUR: metni siyahla ÖRTMEK yerine gerçekten kaldırıp yerine
                        #    orijinalin BULANIK rasterini koyarız: altta metin kalmaz (geri
                        #    getirilemez) ama renk korunur, siyah kutu olmaz. Bulanık görüntü,
                        #    içerik kaldırılmadan ÖNCE üretilir.
                        blur_imgs: list[tuple[tuple[float, float, float, float], Any]] = []
                        for r in rects:
                            try:
                                img = reader.render(pi, 3.0, crop=r)
                                radius = max(6, int(min(img.width, img.height) / 4))
                                blur_imgs.append((r, img.filter(_ImageFilter.GaussianBlur(radius))))
                            except Exception:
                                blur_imgs.append((r, None))  # görüntü üretilemezse içerik yine kaldırılır (beyaz)

                        # 3. İçeriği (metin, görsel pikselleri, örtülen çizimler) GERÇEKTEN kaldır.
                        try:
                            _ea.blank_image_pixels(doc, page, rects, (1.0, 1.0, 1.0))
                        except Exception:
                            pass
                        _ct.remove_in_rects(doc, page, rects, text=True, paths=True)

                        # 4. Beyaz zemin + bulanık raster (kaldırmadan SONRA, sayfa üstüne).
                        def _draw(cv, rects=rects, blur_imgs=blur_imgs):
                            for r in rects:
                                cv.rect(r, fill=(1.0, 1.0, 1.0))
                            for r, im in blur_imgs:
                                if im is not None:
                                    cv.image(r, im, keep_proportion=False)

                        builders[pi] = _draw
                finally:
                    reader.close()
                if builders:
                    _ov.stamp_pages(doc, builders)
                _pc.save_pdf(doc, out_p)
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
            from src.pdfcore import pages as _pc
            from src.pdfcore.errors import PdfPasswordRequired, PdfPasswordWrong
            from app.core import edit_analyze as _an

            try:
                doc = _pc.open_pdf(sp, pwd)
            except (PdfPasswordRequired, PdfPasswordWrong):
                raise HTTPException(status_code=400, detail="Şifreli PDF için doğru parola gerekli.")
            try:
                return _an.analyze_pdf(doc, want_ocr=want_ocr)
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
            from src.pdfcore import pages as _pc
            doc = _pc.open_pdf(sp, pwd)
            try:
                n = len(doc.pages)
                pages_l = parse_pages_text(pages_str, max_page=n) if (per_page_raw is None and pages_str) else None
                if per_page_raw is not None:
                    for p in range(1, n + 1):
                        add_deg = int(per_page_raw.get(p, 0))
                        if add_deg == 0:
                            continue
                        _pc.rotate_page(doc.pages[p - 1], add_deg)
                else:
                    targets = [p - 1 for p in (pages_l or list(range(1, n + 1)))]
                    for i in targets:
                        if i < 0 or i >= n:
                            continue
                        _pc.rotate_page(doc.pages[i], int(degrees))
                # Döndürme yalnızca /Rotate meta-verisini değiştirir — içerik akışı yok
                _pc.save_pdf(doc, out_p)
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
            from src.pdfcore import pages as _pc
            src = _pc.open_pdf(sp, pwd)
            try:
                n = len(src.pages)
                raw = [int(x.strip()) for x in raw_order_str.split(",") if x.strip().isdigit()]
                if len(raw) != n:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Tam {n} sayfa numarası verin (virgülle, örn. 2,1,3).",
                    )
                order_0 = [p - 1 for p in raw]
                if any(i < 0 or i >= n for i in order_0):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Sayfa numaraları 1 ile {n} arasında olmalı.",
                    )
                _pc.write_selected_pages(src, str(out_p), order_0)
            finally:
                src.close()
            thumb = generate_blurred_pdf_thumbnail_from_path(out_p)
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
    watermark_text: str = Form(""),
    watermark_image: UploadFile | None = File(None),
    watermark_position: str = Form("center"),
    watermark_color: str = Form("#8C8C8C"),
    watermark_font: str = Form("helv"),
    watermark_opacity: float = Form(0.15),
    password: str = Form(""),
    watermark_rotation: float = Form(45.0),
    watermark_size: float = Form(70.0),
    from_page: int = Form(1),
    to_page: int = Form(0),
):
    opacity = max(0.05, min(1.0, float(watermark_opacity)))
    watermark_rotation = max(-360.0, min(360.0, watermark_rotation))
    watermark_size = max(10.0, min(100.0, watermark_size))
    from_page = max(1, from_page)
    to_page = max(0, to_page)
    if watermark_position not in ("center", "top-left", "top-right", "bottom-left", "bottom-right"):
        watermark_position = "center"
    gorsel_bayt: bytes | None = None
    if watermark_image is not None and (watermark_image.filename or ""):
        gorsel_bayt = await watermark_image.read(5 * 1024 * 1024 + 1)
        if len(gorsel_bayt) > 5 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Filigran görseli en fazla 5 MB olabilir.")
        if not gorsel_bayt:
            gorsel_bayt = None
    if gorsel_bayt is None and not (watermark_text or "").strip():
        raise HTTPException(status_code=400, detail="Filigran metni yazın ya da bir görsel seçin.")
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
            if gorsel_bayt is not None:
                ptx.add_watermark_image(
                    sp, str(out_p), gorsel_bayt,
                    opacity=opacity, password=pwd,
                    rotation=watermark_rotation, size_pct=watermark_size,
                    from_page=from_page, to_page=to_page,
                    position=watermark_position,
                )
                return _pack_pdf_result_file(out_p, out_n, user_id, "watermark")
            ptx.add_watermark_text(
                sp, str(out_p), watermark_text,
                opacity=opacity, password=pwd,
                font_name=watermark_font, font_color=watermark_color,
                rotation=watermark_rotation, size_pct=watermark_size,
                from_page=from_page, to_page=to_page,
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


def _hf_slotlari(ham: str) -> dict:
    """Arayüzden gelen {"header-left": "...", ...} JSON'unu doğrular; boşsa {}."""
    if not (ham or "").strip():
        return {}
    try:
        veri = json.loads(ham)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Üst/alt bilgi verisi okunamadı.")
    if not isinstance(veri, dict):
        raise HTTPException(status_code=400, detail="Üst/alt bilgi verisi geçersiz.")
    izinli = ("header-left", "header-center", "header-right", "footer-left", "footer-center", "footer-right")
    sonuc = {}
    for k, v in veri.items():
        if k in izinli and isinstance(v, str) and v.strip():
            if len(v) > 200:
                raise HTTPException(status_code=400, detail="Üst/alt bilgi metni en fazla 200 karakter olabilir.")
            sonuc[k] = v
    return sonuc


def _uygula_numara_ve_bilgi(
    kaynak: str, cikti: str, dosya_adi: str, hf_slots: dict, *, start_at: int, position: str,
    password, fmt: str, font_size: float, color: str, from_page: int, to_page: int,
) -> None:
    """Önce (varsa) serbest üst/alt bilgi metinleri, sonra (fmt != none ise) sayfa numaraları."""
    adim = kaynak
    gecici = None
    try:
        if hf_slots:
            hedef = cikti if fmt == "none" else cikti + ".hf.pdf"
            ptx.add_header_footer(
                adim, hedef, hf_slots, password=password, font_size=font_size, color=color,
                from_page=from_page, to_page=to_page, start_at=start_at, file_name=dosya_adi,
            )
            if fmt == "none":
                return
            adim = hedef
            gecici = hedef
            password = None  # ara dosya şifresizdir
        ptx.add_page_numbers(
            adim, cikti, start_at=start_at, position=position, password=password, fmt=fmt,
            font_size=font_size, color=color, from_page=from_page, to_page=to_page,
        )
    finally:
        if gecici and _os.path.exists(gecici):
            try:
                _os.remove(gecici)
            except OSError:
                pass


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
    font_size: float = Form(9.0),
    color: str = Form("#666666"),
    from_page: int = Form(1),
    to_page: int = Form(0),
    header_footer_json: str = Form(""),
):
    hf_slots = _hf_slotlari(header_footer_json)
    _gecerli_konumlar = {"footer", "header"} | {
        f"{v}-{h}" for v in ("footer", "header") for h in ("left", "center", "right")
    }
    if position not in _gecerli_konumlar:
        position = "footer"
    if fmt not in ("plain", "page", "of", "page-of", "none"):
        fmt = "plain"
    if fmt == "none" and not hf_slots:
        raise HTTPException(status_code=400, detail="Numara eklemiyorsanız en az bir üst/alt bilgi metni yazın.")
    font_size = max(6.0, min(48.0, font_size))
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", color or ""):
        color = "#666666"
    from_page = max(1, from_page)
    to_page = max(0, to_page)
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
            _uygula_numara_ve_bilgi(
                sp, str(out_p), file.filename or saved.name, hf_slots, start_at=int(start_at),
                position=position, password=pwd, fmt=fmt, font_size=font_size, color=color,
                from_page=from_page, to_page=to_page,
            )
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
        out_n = format_derived_filename(file.filename or saved.name, "Onarılmış", "pdf")
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
        ensure_page_limit(saved, pwd, "pdf-to-ppt")
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
    pages: str = Form(""),
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
                pages=_secili_sayfalar(pages),
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


def _secili_sayfalar(metin: str):
    """"1-3,5" gibi metni sayfa listesine çevirir; boşsa None (tüm sayfalar)."""
    from app.core.operations import parse_pages_text

    if not (metin or "").strip():
        return None
    return parse_pages_text(metin)


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
    pages: str = Form(""),
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
                pages=_secili_sayfalar(pages),
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
        # PDF/A-1b artık desteklenmiyor (Ghostscript kaldırıldı); eski istekler 2b'ye düşer.
        if surum not in {"2b", "3b"}:
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


@router.post("/deskew-pdf")
@limiter.limit("10/minute")
async def tool_deskew_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "deskew-pdf")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        sp = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(sp, request, decision, file.filename)
        out_p = workdir / "duz-tarama.pdf"
        pwd = (password or "").strip() or None
        out_n = format_derived_filename(file.filename or "dosya.pdf", "düzeltilmiş", ".pdf")

        def _run():
            ptx.deskew_pdf(str(sp), str(out_p), password=pwd)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, out_n, user_id, "deskew-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="deskew-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/grayscale-pdf")
@limiter.limit("20/minute")
async def tool_grayscale_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "grayscale-pdf")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        sp = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(sp, request, decision, file.filename)
        out_p = workdir / "gri.pdf"
        pwd = (password or "").strip() or None
        out_n = format_derived_filename(file.filename or "dosya.pdf", "gri tonlamalı", ".pdf")

        def _run():
            ptx.grayscale_pdf(str(sp), str(out_p), password=pwd)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, out_n, user_id, "grayscale-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="grayscale-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/resize-pdf")
@limiter.limit("20/minute")
async def tool_resize_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
    page_size: str = Form("a4"),
    custom_w_mm: float = Form(0.0),
    custom_h_mm: float = Form(0.0),
    orientation: str = Form("auto"),
    fit: str = Form("fit"),
    margin_mm: float = Form(0.0),
):
    decision = await entitlement_check(token, "resize-pdf")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        sp = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(sp, request, decision, file.filename)
        out_p = workdir / "boyut.pdf"
        pwd = (password or "").strip() or None
        out_n = format_derived_filename(file.filename or "dosya.pdf", f"{page_size}", ".pdf")

        def _run():
            ptx.resize_pdf_pages(
                str(sp), str(out_p), size=page_size, custom_w_mm=custom_w_mm, custom_h_mm=custom_h_mm,
                orientation=orientation, fit=fit, margin_mm=margin_mm, password=pwd,
            )
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, out_n, user_id, "resize-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="resize-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/flip-pdf")
@limiter.limit("20/minute")
async def tool_flip_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
    direction: str = Form("horizontal"),
    from_page: int = Form(1),
    to_page: int = Form(0),
):
    decision = await entitlement_check(token, "flip-pdf")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        sp = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        _after_save_validate(sp, request, decision, file.filename)
        out_p = workdir / "ayna.pdf"
        pwd = (password or "").strip() or None
        out_n = format_derived_filename(file.filename or "dosya.pdf", "çevrilmiş", ".pdf")

        def _run():
            ptx.flip_pdf(
                str(sp), str(out_p), direction=direction, from_page=max(1, from_page),
                to_page=max(0, to_page), password=pwd,
            )
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, out_n, user_id, "flip-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename=getattr(file, "filename", "<?>") or "<?>", client_ip=_client_ip(request), operation="flip-pdf")
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/alternate-mix-pdf")
@limiter.limit("10/minute")
async def tool_alternate_mix_pdf(
    request: Request,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    files: list[UploadFile] = File(...),
    reverse_second: str = Form(""),
):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Serpiştirmek için en az iki PDF seçin.")
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="En fazla 10 PDF serpiştirilebilir.")
    decision = await entitlement_check(token, "alternate-mix-pdf")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        yollar = []
        for idx, up in enumerate(files):
            ad = Path(up.filename or f"dosya{idx}.pdf").name
            kayit = await save_upload(up, workdir, filename=f"{idx:02d}__{ad}", max_bytes=max_bytes_from_decision(decision))
            _after_save_validate(kayit, request, decision, ad)
            yollar.append(str(kayit))
        out_p = workdir / "serpistirilmis.pdf"
        out_n = "serpiştirilmiş.pdf"
        ters = reverse_second.strip().lower() in ("1", "true", "on", "yes")

        def _run():
            ptx.alternate_mix_pdfs(yollar, str(out_p), reverse_second=ters)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return _pack_pdf_result_file(out_p, out_n, user_id, "alternate-mix-pdf")

        body = await run_sandboxed(_run)
        body["saasGating"] = _g_check(decision)
        return body
    except CpuCapacityTimeout:
        cleanup_path(workdir)
        raise
    except Exception as e:
        cleanup_and_raise(workdir, e, filename="<çoklu>", client_ip=_client_ip(request), operation="alternate-mix-pdf")
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

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

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from app.limiter import limiter

from app.api.pdf_auth import extract_pdf_access_token
from app.core import operations
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
from app.core.result_store import save_result_from_file
from app.core.thread_pool import CpuCapacityTimeout, run_cpu_bound
from app.core.pdf_sandbox import run_sandboxed
from app.core.saas_gate import (
    entitlement_check,
    saas_current_user_id,
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

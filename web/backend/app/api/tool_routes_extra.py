"""Ek PDF araç uç noktaları (result-store + doğrudan indirme). routes.py ile döngüsel import yok."""

from __future__ import annotations

import json
import logging
import os as _os
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

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
from app.core.preview_thumbnail import generate_blurred_pdf_thumbnail_from_path
from app.core.result_store import save_result_from_file
from app.core.thread_pool import run_cpu_bound
from app.core.saas_gate import (
    entitlement_check,
    saas_current_user_id,
)
from src import pdf_toolkit_extra as ptx

logger = logging.getLogger(__name__)

engine = operations.get_engine()

router = APIRouter(prefix="/api", tags=["nb-pdf-TOOLS-extras"])


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
async def tool_delete_pages(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    pages_to_delete: str = Form(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "delete-pages")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        pwd = password.strip() or None
        sp = str(saved)
        n = await run_cpu_bound(engine.get_num_pages, sp, password=pwd)
        to_del = parse_pages_text(pages_to_delete, max_page=n)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Silinmis", "pdf")
        out_p = workdir / out_n

        def _run():
            ptx.delete_pages_pdf(sp, str(out_p), to_del, password=pwd)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return out_p

        await run_cpu_bound(_run)
        body = _pack_pdf_result_file(out_p, out_n, user_id, "delete-pages")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/rotate-pdf")
async def tool_rotate_pdf(
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
        pwd = password.strip() or None
        sp = str(saved)
        n = await run_cpu_bound(engine.get_num_pages, sp, password=pwd)
        per_page: dict[int, int] | None = None
        raw_rot = (pages_rotation_json or "").strip()
        if raw_rot:
            try:
                parsed = json.loads(raw_rot)
                if not isinstance(parsed, dict):
                    raise ValueError("not an object")
                per_page = {}
                for k, v in parsed.items():
                    pi = int(k)
                    deg = int(v)
                    if deg != 0 and deg not in (90, 180, 270):
                        raise HTTPException(
                            status_code=400,
                            detail="pages_rotation_json değerleri 0, 90, 180 veya 270 olmalı.",
                        )
                    if deg != 0:
                        per_page[pi] = deg
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=400, detail="pages_rotation_json geçersiz.") from None
        pages_l = None
        if per_page is None:
            if degrees not in (90, 180, 270):
                raise HTTPException(status_code=400, detail="Açı 90, 180 veya 270 olmalı.")
            if (pages or "").strip():
                pages_l = parse_pages_text(pages, max_page=n)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Dondurulmus", "pdf")
        out_p = workdir / out_n

        def _run():
            ptx.rotate_pdf(
                sp,
                str(out_p),
                int(degrees),
                pages_l,
                password=pwd,
                per_page_degrees=per_page,
            )
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return out_p

        await run_cpu_bound(_run)
        body = _pack_pdf_result_file(out_p, out_n, user_id, "rotate-pdf")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/organize-pdf")
async def tool_organize_pdf(
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
        pwd = password.strip() or None
        sp = str(saved)
        n = await run_cpu_bound(engine.get_num_pages, sp, password=pwd)
        raw = [int(x.strip()) for x in page_order.split(",") if x.strip().isdigit()]
        if len(raw) != n:
            raise HTTPException(
                status_code=400,
                detail=f"Tam {n} sayfa numarası verin (virgülle, örn. 2,1,3).",
            )
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Duzenlendi", "pdf")
        out_p = workdir / out_n

        def _run():
            ptx.organize_pdf(sp, str(out_p), raw, password=pwd)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return out_p

        await run_cpu_bound(_run)
        body = _pack_pdf_result_file(out_p, out_n, user_id, "organize-pdf")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/unlock-pdf")
async def tool_unlock_pdf(
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
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Acik", "pdf")
        out_p = workdir / out_n

        def _run():
            ptx.unlock_pdf_pikepdf(sp, str(out_p), password)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return out_p

        await run_cpu_bound(_run)
        body = _pack_pdf_result_file(out_p, out_n, user_id, "unlock-pdf")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/watermark")
async def tool_watermark(
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
            return out_p

        await run_cpu_bound(_run)
        body = _pack_pdf_result_file(out_p, out_n, user_id, "watermark")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/page-numbers")
async def tool_page_numbers(
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
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Numarali", "pdf")
        out_p = workdir / out_n

        def _run():
            ptx.add_page_numbers(sp, str(out_p), start_at=int(start_at), position=position, password=pwd, fmt=fmt)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return out_p

        await run_cpu_bound(_run)
        body = _pack_pdf_result_file(out_p, out_n, user_id, "page-numbers")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/repair-pdf")
async def tool_repair_pdf(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "repair-pdf")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Onarilmis", "pdf")
        out_p = workdir / out_n

        def _run():
            ptx.repair_pdf(sp, str(out_p), password=pwd)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return out_p

        await run_cpu_bound(_run)
        body = _pack_pdf_result_file(out_p, out_n, user_id, "repair-pdf")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/pdf-to-ppt")
async def tool_pdf_to_ppt(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "pdf-to-ppt")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        pwd = password.strip() or None
        sp = str(saved)
        user_id = await saas_current_user_id(token)
        out_n = format_derived_filename(file.filename or saved.name, "Sunum", "pptx")
        out_p = workdir / out_n

        def _run():
            ptx.pdf_to_pptx(sp, str(out_p), password=pwd, dpi=int(ptx.PDF_EXPORT_DPI_WEB))
            return out_p

        await run_cpu_bound(_run)
        try:
            thumb = generate_blurred_pdf_thumbnail_from_path(Path(sp))
        except OSError:
            thumb = None
        h = save_result_from_file(
            out_p,
            out_n,
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            user_id=user_id,
            thumbnail_png=thumb,
            tool="pdf-to-ppt",
        )
        return {
            "result_id": h.result_id,
            "filename": h.filename,
            "mime": h.mime,
            "size_bytes": h.size_bytes,
            "has_thumbnail": h.has_thumbnail,
            "saasGating": _g_check(decision),
        }
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/ppt-to-pdf")
async def tool_ppt_to_pdf(
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
        await run_cpu_bound(ptx.pptx_to_pdf, sp, str(out_p))
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

        handle = await run_cpu_bound(_store)

        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": handle.has_thumbnail,
            "saasGating": _g_check(decision),
        }
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/pdf-to-image")
async def tool_pdf_to_image(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    image_format: str = Form("jpg"),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "pdf-to-image")
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
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
            return Path(zpath)

        zip_p = await run_cpu_bound(_zip)
        h = save_result_from_file(
            zip_p,
            "sayfalar.zip",
            "application/zip",
            user_id=user_id,
            thumbnail_png=None,
            tool="pdf-to-image",
        )
        return {
            "result_id": h.result_id,
            "filename": h.filename,
            "mime": h.mime,
            "size_bytes": h.size_bytes,
            "has_thumbnail": False,
            "saasGating": _g_check(decision),
        }
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/image-to-pdf")
async def tool_image_to_pdf(
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
            return out_p

        await run_cpu_bound(_run)
        body = _pack_pdf_result_file(out_p, "fotograflar.pdf", user_id, "image-to-pdf")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/html-to-pdf")
async def tool_html_to_pdf(
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
    decision = await entitlement_check(token, "html-to-pdf")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        out_p = workdir / "web.pdf"

        def _run():
            u = (source_url or "").strip()
            if u:
                ptx.html_url_to_pdf(u, str(out_p))
            else:
                ptx.html_to_pdf_file(html or "<html><body><p>Boş</p></body></html>", str(out_p))
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))
            return out_p

        await run_cpu_bound(_run)
        body = _pack_pdf_result_file(out_p, "web.pdf", user_id, "html-to-pdf")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/pdf-to-text")
async def tool_pdf_to_text(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "pdf-to-text")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        sp = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        out_p = workdir / "metin.txt"
        pwd = (password or "").strip() or None
        await run_cpu_bound(lambda: ptx.pdf_to_text(str(sp), str(out_p), password=pwd))
        out_n = format_derived_filename(file.filename or "dosya.pdf", "metin", ".txt")
        body = _pack_text_result_file(out_p, out_n, user_id, "pdf-to-text")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/flatten-pdf")
async def tool_flatten_pdf(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(""),
):
    decision = await entitlement_check(token, "flatten-pdf")
    workdir = create_workdir()
    try:
        user_id = await saas_current_user_id(token)
        sp = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        out_p = workdir / "duzlestir.pdf"
        pwd = (password or "").strip() or None
        def _run():
            ptx.flatten_pdf(str(sp), str(out_p), password=pwd)
            _maybe_watermark_pdf(out_p, bool(decision.get("watermarkEnabled", False)))

        await run_cpu_bound(_run)
        out_n = format_derived_filename(file.filename or "dosya.pdf", "düz", ".pdf")
        body = _pack_pdf_result_file(out_p, out_n, user_id, "flatten-pdf")
        body["saasGating"] = _g_check(decision)
        return body
    except Exception as e:
        cleanup_and_raise(workdir, e)
    finally:
        if workdir.exists():
            cleanup_path(workdir)

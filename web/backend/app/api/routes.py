"""Tarayıcıdan gelen istekleri PDF motoruna bağlayan web API rotaları.

Gating kararları Node SaaS API'deki entitlement engine üzerinden yapılır:
``POST /api/entitlement/check`` pre-check, ``POST /api/entitlement/consume``
atomic decrement + journal. Legacy daily-limit helpers (assert-feature /
record-usage) kaldırılmıştır.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Annotated, Any

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from app.api.pdf_auth import extract_bearer_header_only, extract_pdf_access_token
from app.core.operations import (
    build_pdf_download_headers,
    cleanup_and_raise,
    cleanup_path,
    create_workdir,
    create_zip_archive,
    download_response,
    format_split_page_filename,
    format_split_single_filename,
    format_split_zip_filename,
    format_derived_filename,
    get_engine,
    operation_capabilities,
    parse_pages_text,
    save_upload,
    save_office_upload,
    save_any_upload,
    max_bytes_from_decision,
)
from app.core.jobs import (
    cleanup_job,
    create_merge_job,
    get_job_download,
    get_job_status,
    request_cancel_merge_job,
)
from app.core.thread_pool import run_cpu_bound
from app.core.pdf_sandbox import run_sandboxed
from app.core.preview_gate import (
    generate_hero_watermarked_preview_png_queued,
    generate_hero_watermarked_preview_png_queued_from_path,
)
from app.core.preview_thumbnail import generate_blurred_pdf_thumbnail_from_path
from app.core.result_store import (
    delete_result,
    get_result,
    read_meta_only,
    save_result_from_file,
)
from app.core.saas_gate import (
    entitlement_check,
    entitlement_consume,
    saas_current_user_id,
    saas_session_ok,
    get_user_file_size_limit_bytes,
)
from app.limiter import limiter
from app.core.pdf_security import validate_pdf_before_processing
import src.pdf_toolkit_extra as ptx

logger = logging.getLogger(__name__)


def _result_payload_looks_like_pdf(mime: str, filename: str, payload_path: Path) -> bool:
    """Meta bazen yanlış mime ile yazılır; dosya adı veya %PDF imzası ile doğrula."""
    if "pdf" in (mime or "").lower():
        return True
    if (filename or "").lower().strip().endswith(".pdf"):
        return True
    try:
        with payload_path.open("rb") as fh:
            return fh.read(5).startswith(b"%PDF-")
    except OSError:
        return False


router = APIRouter(prefix="/api", tags=["nb-pdf-TOOLS"])
engine = get_engine()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _saas_gating_from_check(d: dict[str, Any]) -> dict[str, Any]:
    return {
        "allowed": bool(d.get("allowed")),
        "reason": str(d.get("reason", "")),
        "cost": int(d.get("cost") or 0),
        "creditsBefore": int(d.get("creditsBefore") or 0),
        "creditsAfter": int(d.get("creditsAfter") or 0),
        "watermarkEnabled": bool(d.get("watermarkEnabled", False)),
    }


def _saas_gating_from_consume(d: dict[str, Any]) -> dict[str, Any]:
    """Map Node ``consumeTool`` result to the ``saasGating`` / UI shape."""
    if d.get("status") == "ok":
        return {
            "allowed": True,
            "reason": str(d.get("reason", "")),
            "cost": int(d.get("cost") or 0),
            "creditsBefore": int(d.get("creditsBefore") or 0),
            "creditsAfter": int(d.get("creditsAfter") or 0),
        }
    return {
        "allowed": False,
        "reason": str(d.get("reason", "")),
        "cost": int(d.get("cost") or 0),
        "creditsBefore": int(d.get("creditsBefore") or 0),
        "creditsAfter": int(d.get("creditsAfter") or 0),
    }


def _maybe_watermark_pdf(p: Path, enabled: bool) -> None:
    """Plan-level watermark: FREE/Starter çıktılarına NB PDF Platform damgası ekler."""
    if not enabled:
        return
    import os as _os
    tmp = p.parent / (p.stem + "__wm_tmp.pdf")
    try:
        engine.add_watermark_text(
            str(p), str(tmp),
            watermark_text="NB PDF Platform",
            opacity=0.12,
            font_name="helv",
            watermark_color="#8C8C8C",
        )
        _os.replace(str(tmp), str(p))
    except Exception as exc:
        logger.warning("Plan watermark başarısız (non-fatal): %s", exc)
        try:
            if tmp.exists():
                tmp.unlink(missing_ok=True)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Health / capabilities
# ---------------------------------------------------------------------------


@router.get("/health")
@limiter.exempt
def health(request: Request):
    import shutil
    from app.core.pdf_security import get_library_versions
    lib_versions = getattr(request.app.state, "pdf_library_versions", None) or get_library_versions()
    return {
        "status": "ok",
        "service": "nb-pdf-TOOLS-web",
        "pdf_libraries": lib_versions,
        "system_tools": {
            "wkhtmltopdf": bool(shutil.which("wkhtmltopdf")),
            "tesseract":   bool(shutil.which("tesseract")),
            "libreoffice": bool(shutil.which("libreoffice")),
        },
    }


@router.get("/capabilities")
def capabilities():
    import shutil
    base = operation_capabilities()
    base["tool_availability"] = {
        "wkhtmltopdf": bool(shutil.which("wkhtmltopdf")),
        "tesseract":   bool(shutil.which("tesseract")),
        "libreoffice": bool(shutil.which("libreoffice")),
    }
    return base


# ---------------------------------------------------------------------------
# Tool routes
# ---------------------------------------------------------------------------


@router.post("/merge")
async def merge_pdfs(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    files: list[UploadFile] = File(...),
    passwords_json: str = Form(default="{}"),
):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Birleştirme için en az iki PDF seçin.")

    # Merge: kota düşümü indirme GET üzerinden ``entitlement_consume`` ile yapılır.
    decision = await entitlement_check(token, "merge")

    workdir = create_workdir()
    try:
        saved_paths: list[Path] = []
        for idx, upload in enumerate(files):
            orig_name = Path(upload.filename or "upload.pdf").name
            unique_name = f"{idx:04d}__{orig_name}"
            saved = await save_upload(upload, workdir, filename=unique_name, max_bytes=max_bytes_from_decision(decision))
            validate_pdf_before_processing(saved, filename=orig_name, expected_max_bytes=max_bytes_from_decision(decision))
            saved_paths.append(saved)

        passwords: dict[str, str] = {}
        if passwords_json.strip():
            import json

            resolved = json.loads(passwords_json)
            if isinstance(resolved, list):
                for i, saved in enumerate(saved_paths):
                    if i < len(resolved) and str(resolved[i] or "").strip():
                        passwords[str(saved)] = str(resolved[i]).strip()
            elif isinstance(resolved, dict):
                for saved in saved_paths:
                    name = saved.name
                    orig_suffix = name.split("__", 1)[-1] if "__" in name else name
                    password = str(resolved.get(name, "") or resolved.get(orig_suffix, "") or "").strip()
                    if not password:
                        for key, val in resolved.items():
                            key_name = Path(str(key)).name
                            if key_name == name or str(key) == name or key_name == orig_suffix or str(key) == orig_suffix:
                                password = str(val or "").strip()
                                break
                    if password:
                        passwords[str(saved)] = password

        output_name = "birleştirilmiş.pdf"
        job_id = create_merge_job(saved_paths, passwords, workdir, output_name)
        return {"job_id": job_id, "saasGating": _saas_gating_from_check(decision)}
    except Exception as error:
        cleanup_and_raise(workdir, error)


@router.get("/jobs/{job_id}")
@limiter.exempt
def job_status(job_id: str, _token: Annotated[str, Depends(extract_bearer_header_only)]):
    """İstemci sık aralıklarla durum sorar; @limiter.exempt ile genel dakikalık kota merge akışını kesmez."""
    return get_job_status(job_id)


@router.post("/jobs/{job_id}/cancel")
@limiter.exempt
async def cancel_merge_job(
    job_id: str,
    _token: Annotated[str, Depends(extract_bearer_header_only)],
):
    """Cooperative cancel for the in-memory merge worker (sets a flag; worker stops between pages)."""
    if not request_cancel_merge_job(job_id):
        raise HTTPException(
            status_code=404,
            detail="İşlem bulunamadı, tamamlanmış veya iptal edilemez.",
        )
    return {"ok": True}


@router.get("/jobs/{job_id}/download")
@limiter.exempt
async def download_job_output(
    job_id: str,
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
):
    """Akış başlamadan atomik ``entitlement_consume`` — istemci POST’suna güvenilmez."""
    cons = await entitlement_consume(token, "merge")
    if cons.get("status") != "ok":
        return JSONResponse(
            status_code=402,
            content={"error": "payment_required", "saasGating": _saas_gating_from_consume(cons)},
        )
    output_path, output_name, _workdir = get_job_download(job_id)
    background_tasks.add_task(cleanup_job, job_id)
    return FileResponse(
        path=str(output_path),
        filename=output_name,
        media_type="application/pdf",
        headers=build_pdf_download_headers(saas_gating=_saas_gating_from_consume(cons)) or None,
    )


@router.get("/jobs/{job_id}/preview/hero")
@limiter.exempt
async def preview_merge_job_hero(
    job_id: str,
    token: Annotated[str, Depends(extract_bearer_header_only)],
):
    """Birleştirilmiş çıktının ilk sayfası — ücretsiz filigranlı PNG (indirme kotası düşmez)."""
    await saas_session_ok(token)
    output_path, _output_name, _workdir = get_job_download(job_id)
    png = await generate_hero_watermarked_preview_png_queued_from_path(output_path)
    if not png:
        raise HTTPException(status_code=404, detail="Önizleme oluşturulamadı.")
    return Response(content=png, media_type="image/png")


@router.get("/jobs/{job_id}/preview/pdf")
@limiter.exempt
async def preview_merge_job_pdf(
    job_id: str,
    token: Annotated[str, Depends(extract_bearer_header_only)],
):
    """Tam PDF önizlemesi (inline); kota düşmez — düşüm onaylı indirmede."""
    await saas_session_ok(token)
    output_path, output_name, _workdir = get_job_download(job_id)
    disp_headers = {"Content-Disposition": f'inline; filename="{output_name}"'}
    return FileResponse(
        path=str(output_path),
        filename=output_name,
        media_type="application/pdf",
        headers=disp_headers,
    )


@router.post("/inspect-pdf")
@limiter.exempt
async def inspect_pdf(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(default=""),
):
    # Inspection is a free read-only call — no entitlement charge.
    logger.info(
        "inspect_pdf incoming filename=%s bytes_hint=n/a",
        file.filename,
    )
    await saas_session_ok(token)
    logger.info("inspect_pdf saas_session_ok done filename=%s content_type=%s", file.filename, file.content_type)
    max_bytes = await get_user_file_size_limit_bytes(token)

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir, max_bytes=max_bytes)
        validate_pdf_before_processing(saved_file, filename=getattr(file, "filename", None) or "<?>", client_ip="<from-route>")
        p = str(saved_file)

        # 0-byte dosya — geçersiz/bozuk PDF, işleme sokmadan erken dön
        if saved_file.stat().st_size == 0:
            return {
                "filename": file.filename,
                "encrypted": False,
                "page_count": 0,
                "corrupt": True,
                "inspect_error": "Dosya boş (0 byte) — geçersiz veya bozuk PDF.",
                "inspect_diagnostic": {"classification_reason": "empty_file"},
            }

        requires_pw, encrypt_diag = await run_sandboxed(
            engine.classify_pdf_password_requirement,
            p,
        )
        encrypted = requires_pw
        corrupt = bool(encrypt_diag.get("corrupt"))
        pwd = password.strip() or None
        page_count = None
        inspect_error = None
        if corrupt:
            inspect_error = "Dosya geçersiz veya bozuk — PDF olarak açılamıyor."
        elif encrypted and not pwd:
            pass
        else:
            try:
                page_count = await run_sandboxed(engine.get_num_pages, p, password=pwd)
            except Exception as exc:
                page_count = None
                inspect_error = str(exc)
        return {
            "filename": file.filename,
            "encrypted": encrypted,
            "page_count": page_count,
            "corrupt": corrupt,
            "inspect_error": inspect_error,
            "inspect_diagnostic": encrypt_diag,
        }
    except Exception as error:
        cleanup_and_raise(workdir, error)
    finally:
        if workdir.exists():
            from app.core.operations import cleanup_path

            cleanup_path(workdir)


@router.post("/split")
async def split_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    pages_text: str = Form(...),
    mode: str = Form(default="single"),
    password: str = Form(default=""),
):
    """Result-store: compute output + blurred preview; credits on
    ``GET /api/pdf/result/{id}/download``."""
    # background_tasks unused but kept for API compatibility with older clients.
    _ = background_tasks
    workdir = create_workdir()
    try:
        decision = await entitlement_check(token, "split")

        saved_file = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        validate_pdf_before_processing(saved_file, filename=getattr(file, "filename", None) or "<?>", client_ip="<from-route>")
        pwd = password.strip() or None
        sp = str(saved_file)
        if (await run_sandboxed(engine.is_pdf_encrypted, sp)) and not pwd:
            raise HTTPException(status_code=400, detail="Şifreli PDF için kaynak parolası gerekli.")
        max_pages = await run_sandboxed(engine.get_num_pages, sp, password=pwd)
        pages = parse_pages_text(pages_text, max_page=max_pages)
        user_id = await saas_current_user_id(token)
        file_base = file.filename or saved_file.name
        m = (mode or "single").strip().lower()
        if m not in ("single", "separate"):
            m = "single"

        def _do_split() -> Any:
            return _split_to_result_store(workdir, sp, pages, file_base, m, pwd, user_id, watermark_enabled=bool(decision.get("watermarkEnabled", False)))

        handle = await run_sandboxed(_do_split)

        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": handle.has_thumbnail,
            "saasGating": _saas_gating_from_check(decision),
        }
    except asyncio.CancelledError:
        logger.warning("split_pdf cancelled — client disconnected")
        raise
    except Exception as error:
        cleanup_and_raise(workdir, error)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/pdf-to-word")
async def pdf_to_word(
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(default=""),
):
    decision = await entitlement_check(token, "pdf-to-word")
    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        validate_pdf_before_processing(saved_file, filename=getattr(file, "filename", None) or "<?>", client_ip="<from-route>")
        pwd = password.strip() or None
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "Word", "docx")
        output_path = workdir / output_name
        user_id = await saas_current_user_id(token)

        def _run():
            if engine.is_pdf_encrypted(sp) and not pwd:
                raise HTTPException(status_code=400, detail="Şifreli PDF için kaynak parolası gerekli.")
            engine.pdf_to_word(sp, str(output_path), password=pwd)
            outp = Path(str(output_path))
            return save_result_from_file(
                outp,
                outp.name,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                user_id=user_id,
                thumbnail_png=None,
                tool="pdf-to-word",
            )

        handle = await run_sandboxed(_run)

        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": handle.has_thumbnail,
            "saasGating": _saas_gating_from_check(decision),
        }
    except Exception as error:
        cleanup_and_raise(workdir, error)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/word-to-pdf")
async def word_to_pdf(
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
):
    decision = await entitlement_check(token, "word-to-pdf")
    workdir = create_workdir()
    try:
        saved_file = await save_office_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "PDF", "pdf")
        output_path = workdir / output_name
        await run_sandboxed(engine.word_to_pdf, sp, str(output_path))
        user_id = await saas_current_user_id(token)

        def _store():
            outp = Path(str(output_path))
            _maybe_watermark_pdf(outp, bool(decision.get("watermarkEnabled", False)))
            thumb_png = None
            try:
                thumb_png = generate_blurred_pdf_thumbnail_from_path(outp)
            except OSError:
                thumb_png = None
            return save_result_from_file(
                outp,
                outp.name,
                "application/pdf",
                user_id=user_id,
                thumbnail_png=thumb_png,
                tool="word-to-pdf",
            )

        handle = await run_sandboxed(_store)

        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": handle.has_thumbnail,
            "saasGating": _saas_gating_from_check(decision),
        }
    except Exception as error:
        cleanup_and_raise(workdir, error)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/excel-to-pdf")
async def excel_to_pdf(
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
):
    decision = await entitlement_check(token, "excel-to-pdf")
    workdir = create_workdir()
    try:
        saved_file = await save_office_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "PDF", "pdf")
        output_path = workdir / output_name
        await run_sandboxed(engine.excel_to_pdf, sp, str(output_path))
        user_id = await saas_current_user_id(token)

        def _store():
            outp = Path(str(output_path))
            _maybe_watermark_pdf(outp, bool(decision.get("watermarkEnabled", False)))
            thumb_png = None
            try:
                thumb_png = generate_blurred_pdf_thumbnail_from_path(outp)
            except OSError:
                thumb_png = None
            return save_result_from_file(
                outp,
                outp.name,
                "application/pdf",
                user_id=user_id,
                thumbnail_png=thumb_png,
                tool="excel-to-pdf",
            )

        handle = await run_sandboxed(_store)

        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": handle.has_thumbnail,
            "saasGating": _saas_gating_from_check(decision),
        }
    except Exception as error:
        cleanup_and_raise(workdir, error)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/pdf-to-excel")
async def pdf_to_excel(
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(default=""),
):
    decision = await entitlement_check(token, "pdf-to-excel")
    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        validate_pdf_before_processing(saved_file, filename=getattr(file, "filename", None) or "<?>", client_ip="<from-route>")
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "Excel", "xlsx")
        output_path = workdir / output_name
        await run_sandboxed(
            engine.pdf_text_to_excel,
            sp,
            str(output_path),
            preserve_tables=True,
            password=password.strip() or None,
        )
        user_id = await saas_current_user_id(token)

        def _store():
            outp = Path(str(output_path))
            return save_result_from_file(
                outp,
                outp.name,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                user_id=user_id,
                thumbnail_png=None,
                tool="pdf-to-excel",
            )

        handle = await run_sandboxed(_store)

        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": handle.has_thumbnail,
            "saasGating": _saas_gating_from_check(decision),
        }
    except Exception as error:
        cleanup_and_raise(workdir, error)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


@router.post("/compress")
async def compress_pdf(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(default=""),
    quality: str = Form(default="auto"),
):
    """Result-store: build preview; credits are charged on
    ``GET /api/pdf/result/{id}/download`` (not on this POST)."""
    decision = await entitlement_check(token, "compress")

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        validate_pdf_before_processing(saved_file, filename=getattr(file, "filename", None) or "<?>", client_ip="<from-route>")
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "Sıkıştırılmış", "pdf")
        output_path = workdir / output_name
        out_str = str(output_path)
        pwd = password.strip() or None
        user_id = await saas_current_user_id(token)

        q = quality if quality in ("auto", "low", "medium", "high") else "auto"

        def _compress_and_store() -> Any:
            engine.compress_pdf(sp, out_str, password=pwd, quality=q)
            outp = Path(out_str)
            _maybe_watermark_pdf(outp, bool(decision.get("watermarkEnabled", False)))
            thumb = None
            try:
                thumb = generate_blurred_pdf_thumbnail_from_path(outp)
            except OSError:
                thumb = None
            return save_result_from_file(
                outp,
                outp.name,
                "application/pdf",
                user_id=user_id,
                thumbnail_png=thumb,
                tool="compress",
            )

        handle = await run_sandboxed(_compress_and_store)

        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": handle.has_thumbnail,
            "saasGating": _saas_gating_from_check(decision),
        }
    except Exception as error:
        cleanup_and_raise(workdir, error)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


_BATCH_ALLOWED_TOOLS = frozenset({
    "compress",
    "pdf-to-word",
    "pdf-to-excel",
    "word-to-pdf",
    "excel-to-pdf",
    "encrypt",
    "pdf-to-text",
    "repair-pdf",
    "page-numbers",
    "watermark",
    "image-to-pdf",
    "pdf-to-image",
    "ppt-to-pdf",
    "pdf-to-ppt",
})


@router.post("/batch")
async def batch_process(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    files: list[UploadFile] = File(...),
    tool_type: str = Form(...),
    password: str = Form(default=""),
    quality: str = Form(default="auto"),
    user_password: str = Form(default=""),
    input_password: str = Form(default=""),
    watermark_text: str = Form(default=""),
    watermark_color: str = Form(default="#000000"),
    watermark_font: str = Form(default="helv"),
    watermark_opacity: str = Form(default="0.5"),
    start_at: str = Form(default="1"),
    position: str = Form(default="bottom-right"),
    fmt: str = Form(default="numeric"),
    image_format: str = Form(default="png"),
):
    """Birden fazla dosyayı aynı araçla işle; sonuçları ZIP olarak döndür."""
    tool_type = tool_type.strip().lower()
    if tool_type not in _BATCH_ALLOWED_TOOLS:
        raise HTTPException(status_code=400, detail=f"Toplu işlem için desteklenmeyen araç: {tool_type}")
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Toplu işlem için en az 2 dosya gerekli.")
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="En fazla 50 dosya toplu işlenebilir.")

    decision = await entitlement_check(token, tool_type, file_count=len(files))
    if not decision.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail=decision.get("reason", "batch_not_allowed"),
        )

    user_id = await saas_current_user_id(token)
    pwd = password.strip() or None
    q = quality if quality in ("auto", "low", "medium", "high") else "auto"
    u_pwd = user_password.strip()
    i_pwd = input_password.strip() or None

    wm_text = watermark_text.strip()
    wm_color = watermark_color.strip() or "#000000"
    wm_font = watermark_font.strip() or "helv"
    wm_opacity = watermark_opacity.strip() or "0.5"

    page_start = start_at.strip() or "1"
    page_pos = position.strip() or "bottom-right"
    page_fmt = fmt.strip() or "numeric"
    img_fmt = image_format.strip() or "png"

    workdir = create_workdir()
    try:
        output_paths: list[tuple[Path, str]] = []

        _office_tools = {"word-to-pdf", "excel-to-pdf", "ppt-to-pdf"}
        for idx, upload in enumerate(files):
            orig_name = Path(upload.filename or f"file_{idx}.pdf").name
            unique_name = f"{idx:04d}__{orig_name}"
            if tool_type in _office_tools:
                saved = await save_office_upload(upload, workdir, filename=unique_name, max_bytes=max_bytes_from_decision(decision))
            elif tool_type == "image-to-pdf":
                saved = await save_any_upload(upload, workdir, filename=unique_name, max_bytes=max_bytes_from_decision(decision))
            else:
                saved = await save_upload(upload, workdir, filename=unique_name, max_bytes=max_bytes_from_decision(decision))
            sp = str(saved)

            def _process_one(sp=sp, orig_name=orig_name, idx=idx) -> tuple[Path, str]:
                if tool_type == "compress":
                    out_name = format_derived_filename(orig_name, "Sıkıştırılmış", "pdf")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.compress_pdf(sp, str(out_path), password=pwd, quality=q)
                    return out_path, out_name
                elif tool_type == "pdf-to-word":
                    out_name = format_derived_filename(orig_name, "Word", "docx")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.pdf_to_word(sp, str(out_path), password=pwd)
                    return out_path, out_name
                elif tool_type == "pdf-to-excel":
                    out_name = format_derived_filename(orig_name, "Excel", "xlsx")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.pdf_text_to_excel(sp, str(out_path), preserve_tables=True, password=pwd)
                    return out_path, out_name
                elif tool_type == "word-to-pdf":
                    out_name = format_derived_filename(orig_name, "PDF", "pdf")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.word_to_pdf(sp, str(out_path))
                    return out_path, out_name
                elif tool_type == "excel-to-pdf":
                    out_name = format_derived_filename(orig_name, "PDF", "pdf")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.excel_to_pdf(sp, str(out_path))
                    return out_path, out_name
                elif tool_type == "encrypt":
                    if not u_pwd:
                        raise ValueError("Şifrelemek için çıktı parolası gerekli.")
                    out_name = format_derived_filename(orig_name, "Şifreli", "pdf")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.encrypt_pdf(sp, str(out_path), user_password=u_pwd, input_password=i_pwd)
                    return out_path, out_name
                elif tool_type == "pdf-to-text":
                    out_name = format_derived_filename(orig_name, "Metin", "txt")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.pdf_to_text(sp, str(out_path), password=pwd)
                    return out_path, out_name
                elif tool_type == "repair-pdf":
                    out_name = format_derived_filename(orig_name, "Onarılmış", "pdf")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.repair_pdf(sp, str(out_path), password=pwd)
                    return out_path, out_name
                elif tool_type == "page-numbers":
                    out_name = format_derived_filename(orig_name, "Numaralı", "pdf")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.add_page_numbers(sp, str(out_path), start=int(page_start), position=page_pos, fmt=page_fmt, password=pwd)
                    return out_path, out_name
                elif tool_type == "watermark":
                    out_name = format_derived_filename(orig_name, "Filigran", "pdf")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.add_watermark_text(sp, str(out_path), watermark_text=wm_text, watermark_color=wm_color, font_name=wm_font, opacity=float(wm_opacity), password=pwd)
                    return out_path, out_name
                elif tool_type == "image-to-pdf":
                    out_name = format_derived_filename(orig_name, "PDF", "pdf")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    ptx.images_to_pdf([sp], str(out_path))
                    return out_path, out_name
                elif tool_type == "pdf-to-image":
                    out_name = format_derived_filename(orig_name, "Görüntü", img_fmt)
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.pdf_to_image(sp, str(out_path), image_format=img_fmt, password=pwd)
                    return out_path, out_name
                elif tool_type == "ppt-to-pdf":
                    out_name = format_derived_filename(orig_name, "PDF", "pdf")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.ppt_to_pdf(sp, str(out_path))
                    return out_path, out_name
                elif tool_type == "pdf-to-ppt":
                    out_name = format_derived_filename(orig_name, "PowerPoint", "pptx")
                    out_path = workdir / f"{idx:04d}_{out_name}"
                    engine.pdf_to_ppt(sp, str(out_path), password=pwd)
                    return out_path, out_name
                raise ValueError(f"Bilinmeyen araç: {tool_type}")

            result_path, result_name = await run_sandboxed(_process_one)
            output_paths.append((result_path, result_name))

        zip_name = f"toplu_{tool_type.replace('-', '_')}.zip"
        zip_path = create_zip_archive(workdir / zip_name, [p for p, _ in output_paths])

        def _store_zip():
            return save_result_from_file(
                zip_path,
                zip_path.name,
                "application/zip",
                user_id=user_id,
                thumbnail_png=None,
                tool=f"batch-{tool_type}",
            )

        handle = await run_sandboxed(_store_zip)
        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": False,
            "saasGating": _saas_gating_from_check(decision),
        }
    except Exception as error:
        cleanup_and_raise(workdir, error)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


def _split_to_result_store(
    workdir: Path,
    sp: str,
    pages: list[int],
    file_base_name: str,
    mode: str,
    password: str | None,
    user_id: str,
    watermark_enabled: bool = False,
) -> Any:
    """CPU-bound: build split output bytes + blurred preview; returns ResultHandle."""
    from pathlib import Path as P

    if mode == "single":
        output_name = format_split_single_filename(file_base_name, pages)
        output_path = workdir / output_name
        engine.extract_pages(sp, pages, str(output_path), password=password)
        _maybe_watermark_pdf(output_path, watermark_enabled)
        thumb = generate_blurred_pdf_thumbnail_from_path(output_path)
        return save_result_from_file(
            output_path,
            output_path.name,
            "application/pdf",
            user_id=user_id,
            thumbnail_png=thumb,
            tool="split",
        )

    output_folder = workdir / "separate-pages"
    output_folder.mkdir(parents=True, exist_ok=True)
    generated_paths = engine.extract_pages_separate(sp, pages, str(output_folder), password=password)
    renamed_paths = []
    for page_number, raw_path in zip(pages, generated_paths):
        current_path = P(str(raw_path))
        renamed = current_path.with_name(format_split_page_filename(file_base_name, page_number))
        current_path.replace(renamed)
        renamed_paths.append(renamed)
    zip_name = format_split_zip_filename(file_base_name, pages)
    zip_path = create_zip_archive(workdir / zip_name, renamed_paths)
    try:
        thumb = generate_blurred_pdf_thumbnail_from_path(P(str(sp)))
    except OSError:
        thumb = None
    return save_result_from_file(
        zip_path,
        zip_path.name,
        "application/zip",
        user_id=user_id,
        thumbnail_png=thumb,
        tool="split",
    )


@router.post("/encrypt")
async def encrypt_pdf(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    user_password: str = Form(...),
    input_password: str = Form(default=""),
):
    user_password = user_password.strip()
    if not user_password:
        raise HTTPException(status_code=400, detail="Cikti PDF icin parola girmek zorunludur.")

    decision = await entitlement_check(token, "encrypt")
    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir, max_bytes=max_bytes_from_decision(decision))
        validate_pdf_before_processing(saved_file, filename=getattr(file, "filename", None) or "<?>", client_ip="<from-route>")
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "Şifreli", "pdf")
        output_path = workdir / output_name
        await run_sandboxed(
            engine.encrypt_pdf,
            sp,
            str(output_path),
            user_password=user_password,
            input_password=input_password.strip() or None,
        )
        user_id = await saas_current_user_id(token)

        def _store():
            outp = Path(str(output_path))
            _maybe_watermark_pdf(outp, bool(decision.get("watermarkEnabled", False)))
            thumb_png = None
            try:
                thumb_png = generate_blurred_pdf_thumbnail_from_path(outp)
            except OSError:
                thumb_png = None
            return save_result_from_file(
                outp,
                outp.name,
                "application/pdf",
                user_id=user_id,
                thumbnail_png=thumb_png,
                tool="encrypt",
            )

        handle = await run_sandboxed(_store)

        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": handle.has_thumbnail,
            "saasGating": _saas_gating_from_check(decision),
        }
    except Exception as error:
        cleanup_and_raise(workdir, error)
    finally:
        if workdir.exists():
            cleanup_path(workdir)


# ---------------------------------------------------------------------------
# Result store: preview (FREE) and download (access-gated).
# ---------------------------------------------------------------------------


@router.get("/pdf/result/{result_id}/preview")
@limiter.exempt
async def preview_result(
    result_id: str,
    token: Annotated[str, Depends(extract_bearer_header_only)],
):
    """Preview metadata for a processed result. FREE — does NOT call
    ``saas_check_access``. Ownership is still enforced so one user cannot
    enumerate another user's results.
    """
    user_id = await saas_current_user_id(token)
    read = get_result(result_id, user_id)
    meta = read_meta_only(result_id)
    created = float(meta.get("created_at") or 0.0)
    created_iso: str | None = None
    if created > 0:
        created_iso = datetime.fromtimestamp(created, tz=timezone.utc).isoformat()
    thumbnail_url = (
        f"/api/pdf/result/{result_id}/preview/thumbnail" if read.thumbnail_path else None
    )
    return {
        "result_id": result_id,
        "filename": read.filename,
        "mime": read.mime,
        "size_bytes": read.size_bytes,
        "has_thumbnail": read.thumbnail_path is not None,
        "thumbnail_url": thumbnail_url,
        "created_at": created,
        "created_at_iso": created_iso,
    }


@router.get("/pdf/result/{result_id}/preview/thumbnail")
@limiter.exempt
async def preview_result_thumbnail(
    result_id: str,
    token: Annotated[str, Depends(extract_bearer_header_only)],
):
    """Serve the blurred preview PNG. FREE — no ``saas_check_access``."""
    user_id = await saas_current_user_id(token)
    read = get_result(result_id, user_id)
    if read.thumbnail_path is None:
        raise HTTPException(status_code=404, detail="Thumbnail not available.")
    return FileResponse(path=str(read.thumbnail_path), media_type="image/png")


@router.get("/pdf/result/{result_id}/preview/hero")
@limiter.exempt
async def preview_result_hero(
    result_id: str,
    token: Annotated[str, Depends(extract_bearer_header_only)],
):
    """Large watermarked first-page preview for gated-download modal (FREE, owner-only)."""
    user_id = await saas_current_user_id(token)
    read = get_result(result_id, user_id)
    png = await generate_hero_watermarked_preview_png_queued_from_path(read.payload_path)
    if not png:
        raise HTTPException(status_code=404, detail="Preview could not be generated.")
    return Response(content=png, media_type="image/png")


@router.get("/pdf/result/{result_id}/preview/pdf")
@limiter.exempt
async def preview_result_pdf(
    result_id: str,
    token: Annotated[str, Depends(extract_bearer_header_only)],
):
    """Sahibine özel tam PDF önizlemesi (inline). Kota düşmez; sonucu silmez."""
    await saas_session_ok(token)
    user_id = await saas_current_user_id(token)
    meta = read_meta_only(result_id)
    if str(meta.get("user_id")) != str(user_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    mime_meta = str(meta.get("mime") or "").lower().strip()
    read = get_result(result_id, user_id)
    if not _result_payload_looks_like_pdf(mime_meta, read.filename, read.payload_path):
        raise HTTPException(status_code=404, detail="Bu çıktı için PDF önizlemesi yok.")
    disp = {"Content-Disposition": f'inline; filename="{read.filename}"'}
    return FileResponse(
        path=str(read.payload_path),
        filename=read.filename,
        media_type=read.mime or "application/pdf",
        headers=disp,
    )


@router.get("/pdf/result/{result_id}/download")
async def download_result(
    result_id: str,
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
):
    """``entitlement_consume`` ile kota düşümü; ardından dosya akışı. Sonuç silinir."""

    user_id = await saas_current_user_id(token)
    meta = read_meta_only(result_id)
    if meta.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    tool = str(meta.get("tool") or "compress")
    cons = await entitlement_consume(token, tool)
    if cons.get("status") != "ok":
        return JSONResponse(
            status_code=402,
            content={"error": "payment_required", "saasGating": _saas_gating_from_consume(cons)},
        )

    read = get_result(result_id, user_id)
    background_tasks.add_task(delete_result, result_id)

    # S3 backend: download from S3 and stream to browser (avoids CORS issues).
    # Local backend: return local file path.
    if read.presigned_url:
        from io import BytesIO
        from fastapi.responses import StreamingResponse
        from app.core.result_store import _s3_get, _PAYLOAD_FILENAME

        try:
            payload = _s3_get(f"{result_id}/{_PAYLOAD_FILENAME}")
            return StreamingResponse(
                BytesIO(payload),
                media_type=read.mime,
                headers={
                    "Content-Disposition": f'attachment; filename="{read.filename}"',
                    **(build_pdf_download_headers(saas_gating=_saas_gating_from_consume(cons)) or {}),
                },
            )
        except Exception as e:
            logger.error("download_result S3 fetch failed result_id=%s: %s", result_id, e)
            raise HTTPException(status_code=500, detail="Download failed.")

    return FileResponse(
        path=str(read.payload_path),
        filename=read.filename,
        media_type=read.mime,
        headers=build_pdf_download_headers(saas_gating=_saas_gating_from_consume(cons)) or None,
    )

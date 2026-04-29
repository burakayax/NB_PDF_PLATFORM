"""Tarayıcıdan gelen istekleri PDF motoruna bağlayan web API rotaları.

Gating kararları Node SaaS API'deki entitlement engine üzerinden yapılır:
``POST /api/entitlement/check`` pre-check, ``POST /api/entitlement/consume``
atomic decrement + journal. Legacy daily-limit helpers (assert-feature /
record-usage) kaldırılmıştır.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated, Any

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
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
)
from app.core.jobs import (
    cleanup_job,
    create_merge_job,
    get_job_download,
    get_job_status,
    request_cancel_merge_job,
)
from app.core.thread_pool import run_cpu_bound
from app.core.preview_gate import generate_hero_watermarked_preview_png_queued
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
)
from app.limiter import limiter

logger = logging.getLogger(__name__)

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


# ---------------------------------------------------------------------------
# Health / capabilities
# ---------------------------------------------------------------------------


@router.get("/health")
@limiter.exempt
def health():
    return {"status": "ok", "service": "nb-pdf-TOOLS-web"}


@router.get("/capabilities")
def capabilities():
    return operation_capabilities()


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

    # Merge: pre-check is advisory (preview / job start is always allowed);
    # credits are charged on GET /jobs/{id}/download when the file is taken.
    decision = await entitlement_check(token, "merge")

    workdir = create_workdir()
    try:
        saved_paths: list[Path] = []
        for idx, upload in enumerate(files):
            orig_name = Path(upload.filename or "upload.pdf").name
            unique_name = f"{idx:04d}__{orig_name}"
            saved = await save_upload(upload, workdir, filename=unique_name)
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
def job_status(job_id: str, _token: Annotated[str, Depends(extract_bearer_header_only)]):
    return get_job_status(job_id)


@router.post("/jobs/{job_id}/cancel")
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
async def download_job_output(
    job_id: str,
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
):
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


@router.post("/inspect-pdf")
async def inspect_pdf(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(default=""),
):
    # Inspection is a free read-only call — no entitlement charge.
    await saas_session_ok(token)

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir)
        p = str(saved_file)
        requires_pw, encrypt_diag = await run_cpu_bound(
            engine.classify_pdf_password_requirement,
            p,
        )
        encrypted = requires_pw
        pwd = password.strip() or None
        page_count = None
        inspect_error = None
        if encrypted and not pwd:
            pass
        else:
            try:
                page_count = await run_cpu_bound(engine.get_num_pages, p, password=pwd)
            except Exception as exc:
                page_count = None
                inspect_error = str(exc)
        return {
            "filename": file.filename,
            "encrypted": encrypted,
            "page_count": page_count,
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
    decision = await entitlement_check(token, "split")

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir)
        pwd = password.strip() or None
        sp = str(saved_file)
        if (await run_cpu_bound(engine.is_pdf_encrypted, sp)) and not pwd:
            raise HTTPException(status_code=400, detail="Şifreli PDF için kaynak parolası gerekli.")
        max_pages = await run_cpu_bound(engine.get_num_pages, sp, password=pwd)
        pages = parse_pages_text(pages_text, max_page=max_pages)
        user_id = await saas_current_user_id(token)
        file_base = file.filename or saved_file.name
        m = (mode or "single").strip().lower()
        if m not in ("single", "separate"):
            m = "single"

        def _do_split() -> Any:
            return _split_to_result_store(workdir, sp, pages, file_base, m, pwd, user_id)

        handle = await run_cpu_bound(_do_split)

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
        saved_file = await save_upload(file, workdir)
        pwd = password.strip() or None
        sp = str(saved_file)
        if (await run_cpu_bound(engine.is_pdf_encrypted, sp)) and not pwd:
            raise HTTPException(status_code=400, detail="Şifreli PDF için kaynak parolası gerekli.")

        output_name = format_derived_filename(file.filename or saved_file.name, "Word", "docx")
        output_path = workdir / output_name
        await run_cpu_bound(engine.pdf_to_word, sp, str(output_path), password=pwd)
        user_id = await saas_current_user_id(token)

        def _store():
            outp = Path(str(output_path))
            return save_result_from_file(
                outp,
                outp.name,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                user_id=user_id,
                thumbnail_png=None,
                tool="pdf-to-word",
            )

        handle = await run_cpu_bound(_store)

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
        saved_file = await save_upload(file, workdir)
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "PDF", "pdf")
        output_path = workdir / output_name
        await run_cpu_bound(engine.word_to_pdf, sp, str(output_path))
        user_id = await saas_current_user_id(token)

        def _store():
            outp = Path(str(output_path))
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

        handle = await run_cpu_bound(_store)

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
        saved_file = await save_upload(file, workdir)
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "PDF", "pdf")
        output_path = workdir / output_name
        await run_cpu_bound(engine.excel_to_pdf, sp, str(output_path))
        user_id = await saas_current_user_id(token)

        def _store():
            outp = Path(str(output_path))
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

        handle = await run_cpu_bound(_store)

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
        saved_file = await save_upload(file, workdir)
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "Excel", "xlsx")
        output_path = workdir / output_name
        await run_cpu_bound(
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

        handle = await run_cpu_bound(_store)

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
):
    """Result-store: build preview; credits are charged on
    ``GET /api/pdf/result/{id}/download`` (not on this POST)."""
    decision = await entitlement_check(token, "compress")

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir)
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "Sıkıştırılmış", "pdf")
        output_path = workdir / output_name
        out_str = str(output_path)
        pwd = password.strip() or None
        user_id = await saas_current_user_id(token)

        def _compress_and_store() -> Any:
            engine.compress_pdf(sp, out_str, password=pwd)
            outp = Path(out_str)
            thumb = generate_blurred_pdf_thumbnail_from_path(outp)
            return save_result_from_file(
                outp,
                outp.name,
                "application/pdf",
                user_id=user_id,
                thumbnail_png=thumb,
                tool="compress",
            )

        handle = await run_cpu_bound(_compress_and_store)

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


def _split_to_result_store(
    workdir: Path,
    sp: str,
    pages: list[int],
    file_base_name: str,
    mode: str,
    password: str | None,
    user_id: str,
) -> Any:
    """CPU-bound: build split output bytes + blurred preview; returns ResultHandle."""
    from pathlib import Path as P

    if mode == "single":
        output_name = format_split_single_filename(file_base_name, pages)
        output_path = workdir / output_name
        engine.extract_pages(sp, pages, str(output_path), password=password)
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
        saved_file = await save_upload(file, workdir)
        sp = str(saved_file)
        output_name = format_derived_filename(file.filename or saved_file.name, "Şifreli", "pdf")
        output_path = workdir / output_name
        await run_cpu_bound(
            engine.encrypt_pdf,
            sp,
            str(output_path),
            user_password=user_password,
            input_password=input_password.strip() or None,
        )
        user_id = await saas_current_user_id(token)

        def _store():
            outp = Path(str(output_path))
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

        handle = await run_cpu_bound(_store)

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
    try:
        pdf_bytes = await run_cpu_bound(read.payload_path.read_bytes)
    except OSError:
        raise HTTPException(status_code=404, detail="Preview not available.") from None
    png = await generate_hero_watermarked_preview_png_queued(pdf_bytes)
    if not png:
        raise HTTPException(status_code=404, detail="Preview could not be generated.")
    return Response(content=png, media_type="image/png")


@router.get("/pdf/result/{result_id}/download")
async def download_result(
    result_id: str,
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
):
    """Stream the file after a successful ``entitlement_consume(tool)`` where
    ``tool`` is stored in result meta (e.g. ``compress``, ``split``). 402 on
    insufficient_credits. Deletes the result after 200 (best-effort)."""
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
    return FileResponse(
        path=str(read.payload_path),
        filename=read.filename,
        media_type=read.mime,
        headers=build_pdf_download_headers(saas_gating=_saas_gating_from_consume(cons)) or None,
    )

"""Tarayıcıdan gelen istekleri PDF motoruna bağlayan web API rotaları.

Gating kararları Node SaaS API'deki entitlement engine üzerinden yapılır:
``POST /api/entitlement/check`` pre-check, ``POST /api/entitlement/consume``
atomic decrement + journal. Legacy daily-limit helpers (assert-feature /
record-usage) kaldırılmıştır.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from app.api.pdf_auth import extract_bearer_header_only, extract_pdf_access_token
from app.core.operations import (
    cleanup_and_raise,
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
from app.core.jobs import cleanup_job, create_merge_job, get_job_download, get_job_status
from app.core.preview_thumbnail import generate_blurred_pdf_thumbnail
from app.core.result_store import (
    get_result,
    read_meta_only,
    save_result,
)
from app.core.saas_gate import (
    entitlement_check,
    entitlement_consume,
    saas_check_access,
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


async def _gate_or_402(token: str, tool_id: str) -> dict[str, Any]:
    """Run a pre-check; translate a denied decision into an HTTP 402.

    On ``allowed=true`` returns the decision dict unchanged so the caller can
    embed it as ``saasGating`` in the tool response.
    """
    decision = await entitlement_check(token, tool_id)
    if not decision.get("allowed"):
        raise HTTPException(
            status_code=402,
            detail={"error": "payment_required", "saasGating": decision},
        )
    return decision


async def _consume_post_run(token: str, tool_id: str) -> None:
    """Run the atomic decrement after a successful tool run.

    The tool's output is already in hand when we call this; a ``denied``
    response here (almost always ``race_lost``) cannot undo the work. We log
    the anomaly and return the file anyway — the user loses no output, and
    the ledger stays consistent with what happened.
    """
    try:
        result = await entitlement_consume(token, tool_id)
    except HTTPException:
        logger.warning("entitlement consume raised for tool=%s", tool_id, exc_info=True)
        return
    if result.get("status") == "denied":
        logger.warning(
            "entitlement consume denied post-run: tool=%s reason=%s",
            tool_id,
            result.get("reason"),
        )


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

    # Merge is a long-running job: pre-check happens here, consume is fired
    # by the worker (see app/core/jobs.py) when the job completes so a
    # failed merge never spends a credit.
    decision = await _gate_or_402(token, "merge")

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
        job_id = create_merge_job(saved_paths, passwords, workdir, output_name, saas_token=token)
        return {"job_id": job_id, "saasGating": decision}
    except Exception as error:
        cleanup_and_raise(workdir, error)


@router.get("/jobs/{job_id}")
def job_status(job_id: str, _token: Annotated[str, Depends(extract_bearer_header_only)]):
    return get_job_status(job_id)


@router.get("/jobs/{job_id}/download")
def download_job_output(
    job_id: str,
    background_tasks: BackgroundTasks,
    _token: Annotated[str, Depends(extract_bearer_header_only)],
):
    output_path, output_name, _workdir = get_job_download(job_id)
    background_tasks.add_task(cleanup_job, job_id)
    return FileResponse(
        path=str(output_path),
        filename=output_name,
        media_type="application/pdf",
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
        encrypted = engine.is_pdf_encrypted(str(saved_file))
        pwd = password.strip() or None
        page_count = None
        inspect_error = None
        if encrypted and not pwd:
            pass
        else:
            try:
                page_count = engine.get_num_pages(str(saved_file), password=pwd)
            except Exception as exc:
                page_count = None
                inspect_error = str(exc)
        return {
            "filename": file.filename,
            "encrypted": encrypted,
            "page_count": page_count,
            "inspect_error": inspect_error,
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
    decision = await _gate_or_402(token, "split")

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir)
        password = password.strip() or None
        if engine.is_pdf_encrypted(str(saved_file)) and not password:
            raise HTTPException(status_code=400, detail="Şifreli PDF için kaynak parolası gerekli.")
        max_pages = engine.get_num_pages(str(saved_file), password=password)
        pages = parse_pages_text(pages_text, max_page=max_pages)

        if mode == "single":
            output_name = format_split_single_filename(file.filename or saved_file.name, pages)
            output_path = workdir / output_name
            engine.extract_pages(str(saved_file), pages, str(output_path), password=password)
            await _consume_post_run(token, "split")
            return download_response(
                output_path,
                output_path.name,
                "application/pdf",
                background_tasks,
                workdir,
                saas_gating=decision,
            )

        output_folder = workdir / "separate-pages"
        output_folder.mkdir(parents=True, exist_ok=True)
        generated_paths = engine.extract_pages_separate(str(saved_file), pages, str(output_folder), password=password)
        renamed_paths = []
        for page_number, raw_path in zip(pages, generated_paths):
            current_path = Path(raw_path)
            renamed = current_path.with_name(format_split_page_filename(file.filename or saved_file.name, page_number))
            current_path.replace(renamed)
            renamed_paths.append(renamed)
        zip_name = format_split_zip_filename(file.filename or saved_file.name, pages)
        zip_path = create_zip_archive(workdir / zip_name, renamed_paths)
        await _consume_post_run(token, "split")
        return download_response(
            zip_path,
            zip_path.name,
            "application/zip",
            background_tasks,
            workdir,
            saas_gating=decision,
        )
    except Exception as error:
        cleanup_and_raise(workdir, error)


@router.post("/pdf-to-word")
async def pdf_to_word(
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(default=""),
):
    decision = await _gate_or_402(token, "pdf-to-word")

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir)
        pwd = password.strip() or None
        if engine.is_pdf_encrypted(str(saved_file)) and not pwd:
            raise HTTPException(status_code=400, detail="Şifreli PDF için kaynak parolası gerekli.")

        output_name = format_derived_filename(file.filename or saved_file.name, "Word", "docx")
        output_path = workdir / output_name
        engine.pdf_to_word(str(saved_file), str(output_path), password=pwd)
        await _consume_post_run(token, "pdf-to-word")
        return download_response(
            output_path,
            output_path.name,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            background_tasks,
            workdir,
            saas_gating=decision,
        )
    except Exception as error:
        cleanup_and_raise(workdir, error)


@router.post("/word-to-pdf")
async def word_to_pdf(
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
):
    decision = await _gate_or_402(token, "word-to-pdf")

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir)
        output_name = format_derived_filename(file.filename or saved_file.name, "PDF", "pdf")
        output_path = workdir / output_name
        engine.word_to_pdf(str(saved_file), str(output_path))
        await _consume_post_run(token, "word-to-pdf")
        return download_response(
            output_path,
            output_path.name,
            "application/pdf",
            background_tasks,
            workdir,
            saas_gating=decision,
        )
    except Exception as error:
        cleanup_and_raise(workdir, error)


@router.post("/excel-to-pdf")
async def excel_to_pdf(
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
):
    decision = await _gate_or_402(token, "excel-to-pdf")

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir)
        output_name = format_derived_filename(file.filename or saved_file.name, "PDF", "pdf")
        output_path = workdir / output_name
        engine.excel_to_pdf(str(saved_file), str(output_path))
        await _consume_post_run(token, "excel-to-pdf")
        return download_response(
            output_path,
            output_path.name,
            "application/pdf",
            background_tasks,
            workdir,
            saas_gating=decision,
        )
    except Exception as error:
        cleanup_and_raise(workdir, error)


@router.post("/pdf-to-excel")
async def pdf_to_excel(
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(default=""),
):
    decision = await _gate_or_402(token, "pdf-to-excel")

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir)
        output_name = format_derived_filename(file.filename or saved_file.name, "Excel", "xlsx")
        output_path = workdir / output_name
        engine.pdf_text_to_excel(
            str(saved_file),
            str(output_path),
            preserve_tables=True,
            password=password.strip() or None,
        )
        await _consume_post_run(token, "pdf-to-excel")
        return download_response(
            output_path,
            output_path.name,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            background_tasks,
            workdir,
            saas_gating=decision,
        )
    except Exception as error:
        cleanup_and_raise(workdir, error)


@router.post("/compress")
async def compress_pdf(
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    password: str = Form(default=""),
):
    """Pilot result-store flow: persist the compressed PDF to the result
    store and return a handle. The client renders a preview and then hits
    the gated download endpoint (``/api/pdf/result/{id}/download``).
    """
    decision = await _gate_or_402(token, "compress")

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir)
        output_name = format_derived_filename(file.filename or saved_file.name, "Sıkıştırılmış", "pdf")
        output_path = workdir / output_name
        engine.compress_pdf(str(saved_file), str(output_path), password=password.strip() or None)
        await _consume_post_run(token, "compress")

        payload_bytes = output_path.read_bytes()
        thumbnail_png = generate_blurred_pdf_thumbnail(payload_bytes)

        user_id = await saas_current_user_id(token)
        handle = save_result(
            payload_bytes,
            output_path.name,
            "application/pdf",
            user_id=user_id,
            thumbnail_png=thumbnail_png,
        )

        return {
            "result_id": handle.result_id,
            "filename": handle.filename,
            "mime": handle.mime,
            "size_bytes": handle.size_bytes,
            "has_thumbnail": handle.has_thumbnail,
            "saasGating": decision,
        }
    except Exception as error:
        cleanup_and_raise(workdir, error)
    finally:
        # Payload now lives in the result store; the working copy is redundant.
        if workdir.exists():
            from app.core.operations import cleanup_path

            cleanup_path(workdir)


@router.post("/encrypt")
async def encrypt_pdf(
    background_tasks: BackgroundTasks,
    token: Annotated[str, Depends(extract_pdf_access_token)],
    file: UploadFile = File(...),
    user_password: str = Form(...),
    input_password: str = Form(default=""),
):
    user_password = user_password.strip()
    if not user_password:
        raise HTTPException(status_code=400, detail="Cikti PDF icin parola girmek zorunludur.")

    decision = await _gate_or_402(token, "encrypt")

    workdir = create_workdir()
    try:
        saved_file = await save_upload(file, workdir)
        output_name = format_derived_filename(file.filename or saved_file.name, "Şifreli", "pdf")
        output_path = workdir / output_name
        engine.encrypt_pdf(
            str(saved_file),
            str(output_path),
            user_password=user_password,
            input_password=input_password.strip() or None,
        )
        await _consume_post_run(token, "encrypt")
        return download_response(
            output_path,
            output_path.name,
            "application/pdf",
            background_tasks,
            workdir,
            saas_gating=decision,
        )
    except Exception as error:
        cleanup_and_raise(workdir, error)


# ---------------------------------------------------------------------------
# Result store: preview (FREE) and download (access-gated).
# ---------------------------------------------------------------------------


@router.get("/pdf/result/{result_id}/preview")
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
    }


@router.get("/pdf/result/{result_id}/preview/thumbnail")
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


@router.get("/pdf/result/{result_id}/download")
async def download_result(
    result_id: str,
    token: Annotated[str, Depends(extract_bearer_header_only)],
):
    """Download a processed result. Ownership enforced; access re-gated via
    Node ``/api/access/check`` (legacy download gate — not the same surface
    as the entitlement engine used by the tool endpoints)."""
    user_id = await saas_current_user_id(token)

    meta = read_meta_only(result_id)
    if meta.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        await saas_check_access(token)
    except HTTPException as exc:
        if exc.status_code == 402:
            return JSONResponse(status_code=402, content={"error": "payment_required"})
        raise

    read = get_result(result_id, user_id)
    return FileResponse(
        path=str(read.payload_path),
        filename=read.filename,
        media_type=read.mime,
    )

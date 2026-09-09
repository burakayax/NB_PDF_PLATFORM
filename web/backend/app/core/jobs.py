"""Uzun süren web işlemleri için bellek içi job kaydı ve ilerleme durumu."""

from __future__ import annotations

import threading
import time
import uuid
from pathlib import Path

from fastapi import HTTPException

from app.core.operations import cleanup_path, get_engine

engine = get_engine()
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _now() -> float:
    return time.time()


def _serialize(job: dict) -> dict:
    elapsed = int((job.get("finished_at") or _now()) - job["started_at"])
    total = max(1, int(job.get("total") or 1))
    current = max(0, int(job.get("current") or 0))
    percent = int(min(100, max(0, round((current / total) * 100)))) if total else 0
    return {
        "id": job["id"],
        "status": job["status"],
        "message": job.get("message", ""),
        "where": job.get("where", ""),
        "current": current,
        "total": total,
        "percent": percent,
        "elapsed_seconds": elapsed,
        "error": job.get("error"),
        "ready": job["status"] == "completed",
    }


def create_merge_job(
    saved_paths: list[Path],
    passwords: dict[str, str],
    workdir: Path,
    output_name: str,
    watermark_enabled: bool = False,
    owner_id: str | None = None,
) -> str:
    """PDF birlestirmeyi arka planda calistirip ilerleme bilgisini hafizada tutar.

    ``watermark_enabled`` → FREE/Starter planda çıktıya görünür marka damgası
    eklenir; marka metadata'sı her planda gömülür (bkz. ``branding``).
    """
    job_id = uuid.uuid4().hex
    output_path = workdir / output_name
    job = {
        "id": job_id,
        # İşi başlatan kullanıcı. Durum/iptal/önizleme/indirme uçları bu kimliği
        # doğrular; aksi halde işin kimliğini ele geçiren başka bir oturum
        # sahibinin çıktısını indirebilir ve KENDİ hakkını harcatabilirdi.
        "owner_id": owner_id,
        "status": "queued",
        "message": "Sıraya alındı.",
        "where": "",
        "current": 0,
        "total": 1,
        "error": None,
        "started_at": _now(),
        "finished_at": None,
        "workdir": workdir,
        "output_path": output_path,
        "output_name": output_name,
        "cancelled": False,
    }
    with _lock:
        _jobs[job_id] = job

    def worker():
        workdir_path = workdir
        try:
            with _lock:
                if job.get("cancelled"):
                    job["status"] = "cancelled"
                    job["message"] = "İptal edildi."
                    job["finished_at"] = _now()
                else:
                    job["status"] = "running"
                    job["message"] = "PDF dosyaları birleştiriliyor..."

            with _lock:
                if job["status"] == "cancelled":
                    cleanup_path(workdir_path)
                    return

            def progress_cb(current: int, total: int, where_text: str):
                with _lock:
                    if job.get("cancelled"):
                        return False
                    job["current"] = current
                    job["total"] = total
                    job["where"] = where_text
                    job["message"] = "İşlem sürüyor..."
                return True

            engine.merge_pdfs([str(p) for p in saved_paths], str(output_path), progress_callback=progress_cb, passwords=passwords)
            # Markalama (non-fatal): iptal edilmediyse görünür filigran (sadece
            # ücretsiz/Starter) + görünmez metadata (her plan) çıktıya işlenir.
            with _lock:
                cancelled_now = bool(job.get("cancelled"))
            if not cancelled_now:
                from app.core.branding import brand_pdf_output
                brand_pdf_output(output_path, watermark_enabled=watermark_enabled)
            with _lock:
                if job.get("cancelled"):
                    job["status"] = "cancelled"
                    job["message"] = "İptal edildi."
                else:
                    job["status"] = "completed"
                    job["message"] = "Birleştirme tamamlandı."
                job["current"] = job["total"]
                job["finished_at"] = _now()
        except Exception as exc:
            err_t = str(exc)
            is_cancel = "iptal" in err_t.lower() or "cancel" in err_t.lower() or "İşlem iptal" in err_t
            with _lock:
                if is_cancel or job.get("cancelled"):
                    job["status"] = "cancelled"
                    job["message"] = "İptal edildi."
                    job["error"] = None
                else:
                    job["status"] = "failed"
                    job["error"] = err_t
                    job["message"] = "Birleştirme başarısız oldu."
                job["finished_at"] = _now()
        finally:
            with _lock:
                st = job.get("status")
            if st == "cancelled":
                cleanup_path(workdir_path)

    threading.Thread(target=worker, daemon=True).start()
    return job_id


def _assert_owner(job: dict, owner_id: str | None) -> None:
    """İş başkasına aitse 404 (varlığını sızdırmamak için 403 değil)."""
    if owner_id is None:
        return
    job_owner = job.get("owner_id")
    if job_owner is not None and job_owner != owner_id:
        raise HTTPException(status_code=404, detail="İşlem bulunamadı.")


def get_job(job_id: str, owner_id: str | None = None) -> dict:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="İşlem bulunamadı.")
        _assert_owner(job, owner_id)
        return job


def get_job_status(job_id: str, owner_id: str | None = None) -> dict:
    return _serialize(get_job(job_id, owner_id))


def request_cancel_merge_job(job_id: str, owner_id: str | None = None) -> bool:
    """Request cooperative cancellation. Returns False if job is missing or already terminal."""
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return False
        _assert_owner(job, owner_id)
        if job["status"] in ("completed", "failed", "cancelled"):
            return False
        job["cancelled"] = True
        return True


def get_job_download(job_id: str, owner_id: str | None = None) -> tuple[Path, str, Path]:
    job = get_job(job_id, owner_id)
    if job["status"] == "cancelled":
        raise HTTPException(status_code=409, detail="Birleştirme işlemi iptal edildi.")
    if job["status"] != "completed":
        raise HTTPException(status_code=409, detail="İndirme için işlem henüz tamamlanmadı.")
    output_path = Path(job["output_path"])
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Çıktı dosyası bulunamadı.")
    return output_path, job["output_name"], Path(job["workdir"])


def cleanup_job(job_id: str) -> None:
    with _lock:
        job = _jobs.pop(job_id, None)
    if not job:
        return
    cleanup_path(job["workdir"])

"""Üye OLMAYAN ziyaretçi için PDF Sıkıştır: günde 1 işlem hakkı.

ÜRÜN KARARI (Ekim 2026): misafir 1 hak, üye (ücretsiz plan) 3 hak, paket satın alanlar planlarının
dahilinde. Amaç dönüşüm: ziyaretçi kayıt olmadan değeri bir kez görsün, sonra üyeliğe geçsin.

NEDEN AYRI ROTA: Üyelerin akışı (``/api/compress/start``) oturum jetonu ister ve hakkı İNDİRME
onayında düşer. Misafirin oturumu yok; ayrıca sıkıştırma SUNUCUDA çalıştığı için maliyet işlem
anında doğar — hak bu yüzden BAŞLANGIÇTA düşer ve işlem hata verirse İADE edilir.

KİMLİK: IP özeti (düz IP saklanmaz). Sonuç, hazırlayana özel rastgele jetonla (``dl``) saklanır;
yalnızca o jetonu bilen indirebilir. PDF Düzenle'nin misafir akışıyla aynı model.

KORUMALAR: dosya boyutu sınırı, PDF doğrulama (pdf_security), dakikalık istek sınırı ve — IP
döndürmeye karşı — TOPLAM günlük üst sınır (``GUEST_COMPRESS_GLOBAL_DAILY_LIMIT``).
"""

from __future__ import annotations

import logging
import os
import secrets
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

from app.core import guest_daily_limit as gdl
from app.core.jobs import create_conversion_job, get_job_status
from app.core.operations import (
    cleanup_and_raise,
    content_disposition,
    create_workdir,
    format_derived_filename,
    get_engine,
    save_upload,
)
from app.core.pdf_security import validate_pdf_before_processing
from app.core.result_store import delete_result, get_result, read_meta_only, save_result_from_file
from app.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/guest-compress", tags=["guest-compress"])
engine = get_engine()



def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


async def _config() -> gdl.GuestConfig:
    """Panelden ayarlanan değerler (30 sn önbellekli; köprü yoksa ortam değişkeni/varsayılan).

    Ağ çağrısı içerdiğinden iş parçacığında çalıştırılır (olay döngüsünü bloklamaz)."""
    return await run_in_threadpool(gdl.get_config)


def _client_ip(request: Request) -> str:
    """Ziyaretçinin IP'si — İSTEMCİNİN TAKLİT EDEMEYECEĞİ biçimde.

    ``X-Forwarded-For``'un ilk değeri istemci tarafından yazılabilir (her istekte başka bir değer
    göndererek günlük hak aşılabilir). Güvenilir olan, SAĞDAN sayılan girdidir: her güvenilir ara
    sunucu bağlandığı IP'yi listenin sonuna ekler. ``GUEST_TRUSTED_PROXY_HOPS`` (varsayılan 1) kaç
    güvenilir ara sunucu olduğunu söyler: yalnız Render önünde 1, Cloudflare + Render ise 2.

    ``CF-Connecting-IP`` yalnızca ``GUEST_TRUST_CF_HEADER=1`` ise kullanılır: PDF servisine doğrudan
    (onrender.com adresiyle) erişilebiliyorsa o başlığı da istemci yazabilir.
    """
    if os.getenv("GUEST_TRUST_CF_HEADER", "").strip().lower() in ("1", "true", "yes"):
        cf = request.headers.get("cf-connecting-ip")
        if cf:
            return cf.strip()
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        parts = [p.strip() for p in fwd.split(",") if p.strip()]
        if parts:
            hops = max(1, _int_env("GUEST_TRUSTED_PROXY_HOPS", 1))
            return parts[max(0, len(parts) - hops)]
    return request.client.host if request.client else "<bilinmiyor>"


async def _allowance(key: str, cfg: gdl.GuestConfig) -> dict:
    """Ziyaretçinin bugünkü kalan hakkı. Kapı kapalıysa kalan her zaman 0."""
    limit = 0 if cfg.closed else cfg.daily_limit
    used = await run_in_threadpool(gdl.peek_person, key, cfg)
    return {
        "used": used,
        "limit": limit,
        "remaining": max(0, limit - used),
        "resetAt": gdl.reset_at_iso(),
        "maxMB": cfg.max_mb,
    }


def _parse_target(target_kb: int, allow_rasterize: str) -> tuple[int, bool]:
    """Hedef boyut (KB). 0 = hedef yok. Motorun sınırlarıyla aynı: 20 KB … 200 MB."""
    if not target_kb:
        return 0, False
    if target_kb < 20 or target_kb > 200 * 1024:
        raise HTTPException(status_code=400, detail="Hedef boyut 20 KB ile 200 MB arasında olmalıdır.")
    return int(target_kb) * 1024, (allow_rasterize or "").strip().lower() in ("1", "true", "on", "yes")


@router.get("/allowance")
@limiter.limit("60/minute")
async def guest_allowance(request: Request):
    """Bu ziyaretçinin bugünkü kalan hakkı (düşürmeden)."""
    cfg = await _config()
    return await _allowance(gdl.guest_key(_client_ip(request)), cfg)


@router.post("/start")
@limiter.limit("8/minute")
async def guest_compress_start(
    request: Request,
    file: UploadFile = File(...),
    quality: str = Form(default="auto"),
    target_kb: int = Form(default=0),
    allow_rasterize: str = Form(default=""),
):
    """Misafir sıkıştırmasını ARKA PLANDA başlatır; hakkı BU AN düşer, hata olursa iade eder."""
    target_bytes, want_raster = _parse_target(target_kb, allow_rasterize)
    q = quality if quality in ("auto", "low", "medium", "high") else "auto"

    ip = _client_ip(request)
    key = gdl.guest_key(ip)
    cfg = await _config()

    # KAPALI KAPI (panelde "Misafir kullanımı" anahtarı kapalı ya da bir sınır 0): kimseye hak verilmez.
    # Sayaçtaki "0 = sınırsız" anlamı burada GEÇERLİ DEĞİL; sınırsız misafir erişimi hiçbir ayarla açılamaz.
    if cfg.closed:
        if cfg.enabled and cfg.daily_limit > 0 and cfg.global_limit <= 0:
            # Yalnız toplam kapasite 0: ziyaretçiye "kapasite" mesajı (kişisel hakkı yanmış değil).
            return JSONResponse(
                status_code=429,
                content={
                    "error": "capacity",
                    "detail": "Misafir kullanımı şu an kapalı. Üye olarak devam edebilirsin.",
                    "resetAt": gdl.reset_at_iso(),
                },
            )
        return JSONResponse(
            status_code=429,
            content={
                "error": "daily_limit",
                **(await _allowance(key, cfg)),
                "guest": True,
                "detail": "Misafir kullanımı şu an kapalı. Üye olarak devam edebilirsin.",
            },
        )

    ok, _used, _limit = await run_in_threadpool(gdl.consume_person, key, cfg)
    if not ok:
        return JSONResponse(
            status_code=429,
            content={"error": "daily_limit", **(await _allowance(key, cfg)), "guest": True},
        )
    g_ok, _, _ = await run_in_threadpool(gdl.consume_global, cfg)
    if not g_ok:
        await run_in_threadpool(gdl.refund_person, key)
        return JSONResponse(
            status_code=429,
            content={
                "error": "capacity",
                "detail": "Bugünkü misafir kapasitesi doldu. Üye olarak devam edebilir ya da yarın tekrar deneyebilirsin.",
                "resetAt": gdl.reset_at_iso(),
            },
        )

    def _give_back() -> None:
        # Başarısız işlemde hak iadesi (iş parçacığında çalışabilir; köprü çağrıları eşzamanlıdır).
        gdl.refund_person(key)
        gdl.refund_global()

    job_started = False
    workdir = create_workdir()
    try:
        saved = await save_upload(file, workdir, max_bytes=cfg.max_mb * 1024 * 1024)
        validate_pdf_before_processing(
            saved, filename=getattr(file, "filename", None) or "<?>", client_ip=ip
        )
        sp = str(saved)
        out_name = format_derived_filename(file.filename or saved.name, "Sıkıştırılmış", "pdf")
        out_path = workdir / out_name
        dl = secrets.token_urlsafe(18)
        owner = f"gc:{dl}"

        def _run(progress_cb):
            try:
                if target_bytes:
                    info = engine.compress_pdf_to_target(
                        sp,
                        str(out_path),
                        target_bytes,
                        password=None,
                        allow_rasterize=want_raster,
                        progress_callback=progress_cb,
                    )
                    if info.get("rasterized"):
                        marked = workdir / format_derived_filename(
                            file.filename or saved.name, "Sıkıştırılmış-görüntü", "pdf"
                        )
                        out_path.replace(marked)
                        return marked
                    return out_path
                engine.compress_pdf(sp, str(out_path), progress_callback=progress_cb, password=None, quality=q)
                return out_path
            except Exception:
                _give_back()
                raise

        def _store(outp: Path):
            try:
                return save_result_from_file(
                    outp,
                    outp.name,
                    "application/pdf",
                    user_id=owner,
                    thumbnail_png=None,
                    tool="compress",
                )
            except Exception:
                _give_back()
                raise

        job_id = create_conversion_job(
            run=_run,
            store_result=_store,
            workdir=workdir,
            owner_id=owner,
            saas_gating=None,
            running_message="PDF sıkıştırılıyor...",
            done_message="Sıkıştırılmış PDF hazır.",
            fail_message="Sıkıştırma başarısız oldu.",
        )
        job_started = True
        return {"job_id": job_id, "dl": dl, "allowance": await _allowance(key, cfg)}
    except Exception as error:
        # İş başladıysa hakkı işin kendi hata yolu iade eder (çift iadeyi önlemek için burada değil).
        if not job_started:
            await run_in_threadpool(_give_back)
        cleanup_and_raise(workdir, error)


@router.get("/jobs/{job_id}")
@limiter.exempt
async def guest_job_status(job_id: str, dl: Annotated[str, Query()] = ""):
    """İşin durumu. Yalnızca başlatan (``dl`` jetonunu bilen) görebilir."""
    if not dl:
        raise HTTPException(status_code=400, detail="Geçersiz jeton.")
    return get_job_status(job_id, f"gc:{dl}")


@router.get("/result/{result_id}/download")
@limiter.limit("30/minute")
async def guest_compress_download(
    request: Request,
    result_id: str,
    background_tasks: BackgroundTasks,
    dl: Annotated[str, Query()] = "",
):
    """Sonucu indirir ve siler. Hak başlangıçta düşüldüğü için burada ayrıca saymaz."""
    if not dl:
        raise HTTPException(status_code=400, detail="Geçersiz jeton.")
    meta = read_meta_only(result_id)
    if meta.get("user_id") != f"gc:{dl}":
        raise HTTPException(status_code=403, detail="Forbidden")
    read = get_result(result_id, f"gc:{dl}")
    background_tasks.add_task(delete_result, result_id)

    if read.presigned_url:
        from fastapi.responses import StreamingResponse

        from app.core.result_store import _PAYLOAD_FILENAME, _get_s3, _s3_bucket

        try:
            s3 = _get_s3()
            resp = s3.get_object(Bucket=_s3_bucket(), Key=f"{result_id}/{_PAYLOAD_FILENAME}")
            return StreamingResponse(
                resp["Body"].iter_chunks(8192),
                media_type=read.mime,
                headers={"Content-Disposition": content_disposition(read.filename)},
            )
        except Exception as exc:  # pragma: no cover — depolama hatası
            logger.error("guest_compress_download S3 failed result_id=%s: %s", result_id, exc)
            raise HTTPException(status_code=500, detail="İndirme başarısız.")

    return FileResponse(
        path=str(read.payload_path),
        media_type=read.mime,
        headers={"Content-Disposition": content_disposition(read.filename)},
    )

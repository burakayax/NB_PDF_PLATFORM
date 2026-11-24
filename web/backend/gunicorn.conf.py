# Gunicorn yapılandırması — yalnızca Linux üretim ortamı için.
# Windows'ta gunicorn çalışmaz; geliştirme için run-pdf-api.mjs (uvicorn) kullanın.
#
# Başlatma: gunicorn -c gunicorn.conf.py app.main:app
# (web/backend dizininden çalıştırın, venv aktif olmalı)

import multiprocessing
import os

_host = os.environ.get("PDF_API_HOST", "0.0.0.0")
_port = os.environ.get("PDF_API_PORT", "8000")
bind = f"{_host}:{_port}"

# Worker sayısı: WEB_CONCURRENCY env'i ile sınırlanabilir. Paylaşımlı/küçük
# planlarda cpu_count() ana makinenin çekirdeklerini görür (ör. 8+) ve
# cpu_count()*2+1 worker düşük RAM'de OOM yapar. Bu yüzden env önceliklidir.
_default_workers = multiprocessing.cpu_count() * 2 + 1
workers = int(os.environ.get("WEB_CONCURRENCY") or _default_workers)
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "660"))
keepalive = 5

# LOGLAR: Render yalnız konsola (stdout/stderr) yazılanı gösterir. Önceden hata ve erişim günlükleri /tmp altındaki
# DOSYALARA yazılıyor ve capture_output uygulamanın tüm konsol çıktısını da o dosyaya yönlendiriyordu; bu yüzden Render'da
# (bellek aşımı gibi) olaylarda hiçbir uygulama satırı görünmüyordu. Artık "-" = konsol.
# Yerelde dosyaya yazmak isterseniz LOG_DIR tanımlayın (eski davranış).
_log_dir = os.environ.get("LOG_DIR", "").strip()
if _log_dir:
    os.makedirs(_log_dir, exist_ok=True)
    accesslog = os.path.join(_log_dir, "gunicorn-access.log")
    errorlog = os.path.join(_log_dir, "gunicorn-error.log")
else:
    accesslog = "-"
    errorlog = "-"
loglevel = "info"
# Erişim satırı: yol (SORGU DİZESİ YOK) + durum + süre. IP ve tarayıcı bilgisi bilerek yazılmaz.
access_log_format = '%(t)s "%(m)s %(U)s" %(s)s %(b)s %(L)ss'

# Konsol çıktısını dosyaya YÖNLENDİRME: Render konsolu okur.
capture_output = False
enable_stdio_inheritance = True

max_requests = 1000
max_requests_jitter = 100

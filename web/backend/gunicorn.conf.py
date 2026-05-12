# Gunicorn yapılandırması — yalnızca Linux üretim ortamı için.
# Windows'ta gunicorn çalışmaz; geliştirme için run-pdf-api.mjs (uvicorn) kullanın.
#
# Başlatma: gunicorn -c gunicorn.conf.py app.main:app
# (web/backend dizininden çalıştırın, venv aktif olmalı)

import multiprocessing

bind = "127.0.0.1:8000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
timeout = 120
keepalive = 5

accesslog = "../../logs/gunicorn-access.log"
errorlog = "../../logs/gunicorn-error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

max_requests = 1000
max_requests_jitter = 100

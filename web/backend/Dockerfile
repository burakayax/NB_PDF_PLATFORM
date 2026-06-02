# NB PDF API (FastAPI) — üretim imajı.
# ÖNEMLİ: build context proje köküdür (render.yaml: dockerContext: .),
# çünkü uygulama kök dizindeki src/pdf_engine.py'yi paylaşır
# (operations.py: REPO_ROOT = parents[4] → from src import pdf_engine).

# Debian 12 (bookworm)'a sabitlendi: yeni "trixie" tabanından wkhtmltopdf
# kaldırıldı (upstream arşivlendi). bookworm'da tüm sistem paketleri mevcut.
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PDF_API_HOST=0.0.0.0 \
    PDF_API_PORT=8000

# Sistem bağımlılıkları (native Python runtime'da apt-get çalışmadığı için Docker şart):
#   wkhtmltopdf  → pdfkit | tesseract-ocr(+tur) → pytesseract | poppler-utils → pdf2image
#   ghostscript  → ocrmypdf | libcairo2 → pycairo/svglib | libgl1/libglib2.0-0 → opencv
RUN apt-get update && apt-get install -y --no-install-recommends \
      wkhtmltopdf \
      tesseract-ocr \
      tesseract-ocr-tur \
      poppler-utils \
      ghostscript \
      libcairo2 \
      libgl1 \
      libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Önce yalnızca requirements — Docker katman cache'i (kod değişince pip tekrar çalışmaz)
COPY web/backend/requirements.txt /app/web/backend/requirements.txt
# pycairo gibi C-eklentileri kaynaktan derlenir: derleyici + cairo başlıkları +
# pkg-config gerekir. Bunları kur, pip'i çalıştır, sonra AYNI katmanda kaldır
# (imaj şişmesin; çalışma zamanında yalnızca libcairo2 yeterli).
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      libcairo2-dev \
      pkg-config \
    && pip install --upgrade pip \
    && pip install -r /app/web/backend/requirements.txt \
    && apt-get purge -y build-essential libcairo2-dev pkg-config \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Uygulama kodu + paylaşılan PDF motoru (kök src/). Dizin yapısı korunmalı:
# /app/web/backend/app/core/operations.py → parents[4] = /app → /app/src erişilebilir.
COPY web/backend /app/web/backend
COPY src /app/src

WORKDIR /app/web/backend

EXPOSE 8000

CMD ["gunicorn", "-c", "gunicorn.conf.py", "app.main:app"]

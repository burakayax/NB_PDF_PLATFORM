# RB-10: PDF Worker Donması (Worker Freeze)

**Belirti:** PDF işleme istekleri sıraya giriyor ama hiçbiri tamamlanmıyor. Thread pool log'unda "all workers busy" veya işlemler timeout alıyor. CPU düşük ama işlemler ilerleyemiyor (deadlock şüphesi).

**Etki:** Hiçbir PDF işlemi çalışmıyor. Kullanıcılar "işleminiz devam ediyor" görüyor ama sonuç gelmiyor.

---

## Adım 1: Worker Durumunu Tespit Et

```bash
# PDF API çalışıyor mu?
curl -f http://localhost:8000/ && echo "PDF API UP"

# Thread pool dolu mu?
grep "thread_pool\|all_workers_busy\|queue_full" /var/log/nb-pdf-platform/api.log | tail -20

# Python process'leri:
ps aux | grep python | grep -v grep
# Worker thread'ler: birden fazla "python" process görüyorsun
```

---

## Adım 2: Donmuş Worker'ı Tanı

```bash
# CPU kullanımı olmayan uzun süreli process:
ps aux --sort=-etime | grep python | head -10
# ELAPSED sütununda saatlerdir çalışan process var mı?

# Python thread dump (SIGUSR1 veya SIGQUIT ile):
PID=$(pgrep -f "uvicorn")
kill -QUIT $PID  # Stack trace yazdırır, process ölmez
# Log'a bakın:
journalctl -u nb-pdf-api -n 30

# Alternatif: py-spy ile canlı stack trace:
pip install py-spy
py-spy dump --pid $PID
```

---

## Adım 3: Hızlı Kurtarma

```bash
# PDF API'yi tamamen yeniden başlat:
systemctl restart nb-pdf-api
sleep 10

# Kontrol:
curl -f http://localhost:8000/ && echo "PDF API OK"

# Sonra bir test işlemi yap:
# Frontend'den küçük bir PDF yükle
```

**Dikkat:** Yeniden başlatma sırasında işlemde olan PDF'ler kaybolur. Kullanıcılar yeniden yükleme yapmak zorunda kalır.

---

## Adım 4: Geçici Dosyaları Temizle

Donmuş worker'lar temp dosya bırakmış olabilir:

```bash
# PDF geçici dosyaları:
find /tmp -name "nbpdf-*" | wc -l
find /tmp -name "nbpdf-*" -mmin +30 -exec rm -rf {} + 2>/dev/null

# Boyut:
du -sh /tmp/
```

---

## Adım 5: Neden Dondu? — Analiz

### Sebep 1: Şifreli/Korumalı PDF

```bash
# Şifreli PDF işleme hatası:
grep "encrypted\|password.*required\|PdfReadError" /var/log/nb-pdf-platform/api.log | tail -10
# Çözüm: Şifreli PDF'leri reddet (frontend'de kontrol ekle)
```

### Sebep 2: Bozuk PDF (Corrupt)

```bash
# Corrupt PDF hatası:
grep "invalid.*pdf\|PdfStreamError\|corrupt" /var/log/nb-pdf-platform/api.log | tail -10
# Çözüm: Magic byte validation zaten var. Hatalı PDF'ler reddediliyor olmalı.
```

### Sebep 3: Timeout Çalışmıyor

```bash
# Timeout ayarı:
grep "PDF_OPERATION_TIMEOUT_SEC" web/backend/.env
# Yoksa 120 saniye varsayılan

# Timeout log:
grep "asyncio.TimeoutError\|operation_timeout" /var/log/nb-pdf-platform/api.log | tail -10
```

**Timeout çalışmıyorsa:**

```bash
# web/backend/.env içine ekle:
PDF_OPERATION_TIMEOUT_SEC=60  # 60 saniye

# Servisi yeniden başlat:
systemctl restart nb-pdf-api
```

### Sebep 4: GIL Deadlock (Python)

```bash
# Python GIL deadlock nadirdir ama olabilir
# Belirtisi: thread'ler wait state'te, CPU düşük, ilerleme yok

# Kalıcı çözüm: Her işlem için yeni process spawn et
# (Mevcut thread_pool.py bunu zaten yapıyor — kontrol et)
grep "ProcessPoolExecutor\|ThreadPoolExecutor" web/backend/app/core/thread_pool.py
```

---

## Adım 6: Kalıcı Önlemler

```bash
# 1. Watchdog script — worker yanıt vermiyorsa yeniden başlat:
#!/bin/bash
# /usr/local/bin/nb-pdf-watchdog.sh

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8000/)
if [ "$HEALTH" != "200" ]; then
  echo "$(date): PDF API DOWN, yeniden başlatılıyor"
  systemctl restart nb-pdf-api
fi

# Cron: her dakika:
* * * * * /usr/local/bin/nb-pdf-watchdog.sh >> /var/log/nb-pdf-platform/watchdog.log 2>&1

# 2. Uvicorn worker restart periyodu:
# web/backend/Procfile veya systemd service:
# --timeout-graceful-shutdown 30
# --timeout-keep-alive 5

# 3. Max concurrent işlem sınırı:
grep "PDF_CPU_MAX_IN_FLIGHT" web/backend/.env
# Makul bir değer: sunucu vCPU sayısı × 2
```

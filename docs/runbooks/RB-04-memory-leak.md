# RB-04: Bellek Sızıntısı (Memory Leak)

**Belirti:** Sunucu birkaç gün içinde yavaşlıyor. `free -h` her geçen gün daha az available gösteriyor. Sonunda servisler çöküyor.

**Etki:** Yavaş API yanıtları → servis çöküşü → downtime.

---

## Adım 1: Bellek Durumunu Ölç

```bash
# Anlık bellek:
free -h
#              total    used    free    available
# Mem:          3.8G    3.5G    102M      200M  ← Sorunlu!

# Hangi process en çok RAM kullanıyor?
ps aux --sort=-%mem | head -15

# Node.js memory:
PID=$(pgrep -f "node.*dist/server")
cat /proc/$PID/status | grep -E "VmRSS|VmSize"
# VmRSS: gerçek fiziksel RAM kullanımı

# Python memory:
PID_PY=$(pgrep -f "uvicorn\|python.*main")
cat /proc/$PID_PY/status | grep -E "VmRSS|VmSize"
```

**VmRSS 500MB+ (Node.js) → Büyük ihtimalle leak**

---

## Adım 2: Trend Analizi

```bash
# Son 7 günlük memory log (eğer izliyorsan):
cat /var/log/nb-pdf-platform/node-mem.log | tail -50

# Anlık snapshot al, sonra karşılaştır:
date >> /tmp/mem-check.log
ps aux | grep node | awk '{print $6}' >> /tmp/mem-check.log
```

**30 dakika bekliyip tekrar ölç. Sayı artıyorsa → leak kesin.**

---

## Adım 3: Geçici Çözüm — Hızlı Kurtarma

Memory leak varken en hızlı çözüm servisi yeniden başlatmak:

```bash
# Kullanıcı yokken (gece):
systemctl restart nb-api

# Kontrol:
free -h
# Bellek geri geldi mi?
```

**Haftada bir otomatik yeniden başlatma (geçici çözüm):**

```bash
# Crontab'a ekle:
0 4 * * 0 systemctl restart nb-api  # Pazar sabahı 04:00
```

---

## Adım 4: Leak'in Kaynağını Bul

### Node.js Leak Tespiti

```bash
# Heap snapshot için V8 profiler etkinleştir:
# web/api/src/server.ts'e ekle (geliştirme ortamında):
# process.on('SIGUSR2', () => {
#   require('v8').writeHeapSnapshot();
# });

# Basit yaklaşım — memory kullanımını 5 dakikada bir logla:
0/5 * * * * ps aux | grep "node.*dist" | awk '{print strftime("%Y-%m-%d %H:%M"), $6}' >> /var/log/nb-pdf-platform/node-mem.log
```

### Muhtemel Kaynak: Sıkıştırılmamış PDF İşlemleri

```bash
# Temp dosyalar birikmiş mi?
du -sh /tmp/nbpdf-* 2>/dev/null | wc -l
find /tmp -name "nbpdf-*" | wc -l
# 100+ → cleanup çalışmıyor
```

```bash
# Manuel cleanup:
find /tmp -name "nbpdf-*" -mmin +30 -exec rm -rf {} + 2>/dev/null
```

### Muhtemel Kaynak: Kapatılmamış DB Bağlantıları

```bash
# PostgreSQL'deki açık bağlantı sayısı:
psql -U postgres -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
# idle_in_transaction fazlaysa sorun var

# Prisma bağlantı limiti (web/api/.env):
grep "connection_limit" web/api/.env
# Yoksa ekle: DATABASE_URL="...?connection_limit=10&pool_timeout=20"
```

### Muhtemel Kaynak: Event Listener Birikimi

```bash
# Node.js max listener uyarısı logda var mı?
grep "MaxListenersExceededWarning" /var/log/nb-pdf-platform/api.log | tail -10
```

---

## Adım 5: Python (FastAPI) Memory Leak

```bash
# Uvicorn process memory:
ps aux | grep uvicorn

# PDF işleme sırasında bellek serbest bırakılıyor mu?
# web/backend/app/core/operations.py'de cleanup_path() çağrılıyor mu?
grep -n "cleanup_path" web/backend/app/api/tool_routes_extra.py | head -20
```

**Python'da en sık neden:** İşlenen PDF dosyaları RAM'de tutuluyor, garbage collector temizlemiyor.

```python
# Büyük dosyalar için açık bellek serbest bırakma:
import gc
# İşlem bittikten sonra:
del pdf_object
gc.collect()
```

---

## Adım 6: Kalıcı Çözüm

```bash
# 1. Memory limit koy:
# /etc/systemd/system/nb-api.service:
[Service]
ExecStart=/usr/bin/node --max-old-space-size=400 /var/www/nb-pdf-platform/web/api/dist/server.js
MemoryMax=600M
MemorySwapMax=0

systemctl daemon-reload
systemctl restart nb-api

# 2. OOM durumunda otomatik yeniden başlat:
# /etc/systemd/system/nb-api.service:
[Service]
Restart=always
RestartSec=10

# 3. Memory alarm kur:
# /usr/local/bin/nb-health-check.sh içine:
RAM=$(free | grep Mem | awk '{printf "%.0f", $3/$2*100}')
[ "$RAM" -gt 85 ] && send_alert "⚠️ RAM %${RAM} dolu — leak şüphesi!"
```

# RB-05: CPU Ani Artışı

**Belirti:** CPU %90+ sürekli. API yanıtları 2-5 saniyeye çıktı. PDF işleme zaman aşımına uğruyor.

**Etki:** Tüm kullanıcılar yavaşlık yaşıyor. PDF işleme başarısız. Ödeme işlemleri yavaşlayabilir.

---

## Adım 1: CPU Durumunu Ölç

```bash
# Anlık CPU kullanımı:
top -b -n 1 | head -20

# En çok CPU kullanan process'ler:
ps aux --sort=-%cpu | head -10

# Load average (son 1, 5, 15 dakika):
uptime
# load average: 4.5, 3.2, 2.1
# Sunucunun vCPU sayısından fazlaysa sorun var
# (2 vCPU'da load > 2 sorunlu)
```

---

## Adım 2: Kaynağı Belirle

### Python (PDF API) CPU Yüksek

```bash
PID=$(pgrep -f "uvicorn\|python.*main")
# CPU kullanımı:
ps -p $PID -o pid,pcpu,pmem,command

# Hangi PDF işlemi takılı?
# Thread pool durumu logda:
grep "thread_pool\|cpu_bound\|timeout" /var/log/nb-pdf-platform/api.log | tail -20
```

**Muhtemel neden:** Çok büyük veya bozuk PDF sonsuz döngüye sokmuş.

```bash
# Çözüm: FastAPI'yi yeniden başlat (o işlemi öldürür):
systemctl restart nb-pdf-api
```

### Node.js CPU Yüksek

```bash
PID=$(pgrep -f "node.*dist/server")
ps -p $PID -o pid,pcpu,pmem,command
```

**Muhtemel neden:** JSON parse eden büyük istek, sonsuz döngü, yoğun rate limiting hesabı.

```bash
# Node.js'i yeniden başlat:
systemctl restart nb-api
```

### Nginx CPU Yüksek

```bash
PID=$(pgrep nginx | head -1)
ps -p $PID -o pid,pcpu,pmem,command
# Nginx normalde düşük CPU kullanır
# Yüksekse → DDoS/bot saldırısı olabilir
# → RB-09 (DDoS runbook) incele
```

---

## Adım 3: Saldırı mı, Normal mi?

```bash
# İstek sayısı normalde ne kadar?
grep "$(date +%Y-%m-%d-%H)" /var/log/nginx/access.log | wc -l
# Son saatteki istek sayısı

# Tek IP'den çok fazla istek var mı?
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10
# Bir IP'den 1000+ istek → Saldırı

# Saldırı ise → RB-09'a git
```

---

## Adım 4: Sonsuz Döngü Tespit Et

```bash
# Python'da uzun süren işlemler:
grep "operation_timeout\|pdf_timeout\|timed out" /var/log/nb-pdf-platform/api.log | tail -20

# Timeout ayarı kontrol et:
grep "PDF_OPERATION_TIMEOUT_SEC" web/backend/.env
# Değer yoksa varsayılan 120 saniye
# 120 saniye sonra worker timeout ile ölüyor olmalı
```

**Sonsuz döngü varsa:**

```bash
# PDF işleme worker'larını öldür:
pkill -f "uvicorn"
sleep 3
systemctl start nb-pdf-api
```

---

## Adım 5: Veritabanı CPU

```bash
# PostgreSQL CPU kullanıyor mu?
ps aux | grep postgres | grep -v grep

# Yavaş query çalışıyor mu?
psql -U postgres -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '10 seconds'
ORDER BY duration DESC;"

# Yavaş query öldür:
psql -U postgres -c "SELECT pg_terminate_backend(PID_BURAYA);"
```

---

## Adım 6: Geçici Yük Azaltma

```bash
# PDF işleme kapasitesini azalt (anlık):
# web/backend/.env:
PDF_CPU_MAX_IN_FLIGHT=1  # Normalde daha yüksek
# Servisi yeniden başlat → Yeni işlemler sıraya girer ama sistem nefes alır

# Rate limiting sıkılaştır (anlık, opsiyonel):
# Nginx'te IP başına limit:
# limit_req_zone $binary_remote_addr zone=pdf:10m rate=5r/m;
```

---

## Adım 7: Kalıcı Önlemler

```bash
# 1. CPU alarm kur:
# /usr/local/bin/nb-health-check.sh içine:
CPU=$(top -b -n 1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
CPU_INT=$(echo "$CPU" | cut -d'.' -f1)
[ "$CPU_INT" -gt 85 ] && send_alert "⚠️ CPU %${CPU} — yüksek yük!"

# 2. PDF timeout ayarla (zaten var, kontrol et):
grep "PDF_OPERATION_TIMEOUT_SEC" web/backend/.env

# 3. Yük testi yap:
# Kaç eşzamanlı PDF işlemi sunucuyu bunaltıyor?
# Bunu bilmeden capacity planlaması yapamazsın
```

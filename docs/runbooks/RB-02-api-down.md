# RB-02: Auth API Yanıt Vermiyor

> 💻 **Platform Notu:** Bu runbook SSH ile Linux sunucuda çalıştırılır.
> `ssh kullanici@SUNUCU_IP` — hem Mac/Linux hem Windows'tan aynı çalışır.

**Belirti:** `/api/auth/login`, `/api/auth/me` veya diğer auth endpoint'leri 502/503/504 döndürüyor. Frontend "sunucuya bağlanılamıyor" hatası gösteriyor.

**Etki:** Hiçbir kullanıcı giriş yapamıyor. Mevcut oturumlar da etkilenebilir. Ödeme işlemleri durdu.

**Önce:** PDF API (`localhost:8000`) sorunsuz mu kontrol et. İkisi bağımsız servis.

---

## Adım 1: Servis Durumunu Kontrol Et

```bash
# 🖥️ SSH ile sunucuda:
systemctl status nb-api
# Active: active (running) → Servis çalışıyor ama yanıt vermiyor
# Active: failed           → Servis çökmüş
# Active: activating       → Başlamaya çalışıyor (bekle 30 sn)
```

**Servis çalışıyorsa ama yanıt vermiyorsa → Adım 2**
**Servis çökmüşse → Adım 3**

---

## Adım 2: Servis Çalışıyor Ama Yanıt Vermiyor

```bash
# 🖥️ SSH ile sunucuda:

# Local'den direkt test:
curl -f http://localhost:4000/api/health
# Yanıt yok/yavaşsa → Node.js takılı

# Process var mı?
ps aux | grep "node.*dist"

# Port dinleniyor mu?
ss -tlnp | grep 4000
# 0.0.0.0:4000 görünmeli
```

**Port açık ama yanıt yok → Muhtemelen event loop bloklu:**

```bash
# 🖥️ SSH ile sunucuda:

# Process ID bul:
PID=$(pgrep -f "node.*dist/server")
echo "PID: $PID"

# Memory kullanımı:
cat /proc/$PID/status | grep VmRSS
# 1GB+ ise memory leak

# Zorla yeniden başlat:
systemctl restart nb-api
sleep 10

# Test:
curl -f http://localhost:4000/api/health && echo "ÇÖZÜLDÜ"
```

---

## Adım 3: Servis Çökmüş — Log İncele

```bash
# 🖥️ SSH ile sunucuda:

# Son hata logları:
journalctl -u nb-api -n 50 --no-pager

# Uygulama log:
tail -50 /var/log/nb-pdf-platform/api.log
```

### Senaryo A: "EADDRINUSE" — Port Meşgul

```bash
# 🖥️ SSH ile sunucuda:
# Portu tutan process:
lsof -i :4000
# Kill:
kill -9 $(lsof -t -i:4000)
systemctl start nb-api
```

### Senaryo B: "Cannot find module" — Build Eksik

```bash
# 🖥️ SSH ile sunucuda:
# dist/ klasörü var mı?
ls /var/www/nb-pdf-platform/web/api/dist/
# Yoksa:
cd /var/www/nb-pdf-platform/web/api
npm run build
systemctl start nb-api
```

### Senaryo C: Database Bağlantı Hatası

```bash
# 🖥️ SSH ile sunucuda:
systemctl status postgresql
pg_isready -U postgres
# Çalışmıyorsa:
systemctl start postgresql
sleep 5
systemctl start nb-api
```

### Senaryo D: Environment Variable Eksik

```bash
# 🖥️ SSH ile sunucuda:
# .env dosyası var mı?
ls -la /var/www/nb-pdf-platform/web/api/.env
# Kritik değişkenler:
grep -E "DATABASE_URL|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET" /var/www/nb-pdf-platform/web/api/.env
# Boş veya eksikse → Bitwarden'dan geri yükle
```

### Senaryo E: Out of Memory

```bash
# 🖥️ SSH ile sunucuda:
# Sistem memory:
free -h
# Swap dolmuş mu?
swapon --show

# OOM killer log:
dmesg | grep -i "out of memory\|oom" | tail -10

# Geçici çözüm: Gereksiz process'leri kapat
systemctl stop nb-pdf-api  # PDF API'yi geçici durdur
systemctl start nb-api
# Sonra PDF API'yi de başlat
systemctl start nb-pdf-api
```

---

## Adım 4: Nginx Kontrol Et

Auth API çalışıyor ama dışarıdan erişilmiyorsa nginx sorunu:

```bash
# 🖥️ SSH ile sunucuda:
systemctl status nginx
# Çalışmıyorsa:
nginx -t  # Config hatalı mı?
systemctl start nginx

# Upstream bağlantısı:
curl -I http://localhost:4000/api/health
# 200 → Nginx proxy sorunu
# 502 → Node.js sorunu
```

---

## Adım 5: Hızlı Kurtarma

```bash
# 🖥️ SSH ile sunucuda:

# Tüm servisleri sırayla başlat:
systemctl start postgresql
sleep 5
systemctl start nb-api
sleep 10
systemctl start nb-pdf-api
sleep 5
systemctl reload nginx

# Kontrol:
curl -f http://localhost:4000/api/health && echo "Auth API OK"
curl -f http://localhost:8000/ && echo "PDF API OK"
```

---

## Önlem: Neden Tekrar Olmasın?

```bash
# 🖥️ Sunucuda — Memory limit ekle (Node.js'in çok RAM almasını engeller):
# /etc/systemd/system/nb-api.service içinde:
[Service]
ExecStart=/usr/bin/node --max-old-space-size=512 /var/www/nb-pdf-platform/web/api/dist/server.js
MemoryLimit=700M

systemctl daemon-reload
systemctl restart nb-api
```

**Sürekli çökme → Sonraki adım:**
- Log'ları tam incele: `journalctl -u nb-api --since "1 hour ago"`
- Hata mesajını kopyala, GitHub issue aç veya araştır

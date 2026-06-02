# RB-06 — Disk Doldu

> 💻 **Platform Notu:** Bu runbook SSH ile Linux sunucuda çalıştırılır.
> `ssh kullanici@SUNUCU_IP` — hem Mac/Linux hem Windows'tan aynı çalışır.

> **Kritiklik:** 🔴 KRİTİK — Disk dolunca her şey durur
> **Tipik çözüm süresi:** 5-15 dakika
> **Neden bu kadar tehlikeli?** Disk dolunca veritabanı yazamaz, loglar yazılamaz, PDF işlenemez, oturumlar kaydedilemez. Sistem tamamen durur.

---

## 🔍 Belirtiler

- Her API isteği hata veriyor
- `ENOSPC: no space left on device` hatası logda
- Kullanıcılar "sunucu hatası" görüyor
- PDF yükleme başarısız
- Servisler başlamıyor

---

## ✅ Adım 1: Durumu Anla

```bash
# 🖥️ SSH ile sunucuda:

# Disk ne kadar dolu?
df -h

# Örnek çıktı:
# Filesystem      Size  Used Avail Use%
# /dev/sda1        50G   48G  100M  99%   ← ALARM!

# Hangi dizin en çok yer kaplıyor?
du -sh /* 2>/dev/null | sort -rh | head -10
du -sh /tmp/* 2>/dev/null | sort -rh | head -10
du -sh /var/* 2>/dev/null | sort -rh | head -10
```

---

## 🚨 HIZLI KURTARMA (önce bunu yap):

```bash
# 🖥️ SSH ile sunucuda:

# === 1. PDF geçici dosyalar (en güvenli temizlik) ===
find /tmp -name "nbpdf-*" -mmin +5 -exec rm -rf {} + 2>/dev/null
echo "1. PDF geçici dosyalar temizlendi"
df -h | grep /dev/sda

# === 2. Eski log dosyaları ===
# Logları sıkıştır (hemen yer açar):
gzip /var/log/nb-pdf-platform/*.log.1 2>/dev/null
# Eski arşivleri sil:
find /var/log/nb-pdf-platform/ -name "*.gz" -mtime +7 -delete
echo "2. Eski loglar temizlendi"
df -h | grep /dev/sda

# === 3. Journalctl (sistem log) temizleme ===
sudo journalctl --vacuum-size=100M
echo "3. Journalctl temizlendi"
df -h | grep /dev/sda

# === 4. Apt cache (paket önbelleği) ===
sudo apt-get clean
echo "4. Apt cache temizlendi"
df -h | grep /dev/sda

# === 5. Eski Docker imajları (Docker kullanıyorsan) ===
docker system prune -f 2>/dev/null
echo "5. Docker temizlendi"
df -h | grep /dev/sda
```

---

## ✅ Adım 2: Hâlâ Yeterli Yer Yoksa — Derine İn

```bash
# 🖥️ SSH ile sunucuda:

# EN BÜYÜK DOSYALARI BUL:
find / -type f -size +100M -exec ls -lh {} \; 2>/dev/null | \
  sort -k5 -rh | head -20

# Core dump dosyaları (crash kalıntıları):
find / -name "core" -o -name "*.core" 2>/dev/null | head -10
find / -name "core.*" -type f 2>/dev/null | head -10
# Bunları güvenle silebilirsin:
find / -name "core" -type f -delete 2>/dev/null

# Node.js npm önbelleği:
du -sh ~/.npm/
npm cache clean --force

# Python pip önbelleği:
pip cache purge

# Result store'da süresi dolmuş dosyalar:
find /path/to/nb-result-store/ -mindepth 1 -maxdepth 1 -type d -mmin +60 \
  -exec rm -rf {} + 2>/dev/null
echo "Result store temizlendi"
```

---

## ✅ Adım 3: Servisler Yeniden Başlat

```bash
# 🖥️ SSH ile sunucuda:
# Disk temizlendikten sonra servisleri yeniden başlat:
sudo systemctl restart nb-api nb-pdf-api

# Kontrol:
systemctl is-active nb-api nb-pdf-api
df -h
```

---

## 🛠️ Kalıcı Çözüm — Neden Doldu?

**Olası nedenler:**

### A. PDF Geçici Dosyalar Temizlenmiyor
```bash
# 🖥️ SSH ile sunucuda:
# TTL sweeper çalışıyor mu?
grep "ttl_sweep\|cleanup" /var/log/nb-pdf-platform/pdf-api.log | tail -10

# cleanup_path fonksiyonu hata veriyor mu?
grep "cleanup_path\|güvenlik sınırı" /var/log/nb-pdf-platform/pdf-api.log | tail -10
```

**Çözüm:** Cron job ekle:
```bash
# 🖥️ SSH ile sunucuda:
crontab -e
# Şunu ekle:
0 * * * * find /tmp -name "nbpdf-*" -mmin +60 -exec rm -rf {} + 2>/dev/null
30 * * * * find /path/to/nb-result-store -mindepth 1 -maxdepth 1 -type d -mmin +120 -exec rm -rf {} + 2>/dev/null
```

### B. Log Dosyaları Büyüyor
```bash
# 🖥️ SSH ile sunucuda:
# logrotate kurulu mu?
cat /etc/logrotate.d/nb-pdf-platform 2>/dev/null || \
  echo "logrotate yok! Kurulması gerekiyor."

# Logrotate konfigürasyonu oluştur:
sudo tee /etc/logrotate.d/nb-pdf-platform << 'EOF'
/var/log/nb-pdf-platform/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    maxsize 500M
}
EOF

sudo logrotate -f /etc/logrotate.d/nb-pdf-platform
```

### C. Disk Boyutu Yetersiz
```bash
# 🖥️ SSH ile sunucuda:
# Hosting panelinden disk büyütme:
# DigitalOcean: Droplet → Resize → Disk boyutunu artır
# AWS: EC2 → EBS Volume → Modify Volume → Boyutu artır

# EXT4 volume'ü büyüttükten sonra:
sudo resize2fs /dev/sda1
df -h  # Yeni boyut görünmeli
```

---

## 🚨 ACİL Disk Uyarısı — Monitoring

**Disk %85'e ulaşınca uyarı almalısın.** Bu komutla kontrol et:

```bash
# 🖥️ SSH ile sunucuda — cron job olarak ekle:
crontab -e
# Şu satırı ekle (her 30 dakikada bir):
*/30 * * * * \
  DISK=$(df / | tail -1 | awk '{print $5}' | tr -d '%'); \
  [ "$DISK" -gt 85 ] && \
  curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=ALARM:+Disk+%25$DISK+dolu" \
  2>/dev/null
```

---

## 📊 Disk Kullanım Kategorileri

| Konum | Ne var? | Ne sıklıkta temizle? |
|-------|---------|---------------------|
| `/tmp/nbpdf-*` | PDF işlem geçicileri | Otomatik (işlem bittikten sonra) |
| `/path/to/result-store/` | İşlenmiş PDF sonuçları | 30 dakikada bir (TTL) |
| `/var/log/nb-pdf-platform/` | Uygulama logları | logrotate ile günlük |
| `/var/log/journal/` | Sistem logları | journalctl --vacuum |
| `/var/lib/postgresql/` | Veritabanı | Büyüyorsa plan yap |
| `~/.npm/` | Node.js paketi cache | Aylık |

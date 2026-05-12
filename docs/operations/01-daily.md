# Günlük Operasyonlar — Her Gün Yapılacaklar

> **Ne zaman:** Her sabah açılınca ilk 15 dakika, akşam kapanmadan önce 5 dakika.
> **Neden:** Küçük sorunlar fark edilmeden büyür. Günlük kontrol, kullanıcılar fark etmeden önce problemi yakalamanı sağlar.

> 💻 **Platform Notu:**
> Sunucu komutları (systemctl, journalctl, df, free vb.) SSH ile Linux sunucuda çalıştırılır.
> `ssh kullanici@SUNUCU_IP` komutu hem Windows Terminal hem Mac Terminal'de aynı çalışır.
> **Yerel makinenden** çalıştırılan komutlar 🍎 Mac/Linux ve 🪟 Windows olarak ayrı gösterilmiştir.

---

## 🌅 Sabah Kontrol Listesi (15 dakika)

### 1. Site Ayakta mı? (Yerel Makinenden — SSH Gerekmez)

```bash
# 🍎 Mac / Linux Terminal:
curl -s -o /dev/null -w "%{http_code}" https://pdfplatform.com/
# Beklenen: 200

curl -s -o /dev/null -w "%{http_code}" https://siteadın.com/api/health
# Beklenen: 200

curl -s https://siteadın.com/api/health | python3 -m json.tool
```

```powershell
# 🪟 Windows (PowerShell):
(Invoke-WebRequest -Uri "https://pdfplatform.com/" -UseBasicParsing).StatusCode
# Beklenen: 200

(Invoke-WebRequest -Uri "https://pdfplatform/api/health" -UseBasicParsing).StatusCode
# Beklenen: 200

(Invoke-WebRequest -Uri "https://pdfplatform/api/health" -UseBasicParsing).Content | ConvertFrom-Json
```

**Tarayıcıdan da kontrol et:** Gizli/incognito pencerede siteyi aç.

---

### 2. Log Kontrolü — Son 12 Saatte Neler Oldu? (SSH ile Sunucuda)

> **Log nedir?** Sisteminizin tuttuğu günlük. Her istek, her hata, her işlem buraya yazılır.

```bash
# SSH ile sunucuya bağlandıktan sonra:

# Son 100 satırda hata var mı:
tail -100 /var/log/nb-pdf-platform/api.log | grep '"level":"error"'

# Son 1 saatin logları:
grep "$(date -u +%Y-%m-%dT%H)" /var/log/nb-pdf-platform/api.log | tail -50

# Ödeme hatalarına bak:
grep -i "payment\|iyzico\|callback" /var/log/nb-pdf-platform/api.log | tail -50

# Şüpheli aktivite:
grep -i "suspicious\|blocked\|rate_limit" /var/log/nb-pdf-platform/api.log | tail -20

# PDF API hataları:
journalctl -u nb-pdf-api -n 200 --no-pager | grep -E "ERROR|WARNING"
```

**Ne aramalısın?**

- `"level":"error"` → Hata oluşmuş
- `iyzico_signature_mismatch` → Ödeme sahtecilik girişimi
- `ip_blocked` → IP engellenmiş (normal olabilir)
- `pdf_cpu_pool saturated` → PDF sırası dolmuş

---

### 3. Disk Kullanımı (SSH ile Sunucuda)

> **Neden kritik?** Disk dolunca tüm sistem durur — veritabanı yazamaz, PDF işleyemez.

```bash
# SSH ile sunucuda:
df -h

# Kritik dizinleri kontrol et:
du -sh /tmp/nbpdf-* 2>/dev/null || echo "Geçici dosya yok"
du -sh /var/log/nb-pdf-platform/
du -sh /var/lib/postgresql/

# 1 saatten eski geçici PDF dosyaları:
find /tmp -name "nbpdf-*" -mmin +60 | wc -l
```

**Eşikler:**

- ✅ %70 altı → Normal
- ⚠️ %70-85 → Dikkat et
- 🚨 %85 üstü → Hemen temizle → `runbooks/RB-06-disk-full.md`

---

### 4. Bellek (RAM) Kullanımı (SSH ile Sunucuda)

> **Memory leak nedir?** Programın kullandığı belleği serbest bırakmaması. Zamanla RAM dolar.

```bash
# SSH ile sunucuda:
free -h

# En çok RAM kullanan process'ler:
ps aux --sort=-%mem | head -10

# Node.js memory:
ps aux | grep node | grep -v grep

# Python/uvicorn:
ps aux | grep uvicorn | grep -v grep
```

**Eşikler:**

- ✅ %70 altı → Normal
- ⚠️ %80 → Servisleri yeniden başlatmayı düşün
- 🚨 %90 üstü → Hemen müdahale → `runbooks/RB-04-memory-leak.md`

---

### 5. Aktif Kullanıcı ve Trafik Kontrolü (SSH ile Sunucuda)

```bash
# SSH ile sunucuda:

# Son 1 saatte kaç istek:
grep "$(date -u +%Y-%m-%dT%H)" /var/log/nb-pdf-platform/api.log | wc -l

# En çok istek atan IP'ler:
grep "$(date -u +%Y-%m-%dT%H)" /var/log/nb-pdf-platform/api.log | \
  grep -o '"ip":"[^"]*"' | sort | uniq -c | sort -rn | head -10

# Rate limit alanlar:
grep "rate_limit_exceeded" /var/log/nb-pdf-platform/api.log | \
  grep "$(date -u +%Y-%m-%d)" | wc -l
```

---

### 6. Ödeme Durumu Kontrolü (SSH ile Sunucuda)

```bash
# SSH ile sunucuda:

# Bugün başarılı ödemeler:
grep "subscription_activated\|subscription updated successfully" \
  /var/log/nb-pdf-platform/api.log | grep "$(date -u +%Y-%m-%d)" | wc -l

# Callback hataları:
grep "callback.*failed\|signature_invalid\|retrieve_failed" \
  /var/log/nb-pdf-platform/api.log | grep "$(date -u +%Y-%m-%d)"

# İyzico imza uyuşmazlığı (sahtecilik girişimi):
grep "iyzico_signature_mismatch" /var/log/nb-pdf-platform/api.log | \
  grep "$(date -u +%Y-%m-%d)"
```

---

### 7. SSL Sertifika Geçerlilik Süresi (Yerel Makinenden)

> **SSL süresi dolarsa** tarayıcılar "güvensiz site" uyarısı gösterir, kullanıcılar kaçar.

```bash
# 🍎 Mac / Linux Terminal:
echo | openssl s_client -connect siteadın.com:443 -servername siteadın.com 2>/dev/null | \
  openssl x509 -noout -enddate
# "notAfter=Feb 15 12:00:00 2025 GMT" gibi bir çıktı gelir
```

```powershell
# 🪟 Windows (PowerShell):
$cert = [System.Net.ServicePointManager]::FindServicePoint("https://pdfplatform.app").Certificate
# Daha basit yöntem — tarayıcıda:
# Site adres çubuğundaki kilide tıkla → Sertifika Bilgisi → Son Kullanma Tarihi
```

**Eşikler:**

- ✅ 30+ gün → Sorun yok
- ⚠️ 14-30 gün → Yakında yenilenecek
- 🚨 14 gün altı → Hemen yenile → `runbooks/RB-08-ssl-expired.md`

---

## 🌆 Akşam Kısa Kontrol (5 dakika) — SSH ile Sunucuda

```bash
# SSH ile sunucuda:

# Disk büyümesi:
df -h | grep -v tmpfs

# Geçici dosyalar temizlendi mi:
find /tmp -name "nbpdf-*" 2>/dev/null | wc -l
# Beklenen: 0 ya da çok az

# Bugün kaç kullanıcı kayıt oldu:
grep "user_registered" /var/log/nb-pdf-platform/api.log | \
  grep "$(date -u +%Y-%m-%d)" | wc -l

# Bugün kaç PDF işlendi:
grep "pdf_processed\|pdf_api_incoming" /var/log/nb-pdf-platform/api.log | \
  grep "$(date -u +%Y-%m-%d)" | wc -l
```

---

## 📊 Özet Tablo — Günlük Kontrol

| Kontrol         | Nerede                  | Beklenen  | Alarm         |
| --------------- | ----------------------- | --------- | ------------- |
| Site sağlık     | Yerel makine            | HTTP 200  | Başka her şey |
| Disk kullanımı  | SSH → `df -h`           | < %85     | > %85         |
| RAM kullanımı   | SSH → `free -h`         | < %80     | > %90         |
| Hata sayısı     | SSH → log grep          | < 50/saat | > 200/saat    |
| SSL süresi      | Yerel makine / tarayıcı | > 30 gün  | < 14 gün      |
| Geçici dosyalar | SSH → find /tmp         | < 5 dosya | > 50 dosya    |

---

## 🛠️ Günlük İzleme Araçları

### 1. UptimeRobot (Ücretsiz)

- Her 5 dakikada `/api/health` endpoint'ini kontrol eder
- Site düşünce SMS/email atar
- https://uptimerobot.com → Hesap aç → Monitor ekle

### 2. Logrotate Kurulumu (SSH ile Sunucuda)

```bash
# SSH ile sunucuda:
sudo nano /etc/logrotate.d/nb-pdf-platform
```

```
/var/log/nb-pdf-platform/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nb-api 2>/dev/null || true
    endscript
}
```

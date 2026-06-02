# İzleme Rehberi — Ne İzlenir, Ne Zaman Alarm Verir?

> **Monitoring (izleme) nedir?** Sisteminizin nabzını sürekli tutmak. Kullanıcı şikayet etmeden önce sorunu fark etmek.

> 💻 **Platform Notu:**
> 🍎 = Mac/Linux Terminal &nbsp;|&nbsp; 🪟 = Windows PowerShell &nbsp;|&nbsp; 🖥️ = SSH ile sunucuda
> Sunucu monitoring scriptleri SSH ile Linux sunucuda çalışır. SSH her iki platformdan aynı çalışır.

---

## 📊 PDF SaaS İçin Kritik Metrikler

### Katman 1: "Site Ayakta mı?" (En Önemli)

| Metrik | Nasıl Ölçülür | Alarm Eşiği | Neden Önemli? |
|--------|---------------|-------------|----------------|
| Site uptime | UptimeRobot (dışarıdan) | 1 dakika kesinti | Kullanıcılar göremiyorsa hiçbir şey önemli değil |
| API health | `/api/health` endpoint | HTTP ≠ 200 | Auth ve ödeme çalışıyor mu? |
| PDF API health | `localhost:8000/` | HTTP ≠ 200 | PDF işleme çalışıyor mu? |

### Katman 2: Sistem Kaynakları

| Metrik | Alarm: Uyarı | Alarm: Kritik |
|--------|-------------|---------------|
| CPU kullanımı | >%70 | >%90 |
| RAM kullanımı | >%80 | >%90 |
| Disk kullanımı | >%75 | >%90 |
| Disk I/O beklemesi | >%30 | >%70 |

### Katman 3: Uygulama Metrikleri

| Metrik | Alarm: Uyarı | Alarm: Kritik |
|--------|-------------|---------------|
| HTTP 5xx hata oranı | >%2 | >%10 |
| API yanıt süresi | >500ms (p95) | >2000ms |
| PDF işleme süresi | >30s | >120s |
| 429 Too Many Requests | >100/dk | >500/dk |

### Katman 4: İş (Business) Metrikleri

| Metrik | Kontrol Sıklığı |
|--------|----------------|
| Başarılı ödeme sayısı | Günlük |
| Başarısız ödeme sayısı | Günlük |
| Yeni kayıt sayısı | Günlük |
| Aktif abonelik sayısı | Haftalık |

---

## 🛠️ Ücretsiz Monitoring Stack

### 1. UptimeRobot (Ücretsiz — Zorunlu)

```
1. https://uptimerobot.com → Hesap aç
2. "Add New Monitor" → HTTP(s)
3. URL: https://siteadın.com/api/health
4. Kontrol aralığı: 5 dakika
5. Alert contact: SMS + E-posta
```

### 2. Netdata — Sunucu Kaynak İzleme (SSH ile Sunucuda Kurulur)

```bash
# 🖥️ SSH ile sunucuda kurulum:
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
systemctl status netdata
```

**Tarayıcıdan erişim için SSH tüneli kur (yerel makinenden):**

```bash
# 🍎 Mac / Linux ve 🪟 Windows Terminal — AYNI KOMUT:
ssh -L 19999:localhost:19999 kullanici@SUNUCU_IP
# Sonra tarayıcıda: http://localhost:19999
```

---

### 3. Otomatik Alarm Scripti (SSH ile Sunucuda Kurulur)

> Bu script Linux sunucuda çalışır. Cron ile her 5 dakikada tetiklenir.

```bash
# 🖥️ SSH ile sunucuda — /usr/local/bin/nb-health-check.sh oluştur:

#!/bin/bash
TELEGRAM_TOKEN="BOT_TOKEN_BURAYA"
CHAT_ID="CHAT_ID_BURAYA"
LOG="/var/log/nb-pdf-platform/health-check.log"

send_alert() {
  local msg="$1"
  echo "$(date): $msg" >> $LOG
  curl -s "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}&text=${msg}" > /dev/null
}

# Disk kontrolü:
DISK=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
[ "$DISK" -gt 85 ] && send_alert "⚠️ Disk %${DISK} dolu!"

# RAM kontrolü:
RAM=$(free | grep Mem | awk '{printf "%.0f", $3/$2*100}')
[ "$RAM" -gt 90 ] && send_alert "⚠️ RAM %${RAM} dolu!"

# API health:
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:4000/api/health)
[ "$HEALTH" != "200" ] && send_alert "🚨 Auth API DOWN! HTTP $HEALTH"

# PDF API:
PDF_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:8000/)
[ "$PDF_HEALTH" != "200" ] && send_alert "🚨 PDF API DOWN! HTTP $PDF_HEALTH"

# Geçici dosya sayısı:
TEMP_COUNT=$(find /tmp -name "nbpdf-*" -mmin +60 2>/dev/null | wc -l)
[ "$TEMP_COUNT" -gt 50 ] && send_alert "⚠️ ${TEMP_COUNT} adet eski geçici PDF dosyası!"

echo "$(date): OK" >> $LOG
```

```bash
# 🖥️ Sunucuda scripti etkinleştir:
chmod +x /usr/local/bin/nb-health-check.sh
crontab -e
# Şu satırı ekle:
*/5 * * * * /usr/local/bin/nb-health-check.sh
```

---

## 📱 Telegram Bot Alarm Kurulumu

```
1. Telegram'da @BotFather'a yaz: /newbot
2. Bot adı ver, TOKEN al (örn: 123456:ABC-DEF...)
3. Bota bir mesaj gönder
4. https://api.telegram.org/bot<TOKEN>/getUpdates adresini aç
5. "chat":{"id": 123456789} → bu senin chat_id'n
```

**Test komutu (yerel makinenden):**

```bash
# 🍎 Mac / Linux:
curl "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=Test+alarm"
```

```powershell
# 🪟 Windows (PowerShell):
Invoke-WebRequest -Uri "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=Test+alarm" -UseBasicParsing
```

---

## 📈 Günlük Rapor Scripti (SSH ile Sunucuda)

```bash
# 🖥️ SSH ile sunucuda — /usr/local/bin/nb-daily-report.sh:

#!/bin/bash
DATE=$(date -d "yesterday" +%Y-%m-%d)
LOG_FILE="/var/log/nb-pdf-platform/api.log"

echo "=== $DATE Günlük Rapor ==="
echo "📊 İstek İstatistikleri:"
echo "  Toplam istek: $(grep "$DATE" $LOG_FILE | wc -l)"
echo "  5xx hatalar: $(grep "$DATE" $LOG_FILE | grep '"status":5' | wc -l)"
echo "  4xx hatalar: $(grep "$DATE" $LOG_FILE | grep '"status":4' | wc -l)"
echo ""
echo "💰 Ödeme:"
echo "  Başarılı: $(grep "$DATE" $LOG_FILE | grep 'subscription_activated' | wc -l)"
echo "  Başarısız: $(grep "$DATE" $LOG_FILE | grep 'callback.*failed\|retrieve_failed' | wc -l)"
echo ""
echo "🔒 Güvenlik:"
echo "  İmza hatası: $(grep "$DATE" $LOG_FILE | grep 'iyzico_signature_mismatch' | wc -l)"
echo ""
echo "💾 Sistem:"
echo "  Disk: $(df -h / | tail -1 | awk '{print $5}')"
echo "  RAM: $(free | grep Mem | awk '{printf "%.0f%%", $3/$2*100}')"
```

---

## 🎯 Monitoring Olgunluk Seviyeleri

**Seviye 1 (MVP — Şimdi yap):**
- ✅ UptimeRobot ile external uptime
- ✅ Telegram/e-posta alarmı (sunucu scripti)
- ✅ Günlük manual log kontrolü (SSH ile)

**Seviye 2 (100+ kullanıcı):**
- Netdata veya Grafana + Prometheus
- Otomatik günlük rapor e-postası
- Ödeme başarı oranı izleme

**Seviye 3 (1000+ kullanıcı):**
- Merkezi log yönetimi (Loki, ELK Stack)
- APM (Application Performance Monitoring)
- PagerDuty/OpsGenie

> **Önemli:** Seviye 3'ü MVP aşamasında kurma. Overengineering zaman kaybıdır.

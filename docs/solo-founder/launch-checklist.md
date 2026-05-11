# Lansman Öncesi Kontrol Listesi

> **Bu liste tamamlanmadan kullanıcılara açmayın.** Her madde bir nedeni var — atlamanın bedeli ödeme kaybı, veri kaybı veya güvenlik ihlali olabilir.

> 💻 **Platform Notu:**
> "Kontrol" / "Test" olarak işaretlenen komutlar **yerel makinenden** veya **SSH ile sunucuda** çalıştırılır.
> 🍎 = Mac/Linux Terminal &nbsp;|&nbsp; 🪟 = Windows PowerShell &nbsp;|&nbsp; 🖥️ = SSH ile sunucuda (her iki platformda SSH aynı çalışır)

---

## 🔴 Kritik — Bunlar Olmadan Lansman Yapma

### Altyapı

```
[ ] Node.js API üretim sunucusunda çalışıyor (localhost değil)
[ ] FastAPI PDF servisi çalışıyor
[ ] PostgreSQL kullanılıyor (SQLite DEĞİL)
    🖥️ Sunucuda: grep "DATABASE_URL" web/api/.env | grep -v "file:"
[ ] Nginx reverse proxy kuruldu (4000 ve 8000 portları dışarıya kapalı)
[ ] SSL sertifikası kurulu ve geçerli
    🍎 Mac: curl -I https://siteadın.com | grep HTTP
    🪟 Windows: (Invoke-WebRequest "https://siteadin.com" -Method Head -UseBasicParsing).StatusCode
[ ] HTTPS yönlendirmesi çalışıyor (HTTP → HTTPS)
    🍎 Mac: curl -I http://siteadın.com | grep Location
    🪟 Windows: (Invoke-WebRequest "http://siteadin.com" -UseBasicParsing -MaximumRedirection 0).Headers.Location
[ ] Sunucu zaman dilimi doğru (UTC önerilir)
    🖥️ Sunucuda: date
```

### Uygulama Konfigürasyonu

> Bu kontroller proje dizininde yerel makinende çalıştırılır.

```
[ ] NODE_ENV=production
    🍎 Mac: grep "NODE_ENV" web/api/.env
    🪟 Windows: Select-String "NODE_ENV" web\api\.env

[ ] JWT_ACCESS_SECRET en az 64 karakter
    🍎 Mac: grep "JWT_ACCESS_SECRET" web/api/.env | wc -c   # 65+ olmalı
    🪟 Windows: (Select-String "JWT_ACCESS_SECRET" web\api\.env).Line.Length

[ ] JWT_REFRESH_SECRET farklı ve en az 64 karakter

[ ] FRONTEND_ORIGIN gerçek domain (localhost değil)
    🍎 Mac: grep "FRONTEND_ORIGIN" web/api/.env
    🪟 Windows: Select-String "FRONTEND_ORIGIN" web\api\.env

[ ] IYZICO_URI üretim URL: https://api.iyzipay.com (sandbox değil!)
    🍎 Mac: grep "IYZICO_URI" web/api/.env
    🪟 Windows: Select-String "IYZICO_URI" web\api\.env

[ ] IYZICO_API_KEY ve IYZICO_SECRET_KEY gerçek üretim anahtarları
[ ] EMAIL_USER ve EMAIL_PASS dolu (doğrulama e-postaları için)
[ ] ADMIN_EMAIL doğru e-posta adresi
[ ] PAYMENT_CALLBACK_BASE_URL dışarıdan erişilebilir URL
```

### Güvenlik

```
[ ] .env dosyaları git'e commit edilmemiş
    🍎 Mac: git ls-files | grep "\.env$"   # Boş olmalı
    🪟 Windows: git ls-files | Select-String "\.env$"   # Sonuç gelmemeli

[ ] API logları hassas veri içermiyor (token'lar, şifreler)
    🖥️ Sunucuda: grep -i "password\|secret\|token" /var/log/nb-pdf-platform/api.log | head -5

[ ] Rate limiting çalışıyor
    🍎 Mac:
      for i in {1..20}; do
        curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/auth/login -X POST -d '{}'
      done
      # 429 görünmeli

    🪟 Windows (PowerShell):
      1..20 | ForEach-Object {
        (Invoke-WebRequest "http://localhost:4000/api/auth/login" -Method POST -Body '{}' `
          -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue).StatusCode
      }
      # 429 görünmeli

[ ] Admin paneli sadece admin@email.com'a açık
[ ] Güvenlik duvarı sadece 22, 80, 443 açık
    🖥️ Sunucuda: sudo ufw status
```

### Ödeme Sistemi

```
[ ] İyzico üretim ortamında test ödemesi yapıldı
    (Gerçek kart ile küçük miktar test et, iade al)
[ ] Başarılı ödeme sonrası plan güncelleniyor
    Test: Ödeme yap → kullanıcı PRO'ya geçiyor mu?
[ ] Başarısız ödeme sonrası kullanıcı hata mesajı görüyor
[ ] Callback URL iyzico panelinde kayıtlı
    (iyzico merchant panel → Entegrasyon → Callback URL)
[ ] İade akışı çalışıyor (admin panelinden test et)
```

### Kullanıcı Akışları

```
[ ] Kayıt olma → e-posta doğrulama → giriş akışı test edildi
[ ] "Şifremi unuttum" akışı test edildi
[ ] Google ile giriş çalışıyor (etkinleştirildiyse)
[ ] PDF yükleme → işleme → indirme testi yapıldı
    (Küçük bir PDF ile: merge, split, compress test et)
[ ] Büyük PDF (50MB+) yükleme test edildi (limit çalışıyor mu?)
[ ] Abonelik satın alma → araç kullanımı testi
[ ] FREE plan limitleri çalışıyor mu?
```

---

## 🟠 Önemli — Lansman Sonrası İlk Hafta İçinde Yap

```
[ ] Otomatik yedek kuruldu ve test edildi
    🖥️ Sunucuda: /usr/local/bin/nb-backup-db.sh çalıştır, sonuç dosyasını kontrol et

[ ] UptimeRobot kuruldu (ücretsiz, 5 dakikada bir kontrol)
    https://uptimerobot.com → /api/health için monitör ekle

[ ] Telegram/e-posta alarmı çalışıyor
    Test: Servisi durdur → alarm geliyor mu?

[ ] logrotate kuruldu (loglar sonsuza büyümez)
    🖥️ Sunucuda: sudo nano /etc/logrotate.d/nb-pdf-platform

[ ] Geçici dosya temizleme cron'u kuruldu
    🖥️ Sunucuda crontab: 0 * * * * find /tmp -name "nbpdf-*" -mmin +60 -exec rm -rf {} +

[ ] SSL otomatik yenileme test edildi
    🖥️ Sunucuda: certbot renew --dry-run
```

---

## 🟡 Güzel Olur — İlk Ay İçinde Yap

```
[ ] Status sayfası (https://status.siteadın.com veya UptimeRobot public page)
[ ] Kullanım analitiği (Google Analytics veya benzeri)
[ ] Hata izleme (Sentry ücretsiz tier — her uygulamada olmalı)
[ ] Kullanıcı geri bildirim mekanizması
[ ] KVKK/GDPR uyum metinleri (Gizlilik Politikası, Kullanım Koşulları)
[ ] İletişim formu veya destek e-postası
[ ] Sosyal medya hesapları (Twitter/X, LinkedIn)
```

---

## ✅ Lansman Günü Prosedürü

> Aşağıdaki komutlar SSH ile sunucuda çalıştırılır (her iki platformda SSH aynıdır).

```bash
# 🖥️ SSH ile sunucuda — Sabah lansman öncesi son kontrol:

echo "=== LANSMAN ÖNCESİ KONTROL ==="

# 1. Servisler:
systemctl is-active nb-api nb-pdf-api nginx postgresql
# Hepsi "active" yazmalı

# 2. Sağlık kontrolleri:
curl -f https://siteadın.com/api/health && echo "Auth API OK"
curl -f http://localhost:8000/ && echo "PDF API OK"

# 3. Disk:
df -h | grep -v tmpfs  # %70 altında olmalı

# 4. Son yedek:
ls -lht /var/backups/nb-pdf-platform/ | head -3  # Bugün alınmış olmalı

# 5. SSL:
echo | openssl s_client -connect siteadın.com:443 2>/dev/null | \
  openssl x509 -noout -enddate

# 6. Tüm kontroller geçtiyse:
echo "✅ LANSMAN'A HAZIR!"
```

---

## ⚠️ Lansman Sonrası İlk Saatler

```
İlk 1 saat (SSH ile sunucuda):
[ ] Logları aktif izle: tail -f /var/log/nb-pdf-platform/api.log
[ ] Hata sayısını izle: her 10 dakikada grep "level\":\"error" api.log | wc -l
[ ] Disk kullanımı normal büyüyor mu? df -h

İlk gün:
[ ] İlk gerçek kullanıcı PDF işledi mi?
[ ] İlk gerçek ödeme geldi mi?
[ ] Herhangi bir beklenmedik hata var mı?

İlk hafta:
[ ] Kullanıcı geri bildirimleri topla
[ ] En çok kullanılan araçları belirle
[ ] Yavaş veya hatalı işlemleri analiz et
```

# İlk Olarak Bozulacak Top 20 Şey

> **Gerçekçi uyarı:** Bu liste deneyimden geliyor. Her madde "bu bana olmaz" derken olan şeylerden oluşuyor. Hazırlıklı olursan çoğu 5 dakikada çözülür — hazırlıksız yakalanırsan saatler kaybedebilirsin.

---

## 🔴 İlk Hafta İçinde Karşılaşacakların

### 1. Disk Dolacak — %100 Kesin

**Ne olur:** Geçici PDF dosyaları birikir. `/tmp` ya da `/var/www` dolar. Her şey durur — API 500 döner, yüklemeler başarısız olur.

**Neden olur:** Başarısız işlemlerde cleanup çalışmaz. Test sırasında büyük dosyalar yüklüyorsun ve unutuyorsun.

**Önlem (şimdi yap):**
```bash
# Her saat geçici dosyaları sil:
crontab -e
0 * * * * find /tmp -name "nbpdf-*" -mmin +60 -exec rm -rf {} + 2>/dev/null
```

**Erken uyarı:** UptimeRobot + disk alarm kurulu olsun. %75 dolduğunda uyarsın.

---

### 2. İyzico Callback URL'i Kayıtlı Değil

**Ne olur:** Kullanıcı ödeme yapar, para çekilir — ama plan PRO'ya geçmez. Kullanıcı sinirle şikayet eder.

**Neden olur:** iyzico merchant panel'de callback URL kaydetmeyi unuttun. Sandbox'ta çalışıyordu çünkü sandbox daha affedici.

**Kontrol:**
```
iyzico merchant panel → Entegrasyon → Callback URL
→ https://siteadın.com/api/payment/callback olmalı
```

**Manuel düzeltme:** Ödeme yapan kullanıcının planını admin panelinden elle güncelle. Sonra callback URL'i kaydet.

---

### 3. SSL Sertifikası — İlk Yenilemede Sorun

**Ne olur:** 90 gün sonra sertifika sona erer. Otomatik yenileme ayarlıysa büyük ihtimalle çalışır — ama certbot dosya yolunu bulamazsa ya da port 80 kapalıysa yenileme başarısız olur. Kullanıcılar "Bağlantınız güvenli değil" hatası görür.

**Önlem:**
```bash
# Şimdi test et:
certbot renew --dry-run
# Hata yoksa sorun yok. Hata varsa düzelt.
```

---

### 4. Email Gönderilemiyor — Gmail Limit

**Ne olur:** Çok kullanıcı kaydolduğunda Gmail günlük email limitine (500/gün) takılırsın. Doğrulama e-postaları gitmez. Kullanıcılar hesabı aktive edemez.

**Çözüm:** İlk kullanıcı artışında transactional email servise geç (Resend, SendGrid — ücretsiz tier var).

---

### 5. JWT Secret Değişti — Tüm Kullanıcılar Çıktı

**Ne olur:** Sunucuyu yeniden kur veya .env'i yenile — JWT secret değişirse tüm aktif oturumlar geçersiz. Kullanıcılar "oturumunuz sona erdi" görür. Tam lansman günü olursa kötü.

**Kural:** JWT secret bir kez üretilince değiştirme. Rotasyon sadece güvenlik olayında yapılır.

---

## 🟠 İlk Ay İçinde Karşılaşacakların

### 6. Büyük PDF — Thread Pool Doldu

**Ne olur:** Birisi 200MB'lık PDF yükler. İşleme 3 dakika sürer. Bu sürede gelen diğer istekler sıraya girer. Thread pool doyarsa yeni istekler 503 alır.

**Kontrol:**
```bash
grep "thread_pool_full\|queue_full" /var/log/nb-pdf-platform/api.log | tail -20
```

**Çözüm:** `PDF_CPU_MAX_IN_FLIGHT` düşür (varsayılan makul bir değer). Dosya boyutu limitini zorla (50MB önerilen).

---

### 7. PostgreSQL Bağlantı Limiti

**Ne olur:** Trafik artınca Prisma connection pool dolabilir. `too many connections` hatası alırsın.

**Belirti:**
```
Error: P2024 - Connection pool timeout
```

**Çözüm:** `DATABASE_URL`'e `?connection_limit=10` ekle. Ya da PgBouncer kur (daha iyi ama başlangıçta gerekmez).

---

### 8. Node.js Memory Leak — Process Çöktü

**Ne olur:** API 24-48 saat sonra yavaşlar, sonra çöker. systemd yeniden başlatır ama kısa süre (30-60 sn) downtime olur.

**Kontrol:**
```bash
# Memory trend:
ps aux | grep node
# RSS kolonu zamanla artıyorsa leak var
```

**Kısa vadeli çözüm:** Haftalık yeniden başlatma cron'u:
```bash
0 4 * * 0 systemctl restart nb-api
```

---

### 9. Rate Limiting Meşru Kullanıcıyı Engelledi

**Ne olur:** Bir kullanıcı VPN arkasında — aynı IP'den gelen tüm kullanıcılar rate limit'e takılır. Ya da ofis ağından çok kişi kullanıyor.

**Belirti:** Kullanıcı "çok fazla istek" hatası alıyor ama kötü niyetli değil.

**Çözüm:** Rate limit eşiklerini kontrol et. Authenticated kullanıcılar için IP yerine user ID bazlı limit kullan.

---

### 10. Frontend Build — Environment Variable Eksik

**Ne olur:** Yeni bir `.env` değişkeni ekledin, frontend'de kullanmak istiyorsun ama `VITE_` prefix'i unuttun. Production build'de `undefined` görünüyor.

**Kural:** Frontend'de kullanılan her değişken `VITE_` ile başlamalı. Build öncesi `web/frontend/.env` dosyasını kontrol et.

---

## 🟡 1-3. Ay İçinde Karşılaşacakların

### 11. İyzico Sandbox → Production Geçişte Fiyat Formatı

**Ne olur:** iyzico üretim ortamı fiyatı farklı formatta bekler. Ondalık ayraç, virgül/nokta farkı. "Geçersiz fiyat" hatası.

**Kontrol:** Üretim test ödemesi yap, logları izle:
```bash
grep "iyzico" /var/log/nb-pdf-platform/api.log | grep "error\|fail" | tail -20
```

---

### 12. Prisma Migration Conflict

**Ne olur:** Geliştirme ortamında schema değiştirdin, migration oluşturdun. Üretimde migration uygularken çakışma oluyor.

**Neden:** Üretim ve geliştirme DB'si farklı state'te.

**Önlem:**
```bash
# Deploy öncesi her zaman:
pg_dump -U postgres nb_pdf_platform | gzip > /var/backups/before-migration-$(date +%Y%m%d).sql.gz
npx prisma migrate deploy  # sadece bu, migrate dev değil
```

---

### 13. Nginx Config Hatası — Site Tamamen Düştü

**Ne olur:** Nginx config'ini düzenledin, `nginx -s reload` yaptın — syntax hatası varsa nginx durur. Site erişilemez.

**Her zaman:**
```bash
nginx -t  # Test et
nginx -s reload  # Sonra reload
```

**Kurtarma:**
```bash
# Son çalışan config'e geri dön:
git checkout /etc/nginx/sites-available/nb-pdf-platform
nginx -t && nginx -s reload
```

---

### 14. Python Dependency Conflict

**Ne olur:** `pip install -r requirements.txt` çakışan versiyonlar bulur. Özellikle `pypdf`, `Pillow`, `reportlab` arasında.

**Önlem:**
```bash
# Her zaman virtual environment kullan
# requirements.txt'te versiyonları pinle: pypdf==4.1.0 değil pypdf>=4.0,<5.0
pip install --dry-run -r requirements.txt  # önce test
```

---

### 15. Google OAuth Redirect URI Mismatch

**Ne olur:** Üretim domain'ini Google Console'a eklemedin. Google ile giriş "redirect_uri_mismatch" hatası verir.

**Kontrol:**
```
Google Cloud Console → APIs → Credentials → OAuth 2.0
→ Authorized redirect URIs: https://siteadın.com/auth/google/callback ekli mi?
```

---

### 16. Cron Çalışmıyor — `crontab` vs `root crontab`

**Ne olur:** `crontab -e` ile kurduğun cron, servis kullanıcısı olarak değil kendi kullanıcın olarak çalışır. `/var/backups`'a yazma izni olmayabilir.

**Kontrol:**
```bash
grep CRON /var/log/syslog | tail -20  # Çalışıyor mu?
ls -la /var/backups/nb-pdf-platform/  # Dosyalar oluşuyor mu?
```

---

### 17. İlk Gerçek DDoS / Bot Scan

**Ne olur:** Site açıldıktan sonra otomatik botlar seni bulur. `/wp-admin`, `/phpmyadmin` gibi URL'leri tarar. Log'lar şişer, disk dolar.

**Kontrol:**
```bash
grep " 404 " /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -20
# Tek IP'den yüzlerce istek var mı?
```

**Hızlı engel:**
```bash
sudo ufw deny from SORUNLU_IP
```

---

### 18. Refresh Token Çalınması — Oturum Hırsızlığı

**Ne olur:** Kullanıcı şikayet ediyor: "Ben çıkmadım ama oturumum kapandı." HttpOnly cookie çalınmış olabilir (XSS?).

**Kontrol:**
```bash
# O kullanıcının refresh token'larına bak:
npx prisma db execute --stdin <<'SQL'
SELECT id, created_at, revoked, user_id FROM refresh_tokens
WHERE user_id = 'kullanici-id' ORDER BY created_at DESC LIMIT 10;
SQL
```

**Hemen:** Tüm token'larını revoke et ve kullanıcıya şifre sıfırla.

---

### 19. Zamanlanmış İşler Çakışıyor

**Ne olur:** Yedek cron'u, cleanup cron'u ve health check cron'u aynı anda çalışır. CPU ani olarak %90'a çıkar. PDF işleme yavaşlar.

**Çözüm:** Cron zamanlamalarını yay:
```
02:00 — Veritabanı yedeği
02:30 — Upload cleanup
03:00 — Log rotation
*/5   — Health check (hafif, sorun değil)
```

---

### 20. "Çalışıyordu, Dokunmadım, Bozuldu"

**Ne olur:** Hiçbir şey yapmadın ama bozuldu. Çoğunlukla neden:
- npm paket otomatik güncellendi (package-lock.json'u commit etmeyi unutursan)
- SSL sertifikası sona erdi
- Disk doldu
- iyzico API versiyonu değişti
- İşletim sistemi güvenlik güncellemesi bir şeyi kırdı

**Kural:** `package-lock.json` ve `requirements.txt` commit'le. `npm ci` kullan (install değil). Sunucu güncellemelerini kontrollü yap.

---

## 📊 Özet: Öncelik Sırası

| # | Problem | Olasılık | Hasar | Çözüm Süresi |
|---|---------|----------|-------|--------------|
| 1 | Disk dolması | %95 | Yüksek | 5 dk (cron) |
| 2 | iyzico callback | %80 | Çok Yüksek | 10 dk |
| 3 | SSL yenileme | %40 | Yüksek | 30 dk |
| 4 | Gmail limiti | %60 | Orta | 2 saat |
| 7 | PostgreSQL bağlantı | %50 | Yüksek | 1 saat |
| 13 | Nginx config hatası | %70 | Çok Yüksek | 5 dk |
| 17 | Bot scan / DDoS | %90 | Orta | 15 dk |

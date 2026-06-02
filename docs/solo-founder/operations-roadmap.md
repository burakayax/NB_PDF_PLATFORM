# Operasyon Yol Haritası — Öncelik Sıralı

> **Bu liste ne kadar büyük olduğunu göstermek için değil, neyi ne zaman yapacağını göstermek için var.** Hepsini aynı anda yapma. Sırayla git.

---

## 🚀 FAZI 0: Lansman Öncesi (Şimdi)

> Bunlar olmadan lansmana geçme. Hepsini bitir.

### Altyapı (1-2 gün)
```
[ ] PostgreSQL kuruldu (SQLite değil)
[ ] Nginx reverse proxy kuruldu (4000/8000 portları kapalı)
[ ] SSL sertifikası kuruldu ve HTTPS yönlendirmesi çalışıyor
[ ] NODE_ENV=production ve tüm üretim env var'ları ayarlandı
[ ] IYZICO_URI=https://api.iyzipay.com (sandbox değil)
```

### Güvenlik (yarım gün)
```
[ ] .env dosyaları git'te yok (git ls-files | grep .env boş)
[ ] JWT secret'ları en az 64 karakter
[ ] Firewall: sadece 22, 80, 443 açık
[ ] iyzico callback URL merchant panelde kayıtlı
```

### Monitoring (yarım gün)
```
[ ] UptimeRobot kuruldu → /api/health için
[ ] Telegram alarmı çalışıyor (disk + API down)
[ ] Geçici dosya temizleme cron'u kuruldu
```

### Test (1 gün)
```
[ ] Kayıt → doğrulama → giriş akışı test edildi
[ ] Üretim ortamında gerçek iyzico ödemesi test edildi
[ ] PDF işleme (merge, split, compress) test edildi
[ ] Şifremi unuttum akışı test edildi
```

**Tahmini süre: 3-4 gün**

---

## 📅 FAZI 1: İlk 2 Hafta (Lansman Sonrası)

> Lansman günü değil, ilk hafta içinde yap.

### Yedekleme Sistemi (1 gün)
```
[ ] Otomatik günlük yedek script'i kuruldu
[ ] İlk yedek alındı ve boyutu kontrol edildi
[ ] Yedek cron'u çalışıyor (0 2 * * *)
[ ] Uzak depolamaya gönderme (Backblaze B2 veya rsync) — opsiyonel ama önerilen
```

### Log Yönetimi (2 saat)
```
[ ] logrotate kuruldu
[ ] Log dizini /var/log/nb-pdf-platform/ oluşturuldu
[ ] API logları JSON formatında yazılıyor
```

### Operasyon Alışkanlıkları (sürekli)
```
[ ] Sabah kontrol rutini başladı (15 dk: disk, log, ödeme, uptime)
[ ] İlk kullanıcılarla iletişim kuruldu
```

**Tahmini süre: 2-3 gün çalışma**

---

## 📅 FAZI 2: İlk Ay

> 100. kullanıcıya ulaşmadan önce bunları bitir.

### Güvenlik Rutin
```
[ ] İlk npm audit ve pip-audit çalıştırıldı
[ ] Dependabot GitHub'da etkinleştirildi
[ ] Admin hesabı kontrol edildi (sadece nbglobalstudio@gmail.com)
[ ] Firewall kuralları tekrar kontrol edildi
```

### Monitoring İyileştirme
```
[ ] Günlük rapor e-postası (veya terminal komutu) rutinleşti
[ ] İlk disk büyüme trendi analiz edildi
[ ] İlk ödeme başarı/hata oranı hesaplandı
```

### Hata Analizi
```
[ ] İlk 1 ay logları incelendi: en sık hata nedir?
[ ] Kullanıcı şikayetleri kategorize edildi
[ ] Düzeltilecekler listesi hazırlandı
```

**Tahmini süre: Ayda 4-6 saat (paralel, lansman sonrası)**

---

## 📅 FAZI 3: 1–3. Ay (100+ Kullanıcı)

> Düzenli kullanıcı tabanı oluşmaya başladığında.

### Ölçekleme Hazırlığı
```
[ ] Thread pool kapasitesi test edildi (yük testi)
[ ] PostgreSQL query analizi yapıldı (pg_stat_statements)
[ ] Node.js memory trend izlendi (leak var mı?)
[ ] Sunucu RAM/CPU yeterliliği değerlendirildi
```

### Email Sistemi
```
[ ] Gmail → Transactional email servise geçildi (Resend/SendGrid ücretsiz tier)
    Sebep: Gmail günlük 500 limit, transactional daha güvenilir
```

### Kullanıcı Analitikleri
```
[ ] Hangi araçlar en çok kullanılıyor? (log analizi)
[ ] Kayıt → Ödeme dönüşüm oranı hesaplandı
[ ] FREE plan limitleri mantıklı mı? (kullanım verisiyle kontrol)
```

### Destek Sistemi
```
[ ] İletişim formu veya destek e-postası aktif
[ ] Sık sorulan sorular listesi hazırlandı
[ ] KVKK/GDPR metinleri yayında (Gizlilik Politikası, Kullanım Koşulları)
```

**Tahmini süre: Ayda 8-12 saat**

---

## 📅 FAZI 4: 3–6. Ay (500+ Kullanıcı)

> Artık "çalıştırma" değil "büyütme" odağı.

### Otomasyonlar
```
[ ] Günlük rapor e-postası otomatik
[ ] Şüpheli aktivite alarmı otomatik
[ ] Yedek doğrulama otomatik (aylık restore testi)
```

### Kapasite Planlama
```
[ ] Sunucu yükseltme ihtiyacı değerlendirildi (1 vCPU → 2 vCPU?)
[ ] CDN ihtiyacı değerlendirildi (statik dosyalar için)
[ ] Database bağlantı pool optimize edildi
```

### Güvenlik Operasyon Rutini
```
[ ] Aylık güvenlik kontrol listesi rutin haline geldi
[ ] SSL otomatik yenileme test edildi (certbot renew --dry-run)
[ ] JWT rotation politikası gözden geçirildi
```

**Tahmini süre: Ayda 12-16 saat**

---

## 📅 FAZI 5: 6–12. Ay (1000+ Kullanıcı)

> Operasyonlar artık ciddi. Otomasyonsuz yönetemezsin.

### Mimari Değerlendirme
```
[ ] Mevcut mimari bottleneck'ler belirlendi
[ ] Ölçekleme yol haritası hazırlandı
[ ] Teknik borç listesi çıkarıldı ve önceliklendirildi
```

### İş Sürekliliği
```
[ ] Disaster recovery drill yapıldı (gerçek restore testi)
[ ] Tüm secrets Bitwarden'da ve güncel
[ ] "Ben olmazsam ne olur?" sorusu cevaplandı (runbook'lar yeterli mi?)
```

### Büyüme Operasyonları
```
[ ] Kullanıcı edinme kanalları analiz edildi
[ ] Churn nedenleri araştırıldı
[ ] Feature roadmap önceliklendirildi (kullanıcı verisiyle)
```

**Tahmini süre: Ayda 20+ saat**

---

## 📊 Özet: Ne Zaman Ne Yapılır?

```
Zaman        Odak                          Araçlar
─────────────────────────────────────────────────────
Şimdi        Güvenli altyapı               SSL, UFW, .env
Lansman      Test et, kullanıcı izle       UptimeRobot, loglar
Hafta 1      Yedekleme + log sistemi       cron, logrotate
Ay 1         Güvenlik rutin                npm audit, admin kontrol
Ay 2-3       Ölçekleme analizi             pg_stat, memory trend
Ay 3-6       Otomasyon                     cron raporlar, alarmlar
Ay 6-12      Mimari değerlendirme          Gerçek veriye dayalı
```

---

## ⚠️ Asla Erteleme Listesi

Bu maddeler "sonra yaparım" denilemez:

```
🔴 SSL sertifikası — Yoksa kullanıcı girmez
🔴 Otomatik yedek — Yoksa veri kaybedersin
🔴 iyzico callback URL — Yoksa para alırsın plan veremezsin
🔴 Firewall — Açık port = açık kapı
🔴 .env git'te değil — Bir kez commit = sonsuza kadar tehlikeli
```

> **Son söz:** Operasyon kodu yazma kadar önemli. Çöken sistem = çöken güven = çöken iş.

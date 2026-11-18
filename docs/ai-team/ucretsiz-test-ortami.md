# Ücretsiz test ortamı seçenekleri (öneri — henüz uygulanmadı)

Karar: ücretli staging şimdilik yok. Aşağıdaki üç ücretsiz yöntem değerlendirildi. Bilgiler 2026-11-18'de Render ve GitHub'ın resmî sayfalarından teyit edildi.

## a) Her PR'da geçici Postgres ile test (GitHub Actions)

- **Durum:** Kısmen var. CI'da zaten "PostgreSQL Migration Check" çalışıyor: geçici bir Postgres ayağa kaldırıp veritabanı güncellemesini deniyor. API testleri ve uçtan uca testler ise hâlâ SQLite ile koşuyor.
- **Maliyet:** 0. Depo herkese açık olduğu için GitHub'ın standart çalıştırıcıları ücretsiz (kullanım ücretsiz hakkınızı düşürmez).
- **Ne sağlar:** Veritabanı uyumsuzluğunu, canlıya çıkmadan, her PR'da yakalar. Canlı veriye hiç dokunmaz.
- **Ne sağlamaz:** Gerçek ödeme sağlayıcısı, e-posta, gerçek PDF dosyaları ve Render ortamı (sunucu ayarları) test edilmez.
- **Yapılacak iş (küçük):** API testlerinin bir kısmını (ödeme/plan/kota) Postgres üzerinde de koşturmak; "PostgreSQL Migration Check"i birleştirme için zorunlu listeye almak.

## b) Render ücretsiz planıyla geçici test kopyası

Render'ın güncel sınırları:

| Konu | Ücretsiz plan |
|---|---|
| Web servisi | 15 dk trafik yoksa uyur; uyanması yaklaşık 1 dk. Aylık 750 saat (çalışma alanı başına). |
| Veritabanı | **30 gün sonra sona erer** (+14 gün bekleme, sonra silinir). 1 GB. **Yedek yok.** Çalışma alanı başına 1 tane. |
| Statik site | Ücretsiz. |
| Disk | Kalıcı disk yok; her kurulumda silinir. |
| Özel (private) servis, arka plan işçisi, cron | **Ücretsiz plan yok.** |

Bizim sistemimize etkisi:
- `nb-gotenberg` özel servis olduğu için **ücretsiz olamaz**. Office dönüştürme testi yapılamaz.
- `nb-pdf-api` büyük (LibreOffice, Tesseract vb. içeriyor); ücretsiz planın küçük belleğine sığması şüpheli. Denemeden "olur" diyemem.
- **Mümkün olan:** giriş/ödeme sunucusu (`nb-auth-api`) + ücretsiz Postgres + statik site. Veritabanı her 30 günde yeniden kurulmalı.
- **Risk:** Ücretsiz kopya aynı Render hesabında durur. Yanlış bir ortam değişkeni (özellikle canlı veritabanı adresi) kopyaya girerse canlı veri bozulabilir. Bu yüzden anahtarlar elle, ayrı ve test değerleriyle girilmeli.
- **Maliyet:** 0 dolar, ama her ay bakım gerekir (30 günlük veritabanı).

## c) Özellik anahtarları (feature flag): kod tabanında var mı?

Var, ama kısmen:

- **Var:** Yönetim panelindeki "Sistem Kontrol" anahtarları (`featureFlags`): ödemeler, yurt dışı ödeme, fatura kesimi vb. açıp kapatabiliyor. Araç bazında "görünür" ve "bakım modu" anahtarı (`ToolRegistry`) var.
- **Yok:** "Yalnızca ben göreyim" (yalnız yönetici görsün) seçeneği. Anahtarlar herkes için açık ya da herkes için kapalı.
- **Yapılacak iş (orta):** Yeni bir özellik için "yalnız yönetici" kitlesi eklemek. Bu, ya ayarlar içinde yeni bir kayıt ya da (şemaya dokunursa) ayrı onay gerektirir.

## Öneri: bizim için en mantıklısı

1. **Hemen (a):** PR başına Postgres testi. Ücretsiz, en büyük riski (canlı veritabanı güncellemesi) kapatıyor.
2. **Sonra (c):** "Yalnız yönetici görsün" anahtarı. Yeni özellikleri canlıda kapalı başlatıp sadece sizin görmenizi sağlar; ayrı ortam kurmadan en gerçekçi deneme budur.
3. **Şimdilik yapmayın (b):** Bakım yükü yüksek, ödeme/PDF kısmını test edemiyor, canlıyla karışma riski var. Gelir başlayınca ücretli, ayrı bir staging daha doğru olur.

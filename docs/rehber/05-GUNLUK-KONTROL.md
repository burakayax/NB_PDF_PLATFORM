# 📅 Günlük Kontrol (Sistemi Tek Başına Yönetme Rehberi)

## Bu belge ne anlatıyor?

Bu belge, sistemi **tek başına** sağlıklı tutmak için her gün, her hafta ve her
ay yapman gereken basit kontrolleri liste halinde verir. Ayrıca bir şey
bozulduğunda **hangi sırayla** kontrol edeceğini adım adım anlatır. Hiç teknik
bilgi gerektirmez — sadece listeyi takip et.

---

## ☀️ Bölüm 1 — Her Gün (2-3 dakika)

Sabah kahveni içerken bunlara bir göz at:

```
GÜNLÜK KONTROL LİSTESİ
[ ] 1. Site açılıyor mu?
       → Tarayıcıda https://pdfplatform.app aç. Ana sayfa geliyor mu?

[ ] 2. Üç servis de "Live" (yeşil) mi?
       → Render.com → dashboard. Üçü de yeşil olmalı:
         nb-pdf-frontend ● Live
         nb-auth-api     ● Live
         nb-pdf-api      ● Live

[ ] 3. Dün gece hata var mı?
       → Render → nb-auth-api → Logs. "Error" / "500" arıyor musun?
       → Render → nb-pdf-api → Logs. Aynı şekilde bak.

[ ] 4. Ödemeler geliyor mu? (gelir varsa)
       → iyzico paneline gir, dünkü ödemeleri kontrol et.
```

> **Çoğu gün hiçbir şey yapmana gerek olmaz.** Üçü yeşilse, site açılıyorsa,
> büyük hata yoksa → her şey yolunda, kapat git.

---

## 📆 Bölüm 2 — Her Hafta (10-15 dakika)

Haftada bir, biraz daha derin bak:

```
HAFTALIK KONTROL LİSTESİ
[ ] 1. Sağlık kontrolü (health check)
       → Tarayıcıda şunları aç, "status: ok" görmeli:
         https://api.pdfplatform.app/api/health
         https://pdf-api.pdfplatform.app/health

[ ] 2. Yeni üye sayısı mantıklı mı?
       → Prisma Studio veya admin panelinden üye sayısına bak.
         Ani düşüş varsa kayıt akışı bozulmuş olabilir.

[ ] 3. Bu hafta tekrar eden bir hata var mı?
       → Render loglarında aynı hatanın tekrar tekrar çıkması
         gizli bir sorun işaretidir. Not al, araştır.

[ ] 4. Disk/bellek doluyor mu?
       → Render → her servis → "Metrics" (Ölçümler) sekmesi.
         Bellek (Memory) sürekli %90+ ise sorun büyüyor demektir.

[ ] 5. E-postalar gidiyor mu?
       → Bir test üyeliği oluştur, doğrulama e-postası geliyor mu kontrol et.

[ ] 6. Yedek alınmış mı?
       → Render → veritabanı → "Backups". Son yedek dünkü olmalı.
```

---

## 🗓️ Bölüm 3 — Her Ay (30 dakika)

Ayda bir, bakım zamanı:

```
AYLIK KONTROL LİSTESİ
[ ] 1. Güvenlik güncellemeleri var mı?
       → Bilgisayarında proje klasöründe çalıştır:
         (aşağıdaki "Güvenlik taraması" kutusuna bak)

[ ] 2. Ödeme sistemi düzgün mü?
       → Küçük bir test ödemesi yap, iade et. Akış sorunsuz mu?

[ ] 3. Faturalar oluşuyor mu?
       → Son ayın ödemelerinde fatura kayıtları var mı? (Prisma Studio → Invoice)

[ ] 4. SSL sertifikası geçerli mi?
       → Tarayıcıda siteyi aç, adres çubuğunda kilit 🔒 simgesi var mı?
         (Render bunu otomatik yeniler ama yine de bak.)

[ ] 5. Eski log/dosya birikmiş mi?
       → PDF API geçici dosyaları 24 saatte otomatik silinir (S3 ayarı).
         Yine de Render disk doluluğuna bir bak.

[ ] 6. Kullanım istatistikleri
       → Hangi araç çok kullanılıyor? Hangi plan satıyor?
         (Admin paneli veya analytics'ten bak.)
```

> **Güvenlik taraması** (bilgisayarında, ayda bir):
> ```
> Windows (PowerShell): cd "web/api"; npm audit
> Mac:                  cd web/api && npm audit
> Linux:                cd web/api && npm audit
> ```
> "found 0 vulnerabilities" görmek istersin. Uyarı çıkarsa
> `npm audit fix` ile çoğu otomatik düzelir.

---

## 🚨 Bölüm 4 — Bir Şey Bozulduğunda Kontrol Sırası

Panik yapma. **Her zaman bu sırayla** ilerle — yukarıdan aşağı:

```
ADIM ADIM ARIZA BULMA SIRASI

1️⃣  SİTE AÇILIYOR MU?
    → https://pdfplatform.app aç.
    → Hiç açılmıyorsa: Render → nb-pdf-frontend "Live" mi?
    → "Failed/Crashed" ise → Logs sekmesine bak.

2️⃣  ÜÇ SERVİS DE YEŞİL Mİ?
    → Render dashboard. Hangisi kırmızı/gri?
    → Kırmızı olan servisin Logs'una bak. Sorun orada.

3️⃣  HANGİ İŞLEM BOZUK?
    → Üyelik mi? Ödeme mi? PDF işleme mi?
    → Üyelik/Ödeme  → nb-auth-api logları
    → PDF işleme    → nb-pdf-api logları
    → Görünüm       → nb-pdf-frontend logları

4️⃣  LOGDA NE YAZIYOR?
    → İlgili servisin Logs sekmesinde "Error/500" satırını bul.
    → 03-LOGLAR.md ile o mesajı çöz.

5️⃣  SON DEĞİŞİKLİK NEYDİ?
    → "Dün/bugün ne değiştirdim?" diye düşün.
    → Yeni kod gönderdiysen ve sonra bozulduysa:
      Render → servis → Manual Deploy → önceki çalışan sürüme dön.

6️⃣  SIK HATALARA BAK
    → 06-SIK-HATALAR.md'de bu sorun var mı?

7️⃣  HÂLÂ ÇÖZÜLMEDİYSE
    → Hata mesajını, ekran görüntüsünü, ne zaman başladığını not al.
    → Render durum sayfasına bak (Render'ın kendisi mi arızalı?):
      https://status.render.com
```

### Hızlı karar şeması

```
Site hiç açılmıyor mu?
   ├─ EVET → Frontend servisi + Render durumu kontrol
   └─ HAYIR (açılıyor ama bir özellik bozuk)
         ├─ Üyelik/giriş sorunu  → Auth API logları
         ├─ PDF işlenmiyor       → PDF API logları
         └─ Ödeme sorunu         → Auth API logları + iyzico paneli
```

---

## 🧰 Bölüm 5 — Acil Durum Çantası (önceden hazırla)

Bir sorun anında elinin altında bulunsun:

```
[ ] Render giriş bilgilerin (kullanıcı + şifre)
[ ] iyzico panel giriş bilgilerin
[ ] GitHub giriş bilgilerin
[ ] Domain (alan adı) sağlayıcı giriş bilgilerin
[ ] DEPLOYMENT.md dosyası (tüm ayarların listesi)
[ ] Bu rehber klasörü (docs/rehber/)
```

> Bunları güvenli bir şifre yöneticisinde (örn. Bitwarden) sakla. Sorun
> anında aramakla vakit kaybetme.

---

## 🧯 Hatırlatma

- **Her gün:** 3 servis yeşil mi, site açık mı, hata var mı? (2 dk)
- **Her hafta:** Sağlık kontrolü, üye sayısı, bellek, yedek. (15 dk)
- **Her ay:** Güvenlik taraması, ödeme testi, SSL, istatistik. (30 dk)
- **Bozulduğunda:** Yukarıdan aşağı sırayla — site → servisler → loglar → son değişiklik.

> Sıradaki rehber: **06-SIK-HATALAR.md** (En sık hatalar ve çözümleri).

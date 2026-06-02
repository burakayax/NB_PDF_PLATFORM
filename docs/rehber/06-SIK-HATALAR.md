# 🔧 Sık Hatalar (En Çok Karşılaşılan Sorunlar ve Çözümleri)

## Bu belge ne anlatıyor?

Bu belge, en sık karşılaşacağın hataları ve her birinin **Türkçe, adım adım
çözümünü** verir. Bir hata mesajı gördüğünde önce bu belgede ara — büyük
ihtimalle cevabı burada. Hiç teknik bilgi gerektirmez.

> **Nasıl kullanılır?** Aşağıdaki başlıklara göz at, yaşadığın duruma en
> yakın olanı bul, çözüm adımlarını sırayla uygula.

---

## 🗂️ Hızlı İndeks

- [A] Yerel test sorunları (kendi bilgisayarında)
- [B] Veritabanı sorunları
- [C] Render / yayına alma sorunları
- [D] Site/kullanım sorunları (canlıda)
- [E] Ödeme sorunları
- [F] E-posta sorunları

---

## [A] Yerel Test Sorunları

### A1. `npm run dev` çalışmıyor / hata veriyor

**Belirti:** Komut çalışınca kırmızı yazılar çıkıyor, servisler açılmıyor.

**Çözüm:**
1. Önce gerekli parçalar kurulu mu? Kurulum komutunu çalıştır:
   ```
   Tüm sistemlerde aynı:  npm run install-all
   ```
2. `.env` dosyaları var mı? Yoksa örnekten kopyala:
   ```
   Windows (PowerShell): Copy-Item web/api/.env.example web/api/.env
   Mac:                  cp web/api/.env.example web/api/.env
   Linux:                cp web/api/.env.example web/api/.env
   ```
3. Tekrar dene: `npm run dev`

### A2. "Port already in use" (Kapı zaten kullanımda)

**Belirti:** `EADDRINUSE` veya `port 4000 is already in use` yazısı.

**Anlamı:** O kapıyı (port) başka bir program kullanıyor — genelde önceki
`npm run dev` düzgün kapanmamış.

**Çözüm:**
1. Tüm terminal pencerelerini kapat.
2. Bilgisayarı kapatıp aç (en garantili yöntem), veya açık kalan işlemi durdur:
   ```
   Windows (PowerShell): Get-Process node | Stop-Process -Force
   Mac:                  killall node
   Linux:                killall node
   ```
3. Tekrar `npm run dev`.

### A3. "command not found: npm" veya "npm tanınmıyor"

**Anlamı:** Node.js (projenin çalışması için gereken temel program) kurulu değil.

**Çözüm:**
1. **https://nodejs.org** adresinden "LTS" sürümünü indir, kur.
2. Terminali kapatıp yeniden aç.
3. Kontrol et: `node -v` → bir sürüm numarası (örn. `v20.11.0`) görmeli.

---

## [B] Veritabanı Sorunları

### B1. `ECONNREFUSED ...:5432` (Veritabanına bağlanılamadı)

**Anlamı:** Sistem veritabanına ulaşamıyor.

**Çözüm (yerel):**
1. `.env` dosyasında `DATABASE_URL` doğru mu kontrol et.
2. Yerel test için SQLite kullanıyorsan tabloları kur:
   ```
   Tüm sistemlerde aynı:  npm run prisma:push --prefix web/api
   ```

**Çözüm (canlı/Render):**
1. Render → nb-auth-api → Environment → `DATABASE_URL` doğru girilmiş mi?
2. Render → veritabanı servisi "Live" (yeşil) mi?

### B2. "Table does not exist" / "column does not exist" (Tablo/sütun yok)

**Anlamı:** Veritabanı yapısı kodla uyuşmuyor — tablolar kurulmamış.

**Çözüm:**
1. Yerelde:
   ```
   Tüm sistemlerde aynı:  npm run prisma:push --prefix web/api
   ```
2. Canlıda: Render yeni kodu yayınlarken bunu otomatik yapar. Olmadıysa
   servisi yeniden deploy et (Render → Manual Deploy).

### B3. Prisma Studio açılmıyor

**Çözüm:**
1. Doğru klasörde misin? Önce `web/api` klasörüne geç:
   ```
   Windows (PowerShell): cd "web/api"; npx prisma studio
   Mac:                  cd web/api && npx prisma studio
   Linux:                cd web/api && npx prisma studio
   ```
2. Tarayıcı otomatik açılmazsa elle git: `http://localhost:5555`

---

## [C] Render / Yayına Alma Sorunları

### C1. Build başarısız (Deploy "Failed" oluyor)

**Belirti:** Render'da servis kırmızı, "Deploy failed" yazıyor.

**Çözüm:**
1. Render → ilgili servis → **Logs** sekmesine bak. Kırmızı satır build'in
   nerede durduğunu söyler.
2. En sık sebep: bir yazım/kod hatası. Aynı build'i yerelde dene:
   ```
   Windows (PowerShell): cd "web/frontend"; npm run build
   Mac:                  cd web/frontend && npm run build
   Linux:                cd web/frontend && npm run build
   ```
3. Yerelde de hata veriyorsa → orada düzelt, GitHub'a gönder, Render otomatik
   tekrar dener.

### C2. Site açılıyor ama "boş/beyaz ekran"

**Anlamı:** Genelde frontend, API adreslerini bulamıyor.

**Çözüm:**
1. Render → nb-pdf-frontend → Environment'ta şunlar doğru mu:
   ```
   VITE_API_BASE          = https://pdf-api.pdfplatform.app
   VITE_SAAS_PROXY_TARGET = https://api.pdfplatform.app
   VITE_PUBLIC_SITE_URL   = https://pdfplatform.app
   ```
2. **Önemli:** `VITE_` ayarları build sırasında gömülür. Değiştirdiysen
   **yeniden deploy** etmelisin (Manual Deploy).

### C3. "Service is not active" / 503 hatası

**Anlamı:** Servis uyumuş veya çökmüş.

**Çözüm:**
1. Render → ilgili servis "Live" mi? Değilse "Manual Deploy" ile uyandır.
2. Ücretsiz plandaysan servisler boştayken uyur (ilk istekte yavaş açılır).
   Sürekli açık kalması için ücretli plana geç.

### C4. Değişikliğim Render'a yansımadı

**Çözüm:**
1. Önce GitHub'a gönderdin mi?
   ```
   Tüm sistemlerde aynı:
      git add .
      git commit -m "Degisiklik"
      git push
   ```
2. Render → servis → "Manual Deploy" → "Deploy latest commit" ile zorla.

---

## [D] Site/Kullanım Sorunları (Canlıda)

### D1. PDF işlenmiyor / "İşlem başarısız" hatası

**Çözüm:**
1. Render → nb-pdf-api → Logs. Hata satırını bul.
2. `Damaged PDF` / `corrupt` görüyorsan → kullanıcının dosyası bozuk, bu
   normal. Sistem doğru davranıyor (çökmedi, sadece reddetti).
3. `wkhtmltopdf not found` görüyorsan → HTML→PDF aracı için sistem programı
   eksik. (Render build'inde kurulu olmalı; `render.yaml`'a bak.)
4. `sandbox` / `timeout` görüyorsan → dosya çok büyük veya işlem çok uzun
   sürdü. Kullanıcıya daha küçük dosya öner.

### D2. Kullanıcı giriş yapamıyor

**Çözüm:**
1. Render → nb-auth-api → Logs. `401` / `unauthorized` satırlarına bak.
2. `JWT_ACCESS_SECRET` veya `JWT_REFRESH_SECRET` ayarları boş/yanlış mı?
3. Çerez sorunu olabilir: `FRONTEND_ORIGIN` ve `CORS_ORIGINS` doğru site
   adresini içeriyor mu?

### D3. "CORS error" (tarayıcı konsolu hatası)

**Anlamı:** Frontend ile API farklı adreslerde ve birbirini "tanımıyor".

**Çözüm:**
1. Render → nb-auth-api → Environment → `CORS_ORIGINS` ve `FRONTEND_ORIGIN`
   tam olarak site adresini içermeli (örn. `https://pdfplatform.app`).
2. Sonunda eğik çizgi (`/`) olmamasına dikkat et.

### D4. Site yavaş açılıyor

**Çözüm:**
1. Ücretsiz Render planı uyuyabilir → ilk açılış yavaştır. Ücretli plana geç.
2. Render → Metrics → bellek/CPU sürekli doluysa → daha güçlü plana yükselt.

---

## [E] Ödeme Sorunları

### E1. Ödeme alınamıyor / "Payment service not configured"

**Anlamı:** iyzico (ödeme sistemi) ayarları eksik.

**Çözüm:**
1. Render → nb-auth-api → Environment'ta şunlar dolu mu:
   ```
   IYZICO_API_KEY     = (iyzico panelinden)
   IYZICO_SECRET_KEY  = (iyzico panelinden)
   IYZICO_URI         = https://api.iyzipay.com
   ```
2. **Çok önemli:** `IYZICO_URI` üretimde `https://api.iyzipay.com` olmalı.
   `sandbox` içeriyorsa test modundadır, gerçek ödeme almaz.

### E2. "iyzico signature mismatch" (imza uyuşmuyor)

**Anlamı:** Ödeme bildiriminin güvenlik kontrolü geçmedi.

**Çözüm:**
1. `IYZICO_SECRET_KEY` doğru mu? (iyzico panelindekiyle birebir aynı olmalı.)
2. Test (sandbox) anahtarıyla üretim (gerçek) anahtarını karıştırmış olabilirsin.
   İkisi farklıdır — üretimde gerçek anahtarları kullan.

### E3. Ödeme oldu ama kullanıcının planı yükselmedi

**Çözüm:**
1. Render → nb-auth-api → Logs. Ödeme callback'i (`/api/payment/callback`)
   geldi mi? `200` mü `500` mü döndü?
2. `500` döndüyse veritabanı yazma hatası olabilir → iyzico bildirimi tekrar
   gönderir, biraz bekle.
3. Prisma Studio → PaymentCheckout tablosunda o ödeme "completed" mı?
4. iyzico panelinde "callback URL" doğru mu:
   `https://api.pdfplatform.app/api/payments/callback`

---

## [F] E-posta Sorunları

### F1. Doğrulama/şifre sıfırlama e-postaları gitmiyor

**Çözüm:**
1. Render → nb-auth-api → Environment → `EMAIL_USER` ve `EMAIL_PASS` dolu mu?
2. Gmail kullanıyorsan: `EMAIL_PASS` normal şifren **değil**, Google'dan
   alınan **16 haneli "Uygulama Şifresi"** olmalı.
   - Google Hesabı → Güvenlik → 2 Adımlı Doğrulama (açık olmalı) →
     Uygulama Şifreleri → yeni oluştur → 16 haneyi kopyala.
3. Spam/Gereksiz klasörünü kontrol et — e-posta oraya düşmüş olabilir.
4. Render → Logs'ta `smtp` veya `send_mail` hatası var mı bak.

---

## 🆘 Hiçbiri İşe Yaramadıysa

Şu bilgileri topla (yardım istediğinde veya araştırırken işine yarar):

```
[ ] Tam hata mesajı (kelimesi kelimesine, kopyala)
[ ] Hangi servis? (frontend / auth-api / pdf-api)
[ ] Ne zaman başladı? (saat / hangi değişiklikten sonra)
[ ] Render Logs'tan ilgili kırmızı satırların ekran görüntüsü
[ ] "Son ne değiştirdim?" — son git push neydi?
```

Sonra şunlara bak:
1. **Render durum sayfası** — Render'ın kendisi mi arızalı? → https://status.render.com
2. **Geri al** — son değişiklikten sonra bozulduysa, Render → Manual Deploy →
   önceki çalışan sürüme dön.
3. **03-LOGLAR.md** — hata mesajını derinlemesine çözmek için.

---

## 🧯 Altın Kurallar (tekrar)

1. **Önce loglara bak** — tahmin yürütme.
2. **Hata mesajını oku** — içinde hep ipucu var (servis + kelime + detay).
3. **Son değişikliği düşün** — "ne değiştirdim de bozuldu?"
4. **Geri alabilirsin** — Render'da önceki sürüme dönmek her zaman mümkün.
5. **Panik yok** — hiçbir hata kalıcı değildir, her şey çözülür.

> Başa dönmek için: **00-BURADAN-BASLA.md** (Ana sayfa).

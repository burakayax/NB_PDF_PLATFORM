# 🚀 Yayına Alma (Projeyi İnternete Açma Rehberi)

## Bu belge ne anlatıyor?

Bu belge, bilgisayarındaki projeyi **internete nasıl açacağını** (yayına
alacağını) sıfır bilgiyle, adım adım anlatır. Render.com (sunucu kiralama
hizmeti) kullanarak projeyi gerçek kullanıcılara açacaksın. Ayrıca "ortam
değişkeni" denen gizli ayarların ne olduğunu ve build (derleme) sırasında
nelere dikkat edeceğini öğreneceksin.

---

## 🧭 Önce büyük resmi anlayalım

Yayına almak şu zinciri çalıştırmaktır:

```
  Bilgisayarın               GitHub                 Render.com
  ───────────                ──────                 ──────────
  Kodu yazdın        →    İnternetteki        →   Render kodu alır,
  (yerel)                 kod deposu              build eder (paketler),
                          (yedeğin)               sunucuda çalıştırır
                                                        ↓
                                                  Kullanıcılar
                                                  siteyi görür 🎉
```

- **GitHub** (kod deposu / kodun internetteki yedeği): Kodunu sakladığın,
  Render'ın oradan okuduğu yer. Google Drive'ın kod için olanı gibi.
- **Render.com** (sunucu kiralama): GitHub'daki kodu alıp internette
  çalıştıran şirket.

> **Neden GitHub gerekli?** Render senin bilgisayarına bakmaz; koda
> GitHub üzerinden ulaşır. Yani önce kod GitHub'a gider, sonra Render alır.

---

## 📦 Bölüm 1 — Ortam Değişkeni (Gizli Ayar) Nedir?

### Basit anlatım

**Ortam değişkeni**, koda yazılmaması gereken gizli bilgidir: şifreler,
ödeme sistemi anahtarları, e-posta parolası gibi. Bunları koda yazarsan
GitHub'a giderler ve herkes görür — çok tehlikeli.

Bunun yerine, bu gizli bilgileri Render'ın **özel kasasına** ayrı ayrı
girersin. Kod "şifreyi kasadan al" der, şifre kodun içinde görünmez.

### Örnek (anlaman için)

```
KÖTÜ (kodun içine yazılmış — herkes görür):
   sifre = "AhmetGizli123"      ← TEHLİKELİ

İYİ (ortam değişkeni olarak kasada):
   Kasada:  JWT_ACCESS_SECRET = AhmetGizli123
   Kodda:   sifre = ortam_degiskeninden_al("JWT_ACCESS_SECRET")
```

### Bu projede hangi gizli ayarlar var?

Tam liste `DEPLOYMENT.md` dosyasında (proje ana klasöründe). En önemlileri:

| Gizli ayarın adı | Ne işe yarar? |
|------------------|---------------|
| `DATABASE_URL` | Veritabanına bağlanma adresi (üye/ödeme deposu) |
| `JWT_ACCESS_SECRET` | Üye girişi güvenlik anahtarı |
| `JWT_REFRESH_SECRET` | Oturum yenileme güvenlik anahtarı |
| `BILLING_ENCRYPTION_KEY` | TC Kimlik gibi hassas verileri şifreleme anahtarı |
| `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` | Ödeme sistemi (iyzico) anahtarları |
| `EMAIL_USER` / `EMAIL_PASS` | E-posta gönderme bilgileri |

> **Güvenlik anahtarı nasıl üretilir?** Bilgisayarında terminal açıp şu komutu
> yazarsın (rastgele güvenli bir anahtar üretir):
>
> Windows (PowerShell): `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
> Mac: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
> Linux: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
>
> Çıkan uzun karışık yazıyı kopyalayıp Render'a yapıştırırsın.

---

## 💰 Bölüm 1.5 — Ücretsiz mi, Ücretli mi? (Önemli)

Kafa karışıklığı genelde "Blueprint ücretli mi?" sorusudur. Net cevap:

- **Blueprint ÜCRETSİZDİR.** Blueprint sadece bir *kurulum yöntemidir* —
  `render.yaml` dosyasını okuyup 3 servisi tek seferde kurar. "Web Service"
  ile elle kurmaktan tek farkı kolaylıktır, fiyatla ilgisi yoktur.
- Ücreti belirleyen tek şey her servisin **plan (paket)** ayarıdır. Bu ayar
  `render.yaml` içinde her servis için yazılıdır.

| Plan | Ücret | Davranış |
|------|-------|----------|
| `free` | **Ücretsiz** | 15 dk işlem olmazsa uyur, sonraki ziyaretçi ~50 sn bekler (cold start) |
| `starter` | ~$7/ay (servis başına) | Hep açık, uyumaz — gerçek yayın için önerilen |

> **Şu an `render.yaml` `free` (ücretsiz) ayarda.** Proje bakım/test
> dönemindeyken para ödemezsin. Şirketi kurup gerçek kullanıcıya açarken
> `render.yaml`'da iki web servisinin `plan: free` satırını `plan: starter`
> yapıp `git push` yapman yeterli — Render otomatik geçirir.

### Ücretsiz dönemde dikkat edilecekler

- **Frontend (vitrin) zaten her zaman ücretsiz** (static site, CDN'den servis).
- **Veritabanı (PostgreSQL) ayrı bir konu.** Render'ın ücretsiz PostgreSQL'i
  bir süre sonra (genelde 30 gün) silinir. Bakım dönemi için ücretsiz bir
  dış sağlayıcı (örn. Supabase / Neon ücretsiz katmanı) `DATABASE_URL` olarak
  kullanılabilir. Gerçek yayında kalıcı (ücretli) bir veritabanına geç.
- **Free plan uyuduğu için** bakım modunda zaten kullanıcı olmayacağından
  cold start sorun değildir.

---

## 🌐 Bölüm 2 — Render.com'da Adım Adım Yayına Alma

### Hazırlık: Önce kodu GitHub'a gönder

1. Bilgisayarında terminal (PowerShell) aç, proje klasörüne gir.
2. Aşağıdaki komutla değişiklikleri GitHub'a gönder.

```
Tüm sistemlerde aynı:
   git add .
   git commit -m "Yayina hazirlik"
   git push
```

> **`git push` ne yapar?** Bilgisayarındaki kodu GitHub'a (internetteki
> depoya) yükler. Render bundan sonra bu güncel kodu görebilir.

---

### Adım Adım Render Kurulumu

1. Tarayıcıda **https://render.com** adresine git ve GitHub hesabınla giriş yap.

2. Sağ üstteki **"New +"** (Yeni) butonuna tıkla, açılan menüden
   **"Blueprint"** seç.
   - **Blueprint nedir?** Projenin tüm parçalarını (3 servis) tek seferde
     kuran hazır tarif. Senin projende `render.yaml` dosyası bu tarifi içerir.

   Şöyle görünür:
   ```
   ┌──────────────────────────────┐
   │  New +                  ▼     │
   │  ├─ Web Service               │
   │  ├─ Static Site               │
   │  ├─ Blueprint   ← BUNU SEÇ    │
   │  └─ ...                       │
   └──────────────────────────────┘
   ```

3. Açılan listede **kendi GitHub depo'nu** (NB_PDF_PLATFORM) seç ve
   **"Connect"** (Bağlan) butonuna tıkla.

4. Render `render.yaml` dosyasını okuyup **3 servisi** otomatik tanır:
   ```
   ✓ nb-pdf-api       (PDF mutfağı — Python)
   ✓ nb-auth-api      (Üyelik/ödeme kasası — Node.js)
   ✓ nb-pdf-frontend  (Vitrin — React)
   ```

5. **"Apply"** (Uygula) butonuna tıkla. Render kurulumu başlatır ama
   henüz çalışmaz — çünkü gizli ayarları (ortam değişkenleri) girmedin.

6. Her servis için **gizli ayarları gir**:
   - Soldaki menüden bir servise tıkla (örn. `nb-auth-api`).
   - **"Environment"** (Ortam) sekmesine git.
   - **"Add Environment Variable"** (Ortam Değişkeni Ekle) ile her bir
     gizli ayarı tek tek gir. `Key` (anahtar adı) ve `Value` (değeri) olarak.

   Şöyle görünür:
   ```
   ┌─────────────────────────────────────────────┐
   │  Environment Variables                       │
   │  ┌──────────────────┬──────────────────────┐ │
   │  │ Key              │ Value                │ │
   │  ├──────────────────┼──────────────────────┤ │
   │  │ JWT_ACCESS_SECRET│ a1b2c3...(uzun yazı) │ │
   │  │ DATABASE_URL     │ postgresql://...     │ │
   │  │ IYZICO_API_KEY   │ (iyzico panelinden)  │ │
   │  └──────────────────┴──────────────────────┘ │
   │  [ + Add Environment Variable ]              │
   └─────────────────────────────────────────────┘
   ```

   > Hangi servise hangi ayarın gireceği `DEPLOYMENT.md` dosyasında tablo
   > halinde yazılı. O tabloyu açık tut, tek tek gir.

7. Tüm gizli ayarları girdikten sonra her servisin **"Manual Deploy"**
   (Elle Yayınla) → **"Deploy latest commit"** (Son kodu yayınla) butonuna bas.

8. Render kodu **build eder** (paketler) ve çalıştırır. Birkaç dakika sürer.
   İşlem bitince servisin durumu **yeşil "Live"** (Canlı) olur.

   Şöyle görünür:
   ```
   nb-auth-api      ● Live      ← yeşil = çalışıyor 🎉
   nb-pdf-api       ● Live
   nb-pdf-frontend  ● Live
   ```

9. **Veritabanını hazırla** (ilk kurulumda bir kez): `nb-auth-api` servisi
   ilk açıldığında veritabanı tablolarını otomatik kurar (build komutunda
   `prisma migrate deploy` var). Bunu sen yapmana gerek yok — otomatiktir.

---

## 🏗️ Bölüm 3 — Build (Derleme) Sırasında Nelere Dikkat?

**Build / Derleme**, kodun sunucuda çalışmaya hazır hale getirilmesidir.
Frontend için bu işi **Vite** (derleme aracı) yapar.

### Yerelde build'i önceden dene (sorun varsa burada gör)

Render'a göndermeden önce, bilgisayarında build'in çalıştığını kontrol et:

```
Windows (PowerShell): cd "web/frontend"; npm run build
Mac:                  cd web/frontend && npm run build
Linux:                cd web/frontend && npm run build
```

- **Başarılıysa** sonunda `✓ built in ...` yazar. Sorun yok.
- **Hata varsa** kırmızı yazılar çıkar — Render'da da aynı hatayı alırsın.
  Önce yerelde düzelt, sonra gönder.

### Vite build'inde en sık dikkat edilecekler

1. **`VITE_` ile başlayan ayarlar build sırasında gömülür.** Yani frontend
   ayarları (`VITE_API_BASE` gibi) build *anında* okunur. Render'da bu
   ayarları **build'den önce** girmiş olmalısın, sonra değil.

2. **Adres ayarları doğru olmalı.** Frontend'in, Auth API ve PDF API'nin
   internet adreslerini bilmesi gerekir:
   ```
   VITE_API_BASE          = https://pdf-api.pdfplatform.app
   VITE_SAAS_PROXY_TARGET = https://api.pdfplatform.app
   VITE_PUBLIC_SITE_URL   = https://pdfplatform.app
   ```
   Bunlar yanlışsa site açılır ama "PDF işlenemedi" gibi hatalar alırsın.

3. **Build uzun sürerse panik yapma.** İlk build 3-5 dakika sürebilir.

---

## ✅ Bölüm 4 — Yayına Almadan Önce Kontrol Listesi

Bu listenin tamamı ✓ olmadan kullanıcılara açma:

```
GÜVENLİK
[ ] Tüm güvenlik anahtarları (JWT_*, BILLING_ENCRYPTION_KEY) en az 64 karakter
[ ] Hiçbir şifre/anahtar kodun içinde yazılı DEĞİL (hepsi Render kasasında)
[ ] IYZICO_URI = https://api.iyzipay.com  (sandbox/test DEĞİL!)

VERİTABANI
[ ] DATABASE_URL bir PostgreSQL adresi (SQLite değil)
[ ] Veritabanı tabloları kurulu (build sırasında otomatik olur)

ADRESLER
[ ] VITE_API_BASE doğru PDF API adresini gösteriyor
[ ] VITE_SAAS_PROXY_TARGET doğru Auth API adresini gösteriyor
[ ] FRONTEND_ORIGIN ve CORS_ORIGINS doğru site adresini içeriyor

ÇALIŞMA
[ ] Üç servis de Render'da "Live" (yeşil)
[ ] Build hatasız tamamlandı

SON KONTROL (yayından sonra)
[ ] Siteyi tarayıcıda açtım, ana sayfa geliyor
[ ] Bir üyelik oluşturdum, e-posta geldi
[ ] Bir PDF işlemi denedim, çalıştı
[ ] (Varsa) test ödemesi yaptım, başarılı oldu
```

> Bu listeyi her yayında baştan uygula. Atlama, bedeli ağır olabilir.

---

## 🔄 Daha sonra güncelleme yapmak istersen

Kodda değişiklik yapıp tekrar yayına almak çok basit:

1. Değişikliği yap.
2. GitHub'a gönder:
   ```
   Tüm sistemlerde aynı:
      git add .
      git commit -m "Degisiklik aciklamasi"
      git push
   ```
3. Render **otomatik algılar** ve yeni kodu kendiliğinden yayınlar.
   (Render → servis → "Auto-Deploy" açıksa elle bir şey yapmana gerek yok.)

---

## 🆘 Bir şey ters giderse

- Build hatası alıyorsan → **03-LOGLAR.md** (Render loglarına bakma)
- Site açılıyor ama çalışmıyorsa → **06-SIK-HATALAR.md**
- Geri almak istersen → Render → servis → "Manual Deploy" →
  önceki çalışan sürümü seç.

> Sıradaki rehber: **02-TEST-ETME.md** (Yayına almadan önce kendi
> bilgisayarında test etme).

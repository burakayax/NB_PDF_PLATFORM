# 📜 Loglar (Sistem Kayıtları ve Hata Günlükleri Rehberi)

## Bu belge ne anlatıyor?

Bu belge, **log** (sistem kaydı) denen şeyin ne olduğunu, neden hayati önemde
olduğunu ve bir sorun çıktığında bu kayıtlara nasıl ulaşıp **hata mesajını
nasıl okuyacağını** sıfır bilgiyle anlatır. Hem Render.com'da hem de kendi
bilgisayarında (terminalde) loglara bakmayı öğreneceksin.

---

## 💡 Bölüm 1 — Log Nedir, Neden Önemlidir?

### Basit anlatım

**Log** (kayıt / günlük), sistemin tuttuğu **not defteridir**. Sistem her
yaptığı işi ve karşılaştığı her hatayı bu deftere yazar:

```
14:32:01  Kullanıcı giriş yaptı: ahmet@ornek.com
14:32:05  PDF birleştirme başladı (3 dosya)
14:32:07  PDF birleştirme bitti, başarılı
14:35:22  HATA: Ödeme başarısız — kart reddedildi
```

### Neden önemli?

Bir şey bozulduğunda, **"neden bozuldu?"** sorusunun cevabı her zaman
loglardadır. Tahmin yürütmek yerine deftere bakarsın:

> Bir hastayı düşün. Sen doktorsun. Loglar = hastanın tahlil sonuçları.
> Tahlile bakmadan "sanırım gribi var" demek tehlikeli. Önce loglara (tahlile)
> bak, sonra karar ver.

### Altın kural

> **Bir sorun olduğunda İLK iş loglara bakmaktır.** Asla "herhalde şu olmuştur"
> diye tahminle başlama. Önce kayıtları oku.

---

## ☁️ Bölüm 2 — Render.com Loglarına Ulaşma

Projen Render'da yayındayken loglar oradadır. Şöyle bakarsın:

1. **https://render.com** adresine git, giriş yap.
2. Sol menüden hangi servisin logunu görmek istiyorsan ona tıkla:
   - `nb-auth-api` → üyelik/ödeme sorunları için
   - `nb-pdf-api` → PDF işleme sorunları için
   - `nb-pdf-frontend` → site açılmıyorsa
3. Üstteki sekmelerden **"Logs"** (Kayıtlar) sekmesine tıkla.
4. Akan canlı kayıtları görürsün. En yenisi en alttadır.

Şöyle görünür:
```
┌──────────────────────────────────────────────────────┐
│  nb-auth-api    [ Events ][ Logs ][ Environment ]     │
│  ──────────────────────────────────────────────────  │
│  16:40:01  Server listening on port 4000              │
│  16:41:33  POST /api/auth/login   200  (başarılı)     │
│  16:42:10  POST /api/payment/...  500  (HATA!)  ← bak │
│  16:42:10  Error: iyzico signature mismatch           │
└──────────────────────────────────────────────────────┘
```

### Logda ne arayacaksın?

- **Yeşil/normal satırlar** = her şey yolunda, geç bunları.
- **`Error`, `HATA`, `Failed`, `500`** içeren satırlar = sorunun olduğu yer.
- **Zaman damgası** (saat) = sorunun ne zaman olduğu. Kullanıcı "şu saatte
  hata aldım" derse, o saate yakın satırlara bak.

> **İpucu:** Render'da log arama kutusu vardır. Oraya `Error` yazıp aratabilir,
> sadece hataları görebilirsin.

### HTTP durum kodları (sayıların anlamı)

Loglarda gördüğün 3 haneli sayılar şunu anlatır:
```
200, 201  →  ✅ Başarılı (işlem oldu)
301, 302  →  ↪️  Yönlendirme (normal)
400       →  ⚠️  Yanlış istek (kullanıcı hatası)
401, 403  →  🔒 Yetkisiz (giriş gerekli / izin yok)
404       →  🔍 Bulunamadı (adres yanlış)
429       →  🚦 Çok fazla istek (yavaşlat)
500       →  🔴 Sunucu hatası (BİZİM hatamız — buna bak!)
503       →  😴 Servis meşgul/kapalı
```

> En çok dikkat edeceğin **500** ve **503**. Bunlar "bizim tarafta bir şey
> ters gitti" demektir.

---

## 💻 Bölüm 3 — Kendi Bilgisayarında (Terminalde) Loglara Bakma

Yerelde test ederken (`npm run dev` çalışırken) loglar **doğrudan terminal
penceresinde** akar. Ayrı bir yere bakmana gerek yok.

```
[pdf]  16:50:01  PDF API çalışıyor
[api]  16:50:02  Auth API çalışıyor
[api]  16:51:10  POST /api/auth/login  200
[pdf]  16:51:45  HATA: PDF okunamadı  ← işte burada
```

- Soldaki **[pdf] / [api] / [ui]** etiketi, hangi servisin konuştuğunu söyler.
- Kırmızı renkli satırlar genelde hatalardır.

### Dosyaya yazılan loglar (Auth API)

Auth API, kayıtları aynı zamanda bir dosyaya da yazar. Bu dosya proje
içindeki `logs/` klasöründedir. İçine bakmak için:

```
Windows (PowerShell): Get-Content web/api/logs/*.log -Tail 50
Mac:                  tail -n 50 web/api/logs/*.log
Linux:                tail -n 50 web/api/logs/*.log
```

> **`-Tail 50` / `tail -50` ne demek?** "Dosyanın son 50 satırını göster."
> En yeni kayıtlar sondadır, o yüzden sonu okuruz.

Canlı (akan) takip için (yeni kayıtlar geldikçe ekrana düşer):
```
Windows (PowerShell): Get-Content web/api/logs/*.log -Wait -Tail 20
Mac:                  tail -f web/api/logs/*.log
Linux:                tail -f web/api/logs/*.log
```
(Durdurmak için **Ctrl + C**.)

---

## 🔬 Bölüm 4 — Hata Mesajını Okumayı Öğrenmek (Örneklerle)

Hata mesajları korkutucu görünür ama bir kalıbı vardır. Üç şeye bak:
**(1) Hangi servis, (2) Hangi anahtar kelime, (3) Hangi detay.**

### Örnek 1

```
[api] Error: connect ECONNREFUSED 127.0.0.1:5432
```
- **Servis:** `[api]` → Auth API.
- **Anahtar kelime:** `ECONNREFUSED` = "bağlantı reddedildi".
- **Detay:** `5432` = veritabanının kapı numarası.
- **Türkçesi:** Auth API veritabanına bağlanamadı.
- **Ne yapmalı:** Veritabanı çalışıyor mu? `DATABASE_URL` doğru mu? → 04-VERITABANI.md

### Örnek 2

```
[pdf] pdf_sandbox_error exc_type=PdfReadError exc=Damaged PDF
```
- **Servis:** `[pdf]` → PDF API.
- **Anahtar kelime:** `PdfReadError` = "PDF okuma hatası".
- **Detay:** `Damaged PDF` = "bozuk PDF".
- **Türkçesi:** Kullanıcı bozuk bir PDF yükledi, işlenemedi.
- **Ne yapmalı:** Bu normal! Sistem bozuk dosyayı reddetti, çökmedi.
  Sadece o istek başarısız oldu. Eylem gerekmez.

### Örnek 3

```
[api] iyzico signature mismatch   POST /api/payment/callback 502
```
- **Servis:** `[api]` → Auth API.
- **Anahtar kelime:** `signature mismatch` = "imza uyuşmuyor".
- **Detay:** Ödeme sistemi (iyzico) güvenlik imzası doğrulanamadı.
- **Türkçesi:** Ödeme bildirimi geldi ama güvenlik kontrolünden geçmedi.
- **Ne yapmalı:** `IYZICO_SECRET_KEY` doğru mu? Sandbox/üretim karışmış olabilir.
  → 06-SIK-HATALAR.md

### Hata okuma kalıbı (ezberle)

```
┌─────────────────────────────────────────────────┐
│  [SERVİS]  anahtar_kelime  =  detay  /  sayı     │
│     ↓            ↓             ↓                  │
│  Nerede?    Ne tür hata?   Tam olarak ne?        │
└─────────────────────────────────────────────────┘
```

### Sık geçen İngilizce hata kelimeleri → Türkçesi

| İngilizce | Türkçe anlamı |
|-----------|---------------|
| `Error` | Hata |
| `Failed` | Başarısız |
| `refused` | Reddedildi |
| `not found` | Bulunamadı |
| `timeout` | Zaman aşımı (çok bekledi) |
| `denied` | İzin verilmedi |
| `invalid` | Geçersiz |
| `missing` | Eksik |
| `already exists` | Zaten var |
| `unauthorized` | Yetkisiz (giriş gerekli) |
| `mismatch` | Uyuşmuyor |
| `damaged` / `corrupt` | Bozuk |

---

## 🧯 Hatırlatma

- Bir sorun → **önce loglara bak**, tahmin yürütme.
- Render'da loglar: servis → **Logs** sekmesi.
- Yerelde loglar: `npm run dev` terminali veya `logs/` klasörü.
- Hata mesajında **servis + anahtar kelime + detay** üçlüsünü oku.
- Çözüm bulamazsan → **06-SIK-HATALAR.md**.

> Sıradaki rehber: **04-VERITABANI.md** (Üye ve ödeme deposunu yönetme).

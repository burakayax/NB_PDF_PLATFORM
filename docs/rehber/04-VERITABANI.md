# 🗄️ Veritabanı (Bilgi Deposu Yönetim Rehberi)

## Bu belge ne anlatıyor?

Bu belge, **veritabanı** (üye, şifre, ödeme gibi bilgilerin saklandığı dijital
arşiv) yönetimini sıfır bilgiyle anlatır. Hangi komutun ne zaman kullanılacağını
(`db push`, `migrate`, `studio`), veritabanını güvenle nasıl sıfırlayacağını ve
Render'daki canlı veritabanına nasıl bağlanacağını öğreneceksin.

---

## 💡 Bölüm 1 — Veritabanı ve Prisma Nedir?

### Veritabanı = Dijital arşiv dolabı

**Veritabanı**, bilgilerin düzenli saklandığı bir arşivdir. Senin projende
şunlar burada tutulur:

```
┌─────────────────────────────────────────┐
│   VERİTABANI (Arşiv Dolabı)              │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  │
│  │ Üyeler  │  │ Ödemeler │  │ Faturalar│ │
│  │ (email, │  │ (plan,   │  │         │  │
│  │  şifre) │  │  tutar)  │  │         │  │
│  └─────────┘  └──────────┘  └─────────┘  │
│  Her "çekmece" bir tablodur.             │
└─────────────────────────────────────────┘
```

> **Tablo nedir?** Excel sayfası gibi düşün: satırlar (her üye bir satır) ve
> sütunlar (email, şifre, kayıt tarihi). Her bilgi türünün kendi tablosu var.

### Prisma = Arşiv görevlisi

**Prisma**, veritabanıyla konuşmanı kolaylaştıran yardımcı programdır. Sen
"şu üyeyi bul" dersin, Prisma gidip arşivden getirir. Komutları hep
`prisma` ile başlar.

### İki tür veritabanı: SQLite ve PostgreSQL

```
SQLite (yerel test için):
   - Tek bir dosya (dev.db). Bilgisayarında durur.
   - Kurulum gerektirmez, hemen çalışır. Test için ideal.

PostgreSQL (canlı/üretim için):
   - Render'da çalışan, güçlü, çok kullanıcılı gerçek veritabanı.
   - Gerçek kullanıcılarla yayında bunu kullanırsın.
```

> Yerelde test ederken SQLite, Render'da yayındayken PostgreSQL kullanılır.
> Sen aynı komutları kullanırsın; sistem hangisini kullanacağını ayarlardan
> (`DATABASE_URL`) bilir.

---

## 🛠️ Bölüm 2 — Hangi Komut Ne Zaman Kullanılır?

Üç temel komut var. Karıştırma diye basit kuralları:

### 1) `prisma db push` — "Hızlı kur" (sadece yerel test)

**Ne zaman?** Yerelde test veritabanını ilk kez kurarken veya hızlıca
güncellerken.

**Ne yapar?** Veritabanı tablolarını şu anki şemaya (plan) göre hızlıca
ayarlar. Kayıt geçmişi tutmaz.

```
Windows (PowerShell): npm run prisma:push --prefix web/api
Mac:                  npm run prisma:push --prefix web/api
Linux:                npm run prisma:push --prefix web/api
```

> ⚠️ Bu komut **sadece yerel/test** içindir. Canlıda kullanma.

### 2) `prisma migrate` — "Kayıtlı değişiklik" (canlı için doğru yöntem)

**Ne zaman?** Veritabanının yapısını değiştirdiğinde (yeni tablo/sütun
eklediğinde). Canlı ortamın doğru yöntemi budur.

**Ne yapar?** Her değişikliği tarihli bir "migration dosyası" olarak kaydeder.
Böylece değişikliklerin geçmişi tutulur ve gerekirse geri alınabilir.

Yeni bir değişiklik kaydı oluşturmak için (değişiklik açıklamasıyla):
```
Windows (PowerShell): npm run prisma:migrate --prefix web/api -- --name degisiklik_aciklamasi
Mac:                  npm run prisma:migrate --prefix web/api -- --name degisiklik_aciklamasi
Linux:                npm run prisma:migrate --prefix web/api -- --name degisiklik_aciklamasi
```

> **Render'da bu otomatik olur.** Sen kod gönderince Render `prisma migrate
> deploy` komutunu kendiliğinden çalıştırır. Canlıda elle bir şey yapmana
> gerek yok.

### 3) `prisma studio` — "Arşivi gözle gör" (içine bak)

**Ne zaman?** Veritabanındaki bilgileri **gözünle görmek**, kontrol etmek
istediğinde. "Kaç üye var? Şu ödeme kaydedildi mi?" gibi.

**Ne yapar?** Tarayıcıda Excel benzeri bir görsel arayüz açar. Tıklayarak
tüm tabloları gezebilirsin.

```
Windows (PowerShell): cd "web/api"; npx prisma studio
Mac:                  cd web/api && npx prisma studio
Linux:                cd web/api && npx prisma studio
```

Çalıştırınca tarayıcıda `http://localhost:5555` otomatik açılır. Şöyle görünür:
```
┌────────────────────────────────────────────┐
│  Prisma Studio                              │
│  ┌──────────┐                               │
│  │ Tablolar │  User (Üyeler)                │
│  │ - User   │  ┌────────────┬─────────────┐ │
│  │ - Payment│  │ email      │ plan        │ │
│  │ - Invoice│  ├────────────┼─────────────┤ │
│  └──────────┘  │ a@b.com    │ FREE        │ │
│                │ c@d.com    │ PRO         │ │
│                └────────────┴─────────────┘ │
└────────────────────────────────────────────┘
```

> Burada elle bilgi düzenleyebilir, silebilirsin. **Dikkatli ol** — yaptığın
> değişiklik gerçektir, geri alınamaz.

### Özet tablo (ezberlemek için)

| Komut | Ne zaman? | Tehlike |
|-------|-----------|---------|
| `db push` | Yerel test kurulumu | Sadece yerel, kayıt tutmaz |
| `migrate` | Kalıcı yapı değişikliği | Canlının doğru yöntemi |
| `studio` | Bilgileri gözle görme | Elle değişiklik kalıcıdır |

---

## 🔄 Bölüm 3 — Veritabanını Sıfırlama / Resetleme

> ⚠️ **ÇOK DİKKAT:** Sıfırlama **TÜM bilgileri siler** — üyeler, ödemeler,
> her şey. Sadece **yerel test** veritabanında ve **yedek aldıktan sonra** yap.
> **Canlı veritabanında ASLA bunu yapma.**

### Ne zaman gerekir?

Sadece yerelde, test verilerin karıştığında "temiz sayfa" istediğinde.

### Nasıl yapılır (yalnızca yerel)

```
Windows (PowerShell): cd "web/api"; npx prisma migrate reset
Mac:                  cd web/api && npx prisma migrate reset
Linux:                cd web/api && npx prisma migrate reset
```

Komut "emin misin?" diye sorar. **Evet** dersen veritabanı boşalır ve
sıfırdan kurulur (plan ayarları otomatik geri yüklenir).

---

## ☁️ Bölüm 4 — Render'daki Canlı Veritabanına Bağlanma

Gerçek kullanıcıların bilgilerini görmek istediğinde Render'daki canlı
veritabanına bağlanırsın.

### Yöntem A: Render panelinden bakma (en kolay)

1. **https://render.com** → giriş yap.
2. Sol menüden veritabanı servisine tıkla (PostgreSQL).
3. **"Info"** veya **"Connect"** sekmesinde bağlantı bilgilerini görürsün.
4. Render'ın kendi **"Shell"** veya bağlantı aracıyla bilgilere bakabilirsin.

### Yöntem B: Prisma Studio ile canlıya bağlanma

Canlı veritabanını kendi bilgisayarındaki Studio ile görsel olarak açabilirsin:

1. Render'dan canlı veritabanının bağlantı adresini (`DATABASE_URL`) kopyala.
   - Render → veritabanı servisi → **"Connect"** → **"External Connection"**
     altındaki uzun adres (`postgresql://...` ile başlar).
2. O adresi geçici olarak kullanarak Studio'yu aç:

```
Windows (PowerShell): cd "web/api"; $env:DATABASE_URL="(render'dan_kopyaladigin_adres)"; npx prisma studio
Mac:                  cd web/api && DATABASE_URL="(render'dan_kopyaladigin_adres)" npx prisma studio
Linux:                cd web/api && DATABASE_URL="(render'dan_kopyaladigin_adres)" npx prisma studio
```

> ⚠️ **Canlı veritabanına bağlandığında çok dikkatli ol.** Burada gördüğün her
> şey gerçek kullanıcıların gerçek bilgisidir. Silme/değiştirme yapma, sadece
> bakmakla yetin.

---

## 💾 Bölüm 5 — Yedekleme (En Önemli Kural)

> **Veritabanını sıfırlamadan, büyük bir değişiklik yapmadan önce MUTLAKA
> yedek al.** Yedek, "geri dönülebilecek bir nokta"dır.

### Render otomatik yedek alır

İyi haber: Render'ın yönetilen PostgreSQL veritabanı **her gün otomatik yedek**
alır. Bir felaket olursa Render panelinden eski bir yedeğe dönebilirsin:

1. Render → veritabanı servisi → **"Backups"** (Yedekler) sekmesi.
2. Bir tarih seç → **"Restore"** (Geri Yükle).

### Yine de kritik işlemden önce manuel yedek

Büyük bir değişiklikten önce o anki halini de yedekle (Render → Backups →
"Create Backup" veya elle dışa aktarma).

---

## 🧯 Hatırlatma

- **Yerel test** kurulumu → `prisma db push`.
- **Kalıcı yapı değişikliği** → `prisma migrate` (canlıda Render otomatik yapar).
- **Bilgileri görme** → `prisma studio`.
- **Sıfırlama** → sadece yerelde, yedekle, canlıda ASLA.
- **Canlıya bağlanınca** → sadece bak, dokunma.
- **Her kritik işlemden önce** → yedek al.

> Sıradaki rehber: **05-GUNLUK-KONTROL.md** (Sistemi düzenli kontrol etme).

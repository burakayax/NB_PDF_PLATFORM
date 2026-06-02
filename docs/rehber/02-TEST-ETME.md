# 🧪 Test Etme (Çalışıyor mu Kontrol Etme Rehberi)

## Bu belge ne anlatıyor?

Bu belge, projeyi **kendi bilgisayarında** (yayına almadan önce) nasıl
çalıştırıp test edeceğini anlatır. "Postman" gibi bir araçla API'nin (program
konuşma dili) çalışıp çalışmadığını nasıl deneyeceğini, neleri baştan sona
kontrol etmen gerektiğini ve hata aldığında nereden başlayacağını öğreneceksin.

---

## 🏠 Bölüm 1 — Projeyi Kendi Bilgisayarında Çalıştırma (Localhost)

**Localhost / Yerel** (kendi bilgisayarın): Projeyi sadece senin görebildiğin
test ortamı. İnternete kapalıdır, kimse göremez, rahatça denersin.

### İlk kurulum (yalnızca bir kez yapılır)

1. Terminal (siyah komut penceresi) aç ve proje klasörüne gir.
2. Tüm gerekli parçaları kuran komutu çalıştır (5-10 dakika sürer):

```
Tüm sistemlerde aynı:
   npm run install-all
```

> **Bu ne yaptı?** Projenin 3 parçası için gereken tüm yardımcı programları
> indirip kurdu. Sadece ilk seferde gerekir; bir daha yapmana gerek yok.

3. Gizli ayar dosyalarını oluştur. Proje, örnek dosyalardan kopya ister:

```
Windows (PowerShell): Copy-Item web/api/.env.example web/api/.env ; Copy-Item web/frontend/.env.example web/frontend/.env
Mac:                  cp web/api/.env.example web/api/.env && cp web/frontend/.env.example web/frontend/.env
Linux:                cp web/api/.env.example web/api/.env && cp web/frontend/.env.example web/frontend/.env
```

> **`.env` dosyası nedir?** Gizli ayarların (şifreler vb.) yerelde tutulduğu
> dosya. `.env.example` örnek şablondur; ondan kopyalayıp `.env` yaparsın.
> Yerelde test için içindeki örnek değerler genelde yeterlidir.

4. Veritabanını hazırla (üye/ödeme deposunun tablolarını kur):

```
Windows (PowerShell): npm run prisma:push --prefix web/api
Mac:                  npm run prisma:push --prefix web/api
Linux:                npm run prisma:push --prefix web/api
```

### Her test için çalıştırma (her seferinde)

Üç servisi de tek komutla aynı anda başlat:

```
Tüm sistemlerde aynı:
   npm run dev
```

Şöyle görünür (üç renk, üç servis aynı anda açılır):
```
[pdf]  PDF API çalışıyor → http://localhost:8000
[api]  Auth API çalışıyor → http://localhost:4000
[ui]   Frontend çalışıyor → http://localhost:5173
```

5. Tarayıcıyı aç ve şu adrese git: **http://localhost:5173**
   - Siten açılırsa 🎉 her şey çalışıyor demektir.

### Durdurmak için

Terminal penceresine tıkla ve klavyeden **Ctrl + C** tuşlarına bas.
(Mac'te de Ctrl + C, Command değil.)

---

## 📮 Bölüm 2 — Postman ile API Testi

### Postman nedir, neden lazım?

**Postman** (API test programı): Frontend'i (vitrin) kullanmadan, doğrudan
"mutfağa" (API) sipariş gönderip cevabını gören ücretsiz bir program. Bir
butonun arkasındaki işlemi tek başına test etmeni sağlar.

> İndirme: **https://www.postman.com/downloads/** (ücretsiz)

### Postman'ı anlamak: Çok basit 4 parça

```
┌─────────────────────────────────────────────────┐
│  1) Metot:  GET / POST    (ne tür istek?)        │
│  2) Adres:  http://localhost:4000/api/health     │
│  3) [Send] butonu          (gönder)              │
│  4) Cevap:  aşağıda görünür (başarılı mı?)       │
└─────────────────────────────────────────────────┘
```

- **GET** = "Bilgi ver" (örn: durumun nasıl?)
- **POST** = "Bir şey yap/gönder" (örn: üye oluştur)

### En kolay test: Sistem ayakta mı? (Health Check)

**Health check** (sağlık kontrolü): Servisin "yaşıyorum" deyip demediğini
soran en basit test.

1. Postman'ı aç, yeni bir istek (request) oluştur.
2. Metodu **GET** yap.
3. Adres kısmına yaz: `http://localhost:4000/api/health`
4. **Send** (Gönder) butonuna bas.
5. Aşağıda şuna benzer bir cevap görmelisin:

```
{
  "status": "ok",
  "service": "nb-pdf-TOOLS-auth-api"
}
```

> `"status": "ok"` görüyorsan **Auth API çalışıyor** demektir. 🎉

6. Aynısını PDF API için de dene:
   - Adres: `http://localhost:8000/health`
   - Cevapta `"status": "ok"` ve kütüphane listesi görürsün.

### Biraz daha ileri: Üye oluşturma testi (POST)

1. Metodu **POST** yap.
2. Adres: `http://localhost:4000/api/auth/register`
3. **Body** (gövde) sekmesine git, **raw** ve **JSON** seç.
4. Şunu yaz (kendi test e-postanı koy):

```json
{
  "email": "test@ornek.com",
  "password": "GucluSifre123!"
}
```

5. **Send** bas.
   - Başarılıysa "üye oluşturuldu, e-postanı doğrula" gibi bir cevap gelir.
   - Hata gelirse cevap mesajı sorunun ne olduğunu söyler.

> **JSON nedir?** Bilgisayarların anlaştığı, süslü parantezli `{ }` yazım
> biçimi. "Anahtar: değer" çiftlerinden oluşur. Yukarıda e-posta ve şifre
> birer anahtar-değer çiftidir.

---

## 📋 Bölüm 3 — Baştan Sona Test Listesi (Neyi Test Etmeliyim?)

Yayına almadan önce şu yolculukları **kendi gözünle** dene. Sıra önemli:

```
1) ANA SAYFA
   [ ] http://localhost:5173 açılıyor mu?
   [ ] Sayfa düzgün görünüyor mu (bozuk değil)?
   [ ] Dil değiştirme (TR/EN) çalışıyor mu?

2) ÜYELİK
   [ ] Yeni üye oluşturabiliyor muyum?
   [ ] Doğrulama e-postası geliyor mu? (yerelde terminale yazılır)
   [ ] Giriş yapabiliyor muyum?
   [ ] Çıkış yapabiliyor muyum?
   [ ] Şifremi unuttum çalışıyor mu?

3) PDF ARAÇLARI (asıl iş)
   [ ] PDF birleştirme çalışıyor mu?
   [ ] PDF sıkıştırma çalışıyor mu?
   [ ] PDF → Word çevirme çalışıyor mu?
   [ ] Sonucu indirebiliyor muyum?
   [ ] Bozuk/garip bir dosya yüklersem hata mesajı düzgün mü?

4) ÖDEME (varsa test modunda)
   [ ] Fiyat sayfası açılıyor mu?
   [ ] Plan seçip ödeme ekranına geçebiliyor muyum?
   [ ] Test ödemesi başarılı oluyor mu?
   [ ] Ödeme sonrası planım yükseldi mi?
   [ ] Ödeme e-postası geldi mi?

5) HESAP YÖNETİMİ
   [ ] Profil bilgilerimi güncelleyebiliyor muyum?
   [ ] Aboneliği iptal edebiliyor muyum?
   [ ] Hesabımı silebiliyor muyum (GDPR)?

6) MOBİL GÖRÜNÜM
   [ ] Tarayıcıyı daraltınca (telefon gibi) sayfa düzgün mü?
```

> **İpucu:** Her yolculuğu en az bir kez baştan sona dene. "Buton var ama
> tıklayınca ne oluyor?" sorusunu hep sor.

---

## 🔍 Bölüm 4 — Hata Aldığımda Ne Yapmalıyım?

Panik yok. Şu sırayı **her zaman** izle:

```
1. HATAYI OKU
   Kırmızı yazı tam olarak ne diyor? Bir cümleyle not al.

2. NEREDE OLDU?
   - Tarayıcıda mı? (sayfa açılmadı/buton çalışmadı)
   - Terminalde mi? (npm run dev penceresinde kırmızı yazı)

3. TERMİNALE BAK
   "npm run dev" çalışan pencerede en alttaki kırmızı satırları oku.
   Genelde sorunun gerçek sebebi oradadır.

4. HANGİ SERVİS?
   Hata [pdf], [api] yoksa [ui] etiketinden hangisinde başladı?
   - [ui]  = Frontend (görünüm) sorunu
   - [api] = Üyelik/ödeme sorunu
   - [pdf] = PDF işleme sorunu

5. SIK HATALARA BAK
   06-SIK-HATALAR.md dosyasında bu hata var mı diye ara.

6. LOGLARA BAK
   Hâlâ çözülmediyse 03-LOGLAR.md ile detaylı kayıtları incele.
```

### Hata okuma örneği (anlaman için)

Diyelim terminalde şunu gördün:
```
[api] Error: connect ECONNREFUSED 127.0.0.1:5432
```

Bunu şöyle çöz:
- `[api]` → Sorun Auth API'de.
- `ECONNREFUSED` → "Bağlantı reddedildi" demek.
- `5432` → Bu PostgreSQL veritabanının kapı numarası.
- **Anlam:** Auth API veritabanına bağlanamadı. Muhtemelen veritabanı
  çalışmıyor veya `DATABASE_URL` ayarı yanlış.
- **Çözüm:** 04-VERITABANI.md'ye bak.

> Hata mesajları korkutucu görünür ama içinde hep ipucu vardır: hangi servis,
> hangi kelime ("refused" = reddedildi, "not found" = bulunamadı,
> "timeout" = zaman aşımı), hangi numara.

---

## ✅ Otomatik Testler (kendiliğinden kontrol)

Proje, kendini otomatik test eden komutlara da sahip. Bunları çalıştırınca
bilgisayar yüzlerce kontrolü senin yerine yapar:

```
Frontend testleri:
Windows (PowerShell): cd "web/frontend"; npm test
Mac:                  cd web/frontend && npm test
Linux:                cd web/frontend && npm test

Auth API testleri:
Windows (PowerShell): cd "web/api"; npm test
Mac:                  cd web/api && npm test
Linux:                cd web/api && npm test

PDF API testleri:
Windows (PowerShell): cd "web/backend"; python -m pytest tests/ -q
Mac:                  cd web/backend && python3 -m pytest tests/ -q
Linux:                cd web/backend && python3 -m pytest tests/ -q
```

- Sonunda **`passed`** (geçti) yazısı çoğunluktaysa her şey yolunda.
- **`failed`** (kaldı) varsa, o testin adı sorunun nerede olduğunu söyler.

> Sıradaki rehber: **03-LOGLAR.md** (Hata kayıtlarını okuma).

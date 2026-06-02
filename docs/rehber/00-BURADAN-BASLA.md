# 📘 Buradan Başla (Başlangıç Rehberi / Ana Sayfa)

## Bu belge ne anlatıyor?

Bu belge, **NB PDF Platform** projesini hiç teknik bilgin olmadan nasıl
yöneteceğini anlatan rehber serisinin **ana sayfasıdır**. Burada her şeyin
nerede olduğunu görür, hangi rehbere ne zaman bakacağını öğrenirsin.

Bu rehber serisi tamamen **sıfır bilgi** varsayılarak yazılmıştır. Hiçbir
teknik kelimeyi açıklamadan kullanmayacağız.

---

## 🧩 Önce şunu anlayalım: Bu proje neden 3 parçadan oluşuyor?

Senin projen tek bir program değil, birlikte çalışan **3 ayrı program**dan
oluşur. Bir restoran gibi düşün:

```
  ┌─────────────────────────────────────────────────────┐
  │  1) FRONTEND (Vitrin / Müşterinin gördüğü yüz)        │
  │     Kullanıcının tarayıcıda gördüğü renkli ekran.    │
  │     Butonlar, menüler, "PDF Birleştir" sayfaları.    │
  └─────────────────────────────────────────────────────┘
                          ↓ konuşur
  ┌─────────────────────────────────────────────────────┐
  │  2) AUTH API (Kasa / Üyelik & Ödeme bölümü)          │
  │     Üye girişi, şifreler, abonelik, ödeme işleri.    │
  └─────────────────────────────────────────────────────┘
                          ↓ konuşur
  ┌─────────────────────────────────────────────────────┐
  │  3) PDF API (Mutfak / Asıl işi yapan bölüm)          │
  │     PDF birleştirme, sıkıştırma, Word'e çevirme.     │
  └─────────────────────────────────────────────────────┘
```

- **Frontend** (ön yüz) = Müşterinin gördüğü vitrin.
- **Auth API** (kimlik sunucusu) = Üyelik ve para işlerinin yapıldığı kasa.
- **PDF API** (PDF sunucusu) = PDF'leri asıl işleyen mutfak.

> **API nedir?** İki programın birbiriyle konuşmasını sağlayan "konuşma dili".
> Garson (frontend) mutfağa (PDF API) "bir PDF birleştir" siparişi verir gibi.

---

## 📚 Hangi rehber ne işe yarıyor?

| # | Rehber | Ne zaman okumalısın? |
|---|--------|----------------------|
| 01 | **Yayına Alma** (`01-YAYINA-ALMA.md`) | Projeyi internete açmak, canlıya almak istediğinde |
| 02 | **Test Etme** (`02-TEST-ETME.md`) | Yayına almadan önce, "çalışıyor mu?" diye kontrol ederken |
| 03 | **Loglar** (`03-LOGLAR.md`) | Bir şey bozulduğunda, "neden bozuldu?" diye bakarken |
| 04 | **Veritabanı** (`04-VERITABANI.md`) | Üye/ödeme bilgilerinin saklandığı yeri yönetirken |
| 05 | **Günlük Kontrol** (`05-GUNLUK-KONTROL.md`) | Her gün/hafta sistemin sağlığını kontrol ederken |
| 06 | **Sık Hatalar** (`06-SIK-HATALAR.md`) | Bir hata mesajı gördüğünde, çözüm ararken |

---

## 🖥️ Bu rehberlerde sık geçecek temel kelimeler

Bunları bir kez öğren, hepsi netleşir:

- **Terminal** (siyah ekranlı komut penceresi): Bilgisayara yazıyla komut
  verdiğin pencere. Windows'ta adı **PowerShell**, Mac/Linux'ta **Terminal**.
- **Komut** (bilgisayara verilen yazılı emir): Terminale yazdığın, Enter'a
  basınca çalışan satır. Örnek: `npm run dev`
- **Render.com** (sunucu kiralama hizmeti): Projeni internette barındıran
  şirket. Senin yerine bilgisayar (sunucu) çalıştırır.
- **Sunucu** (7/24 açık kalan internet bilgisayarı): Projenin internette
  yaşadığı, hiç kapanmayan bilgisayar.
- **Deploy / Yayına alma** (canlıya gönderme): Bilgisayarındaki kodu, gerçek
  kullanıcıların kullanabileceği internet adresine taşımak.
- **Localhost / Yerel** (kendi bilgisayarın): Projeyi sadece senin görebildiğin,
  internete açık olmayan test ortamı. Adresi genelde `localhost:5173` gibidir.
- **Build / Derleme** (paketleme): Kodun, sunucuda çalışmaya hazır hale
  getirilmesi. Çiğ malzemeleri pişirip servise hazır yapmak gibi.
- **Environment Variable / Ortam Değişkeni** (gizli ayar): Şifreler, anahtarlar
  gibi koda yazılmaması gereken gizli bilgiler. (Detayı 01 numaralı rehberde.)
- **Log / Kayıt** (sistem günlüğü): Sistemin "ne yaptım, ne hata aldım" diye
  tuttuğu not defteri. (Detayı 03 numaralı rehberde.)
- **Veritabanı** (bilgi deposu): Üyeler, şifreler, ödemeler gibi bilgilerin
  saklandığı dijital arşiv. (Detayı 04 numaralı rehberde.)

---

## ▶️ İlk kez mi başlıyorsun? Şu sırayı izle:

1. Bu sayfayı (00) sonuna kadar oku — genel resmi gör.
2. **02-TEST-ETME** ile başla — projeyi kendi bilgisayarında çalıştırmayı öğren.
3. Her şey yerelde çalışınca **01-YAYINA-ALMA** ile internete aç.
4. Sorun çıkarsa **03-LOGLAR** ve **06-SIK-HATALAR**'a bak.
5. Yayında kaldıkça **05-GUNLUK-KONTROL** listesini düzenli uygula.

---

## ⚠️ Altın Kurallar (panik yapmadan önce oku)

1. **Hiçbir komut bilgisayarını bozmaz.** Yanlış komut en fazla hata mesajı
   verir, geri alınabilir. Korkma, dene.
2. **Şifreleri asla koda yazma.** Hep "ortam değişkeni" olarak gir (01'de anlatılıyor).
3. **Canlıya almadan önce mutlaka yerelde test et** (02'deki adımlar).
4. **Bir şey bozulunca önce loglara bak** (03), tahmin yürütme.
5. **Yedek almadan veritabanını silme/sıfırlama** (04'te anlatılıyor).

---

> Sıradaki adım: **01-YAYINA-ALMA.md** (Projeyi internete açma rehberi) veya
> önce denemek istiyorsan **02-TEST-ETME.md** (Kendi bilgisayarında test).

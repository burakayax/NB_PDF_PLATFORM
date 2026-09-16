# 09 — Sosyal Medya Otomasyonu

Sitedeki blog beslemesini her gün belirlediğin saatte sosyal medya hesaplarında
paylaşan sistem. Make.com'un yaptığı işi yapar, ek ücret yoktur.

Panelde yeri: **Yönetim Paneli → Büyüme → Sosyal medya**

---

## Nasıl çalışıyor?

1. Her gün seçtiğin saatte sistem site beslemesini okur.
2. Daha önce paylaşılmamış en yeni yazıyı seçer.
3. Yapay zekâ her ağ için ayrı bir gönderi metni yazar (SEO'ya uygun etiketlerle).
4. Yazının markalı kapak görseli gönderiye **ek** olarak iliştirilir.
5. Gönderi yayınlanır ve panelde listelenir.

## Çift dil — üstte İngilizce, altta Türkçe

Gönderiler iki dilli paylaşılır: önce İngilizce bloğu, bir ayıraç, sonra Türkçe
bloğu. Her blok **kendi dilinin sayfasına** bağlanır.

**Çeviri yapılmıyor.** Blog yazılarını zaten iki dilde ayrı ayrı yazıyorsun;
yapay zekâya ikisini birden veriyoruz ve her dil için o dilin kendi gönderi
metnini yazdırıyoruz. Make.com'daki "çeviri gibi duran, sıradan" metin sorunu bu
yüzden oluşmuyor. Etiketler de dile göre ayrışır (`#PDFKırpma` / `#CropPDF`).

**X (Twitter) çift dilli değildir** — 280 karakterde iki dil okunur bir gönderi
çıkmıyor. X'in dili panelden seçilir (varsayılan: İngilizce).

Sıra İngilizce yazı listesinden ilerler; Türkçe karşılık alt bloğu besler. Bir
yazının yalnızca tek dilde karşılığı varsa o gönderi tek dilli paylaşılır.

## Bağlantı gerçekten çalışıyor mu?

Karttaki "bağlı" rozeti yalnızca **dört alanın dolu olduğunu** söyler; anahtarın
ağ tarafından kabul edildiğini söylemez. Bunu öğrenmek için kartı aç ve
**"Bağlantıyı sına"** düğmesine bas. Sınama ağa sorar ve hangi hesaba
bağlandığını söyler (örn. `@pdfplatform`).

Sınama X, Facebook, Instagram ve Pinterest için çalışır (LinkedIn'de erişim
anahtarı alınınca eklenecek). Sınama kimliği doğrular. **Paylaşım yetkisinin kesin kanıtı gerçek bir
gönderidir** — bir taslağı "Şimdi paylaş" ile denemek en güvenli doğrulamadır.
X'te anahtarlar "Read and write" yetkisi verilmeden ÖNCE üretildiyse kimlik
sınaması geçer ama paylaşım reddedilir; bu durumda anahtarları X panelinden
yeniden üret.

## X (Twitter) ücretli hâle geldi

X, Şubat 2026'da ücretsiz katmanı kaldırdı; her istek tek tek ücretlendiriliyor
ve **bakiye sıfırken okuma dahil her şey engelleniyor**.

| İşlem | Yaklaşık ücret |
|---|---|
| Bağlantı sınaması (okuma) | 0,005 $ |
| Düz gönderi | 0,015 $ |
| **Bağlantılı gönderi** | **0,20 $** |

Bizim X gönderilerimiz her zaman yazının bağlantısını taşır, yani gönderi başına
~0,20 $. Günlük paylaşım ayda ~6 $ eder. Diğer dört ağ bu ücretten etkilenmez.

Bakiye bittiğinde sınama "bakiye yüzünden reddetti" der; bunu anahtar hatası
sanma. X'i kullanmak istemiyorsan kartı duraklat, diğer ağlar çalışmaya devam
eder.

## Anahtar kelimeler nereden geliyor?

Etiketleri yapay zekâ **yazmaz** — sistem, doğrulanmış terim listesinden kendisi
üretir. Böylece yazım her gönderide aynı olur ve kısaltmalar büyük harfle
yazılır (`#PDFKesitAlma`, `#ExtractTableFromPDF`).

Terimler iki kaynaktan beslenir:

1. **Sitenin kendi SEO terimleri** — her araç sayfasının hedeflediği gerçek
   arama terimleri ve yazının etiketleri. Ücretsiz, her zaman devrede.
2. **Canlı araştırma** — açıkken yapay zekâ internete bakıp o konuda gerçekten
   kullanılan terimleri doğrular.

Araştırma **yazı başına bir kez** yapılır ve saklanır. Eski bir yazı tekrar
gündeme geldiğinde yeniden araştırma ücreti çıkmaz. Ölçülen maliyet: araştırma
başına yaklaşık 2 kuruş; yeni yazı üretmediğin aylarda sıfıra yakın.

Araştırmayı panelden kapatabilirsin; o zaman yalnızca 1. kaynak kullanılır ve
maliyet tamamen sıfırlanır.

**Önemli:** Metin görselin içine yazılmaz. Metin gönderinin kendi yazı alanına,
görsel ayrı bir ek olarak gider. Bu sayede bağlantı tıklanabilir kalır ve yazı
aramalarda görünür. (Make.com'da yaşanan "yazıyı resim olarak paylaştı" sorunu
bu yüzden burada oluşmaz.)

Her ağ farklı en-boy oranı istediği için yazının kapağı üç ölçüde üretiliyor:

| Ölçü | Nereye gider |
|---|---|
| 1200×630 (yatay) | X, LinkedIn, Facebook |
| 1080×1080 (kare) | Instagram |
| 1000×1500 (dikey) | Pinterest |

---

## Hesapları bağlama

Her ağın erişim anahtarını kendi geliştirici panelinden alıp **Bağla** düğmesine
tıklayarak yapıştırırsın. Anahtarlar şifreli saklanır ve bir daha ekranda
gösterilmez (yalnızca "kayıtlı" yazar). Değiştirmek istersen üzerine yenisini
yazman yeterli.

### X (Twitter)

1. `developer.x.com` → Projects & Apps → uygulama oluştur.
2. Uygulama ayarlarında **User authentication settings** → izinleri
   **Read and write** yap.
3. Keys and tokens sekmesinden şu dördünü al:
   - API Key
   - API Key Secret
   - Access Token
   - Access Token Secret

> Ücretsiz katman ayda ~500 gönderiye izin verir; günde bir paylaşım için yeterli.
> Access Token'ı izinleri "Read and write" yaptıktan **sonra** üretmelisin,
> yoksa paylaşım yetkisiz kalır.

### LinkedIn (şirket sayfası)

1. `linkedin.com/developers` → uygulama oluştur, şirket sayfanı bağla.
2. Products bölümünden **Community Management API** başvurusunu yap.
3. Onay gelince `w_organization_social` yetkili bir access token üret.
4. Şirket sayfanın sayısal kimliğini al (sayfa yönetim adresinde görünür).

### Facebook Sayfası

1. `developers.facebook.com` → uygulama oluştur.
2. Sayfan için **süresiz (long-lived) page access token** üret.
3. Sayfanın sayısal kimliğini al.
4. `pages_manage_posts` ve `pages_read_engagement` izinleri için uygulama
   incelemesinden geçmen gerekir.

### Instagram

1. Instagram hesabın **İşletme** hesabı olmalı ve bir Facebook sayfasına bağlı olmalı.
2. Facebook uygulamasına **Instagram Graph API** ekle.
3. `instagram_content_publish` izni için incelemeden geç.
4. Instagram İşletme Hesabı kimliğini ve bağlı sayfanın erişim anahtarını al.

> Meta'nın (Facebook + Instagram) onay süreci haftalar sürebilir. Sistem hazır
> bekler; onay gelince anahtarı yapıştırman yeterli.

### Pinterest

1. `developers.pinterest.com` → uygulama oluştur, `pins:write` izni iste.
2. Access token üret.
3. Pinlerin ekleneceği panonun kimliğini al.

---

## Günlük ayarlar

| Ayar | Anlamı |
|---|---|
| Otomatik paylaşım | Kapalıyken hiçbir şey kendiliğinden paylaşılmaz. |
| Saat | Her gün bu saatte paylaşılır (seçtiğin saat dilimine göre). |
| Çift dilli paylaş | Kapalıyken yalnızca ana besleme dilinde paylaşılır. |
| X (Twitter) dili | X'te 280 karaktere iki dil sığmaz; yalnız oradaki gönderinin dili. |
| Etiketleri internette araştır | Kapalıyken yalnızca sitenin kendi SEO terimleri kullanılır (ücretsiz). |
| Yeni yazı yoksa eski yazıları tekrar paylaş | Kapalıysa yeni içerik olmayan günlerde hesap sessiz kalır. |

---

## Panelin bölümleri

Ekran üç sekmeden oluşur:

- **Gönderi akışı** — yayın bekleyenler ve geçmiş. Her gönderi, yayına gideceği
  biçimde görünür: metin, karakter sayacı ve görselin gerçek en-boy oranı.
- **Hesaplar** — bağlantı durumları ve erişim anahtarları.
- **Zamanlama** — saat, saat dilimi, içerik dili ve besleme sınaması.

En üstteki durum kartı otomasyonun açık olup olmadığını, bir sonraki paylaşıma
ne kadar kaldığını ve hangi hesaplarda yayınlanacağını gösterir.

## Elle kullanım

- **Taslak hazırla** — bugünün gönderilerini yazdırır ama **yayınlamaz**.
  Taslaklar "Onay bekliyor" olarak durur; sen **Şimdi paylaş** demeden hiçbir
  yere gitmez.
- **Metni düzenle** — taslak ya da başarısız gönderinin metnini değiştirirsin;
  karakter sayacı sınırı aşıp aşmadığını anında gösterir.
- **Beslemeyi sına** — sitenin beslemesinin okunabildiğini doğrular.

---

## Bir şey ters giderse

- Hesap kartında kırmızı **Son hata** satırı çıkarsa, çoğunlukla erişim
  anahtarının süresi dolmuştur — yenisini üretip yapıştır.
- Başarısız gönderi kuyrukta kalır; **Şimdi paylaş** ile yeniden denenebilir.
- Sistem bir gönderiyi en fazla üç kez dener, sonra "Başarısız" işaretler.
- Aynı yazı aynı ağda aynı gün iki kez paylaşılamaz (veritabanı engeller);
  aylar sonra tekrar gündeme gelebilir.
- Gönderim sırasında sunucu yeniden başlarsa kayıt asılı kalmaz: 15 dakika sonra
  kendiliğinden kuyruğa döner.
- "Kayıtlı anahtarlar okunamıyor" uyarısı görürsen sunucunun şifreleme anahtarı
  (`BILLING_ENCRYPTION_KEY`) değişmiş demektir; anahtarları yeniden girmen gerekir.

## Geri alma

Otomasyonu tamamen durdurmak için paneldeki **Otomatik paylaşım** anahtarını
kapatman yeterli. Hesapları da silmek istersen her kartta **Kaldır** düğmesi var.

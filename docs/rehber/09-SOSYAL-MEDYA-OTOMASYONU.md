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

**Metin her ağda AYNI.** Yapay zekâ ağ başına ayrı metin yazmıyor; dil başına
iki uzunluk üretiyor. Uzun metin Facebook, Instagram ve LinkedIn'de aynen
kullanılıyor; kısa metin X ve Pinterest'te. Ağ başına ayrı yazdırmak aynı yazıyı
her ağda başka türlü anlatıyordu — aynı markayı birden çok ağda takip eden kişi
için tutarsız görünüyordu.

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

## Ölçüler ve sınırlar

Her yazı için **üç ayrı kesim** kapak görseli üretiliyor; punto ve kenar
boşlukları kesime göre ölçekleniyor:

| Ağ | Görsel | Metin sınırı | Etiket |
|---|---|---|---|
| X | 1200×630 | 280 | 2 |
| LinkedIn | 1200×630 | 3.000 | 3 |
| Facebook | 1200×630 | 2.200 | 3 |
| Instagram | 1080×1080 | 2.200 | 6 |
| Pinterest | 1000×1500 | 500 | 2 |

Sınırlar ağların 2026'da yayımladığı gerçek değerler. Facebook'un sınırı aslında
63.206 ama metin Instagram ve LinkedIn ile ortak olduğu için en dar sınır
(Instagram 2.200) belirleyici.

X'te bağlantı, gerçek uzunluğu ne olursa olsun **23 karakter** sayılıyor
(t.co kısaltması). Sistem bunu hesaba katıyor; aksi hâlde uzun bir adres
yüzünden boşuna 30+ karakter kaybediliyordu.

## Görsel alternatif metni

Her kapak görseli, yazının başlığını taşıyan bir alternatif metinle gönderiliyor
(`PDF Platform kapak görseli — "…"`). Ekran okuyucu kullanan kişi gönderinin
görselini böylece algılıyor; ağlar da bu metni içeriği anlamak için kullanıyor.

Facebook, Instagram, LinkedIn ve Pinterest'te otomatik ekleniyor. X'te alternatif
metin ayrı bir istek gerektiriyor, henüz eklenmedi.

## Gönderiler yayından önce hazırlanır

Metin ve görsel, paylaşım saatini **beklemeden** üretilir. Saati 09:00 yaptıysan
ve hazırlık süresi 2 saat ise, gönderiler saat 07:00 civarında panelde “Sırada”
olarak belirir ve 09:00'ı bekler.

Bu aralıkta:

- Metni okuyup **düzeltebilirsin** (değişiklik yayına aynen gider).
- Beğenmediğin gönderiyi **silebilirsin** — o gün o ağda paylaşım olmaz.
- İstersen **Şimdi paylaş** deyip erkene alabilirsin.

Süreyi Zamanlama sekmesinden değiştirirsin: 30 dakika ile 1 gün arası. “Tam
yayın anında” seçilirse eski davranışa dönülür — gönderi üretildiği anda gider,
önceden görme şansın olmaz.

Durum kartında hazırlığa ne kadar kaldığı, hazırlık yapıldıysa da “yayın saatini
bekliyor” bilgisi yazar.

## Elle paylaşmak

**Her gönderi kartında** — taslakta, sırada bekleyende ve geçmişte paylaşılmış
olanda — iki düğme her zaman açık: **Metni kopyala** (etiketler ve satır sonları
bozulmadan panoya alır) ve **Görseli indir**. Görsele tıklayıp büyüttüğünde de
indirme düğmesi orada duruyor. İnen dosyanın adı ağ + yazı başlığı oluyor
(`instagram-pdf-birlestirme.jpg`), böylece beş ağın kesimi aynı klasörde
birbirine karışmıyor.

### Bağlı olmayan ağlar da hazırlanıyor

Gönderi **tüm ağlar için** hazırlanır — hesabı bağlı olmayanlar dâhil. Metin
zaten bir kez yazılıyor; değişen tek şey görselin o ağa uygun kesimi. Hesabı
bağlı olmayan ağın gönderisi panelde **"Elle paylaşılacaklar"** başlığı altında
mor bir rozetle durur:

- Otomatik yayına **asla** girmez; oradan hiçbir şey kendiliğinden paylaşılmaz.
- Metnini düzenleyebilir, kopyalayabilir, görselini indirebilirsin.
- Kendi hesabından paylaştıktan sonra **Paylaştım** dersin; kart geçmişe geçer
  ve liste temizlenir.

Sayaç satırındaki **"Elle paylaşılacak"** kutusu kaç gönderinin seni beklediğini
gösterir.

## Bağlantı her ağda aynı görünmez

| Ağ | Bağlantı |
|---|---|
| Facebook, LinkedIn, X | Tam adres — tıklanabilir |
| Instagram | "Bağlantı profilde: pdfplatform.app" |
| Pinterest | Metne yazılmaz; pinin kendi bağlantı alanında gider |

Instagram'ın açıklama metnindeki adresler **tıklanmıyor** (2026'da tıklanabilir
bağlantı yalnızca Meta Verified aboneliği olan küçük bir test grubunda). Tam
adres yazmak 55 karakter harcayıp kullanıcıdan kopyalamasını beklemek olurdu.

**Bu yüzden Instagram profilindeki web sitesi alanını doldurman şart** —
`https://www.pdfplatform.app`. Metin oraya yönlendiriyor; alan boşsa gönderiler
hiçbir yere götürmez.

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
| Saat | Bu saatte paylaşılır (seçtiğin saat dilimine göre). |
| Gönderiler ne kadar önce hazırlansın | Metin ve görsel yayından bu kadar önce üretilip ekranda belirir (varsayılan 2 saat). |
| Paylaşım temposu | Her gün · Gün aşırı · Haftada üç (Pzt/Çar/Cum). |
| Çift dilli paylaş | Kapalıyken yalnızca ana besleme dilinde paylaşılır. |
| X (Twitter) dili | X'te 280 karaktere iki dil sığmaz; yalnız oradaki gönderinin dili. |
| Etiketleri internette araştır | Kapalıyken yalnızca sitenin kendi SEO terimleri kullanılır (ücretsiz). |
| Yeni yazı yoksa eski yazıları tekrar paylaş | Kapalıysa yeni içerik olmayan günlerde hesap sessiz kalır. |

**Tempo neden önemli:** Arşivde 52 yazı var. Her gün paylaşırsan döngü iki ayda
başa döner ve aynı yazı yeniden gelir (metni yeniden üretilir ama kapak görseli
aynıdır). Gün aşırı paylaşmak döngüyü üç buçuk aya çıkarır. Yeni bir hesap için
seyrek tempo ayrıca daha doğal görünür.

Tempo takvimden hesaplanır, sayaç tutulmaz — sunucu yeniden başlasa da ritim
kaymaz. Ayar bozuk ya da eksikse "her gün" sayılır; susmak fazla paylaşmaktan
kötüdür.

---

## Panelin bölümleri

Ekran üç sekmeden oluşur:

- **Gönderi akışı** — yayın bekleyenler, elle paylaşılacaklar ve geçmiş. Her gönderi, yayına gideceği
  biçimde görünür: metin, karakter sayacı ve görselin gerçek en-boy oranı.
- **Hesaplar** — bağlantı durumları ve erişim anahtarları.
- **Zamanlama** — saat, saat dilimi, içerik dili ve besleme sınaması.

En üstteki durum kartı otomasyonun açık olup olmadığını, bir sonraki paylaşıma
ne kadar kaldığını ve hangi hesaplarda yayınlanacağını gösterir.

## Elle kullanım

- **Taslak hazırla** — bugünün gönderilerini yazdırır ama **yayınlamaz**.
  Taslaklar "Onay bekliyor" olarak durur; sen **Şimdi paylaş** demeden hiçbir
  yere gitmez.
- **Paylaştım** — elle attığın bir gönderiyi paylaşıldı olarak işaretler.
- **Metni düzenle** — taslak, elle paylaşılacak ya da başarısız gönderinin
  metnini değiştirirsin;
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

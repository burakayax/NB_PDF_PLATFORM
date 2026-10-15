# Fiyatlandırma

## Fiyatlar nerede tutuluyor?

**Tek bir yerde:** `web/api/src/lib/plan-catalogue.ts`

Ana sayfa kartları, uygulama içi yükseltme ekranı, ödeme sağlayıcısına giden
tutar ve fatura — hepsi bu dosyadan okur. Fiyat değiştirmek istediğinde başka
hiçbir yeri elle değiştirme; ayrışırsa `plan-catalogue.test.ts` derlemede
hata verir ve yayına çıkamaz.

Pro ve Business'ın TL fiyatı ayrıca **yönetim panelinden** değiştirilebilir
(Paketler sekmesi). Panelden girilen değer kataloğun yerine geçer.

## Güncel fiyatlar

TL tutarları **KDV dahildir** — müşteri ne görüyorsa onu öder. Türkiye'de
tüketiciye gösterilen fiyatın vergi dahil olması yasal zorunluluktur.

| Plan | Aylık (TL) | Yıllık (TL) | Aylık (USD) | Yıllık (USD) | Yapay zekâ / ay |
|---|---|---|---|---|---|
| Ücretsiz | — | — | — | — | 0 |
| Başlangıç | 129 ₺ | — | $3.99 | — | 5 |
| Plus | 229 ₺ | 2.292 ₺ | $6.99 | $50.04 | 15 |
| Pro | 399 ₺ | 3.996 ₺ | $11.99 | $90.00 | 40 |
| Business | 1.099 ₺ | 10.992 ₺ | $39.99 | $399.96 | 100 |
| Ek koltuk | 219 ₺ | — | $7.99 | — | — |

**Yıllık ödeme Plus, Pro ve Business'ta vardır.** TL'de yaklaşık 10 ay fiyatına 12
ay (iki ay bedava); yıllık tutarlar 12'ye tam bölünür ki ekrandaki "ayda X" × 12
yıllık tutara eşit çıksın (Plus 191 ×12 = 2.292, Pro 333 ×12 = 3.996, Business
916 ×12 = 10.992). Dolarda Plus ve Pro yıllığı rakip yıllık fiyatlara göre daha
cömert (Plus ayda $4,17, Pro ayda $7,50, Business ayda $33,33). Başlangıç yalnızca aylıktır; ekranda
yıllık seçeneği hiç gösterilmez ve ödeme tarafı yıllık isteği reddeder.

**Fiyat revizyonu (2026-10-15):** TL fiyatlar dolar fiyatının yaklaşık %65-70'ine
çekildi (eskiden ~%50: 99/179/299/799). Pro 399 ₺ kullanıcı kararıdır; sonradan
zam kötü algılanacağı için ödemeler açılmadan önce yapıldı. Ek koltuk ekranda
199 ₺/$5,99 gösterilirken sunucu 159 ₺/$7,99 tahsil ediyordu; artık ikisi de
kataloğa bağlı (219 ₺/$7,99).

Dolar fiyatları yurt dışı müşteriler içindir ve **KDV'siz**dir (ihracat
istisnası): gösterilen tutar ödenen tutardır.

## Bu fiyatlar neye göre belirlendi?

**Maliyet tarafı.** Tek değişken giderimiz yapay zekâ çağrılarıdır; ölçülen en
kötü durum hak başına ~0,035 $. Sunucu tarafı işlemlerin marjinal para maliyeti
yoktur (sabit kapasite).

**Marj tabanı.** Her plan, aylık yapay zekâ hakkının **tamamı** kullanılsa bile
ödeme komisyonu sonrası en az %55 brüt marj bırakır. Bu bir test tarafından her
derlemede doğrulanır — fiyat düşürüp hak artırmak isteyen bir değişiklik
otomatik olarak reddedilir.

**Piyasa tarafı** (Eylül 2026'da ölçüldü):

| Rakip | Aylık | Not |
|---|---|---|
| iLovePDF Premium | $7 (yıllık $4) | Türkiye'de de dolar alıyor, yapay zekâ yok |
| Smallpdf Pro | $15 (yıllık ~$9) | Ekip: $12/kişi |
| Adobe Acrobat Pro | ~$19.99 | |
| ChatPDF (yalnız yapay zekâ) | $19.99 | Tek başına sohbet/özet |

Pro'muz 11,99 $: iLovePDF'in üstünde (bizde yapay zekâ var), yapay zekâ odaklı
rakiplerin belirgin altında.

## Kur riski — düzenli bakılmalı

Yapay zekâ maliyeti **dolar**, TL fiyatları **sabit**. Lira değer kaybettikçe
TL kanalının marjı daralır. Mevcut hak sayıları kur **60 ₺/$** olsa bile %55
marj kalacak şekilde seçildi.

**Kur 60'ın üstüne çıkarsa** TL fiyatları yükseltilmeli ya da yapay zekâ hakları
düşürülmelidir. Test bunu otomatik yakalamaz (kurun kendisi kodda sabit
varsayımdır) — kur hareketini sen takip etmelisin.

## Geçmiş: neyi düzelttik

2026-09-16 öncesinde fiyatlar **dört ayrı yerde** tanımlıydı ve ayrışmışlardı:

- Ana sayfada Pro **249 ₺** görünüyor, ödeme sağlayıcısına **299 ₺ + KDV =
  358,80 ₺** gidiyordu.
- Business'ta 499 ₺ görünüyor, 958,80 ₺ tahsil ediliyordu.
- Dolarla ödeyen biri Business'ta 29,99 $ görüp **250 $** ödüyordu.
- Uygulama içi ekran Business'ı **4,99 $** gösteriyordu (Pro'dan ucuz).
- Sunucuya ulaşılamazsa ekranda hiçbir yerde olmayan **129 ₺** çıkıyordu.

Ödemeler o dönemde kapalı olduğu için **kimse yanlış tutarla ücretlendirilmedi.**

Ayrıca çeviri aracı, belgeyi parçalara bölüp her parça için ayrı yapay zekâ
çağrısı yaptığı hâlde kullanıcıdan yalnızca 1 hak düşüyordu; 200 sayfalık bir
belge aylık abonelik ücretinin katlarına mal olabiliyordu. Artık hak, belge
boyutuyla orantılı düşüyor ve işlem öncesinde kullanıcıya kaç hak tüketeceği
gösteriliyor.

## AI: aylık hak ve kredi (iki cüzdan)

Kullanıcının iki ayrı AI bakiyesi vardır:

| | Aylık hak | Kredi |
|---|---|---|
| Nereden gelir | Plandan (Başlangıç 5, Plus 15, Pro 40, Business 100) | Ek kredi paketlerinden |
| Ne zaman biter | Her ay başında sıfırlanır, devretmez | Süresi dolmaz, sıfırlanmaz |
| Basit araçlar (özet, sohbet, çeviri, veri çıkarma, karşılaştırma, veri gizleme) | Önce bundan düşer | Aylık hak bitince devreye girer |
| Ağır araç (Sözleşme Denetçisi) | **Geçmez** | **Yalnız bundan düşer** |
| Yönetici hesabı | Sınırsız, hiçbir şey düşülmez | Sınırsız, hiçbir şey düşülmez |

İşlem başarısız olursa harcanan hak/kredi iade edilir.

**Sözleşme Denetçisi bedeli:** belge uzunluğuna göre **85–122 kredi** (yaklaşık
50 sayfa ≈ 105). Ölçülen maliyeti tek çalışmada ~2,1 $ (kısa belge); en uzun
belgede ~3 $ tahmin edilir (uzun belge ÖLÇÜLMEDİ). Basit bir araç ~0,035 $.

**Kredi paketleri** (tek kaynak: `plan-catalogue.ts` → `TOPUP_PACKS`):

| Paket | USD | TL (KDV dahil) |
|---|---|---|
| 1 kredi | 0,99 | 29 |
| 5 kredi | 3,49 | 89 |
| 50 kredi | 4,99 | 359 |
| 125 kredi (tek denetimi karşılar) | 10,49 | 759 |
| 150 kredi (popüler) | 11,99 | 869 |
| 500 kredi | 29,99 | 2.299 |

TL fiyatları, USD fiyatının **60 ₺/$ kuruyla ve %20 KDV dahil** karşılığıdır.
Kur ölçümü (2026-10-02, Anthropic bakiye yüklemesi): 20 $ + 4 $ vergi = 24 $ → 1.208 ₺,
yani gerçek kur ~50,3 ₺/$. Vergi geri alınamıyorsa 1 API dolarının maliyeti ~60,4 ₺'dir;
60 ₺/$ varsayımı bu vergiyi de maliyete katar. **Kur 60 ₺/$'ı aşarsa TL paket fiyatları
yükseltilmelidir**; marj %55'in altına iner, ama zarar ancak kur ~150 ₺/$ olunca başlar.
Anthropic'e ödenen %20 vergi KDV olarak geri alınabiliyorsa gerçek marj daha yüksektir
(muhasebecinizle teyit edin). `plan-catalogue.test.ts`, her paketin en uzun
belgede bile en az %55 marj bıraktığını her derlemede doğrular.

**Eski TL paket fiyatları** (149 / 349 / 899 ₺) USD fiyatlarının kabaca yarısıydı (arada 299/629/719/1.899 ₺ denendi, kur 50 varsayıldığı için yetersiz kaldı);
sözleşme denetimi eklenince bu fiyatlarla zarar yazdırdığı için yükseltildi.
Ödemeler o sırada kapalıydı, hiçbir müşteri etkilenmedi.

**Hak bedelini kalibre etme:** her denetim bittiğinde günlüğe yalnızca sayılar
yazılır (`contract-review` / `usage`: karakter sayısı, kredi, token, arama, süre —
belge içeriği asla). Gerçek maliyet bunlardan hesaplanıp `CONTRACT_AUDIT`
sabitleri güncellenebilir.

## Sözleşme Denetçisi: ödeme kuralları, kayıt defteri ve anlaşmazlık (delil)

**Kurallar** (ekrandaki onay penceresinde kullanıcıya aynen gösterilir; sunucu onaysız işlem başlatmaz):

1. Kullanıcı bedeli ve koşulları **açıkça onaylamadan** hiçbir işlem başlamaz. Ekrandaki bedel sunucununkinden farklıysa
   hiçbir şey düşülmeden "bedel güncellendi, yeniden onaylayın" denir.
2. Hak/kredi **işlem başlamadan** düşülür. Sonuç indirilsin ya da indirilmesin, sayfa kapatılsın ya da kullanıcı
   memnun kalmasın **iade edilmez**.
3. Yalnızca **bizim tarafımızdaki** hatada (sonuç üretilemedi, sunucu yeniden başladı) otomatik iade edilir.
   Aynı iş ikinci kez iade edilemez. Son 24 saatte 3 iade alan kullanıcının yeni analizi geçici durdurulur.
4. Yönetici hesabı her şeyden muaftır (hiçbir şey düşülmez, iade de yoktur) ama kayıt tutulur.
5. Ön tarama ücretsizdir ama saatte 5, günde 15 ile sınırlıdır.

**Kayıt defteri** (`contract_review_logs` tablosu): her analiz için onay zamanı, onay metni sürümü, IP, tarayıcı, mod, bedel,
düşüm kaynağı, belge SHA-256 özeti, sonuç durumu, iade zamanı/nedeni, rapor SHA-256 özeti ve imzası. **Belge ve rapor içeriği
saklanmaz.** Kullanıcının raporu/boyalı PDF'i indirmesi, mevcut "İndirme kayıtları"na (`download_logs`) düşer (zaman, IP,
tarayıcı, indirilen dosyanın SHA-256 özeti). Tablo üretimde `prisma db push` ile otomatik oluşur.

**Anlaşmazlık olursa (yönetim paneli → Raporlar → "Sözleşme Denetçisi kayıtları"):**

1. Kullanıcının e-postasına göre satırı bulun; **"Delil → İndir"** düz metin kayıt verir: kim, ne zaman, neyi onayladı (sürüm,
   IP), ne kadar düşüldü, sonuç, iade, hangi dosyayı ne zaman indirdi.
2. Kullanıcı "rapor yanlıştı / siz böyle yazmadınız" derse elindeki PDF'i **"PDF seç ve doğrula"** ile yükleyin. Her dışa aktarılan
   PDF'e imzalı rapor kaydı gömülüdür; doğrulama (a) gömülü içeriğin imzalanan özetle aynı olduğunu, (b) imzanın bizim anahtarımızla
   geçerli olduğunu, (c) kayıt defteriyle eşleştiğini sınar ve **orijinal raporu** gösterir. Kullanıcı sayfaları düzenlediyse
   gördüğü ile orijinal arasındaki fark ortaya çıkar.
3. Dosyada kayıt yoksa (silinmiş ya da başka araçla yeniden kaydedilmiş) dosya bizim çıktımız olarak **doğrulanamaz**.

**Sınırlar (dürüstçe):** İndirme bildirimini kullanıcının tarayıcısı gönderir (engellenebilir); onay, bedel ve rapor imzası ise
sunucu tarafında kesindir. İçerik saklanmadığı için, gömülü kaydı olmayan bir dosyanın "ne yazdığını" kanıtlayamayız. Bunun için
Kullanım Şartları'na "doğrulama kaydı taşımayan/değiştirilmiş dosyalar bizim çıktımız sayılmaz" ve iade koşulları yazılmalıdır
(Türk tüketici mevzuatı açısından bir avukata teyit ettirin).

## Ekrandaki tutar = kartından çekilen tutar (2026-10-15 denetimi)

- **Ödeme özeti penceresi** TL fiyatı KDV'siz sanıp üstüne %20 ekliyordu (Pro 399 ₺ için 478,80 ₺ gösterip
  399 ₺ çekecekti). Artık sunucunun hesabıyla birebir aynı: `web/frontend/src/lib/checkoutQuote.ts`
  (net = fiyat/1,20; iskonto netten düşer; KDV indirimli net üzerine eklenir; Business'ta ek koltuk ve
  yıllık koltuk indirimi dahil; dolar tarafında iskonto artık gerçekten hesaplanıp gösteriliyor).
- **Yönetim paneli fiyatı:** Ana sayfa kartı panelden girilen TL fiyatı gösteriyordu ama ödeme katalogdaki
  fiyatı çekiyordu. Artık ödeme de panel fiyatını kullanır (Pro aylık/yıllık, Business aylık; Business
  yıllığı aylıktan türetilir: ~10 ay, 12'nin tam katı).
- **Kredi paketi ve CV Geçişi:** Ekran para birimini dile göre seçiyordu, sunucu ise fatura ülkesine göre
  tahsil ediyor. Artık sunucu her pakete `chargeCurrency` ekler, ekran onu gösterir.
- Testler: `plan-catalogue.test.ts` (net + KDV = gösterilen tutar), `checkoutQuote.test.ts`.

## Paket sınırları — ekran metni nerede, gerçek kural nerede?

| Ne | Ekran (kart/pencere) | Gerçek kural |
|---|---|---|
| Günlük/aylık işlem, dosya boyutu, toplu işlem | `web/frontend/src/lib/planConfig.ts` | `web/api/src/modules/organization/organization.service.ts` ve `payment.service.ts` içindeki plan varsayılanları + veritabanındaki PlanConfig satırı (panelden değişir) |
| Aylık yapay zekâ hakkı | `lib/aiCredits.ts` | `plan-catalogue.ts` → `AI_MONTHLY_CREDITS` |
| Plana göre kilitli araçlar | `planConfig.ts` → `STARTER_TOOL_IDS` | `subscription.config.ts` → `FREE_TOOLS` / `STARTER_TOOLS` |

Kartlardan **kaldırılanlar:** "Hızlı işlem sırası" ve "Öncelikli sıra" — kuyruk önceliği veritabanında saklanıyor
ama işlemleri sıralayan hiçbir kod yok, yani vaat doğru değildi. Eklenenler: Ücretsiz ve Başlangıç'ta aylık
tavan (30 / 250), Pro'da aylık 1.000 işlem, Business'ta işlem sınırı yok. Pro rozeti "+%25 işlem" yerine
"Ayda 1.000 işlem" (Plus 600 → Pro 1.000 zaten +%67'ydi).

**Canlıda kontrol:** Yönetim → Paket & fiyat'ta kayıtlı plan sınırları kod varsayılanını EZER. Ücretsiz plan dosya
sınırı 80 MB, Başlangıç 100, Plus 250, Pro 500 olmalı. (Eski tohum betiği Ücretsiz için 25 MB ve filigran AÇIK
yazıyordu; düzeltildi ama canlı veritabanı o betikle kurulduysa panelden elle düzeltilmeli.)

## Fiyat değiştirmek istediğinde

0. Yönetim paneli → Paketler sekmesinde Pro/Business TL fiyatı daha önce girildiyse
   katalogun YERİNE geçer; yeni fiyatların görünmesi için panelde kontrol et.
1. `web/api/src/lib/plan-catalogue.ts` içindeki tutarı değiştir.
2. `web/frontend/src/lib/planConfig.ts` içindeki aynı tutarı güncelle
   (sunucuya ulaşılamadığında kullanılan yedek).
3. `npm test --prefix web/api` çalıştır — ayrışma veya marj sorunu varsa
   test söyler.
4. Bu dosyadaki tabloyu güncelle.

## CV Geçişi (tek seferlik, yenilenmeyen)

**Ne?** Abonelik istemeyen biri küçük bir ücret öder; **tüm CV şablonları 24 saat ya da 7 gün açılır**, süre bitince yeniden
kilitlenir. Yenileme yok. Pro/Business aboneler tüm şablonları zaten süresiz kullanır. Ücretsiz katmanda 4 şablon vardır
(Sade, Net, Klasik Serif, Modern Mavi); hangilerinin ücretsiz olduğu `web/frontend/src/components/tools/cv/cvTemplates.tsx`
içinde `free` alanıdır.

**Fiyatlar** (KDV dahil, yer tutucudur — şirket kurulunca ve piyasa bakılınca değiştir):
`web/api/src/lib/plan-catalogue.ts` → `CV_PASSES`: 24 saat = 49 ₺ / 2,99 $; 7 gün = 99 ₺ / 5,99 $. Cihazda çalıştığı için
marjinal maliyeti sıfırdır; fiyat değer bazlıdır. Fiyat değişince `npm test --prefix web/api` çalıştır
(KDV iki kez eklenmesin diye tutar testi vardır).

**Nasıl çalışır?** Kredi paketiyle aynı ödeme hattını kullanır (ayrı bir ödeme sistemi YOKTUR):
`POST /api/payment/cv-pass` → iyzico → callback `User.cvPassUntil` alanını uzatır (kalan süreye **eklenir**).
Plan değişmez, abonelik e-postası ve ekip kurulumu tetiklenmez, terk edilmiş ödeme hatırlatma e-postası gitmez.
Fatura kalemi: "CV Şablon Geçişi (24 saat / 7 gün)". Seçenekler `GET /api/payment/cv-passes` ile sunucudan okunur.

**İade:** `processRefund` CV Geçişi'ni iptal eder (`cvPassUntil = şimdi`) ve **planı FREE'ye düşürmez** (plan hiç değişmemişti).
Aynı düzeltme kredi paketi iadesine de uygulandı (önceden kredi paketi iadesi kullanıcının planını FREE yapıyordu).

**Canlıya alırken:** Ödemeler `paymentsDisabled=false` yapılınca CV Geçişi satın alma düğmesi kendiliğinden açılır
(kapalıyken "Yakında" yazar). Veritabanı alanları (`users.cv_pass_until`, `payment_checkouts.cv_pass_hours`) üretimde
`prisma db push` ile otomatik eklenir. **Açmadan önce iyzico sandbox'ta bir CV Geçişi alıp** (a) tutarın ekrandakiyle aynı
çıktığını, (b) şablonların açıldığını, (c) iadede kilitlendiğini kontrol et. Canlı iyzico akışı henüz denenmedi.
SEO metinlerine ("CV Geçişi ile açılır") ödeme açılınca eklenmelidir; şimdilik yazılmadı.

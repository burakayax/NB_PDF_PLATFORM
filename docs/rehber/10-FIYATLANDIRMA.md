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
| Başlangıç | 99 ₺ | — | $3.99 | — | 5 |
| Plus | 179 ₺ | — | $6.99 | — | 15 |
| Pro | 299 ₺ | 2.990 ₺ | $11.99 | $119.99 | 40 |
| Business | 799 ₺ | 7.990 ₺ | $39.99 | $399.99 | 100 |
| Ek koltuk | 159 ₺ | — | $7.99 | — | — |

**Yıllık ödeme yalnızca Pro ve Business'ta vardır** (10 ay fiyatına 12 ay, iki
ay bedava). Başlangıç ve Plus yalnızca aylıktır; ekranda yıllık seçeneği hiç
gösterilmez ve ödeme tarafı da yıllık isteği reddeder.

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

## Fiyat değiştirmek istediğinde

1. `web/api/src/lib/plan-catalogue.ts` içindeki tutarı değiştir.
2. `web/frontend/src/lib/planConfig.ts` içindeki aynı tutarı güncelle
   (sunucuya ulaşılamadığında kullanılan yedek).
3. `npm test --prefix web/api` çalıştır — ayrışma veya marj sorunu varsa
   test söyler.
4. Bu dosyadaki tabloyu güncelle.

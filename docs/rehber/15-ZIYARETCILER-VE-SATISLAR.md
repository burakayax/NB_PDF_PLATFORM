# Ziyaretçiler ve Satışlar (yönetim paneli)

Panel → **Ziyaretçiler ve satışlar** sekmesi. Siteye kimlerin geldiğini, nereden geldiğini, nerede vazgeçtiğini ve
kimlerin neden satın aldığını (ya da iptal ettiğini) tablolar halinde gösterir. Üstte dönem (7/30/90 gün) ve
**Hepsi / Misafir / Üye** seçimi vardır; her bölümün ayrıca kendi süzgeçleri var.

## Bölümler
1. **Genel sayaçlar:** ziyaretçi, yeni üye, satın alan, ödemeden vazgeçen, iade. Yeni üye / satın alan / iade veritabanından
   **kesin** gelir; ziyaretçi sayısı ölçüm iznine bağlıdır (izin vermeyenler sayılmaz).
2. **Ziyaretçiler nerede kalıyor?** Adım adım kaç kişi (siteye geldi → araç bitirdi → üye olmaya tıkladı → fiyata baktı →
   ödemeye başladı → vazgeçti → satın aldı).
3. **Nereden geliyorlar?** Google, Instagram, ChatGPT… Reklam/paylaşım bağlantısına isim verirseniz o isim de görünür.
4. **Hangi araç ilgi çekiyor?** Hangi araçta iş bitti, hakkı bitti, fiyat ekranı açıldı.
5. **Satın alanlar:** kim, ne aldı, nereden geldi, üye olduktan kaç gün sonra ödedi, ödemeyi hangi araç tetikledi.
6. **Ödemeden vazgeçenler:** hangi planda, hangi adımda bıraktı.
7. **Abonelik iptalleri ve nedenleri:** iptal ederken seçilen neden (isteğe bağlı).
8. **Tek tek ziyaretçiler:** bir satıra tıklayınca o kişinin site içinde yaptıkları sırayla açılır.

Yönetici hesapları (sizin testleriniz) hiçbir sayıya girmez.

## Reklam / paylaşım bağlantılarına isim vermek (neyin işe yaradığını görmek için)
Bağlantının sonuna şunları ekleyin; ziyaretçi o bağlantıdan gelirse ekranda adıyla görünür:

`https://www.pdfplatform.app/?utm_source=instagram&utm_medium=social&utm_campaign=kapak-1`

- `utm_source` = nereden (instagram, facebook, tiktok, newsletter …)
- `utm_medium` = türü (`social` paylaşım, `cpc` ücretli reklam, `email` e-posta)
- `utm_campaign` = sizin verdiğiniz ad (kapak-1, yaz-kampanyasi …)

Google reklamı ve Facebook/Instagram reklamı için isim vermeseniz bile reklam tıklama kimliğinden (gclid / fbclid)
“Google reklamı” ve “Facebook reklamı” olarak ayrılır.

## Sınırlar (dürüstçe)
- Ölçüm yalnızca **çerez/ölçüm iznini** veren ziyaretçiler için çalışır.
- Aynı kişi başka tarayıcıdan/cihazdan gelirse ayrı ziyaretçi sayılır.
- Bir ziyaretçinin “nereden geldiği”, ödeme yapan için **ilk kayıtlı ziyaretinden** okunur; ödemeden önce izin vermediyse “Bilinmiyor” görünür.
- Çok yoğun dönemde hız için en yeni 5.000 ziyaret gösterilir (ekranda uyarı çıkar); dönemi kısaltırsanız hepsi görünür.
- “Ödemeyi ne tetikledi” bir tahmindir: ödemeden önce hakkının bittiği / fiyat ekranını açtığı son araç.

## Teknik not
- Veri: `GET /api/admin/journeys/insights?days=30` (`web/api/src/modules/admin/journey/insights.service.ts`).
- Yeni alanlar: `PageView.utm_source/medium/campaign`, yeni tablo `cancellation_feedback`. Üretimde `prisma db push`
  (render.yaml) ile kendiliğinden oluşur; her iki şemaya da (`schema.prisma`, `schema.postgres.prisma`) eklendi.
- İptal nedeni formu: Profil → Aboneliği iptal et. Sunucu: `subscription.controller.ts` → `CANCEL_REASONS`.

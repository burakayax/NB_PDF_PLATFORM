# Facebook otomasyonu (2026-10-20)

## Gönderi kuralları (kodda uygulanan — 2026-11-24 güncellemesi)
- Yalnız Türkçe. Ana metinde bağlantı yok. "Link ilk yorumda 👇" yalnız her 4. gönderide; yalnız o gönderide ilk yoruma bağlantı eklenir.
- Biçimler 5'li döngüde: kısa ipucu, 3 maddelik liste, önce/sonra, sık yapılan hata, mini hikâye (komşu iki gönderi aynı biçimde olmaz).
- İlk satır kanca, 60–120 kelime. Soruyla bitmek zorunda değil; son 200 gönderide kullanılmış kapanış sorusu tekrar edilmez. Elle yazılanlar: `sosyal medya/kullanilan-kapanis-sorulari.txt`.
- En fazla 3 etiket, yalnız gönderinin konusundan. Görselsiz gönderi atlanır (her gönderide görsel).
- Günde en fazla 1, 7 günde en fazla 5 Facebook gönderisi (aşılırsa panelde "atlandı" nedeni görünür).
- Saatler (Europe/Istanbul): normal gönderi 12:03–13:57, Reels 19:03–20:57.
- Son 30 Facebook gönderisine çok benzeyen metin TASLAK kalır (panelde görülür).
- Haftalık içerik paketi (3 Reels senaryosu + 4 grup metni): `sosyal medya/haftalik-icerik/`. Gruplara katılma/paylaşma otomatikleştirilmez.

## Geri alma (eski kalıp)
`facebook-kind.ts` içinde `facebookWithLink` her zaman `true` döndürürse ve `social.types.ts` FACEBOOK `hashtagCount: 4` yapılırsa eski davranış gelir.

## Yorum yanıt taslakları
- Her 2 saatte bir kendi sayfamızdaki gönderilerin yorumları taranır; spam/emoji/tek kelime elenir.
- Gerçek soru/yorum için yapay zekâ kısa bir taslak yazar. Soru "nasıl yapılır / nerede" ise adres eklenir.
- OTOMATİK GİTMEZ: `GET /api/social/facebook/reply-drafts` ile listelenir, `POST .../:id/approve` (isteğe bağlı `{ "text": "düzenlenmiş" }`) ya da `.../reject`.
- Başka sayfalara/gruplara yorum yazan hiçbir kod yoktur.

## Haftalık rapor
- Pazartesi 09:00'dan sonra bir kez üretilir; `GET /api/social/facebook/report`, elle: `POST /api/social/facebook/report/run`.
- Graph API ölçüm adları sık değişir: alınamayan ölçüm "ölçülemedi" diye yazılır, uydurulmaz.

## Gerekli Facebook izinleri (sayfa erişim anahtarında)
`pages_manage_posts`, `pages_manage_engagement` (yorum yazma), `pages_read_engagement` ve `pages_read_user_content` (yorum okuma), `read_insights` (rapor). Eksikse ilgili adım günlüğe uyarı düşer, paylaşım etkilenmez.

## Geri alma
Facebook'u eski haline (çift dil, bağlantı metinde) döndürmek için `social.types.ts` içindeki FACEBOOK künyesinde `bilingual: true`, `linkStyle: "url"` yapılır.

## "Biz kimiz" gönderisi (sabitlenecek — elle paylaşılır)

> PDF'le uğraşırken zaman kaybetmek zorunda değilsin.
>
> PDF Platform ile PDF'lerini tarayıcından birleştirebilir, sıkıştırabilir, Word ve Excel'e dönüştürebilir, düzenleyebilir ve sayfalarını ayırabilirsin. Program kurmak yok, bekleme yok.
>
> Birleştirme, bölme, döndürme gibi işlemler dosyan cihazından hiç çıkmadan yapılır.
>
> Link ilk yorumda 👇
>
> En çok hangi PDF işi canını sıkıyor?
>
> #PDF #PDFBirleştir #PDFSıkıştır #Verimlilik

İlk yorum: `Ücretsiz denemek için 👉 https://pdfplatform.app`

NOT: "Dosyan cihazından çıkmaz" iddiası yalnız cihazda çalışan araçlar için doğrudur (birleştir, böl, döndür, sil, düzenle, görselden PDF). Sıkıştır/dönüştür sunucuda çalışır; metni yayımlamadan önce kontrol et.

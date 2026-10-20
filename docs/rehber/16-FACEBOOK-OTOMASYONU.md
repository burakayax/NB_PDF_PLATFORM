# Facebook otomasyonu (2026-10-20)

## Gönderi kuralları (kodda uygulanan)
- Yalnız Türkçe. Ana metinde bağlantı yok; "Link ilk yorumda 👇" yazar, bağlantı yayından hemen sonra sayfa adına ilk yorum olarak eklenir.
- İlk satır kanca (en fazla 10–12 kelime), 60–120 kelime, sonda gerçek soru, etkileşim dilenen ifade yok.
- 3–5 etiket, yalnız gönderinin konusundan (genel havuz ve marka etiketi yok).
- Saatler (Europe/Istanbul, otomatik turda): normal gönderi 12:03–12:57, Reels 20:03–21:57; dakika her seferinde rastgele.
- İçerik karışımı: blog hattı 7'lik döngü (4 ipucu, 2 sorun→çözüm, 1 etkileşim); demo payını araç videoları doldurur (`toolReelEveryDays` ayarı).
- Zaman zaman 3–5 kartlık çoklu görsel (yazıların yaklaşık üçte biri).
- Son 30 Facebook gönderisine çok benzeyen metin TASLAK kalır (panelde görülür).

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

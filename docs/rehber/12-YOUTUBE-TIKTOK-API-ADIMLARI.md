# 12 — YouTube Shorts ve TikTok'a otomatik video paylaşımı (araştırma + adımlar)

Tarih: 2026-10-08. Amaç: Reels için üretilen dikey videoyu YouTube Shorts ve TikTok'ta da paylaşmak.
Bu belge yalnızca kaynaklara dayanan bilgileri içerir; doğrulanamayan yerler "bilinmiyor" diye işaretlidir.

## Bulgular (kaynaklı)

### YouTube
- Yükleme `videos.insert` ile yapılır, izin kapsamı `youtube.upload`. Shorts için ayrı uç yok: dikey/kare ve en çok 3 dakikalık video otomatik Shorts sayılır.
- Varsayılan kota: günde 100 `videos.insert`; bir çağrı 1 puan.
- **Kritik:** 28 Temmuz 2020'den sonra oluşturulan, denetimden geçmemiş API projelerinden yüklenen videolar `public` istense bile **özel (private) kilitlenir**; zamanlama da işlemez. Kaldırmak için "YouTube API Services audit and quota extension form" doldurulur ve Google denetimi geçilir. Süre belirtilmemiş.
- Kaynaklar: developers.google.com/youtube/v3/determine_quota_cost, upload-post.com/youtube-api

### TikTok
- Content Posting API. Kapsam `video.publish`; uygulama VE hesap sahibi onaylı olmalı. Yükleme: dosya (MP4, H.264) ya da `PULL_FROM_URL` (alan adı doğrulaması şart).
- **Kritik:** Denetimsiz uygulamanın tüm paylaşımları **yalnızca ben görebilirim (SELF_ONLY)**; 24 saatte en çok 5 hesap. Denetim 2–4 hafta sürer, birkaç tur geri bildirim olur; demo videosu şart.
- Denetimde sık reddedilme: yazı/gizlilik/etkileşim ayarlarını kullanıcıya onaylatmama, `creator_info` çağrısını yapmama, devre dışı özellikleri (duet vb.) gösterme, gizlilik/şartlar sayfası eksikliği.
- Kaynaklar: developers.tiktok.com/doc/content-posting-api-get-started, bundle.social/blog/tiktok-api-approval

### Bilinmiyor (kaynakta bulunamadı)
- Yalnız kendi hesabına otomatik paylaşan "dahili" bir uygulamanın TikTok denetiminde kabul edilip edilmediği.
- Google denetiminin süresi ve şirketsiz (kişisel) başvuruların kabulü.

## Sizin yapacağınız adımlar

### YouTube (KOD HAZIR — panelde "YouTube (Shorts)" kartı var)
Resmi başlangıç sayfası: https://developers.google.com/youtube/data/getting-started?hl=tr

1. Paylaşım yapılacak YouTube kanalını aç (marka hesabı önerilir).
2. console.cloud.google.com → yeni proje → "API'ler ve Hizmetler" → "Kitaplık" → **YouTube Data API v3** → Etkinleştir.
3. "OAuth izin ekranı": Kullanıcı türü **Harici**; uygulama adı, destek e-postası, gizlilik politikası (https://www.pdfplatform.app/privacy). İzinler (scope): `youtube.upload` ve `youtube.readonly`.
4. **ÖNEMLİ:** İzin ekranında yayın durumunu **"Üretimde" (In production)** yap. "Test" durumunda kalırsa yenileme anahtarı 7 günde ölür ve paylaşım durur.
5. "Kimlik bilgileri" → "Kimlik bilgisi oluştur" → "OAuth istemci kimliği" → Uygulama türü **Web uygulaması**. Yetkili yönlendirme URI'si: `https://developers.google.com/oauthplayground`. Oluşunca **Client ID** ve **Client Secret** görünür.
6. https://developers.google.com/oauthplayground aç → sağ üst dişli → "Use your own OAuth credentials" işaretle → Client ID ve Secret'ı yapıştır.
7. Sol "Step 1": kutuya şu iki izni yaz: `https://www.googleapis.com/auth/youtube.upload` ve `https://www.googleapis.com/auth/youtube.readonly` → "Authorize APIs". Kanalın sahibi Google hesabıyla giriş yap (marka kanalıysa o kanalı seç). "Google bu uygulamayı doğrulamadı" uyarısı çıkarsa "Gelişmiş" → "Devam et".
8. "Step 2": "Exchange authorization code for tokens" → çıkan **Refresh token** değerini kopyala.
9. Yönetim paneli → Sosyal hesaplar → **YouTube (Shorts)** → Client ID, Client Secret, Refresh Token alanlarını doldur → Kaydet → **Bağlantıyı sına** (kanal adı görünmeli). Anahtarları sohbete yazma.
10. Videolar önce **özel (private)** kilitli yüklenirse: API projesi denetimden geçmemiştir. "YouTube API Services audit and quota extension" formunu doldur (kullanım amacı: kendi kanalına otomatik Short paylaşımı). Denetim bitene kadar videolar kanalda özel görünür; YouTube Studio'dan elle herkese açılabilir.

Çalışma şekli: yalnız ARAÇ videoları YouTube'a gider (blog yazıları gitmez). Zamanlama, "Reels otomatik/onaylı" ayarı ve saat Instagram/Facebook ile aynıdır; saati gelince kendiliğinden Short olarak yüklenir. Açıklamaya `#Shorts` otomatik eklenir. Anahtar süresi dolarsa sınama "invalid_grant" der: 4. maddeyi kontrol edip anahtarı yeniden al.

### TikTok
1. TikTok hesabı (işletme hesabı önerilir) aç.
2. developers.tiktok.com → uygulama kaydı → "Content Posting API" ürünü + "Direct Post" ayarı.
3. Kapsam: `video.publish`. Gizlilik ve şartlar bağlantıları gerekir.
4. Client Key ve Client Secret'ı panelden gireceğiz.
5. Denetim için demo videosu hazırlanır: giriş → izin ekranı → yazı/gizlilik seçimi (creator_info'dan) → paylaşım. Bunu uygulama tarafında ben kodlayacağım.

## Bizim yapacaklarımız (denetim öncesi)
- Gizlilik politikasına YouTube API Hizmetleri ve Google gizlilik politikası bağlantısı, TikTok veri kullanımı ifadesi.
- TikTok bağdaştırıcısı (`platforms/` altında yeni dosya), veri tabanında yeni ağ değeri, panelde bağlantı ekranı. (YouTube bunların hepsiyle TAMAMLANDI: `platforms/youtube.platform.ts`.)
- TikTok için paylaşım öncesi onay ekranı (yazı, gizlilik, etkileşim ayarı) — denetim şartı.

## Not
Şirket henüz kurulmadı. Başvuruda şirket/kişi bilgisi istenip istenmediği kaynaklarda net değil; formlar açılınca görülecek.

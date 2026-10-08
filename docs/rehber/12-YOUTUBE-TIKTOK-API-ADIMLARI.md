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

### YouTube
1. Paylaşım yapılacak YouTube kanalını aç (marka hesabı önerilir).
2. console.cloud.google.com → yeni proje → "YouTube Data API v3" etkinleştir.
3. OAuth onay ekranı: uygulama adı, destek e-postası, gizlilik politikası (https://www.pdfplatform.app/privacy) ve hizmet şartları bağlantısı. Kapsam: `youtube.upload`.
4. OAuth istemcisi (Web uygulaması) oluştur; yönlendirme adresini bana ver.
5. Client ID ve Client Secret'ı yönetim paneline gireceğiz (sohbete yazma).
6. Yayına almak için "YouTube API Services audit and quota extension" formunu doldur (kullanım amacı: kendi kanalına otomatik Short paylaşımı; yetkilendirme ekranı kaydı ekle).

### TikTok
1. TikTok hesabı (işletme hesabı önerilir) aç.
2. developers.tiktok.com → uygulama kaydı → "Content Posting API" ürünü + "Direct Post" ayarı.
3. Kapsam: `video.publish`. Gizlilik ve şartlar bağlantıları gerekir.
4. Client Key ve Client Secret'ı panelden gireceğiz.
5. Denetim için demo videosu hazırlanır: giriş → izin ekranı → yazı/gizlilik seçimi (creator_info'dan) → paylaşım. Bunu uygulama tarafında ben kodlayacağım.

## Bizim yapacaklarımız (denetim öncesi)
- Gizlilik politikasına YouTube API Hizmetleri ve Google gizlilik politikası bağlantısı, TikTok veri kullanımı ifadesi.
- YouTube/TikTok bağdaştırıcıları (`platforms/` altında yeni dosya), veri tabanında yeni ağ değerleri, panelde bağlantı ekranı.
- TikTok için paylaşım öncesi onay ekranı (yazı, gizlilik, etkileşim ayarı) — denetim şartı.

## Not
Şirket henüz kurulmadı. Başvuruda şirket/kişi bilgisi istenip istenmediği kaynaklarda net değil; formlar açılınca görülecek.

# Araç Videoları (Instagram + Facebook Reels)

Araçların tanıtım videoları **önceden hazır tutulmaz**. Paylaşım zamanı yaklaşınca aracın gerçek
kullanımı kaydedilerek üretilir, Instagram ve Facebook'ta paylaşılır, **paylaşıldıktan sonra silinir**.
Blog yazıları için video yapılmaz (onlar görselle gider).

## Nasıl çalışıyor

1. **Her gün sabah 05:30'da** (İstanbul) GitHub'daki "Araç videosu üretimi" işi sunucuya sorar:
   "Bugün video gerekli mi?" Yalnızca Zamanlama sekmesinde sıklık açıksa ve sıra bu araçtaysa gerekir.
2. Gerekliyse iş, siteyi kendi makinesinde geçici olarak çalıştırır, aracı kullanıp ekranı kaydeder,
   videoyu kurgular ve sunucuya yükler. Makine işten sonra silinir; hiçbir şey saklanmaz.
3. Günlük paylaşım turu videoyu Instagram + Facebook Reels gönderisine çevirir. "Önce onay"
   modundaysa taslak olarak bekler; sen izleyip onaylarsın.
4. Gönderiler yayınlanınca (ya da elle "paylaştım" işaretlenince) video sunucudan **otomatik silinir**.
   Hiç kullanılmayan video 36 saat, unutulmuş taslağın videosu 14 gün sonra silinir.

Video hazır değilse (üretim aksadıysa) o gün araç videosu paylaşılmaz; blog gönderileri etkilenmez.

## Bir kerelik kurulum (sende)

Aynı gizli anahtarı iki yere gireceksin.

1. Uzun, rastgele bir parola üret (en az 32 karakter).
2. **Render → kimlik API servisi → Environment** → `TOOL_REEL_FACTORY_KEY` = bu parola. Servisi yeniden başlat.
3. **GitHub → depo → Settings → Secrets and variables → Actions → New repository secret** ile iki anahtar ekle:
   - `TOOL_REEL_FACTORY_KEY` = aynı parola
   - `TOOL_REEL_API_BASE` = kimlik API'nin adresi (Render'daki `APP_BASE_URL` ile aynı, ör. `https://api.pdfplatform.app`)
4. **Panel → Sosyal medya → Zamanlama → Araç videoları** sıklığını seç (ör. 3 günde bir).
   Başlangıçta Reels ayarını **"Önce onay"** bırak.

Anahtarlar yoksa iş sessizce atlanır, hata vermez.

## İlk denemeyi elle yapmak

GitHub → **Actions → Araç videosu üretimi → Run workflow** → "tool" alanına `merge` yaz → çalıştır.
Birkaç dakika sonra panelde **Araç videoları** sekmesinde video görünür; "Reels taslağı hazırla" ile
taslağı oluşturup Gönderi akışı'nda izleyebilirsin. (İşin saati sabah 05:30 UTC+3'tür; paylaşım saatini
07:30'dan önceye alırsan iş saatini de öne çek: `.github/workflows/tool-reels.yml` içindeki `cron`.)

## Yeni araç videosu eklemek

Her aracın bir **çekim senaryosu** olması gerekir (aracın hangi adımlarını göstereceğimizi yazarız):

1. `web/frontend/scripts/tool-reels/scenarios/<araç>.mjs` yaz, `run.mjs` içindeki listeye ekle.
2. `web/api/src/modules/social/tool-reel-catalog.ts` içine başlık/özet/arama terimlerini ekle
   (metin elle yazılır ve doğrulanmış olmalı; yapay zekâ kullanılmaz).

Şu an hazır senaryolar: **PDF Sıkıştır (`compress`)**, **PDF Birleştir (`merge`)**.
Sıra: hiç paylaşılmayan araç önce, sonra en eski paylaşılan.

## Güvenlik ve dayanıklılık notları

- Üretim ucu oturumla değil `TOOL_REEL_FACTORY_KEY` ile yetkilenir; anahtar sunucuda tanımlı değilse uç kapalıdır.
- Yüklenen dosya gerçekten MP4 mi diye bakılır, en çok 40 MB.
- Video adresi herkese açıktır (Instagram/Facebook indirebilsin diye) ama tahmin edilemeyen bir kimlik taşır ve
  paylaşımdan sonra silinir.
- Facebook Sayfası Reels için sayfa erişim anahtarının video paylaşma izni (`pages_manage_posts`) olmalıdır.
  Reels yayını başlamadan hata olursa Facebook'ta bağlantılı yazı gönderisine, Instagram'da kapak görseline düşülür;
  yayın başladıktan sonraki hata yedeğe düşmez (aynı gönderi iki kez çıkmasın).

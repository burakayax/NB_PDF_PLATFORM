# Araç Videoları (Instagram + Facebook Reels)

Araçların tanıtım videoları **önceden hazır tutulmaz**. Paylaşım zamanı yaklaşınca aracın elle yazılmış
animasyon sahnesinden üretilir, Instagram ve Facebook'ta paylaşılır, **paylaşıldıktan sonra silinir**.
Blog yazıları için video yapılmaz (onlar görselle gider).

## Nasıl çalışıyor

1. **Yarım saatte bir** GitHub'daki "Araç videosu üretimi" işi sunucuya sorar: "Şimdi video gerekli mi?"
   Sunucu, normal gönderilerle AYNI paylaşım saatine bakar ve yalnızca gönderilerin hazırlanmasından
   yaklaşık 2,5 saat önce "evet" der (araç videosu sıklığı açıksa ve sıra bu araçtaysa). Paylaşım
   saatini panelden değiştirdiğinde başka bir şey yapman gerekmez.
2. Gerekliyse iş, geçici bir makinede aracın sahnesini kare kare videoya çevirir, müziğini üretir ve
   sunucuya yükler. Siteye giriş yapılmaz. Makine işten sonra silinir; hiçbir şey saklanmaz.
3. Günlük paylaşım turu videoyu Instagram + Facebook Reels gönderisine çevirir. "Önce onay"
   modundaysa taslak olarak bekler; sen izleyip onaylarsın.
   **Üç sürüm üretilir:** yalnız kapanıştaki cümle farklıdır: Instagram + TikTok "Bağlantı profilde",
   YouTube "Bağlantı açıklamada", Facebook "Bağlantı yorumlarda". Biri eksikse üçü birlikte yeniden üretilir.
4. Gönderiler yayınlanınca (ya da elle "paylaştım" işaretlenince) video sunucudan **otomatik silinir**.
   Hiç kullanılmayan video 36 saat, unutulmuş taslağın videosu 14 gün sonra silinir.

Video günün gönderileri hazırlanırken hazır değilse, AYNI GÜN içinde gelirse gönderi yine oluşturulur (yayın saati geçtiyse yarım saat sonraya konur; gece yarısını aşacaksa o gün atlanır). Blog gönderileri hiçbir durumda etkilenmez.

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

GitHub → **Actions → Araç videosu üretimi → Run workflow** → "tool" alanına `udf-to-pdf` yaz → çalıştır.
Birkaç dakika sonra panelde **Araç videoları** sekmesinde video görünür; "Reels taslağı hazırla" ile
taslağı oluşturup Gönderi akışı'nda izleyebilirsin.

## Video biçimi ve yeni araç eklemek

Her videonun **kendine özgü bir sahnesi** vardır: gerçek hayattaki bir takılma noktasıyla başlar, çözümle biter,
güvenlik mesajı hikâyenin içinde küçük etiketlerle verilir ve her videoda farklı biçimde bir araç vitriniyle kapanır.
Eski ekran kaydı biçimi kaldırıldı. Bağlayıcı kurallar ve ekleme adımları:
`web/frontend/scripts/tool-reels/README.md`.

**Şu an sahnesi hazır olan 4 araç:** UDF → PDF, Görsel Sıkıştır, Aranabilir PDF, PDF → Excel.
Otomatik sıra yalnız bu araçlar arasında döner; dördü de paylaşılınca baştan başlar (sıklığı buna göre seç).
Yeni sahne ekledikçe sıraya kendiliğinden katılır. Videolar yaklaşık 40 saniyedir.

## Güvenlik ve dayanıklılık notları

- Üretim ucu oturumla değil `TOOL_REEL_FACTORY_KEY` ile yetkilenir; anahtar sunucuda tanımlı değilse uç kapalıdır.
- Yüklenen dosya gerçekten MP4 mi diye bakılır, en çok 40 MB.
- Video adresi herkese açıktır (Instagram/Facebook indirebilsin diye) ama tahmin edilemeyen bir kimlik taşır ve
  paylaşımdan sonra silinir.
- Facebook Sayfası Reels için sayfa erişim anahtarının video paylaşma izni (`pages_manage_posts`) olmalıdır.
  Reels yayını başlamadan hata olursa Facebook'ta bağlantılı yazı gönderisine, Instagram'da kapak görseline düşülür;
  yayın başladıktan sonraki hata yedeğe düşmez (aynı gönderi iki kez çıkmasın).

## Kapak görselleri (profilde görünen kapak)

Reels/Shorts kapağı ve blog kapakları **aynı tasarım sisteminden** çıkar: `web/frontend/scripts/lib/cover-designs.mjs`
(araç kapakları, 1080×1920) ve `scripts/lib/blog-cover.mjs` (blog + kaydırmalı gönderinin ilk slaytı). Logo her zaman sol üsttedir.

- **Araç kapakları:** `scripts/tool-reels/cover-specs.mjs` her aracın tasarım dilini ve başlığını tutar. Beş dil vardır: poster,
  adım adım, koyu premium, özellik ızgarası, önce/sonra. Başlıkta kelime oyunu kuralı: büyük harfli iri yazı + küçük harfli,
  daha küçük anahtar kelime ("BÜYÜK PDF'İ" / küçült). Yeni araç eklenince oraya bir satır ekle; eklenmezse başlıktan sade bir
  poster üretilir. `node scripts/generate-reel-covers.mjs` çalıştırıp çıkan `public/reel-covers/*.jpg` dosyalarını commitle
  (build sırasında da otomatik üretilir).
- **Blog kapakları:** dört renk varyantı (amber poster, açık zemin, doygun mavi, koyu premium) yazının adresinden sabit seçilir.
  "Başlık: alt başlık" biçimindeki başlıklar otomatik bölünür; alt başlık renkli bantta görünür. Site paylaşım görseli,
  kare ve dikey kesimler ile kaydırmalı gönderinin ilk slaytı aynı varyantı kullanır. Tasarım değişince
  `generate-covers.mjs` ve `generate-carousels.mjs` içindeki `DESIGN_VERSION` artırılır.
- **Renk ilkesi:** doygun mavi zemin + tek sıcak vurgu (amber). Kontrast ve doygunluk dikkat çeker. Kesin sonuç için canlıda
  iki tasarımı dönüşümlü kullanıp performansa bakmak en güvenilir yoldur.
- **Güvenli alan:** Instagram profil ızgarası kapağı 3:4 kırpar (üstten ve alttan 240 px gider); önemli her şey y=250–1670 arasındadır.
- **Kapaktaki iddialar** yalnızca aracın gerçek yaptığını söyler; rakamlar örnekse "Örnek" yazılır.

# 19 — Çöküş bekçisi (Cloudflare Worker, GÖLGE MODU)

## Ne işe yarıyor?
Render'dan bağımsız küçük bir program (Worker) Cloudflare'da çalışır ve 5 dakikada bir şunlara bakar:
site ana sayfası, `/api/health` (site ayakta mı) ve `/api/health/db` (veritabanı bağlı mı).
Art arda 3 kontrol başarısız olursa (yaklaşık 15 dakika) bir "olay" kaydı açar ve şunu yazar:
**"Şu an son sürüme geri dönerdim / dönmezdim, çünkü …"**

> **GÖLGE MODU:** Bekçi hiçbir şeyi geri ALMAZ, Render'a ya da GitHub'a yazmaz. Render anahtarı yoktur.
> Yalnızca kendi kayıt klasörüne (`bekci/`) yazar. Gerçek geri alma kodu dosyada hiç yoktur.

## Geri dön derdim kuralı (yapay zekâ yok, 4 kuralın HEPSİ doğru olmalı)
1. Art arda en az 3 kontrol başarısız.
2. Kesinti, main'e yapılan son birleştirmeden en çok ~60 dakika sonra başlamış.
3. Site, kesintiden önceki 24 saatte sağlıklıymış (en az 12 saatlik kayıt, başarısızlık en çok %1).
4. O birleştirmede veritabanı dosyası (`web/api/prisma/`) değişmemiş.

## Haber nasıl gelir?
- **Anlık haber:** UptimeRobot (telefon bildirimi). Bekçi e-posta atmaz.
- **Ertesi sabah:** Sabah özeti e-postasında "Çöküş bekçisi (gölge)" bölümü. Bekçi 2 saatten uzun süre kayıt yazmazsa
  özetin "Dikkat edilecekler" kutusunda uyarı çıkar.

## Kurulum (kopyala-yapıştır) — yalnızca Burak yapar, ücretsiz plan
Kod: `cloudflare/bekci-worker.mjs` dosyasının TAMAMI.
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Ad: `pdfplatform-bekci` → **Deploy**. Sonra **Edit code** → eski yazıyı sil, dosyanın tamamını yapıştır → **Deploy**.
   (Deploy hata verirse ekranı bana göster.)
3. **Settings → Bindings → Add → R2 bucket**: Variable name `BUCKET`, bucket `nb-gecelik-ozet` (sabah ajanlarının
   kullandığı özel kova) → Save/Deploy.
4. **Settings → Trigger Events → Cron Triggers → Add**: `*/5 * * * *` (5 dakikada bir) → Save.
5. Doğrulama: 5–10 dakika sonra R2'de `nb-gecelik-ozet` içinde `bekci/kayit.json` dosyası oluşmalı.
   Ertesi sabahki özette "Çöküş bekçisi (gölge)" satırı "Son 24 saatte N kontrol, 0 başarısız" demeli.
6. Bu Worker'a **route/alan adı EKLEME**; dışarıdan hiçbir adres vermez.

## Ek maliyet
Ücretsiz plan yeterli (günde ~290 çalışma; Worker, R2 ve cron ücretsiz kullanım sınırlarının çok altında).
Yeni hesap, ücretli plan, e-posta hizmeti ya da anahtar gerekmez.

## Geri alma / durdurma
Worker sayfası → **Settings → Trigger Events** → cron'u sil (ya da Worker'ı sil). Siteye hiçbir etkisi yoktur.
Sabah özetinde "Bekçi kaydı henüz yok" yazar; başka bir şey bozulmaz.

## Gölge dönem sonrası (ayrı onayla)
2 hafta sonunda kayıtlar sana gösterilir (yanlış alarm oldu mu, "geri alırdım" kararları doğru muydu).
Gerçek geri alma ancak senin ayrı onayınla, ayrı bir Render anahtarıyla ve ayrı PR'da açılır.

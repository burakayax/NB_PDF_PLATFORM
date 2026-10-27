# 18 — Cloudflare 404 Worker (bilinmeyen adreslere gerçek "bulunamadı")

## Ne işe yarıyor?
Sitede olmayan bir adres (ör. `/bu-sayfa-yok-xyz`) şimdiye kadar "başarılı" (200) görünüp
ana sayfayı gösteriyordu; blogda ise boş sayfa çıkıyordu. Google bunları "kopya sayfa" sayıyor.
Bu küçük program (Worker) Cloudflare'da çalışır ve böyle adreslere gerçek **404** verir.
Gerçek sayfalara, giriş/kayıt gibi uygulama sayfalarına ve `/api` adreslerine dokunmaz.
Bir şey ters giderse isteği olduğu gibi geçirir (site asla bozulmaz).

> Not: `/about` ve `/register` uygulamanın GERÇEK sayfalarıdır, 200 dönmeleri doğrudur.

## Kodu nereden alacağım?
`web/frontend/cloudflare/not-found-worker.js` dosyasının TAMAMI.
(Uygulamaya yeni bir üst sayfa eklenirse `node cloudflare/build-not-found-worker.mjs`
çalıştırılıp dosya yenilenir; test bunu unutursak CI'da uyarır.)

## Adım adım kurulum
1. https://dash.cloudflare.com adresine gir, giriş yap.
2. Sol menüden **Workers & Pages** → **Create** → **Create Worker**.
3. Ad olarak `pdfplatform-404` yaz → **Deploy** (örnek kodla yayınlanır, sorun değil).
4. **Edit code** düğmesine bas. Soldaki editörde tüm yazıyı sil, `not-found-worker.js`
   dosyasının tamamını yapıştır → sağ üstten **Deploy**.

### Önce test adresinde dene (canlıya dokunmadan)
5. Cloudflare'da **DNS** bölümünde `test` adında bir kayıt ekle (CNAME, hedef `www.pdfplatform.app`, bulut simgesi turuncu/Proxied).
6. Worker sayfasında **Settings → Domains & Routes → Add → Route**:
   Route: `test.pdfplatform.app/*`, Zone: `pdfplatform.app` → Save.
7. Bilgisayarda şunu çalıştır (bana da gösterebilirsin):
   `node web/frontend/scripts/canli-404-denetim.mjs https://test.pdfplatform.app`
   Sitemap'teki tüm adresler 200, bilinmeyenler 404 çıkmalı.
   (Render özel alan adı kabul etmediği için test adresi `Host` hatası verirse
   adım 6'daki route'u doğrudan `www.pdfplatform.app/bu-sayfa-yok-xyz*` gibi dar bir yol olarak dene.)

### Canlıya alma
8. **Settings → Domains & Routes → Add → Route**: `www.pdfplatform.app/*`, Zone `pdfplatform.app` → Save.
9. Doğrula:
   `node web/frontend/scripts/canli-404-denetim.mjs https://www.pdfplatform.app`
10. Eski önbelleği temizle: **Caching → Configuration → Purge Cache → Purge Everything**.

## Geri alma (sorun olursa)
Worker sayfası → **Settings → Domains & Routes** → route'un yanındaki çöp kutusu. Anında eski haline döner.
Kod değiştirmeye gerek yok.

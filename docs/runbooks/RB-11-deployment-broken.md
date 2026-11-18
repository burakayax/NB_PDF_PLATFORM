# RB-11 — Kötü Deploy / Geri Alma (Render)

> **Ne zaman:** Yeni sürüm canlıya çıktıktan sonra site bozuldu, ödeme çalışmıyor, sayfalar açılmıyor ya da hata sayısı bir anda arttı.
> **Altın kural:** Şüphen varsa önce geri al, nedenini sonra ara. Geri alma birkaç dakika sürer.
> **Not:** Eski sürüm bu belgede kendi sunucusu (`systemctl`, `git checkout`) için yazılmıştı. Proje Render'a taşındığı için geçersizdi; bu sürüm onun yerine geçer. Render ekranlarındaki düğme adları zamanla değişebilir. İlk gerçek kullanımda ekranı bir kez teyit edin.

## Önce karar: sorun nerede?

| Belirti | Büyük ihtimalle | Ne yapılır |
|---|---|---|
| Site hiç açılmıyor ya da beyaz sayfa | Ön yüz (statik site) | Adım 2: `nb-pdf-frontend` geri al |
| Giriş, üyelik, ödeme, panel çalışmıyor | `nb-auth-api` | Adım 2: `nb-auth-api` geri al |
| PDF araçları hata veriyor | `nb-pdf-api` (veya `nb-gotenberg`) | Adım 2: ilgili servisi geri al |
| Veriler yanlış, kayıtlar eksik/bozuk | Veritabanı | Adım 4: veritabanı geri dönüşü (önce durdur) |

Emin değilseniz: UptimeRobot e-postasına, Sentry'ye ve `https://api.pdfplatform.app/api/health/db` adresine bakın. Bu adres `db: up` dönüyorsa sorun büyük ihtimalle veritabanında değildir.

## Adım 1 — Yeni sürüm mü bozdu? (1 dk)

1. GitHub → **Actions** → en üstteki "CI" çalışması: ne zaman çıktı?
2. Hatanın başladığı saat bu saatle örtüşüyorsa sürüm bozmuş demektir.
3. Hangi PR'ın birleştiğini not edin (geri alma ve sonrası için lazım).

## Adım 2 — Kodu geri al (Render, 2–5 dk)

Her servis için ayrı yapılır. Sorunlu servisi seçin: `nb-pdf-frontend`, `nb-auth-api`, `nb-pdf-api`, `nb-gotenberg`.

1. Render paneli → servis → **Events** (ya da Deploys) sekmesi.
2. Listede **son çalışan başarılı sürümü** bulun (sorunlu sürümden bir önceki).
3. O sürümün yanındaki **Rollback** düğmesine basın ve onaylayın.
4. Durumun **Live** olmasını bekleyin.
5. Kontrol: site açılıyor mu, `https://api.pdfplatform.app/api/health` 200 veriyor mu?

Bilmeniz gerekenler:
- Rollback yalnızca **kodu** eski haline getirir. Veritabanındaki değişiklikler geri gitmez (bkz. Adım 4).
- Render önceki derlemeyi yeniden çalıştırır. Bu sırada yeni bir veritabanı güncellemesi çalışmaması gerekir; ilk kullanımda günlüğe (Logs) bakarak teyit edin.
- Render, geri alınan serviste otomatik kurulumu kapatabilir. Bizde zaten kurulumu CI tetikler; ama **sonraki birleştirme bozuk kodu yeniden canlıya çıkarır.** Bu yüzden Adım 3 şart.

## Adım 3 — Bozan değişikliği kalıcı olarak geri al (PR ile)

`main` dalına doğrudan push yoktur; geri alma da pull request ile yapılır.

1. GitHub → birleştirilmiş PR sayfası → **Revert** düğmesi. GitHub otomatik bir "geri alma" PR'ı açar.
2. CI yeşil olunca sahibi onaylar ve birleştirir. Bu yeni bir deploy tetikler.
3. Render'da tüm servislerin **Live** olduğunu doğrulayın.

Acil durumda ve CI beklenemeyecekse: GitHub → Settings → Rules → "main koruma" kuralını geçici **Disabled** yapın, işlem bitince hemen **Active** yapın. Bu yalnızca sahibin kararıyla yapılır ve işlem sonunda yol haritası belgesine not düşülür.

## Adım 4 — Veritabanı geri dönüşü (yalnızca veri bozulduysa)

Bu adım en riskli olandır. **Önce yazmayı durdurun**, sonra geri dönün.

1. `nb-auth-api` servisini **Suspend** edin (yeni kayıt yazılmasın).
2. Render paneli → veritabanı → **Recovery** (zamana göre geri dönüş; Render şu an son 3 gün).
3. Bozulmadan **hemen önceki** bir zaman seçin. Render bu işlemi mevcut veritabanının üzerine yazmaz; **yeni bir veritabanı** oluşturur.
4. Yeni veritabanı hazır olunca, `nb-auth-api` ortam değişkenlerinde `DATABASE_URL` değerini yeni veritabanının adresiyle değiştirin (değeri hiçbir yere yazmayın).
5. Servisi **Resume** edin, kurulumun bitmesini bekleyin.
6. Kontrol: `https://api.pdfplatform.app/api/health/db` → `db: up`; panelden son siparişlere ve üye sayısına bakın.
7. Eski veritabanını **silmeyin**; her şeyin doğru olduğundan emin olana kadar saklayın.

Önemli: geri dönüş noktasından sonra gelen siparişler/üyelikler yeni veritabanında olmayacaktır. İlgili ödeme sağlayıcı (PayTR/iyzico) kayıtlarından kontrol edilip elle düzeltilir.

Elle aldığınız yedek dosyası (`.dat`/pg_dump) için geri yükleme ayrı bir işlemdir; yardım isteyin, kendiniz denemeyin.

## Adım 5 — Sonrası

- [ ] Site, giriş, ödeme ekranı ve bir PDF aracı elle denendi
- [ ] UptimeRobot yeşil
- [ ] Sentry'de yeni hata akışı durdu
- [ ] Revert PR'ı birleştirildi (Adım 3)
- [ ] Ne olduğu ve neden olduğu `docs/ai-team-roadmap.md` veya olay notlarına yazıldı

## Yapılmaması gerekenler

- `main`'e doğrudan push veya `--force` (zaten engelli)
- Veritabanını "temizlemek" için komut çalıştırmak
- Anahtarları sohbet/belgeye yazmak
- Hangi servisin bozduğunu bilmeden hepsini birden geri almak

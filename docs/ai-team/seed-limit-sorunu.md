# Seed ve panelden değiştirilen limitler — inceleme (öneri; kod değiştirilmedi)

## Sorun nedir?
Her canlıya çıkışta (`nb-auth-api` kurulumu) "seed" adlı adım çalışır. Seed, planların limitlerini **koddaki varsayılan değerlerle** veritabanına yazar ve tüm mevcut kurumların (organization) limitlerini de buna çeker. Panelden elle değiştirilen limit, yazıldığı yere göre geri dönebilir.

## İncelemenin sonucu (kodda doğrulandı)
Limitin kaydedildiği **iki ayrı yol** var:

| Yol | Nerede saklanır | Seed ezer mi? | Çalışma sırasında hangisi geçerli? |
|---|---|---|---|
| **Yeni "Limitler" sekmesi (limit defteri)** | Ayarlar kaydı (`packages.config`) | **Hayır** | Evet. `quota.ts` önce panelde kayıtlı plan limitini okur, yoksa kurum satırındaki değeri kullanır |
| **Eski yol (`plansOverride.dailyLimit`)** | Plan satırı + tüm kurum satırları | **Evet** | Sadece limit defterinde değer yoksa |

Yani **bugünkü ana yol (Limitler sekmesi) seed'den korunuyor.** Kalan açıklar:

1. **Eski yol:** Panel hâlâ `plansOverride` içinde `dailyLimit` yolluyorsa (`PackagesTab.tsx` bu alanı hâlâ okuyup yazıyor; tam olarak ne yolladığı ayrıca doğrulanmalı), o değer bir sonraki deploy'da koda döner.
2. **Seed'in ezdiği başka alanlar:** kurum satırlarındaki aylık limit, dosya boyutu, toplu işlem limiti, kuyruk önceliği, koltuk sayısı ve plan satırındaki fiyat sütunları. Bunların limit defteri karşılığı olanlar (günlük, aylık, dosya boyutu, toplu işlem, yapay zekâ kredisi) çalışma anında defterden okunuyor; ama **ekranda plan satırını gösteren yerler** (varsa) kodun değerini gösterebilir.
3. **Kullanıcıya özel limit** (`customDailyLimit`) ve bugünkü bonus seed'in dokunmadığı alanlardır; güvende.
4. **Fiyatlar:** Panel fiyatları ayrı bir kayıtta (`packages.config` fiyat defteri) tutulur; seed'in yazdığı plan satırındaki fiyat sütunları gösterimi etkilemez.

## Öneri (sırayla)
1. **Seed'i "panel kazanır" yap (önerilen):** Seed, limit defterinde değeri olan plan/alanlara dokunmasın; yalnızca değeri olmayanları koddan doldursun. Kodun varsayılanı kalır, panelin kararı geçer.
   - Artı: Panelden yaptığınız hiçbir şey deploy ile geri dönmez.
   - Eksi: Kodda varsayılan limiti değiştirdiğinizde, paneli daha önce kaydettiyseniz yeni varsayılan görünmez (bilinçli).
2. **Eski yolu kaldır/uyumla:** `plansOverride.dailyLimit` yolunu limit defterine yönlendir; böylece tek kaynak kalır.
3. **Seed'in çıktısına uyarı satırı:** Seed bir değeri ezeceği zaman günlüğe "X planı günlük limit: panel A, kod B (ezilmedi/ezildi)" yazsın.

## Uygulama için gerekenler (onay bekliyor)
- Dokunulacak dosyalar: `web/api/prisma/seed.ts` (veritabanı klasörü) ve muhtemelen `admin.service.ts`. İkisi de **plan/limit alanı olduğu için sizin onayınız gerekir.**
- Plan/fiyat oturumu (33) bu alanı biliyor; uygulamayı onaylarsanız onun yapması en az hata riskidir.
- Veritabanı şeması değişmez.

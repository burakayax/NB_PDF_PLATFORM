# Gecelik özet — GitHub Actions + R2 özel klasör tasarımı (onay bekliyor, KURULMADI)

Önceki tasarım (`gecelik-ozet-tasarimi.md`) güncellendi: Render cron AÇILMAYACAK (ücretli). İş, ücretsiz GitHub Actions'ta zamanlanır.

## Akış
1. **03:00 (TR)** GitHub Actions `schedule` tetikler (UTC 00:00). Elle başlatmak için `workflow_dispatch` de var. `pull_request`/`push` ile ASLA tetiklenmez.
2. İş, `nb-auth-api`'deki **yalnız-okuma özet ucunu** çağırır (yeni, küçük bir uç; yalnızca toplam sayıları döner, kişisel veri yok). Uç, GitHub Secrets'taki bir anahtarı ister.
3. İş, sayıları ikinci bir yoldan doğrular (aşağıda) ve sonucu tek bir JSON+metin dosyası olarak **R2'deki özel kovaya** yazar.
4. Sonuç ASLA depoya, iş günlüğüne ya da "artifact"a yazılmaz (herkese açık depoda hepsi herkese açıktır).

Neden veritabanına doğrudan bağlanmıyoruz: veritabanı şifresini GitHub'a koymak, açık bir depoda en riskli seçenek olurdu. Uç sadece toplamları verir; anahtarı sızsa bile en kötü ihtimalle toplam sayılar okunur, veri değiştirilemez.

## İçereceği sayılar (kişisel veri YOK)
- **Üyelik:** dün yeni üye, toplam üye, aktif üye, misafir ziyaretçi.
- **Satış** (panelin "Satışlar" ekranıyla aynı kaynak): başarılı ödeme adedi ve tutarı (TL ve USD ayrı), iade adedi/tutarı, net, yeni/iptal abonelik, plan başına abone.
- **Kullanım:** toplam işlem, en çok kullanılan 10 araç, günlük limite takılan kullanıcı sayısı, misafir→üye dönüşümü.
- **Sağlık:** son 24 saat hizmet durumu, hata sayısı, başarısız ödeme sayısı.
- 5'ten küçük her sayı "<5" yazılır. E-posta, isim, IP, dosya adı yok.

## Verinin doğruluğu nasıl kontrol edilir
- Her sayı iki yoldan hesaplanır: (1) panelin kullandığı hesap, (2) ham kayıttan bağımsız sayım. Eşitse "doğrulandı", değilse dosyanın başına "TUTMUYOR: panel X, ham sayım Y" yazılır ve okuyan yapay zekâ o sayıya güvenmez.
- Dosyada üretim zamanı vardır; 26 saatten eskiyse "bayat" sayılır.
- İlk 7 gece siz panelle elle karşılaştırırsınız.
- Zamanlanmış iş hata verirse GitHub size e-posta atar (varsayılan bildirim).

## Gizli anahtarlar nasıl korunur
- Yalnız **GitHub Secrets**: `SUMMARY_API_TOKEN` (özet ucunu okur) ve R2 yazma anahtarı (yalnız tek kovaya yazar). Veritabanı, ödeme, JWT anahtarı GitHub'a KONMAZ.
- İş yalnız `schedule` ve `workflow_dispatch` ile çalışır; dışarıdan gelen PR'lar (fork) Secrets'a erişemez.
- Günlükte hiçbir değer basılmaz: `set +x`, anahtarlar yalnız ortam değişkeni olarak geçer, çıktı `curl -s` ile dosyaya yazılır, ekrana basılmaz.
- Çıktı artifact olarak yüklenmez, depoya commit edilmez.
- Okuyan taraf (yapay zekâ) ayrı bir **salt-okunur** R2 anahtarı kullanır; yazma anahtarı ondan ayrıdır. İkisi de tek kovayla sınırlıdır ve iptali tek tıktır.
- Anahtarlar 90 günde bir yenilenir (takvim hatırlatması).

## Özel klasör (R2) önerisi
- Ayrı kova: `nb-gecelik-ozet` (uygulamanın dosya kovasından ayrı). Kamuya açık erişim KAPALI (varsayılan).
- Yol: `ozet/YYYY/AA/ozet-YYYY-AA-GG.json` + `ozet-son.json`. Eski dosyalar 90 gün sonra otomatik silinir (yaşam döngüsü kuralı).

## Maliyet (gerçekten sıfır mı?)
| Kalem | Maliyet | Not |
|---|---|---|
| GitHub Actions | 0 | Depo herkese açık: standart çalıştırıcılar ücretsizdir. Gecelik iş ~1 dk. Depo özel yapılırsa 2.000 dk kotasından düşer (şimdilik açık). |
| Render | 0 ek | Özet ucu mevcut `nb-auth-api` içinde; ücretsiz planda uyku modundan çağrıyla uyanır (ilk istek yavaş olabilir). Cron servisi açılmıyor. |
| Cloudflare R2 | ~0 | Ücretsiz katman aylık 10 GB depolama; günde 1 küçük dosya. Hesapta ödeme yöntemi istenebilir; Cloudflare'in güncel koşulunu kurmadan önce siz teyit edin. |
Not: Actions zamanlanmış işleri birkaç dk gecikebilir; depoda 60 gün hiç hareket olmazsa GitHub zamanlanmış işi durdurur (şu an depo aktif).

## Yapılacak kod (onayınızdan sonra, ayrı PR'lar)
1. `nb-auth-api`: yalnız-okuma özet ucu (kritik modüller: admin/analytics; şema değişikliği YOK). Yüksek riskli değil ama yetki kontrolü içerdiği için ayrı onay istenecek.
2. `.github/workflows/gecelik-ozet.yml` (kritik dosya: CI/.github).
3. Siz: R2 kovası + iki anahtar + GitHub Secrets (adımlar `kurulum-adimlari.md`'de).

## Onay beklenenler
1. Sayı listesi uygun mu? 2. 03:00 TR uygun mu? 3. Özet ucu için kod yazılmasını onaylıyor musunuz?

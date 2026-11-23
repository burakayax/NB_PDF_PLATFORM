# Kurulum adımları: bot hesabı, gecelik özet depolaması, çalışma ortamı

Hiçbiri kurulmadı. Her adımı siz yaparsınız; anahtar/şifre hiçbir yere (sohbet, belge, PR) yazılmaz.

## 1) Bot GitHub hesabı (yapay zekâ PR açsın, siz onaylayın)

**Amaç:** "Kritik dosyalar için kod sahibi onayı" kuralı (CODEOWNERS) açıldığında, PR'ı açan kişi kendi PR'ını onaylayamaz. Tek kişilik depoda bu sizi kilitler. Çözüm: PR'ları ayrı bir bot hesabı açar, siz onaylarsınız. Kurala delik (bypass) açmaya gerek kalmaz.

**Maliyet: 0.** GitHub, kişi başına bir "makine hesabı"na izin verir; ücretsiz hesap yeterlidir.

Adımlar:
1. Yeni bir GitHub hesabı açın (ör. `nbpdf-bot`). E-posta: kendi adresinizin artı takısı (`ad+bot@gmail.com`) ya da ayrı bir adres.
2. Bu hesapta iki adımlı doğrulamayı açın.
3. Depo → Settings → Collaborators → bot hesabını **Write** yetkisiyle ekleyin (Admin vermeyin). Botun daveti kabul etmesi gerekir.
4. Bot hesabıyla Settings → Developer settings → Fine-grained tokens → yeni anahtar: yalnızca bu depo, izinler: Contents = Read and write, Pull requests = Read and write, Metadata = Read. Süre: 90 gün. Anahtarı bana yazmayın; yalnızca yapay zekâ ortamının gizli ayarına siz koyarsınız.
5. Ruleset'te (kurulum bittikten SONRA, siz onaylayınca) "Require review from Code Owners" açılır. Bot PR açar, siz onaylar ve birleştirirsiniz.

Dikkat: Kendi (burakayax) açtığınız PR'larda kritik dosya varsa onları artık botun onaylayabilmesi gerekir; bu yüzden kritik dosya değişikliklerini de bot üzerinden açmak en sorunsuzu. Bu kural kurulana kadar açılmaz.

## 2) Gecelik özet: ayrı R2 deposu + salt-okunur anahtar

Tasarım: `gecelik-ozet-tasarimi.md`. Özet dosyası uygulamanın kendi deposundan ayrı bir kovaya yazılır; okuyan taraf yalnızca okuma anahtarı alır.

1. Cloudflare paneli → R2 Object Storage → **Create bucket**: ad `nb-gecelik-ozet` (mevcut dosya kovasından ayrı).
2. R2 → Manage API Tokens → Create API token: izin **Object Read only**, kapsam yalnızca `nb-gecelik-ozet`. Oluşan Access Key ID ve Secret'i sadece Render'daki ilgili servisin ortam değişkenine kendiniz yapıştırın.
3. Yazma anahtarı ayrıdır (**Object Read & Write**, aynı kova) ve yalnızca özeti üreten Render işine verilir.

Maliyet: R2'nin ücretsiz katmanı (aylık 10 GB depolama) bu boyut için yeter; özet birkaç KB. Hesapta ödeme yöntemi istenebilir, kurmadan önce Cloudflare'in güncel koşulunu teyit edin.

## 3) Çalışma ortamı kurulumu ve aylık maliyet tahmini

Kararınız: sabit işler → GitHub Actions + Render gecelik iş; yorum gerektiren işler → bulut Claude Code.

| Parça | Kurulum | Aylık tahmini maliyet |
|---|---|---|
| GitHub Actions zamanlanmış kontroller | `.github/workflows` altına zamanlanmış iş (PR ile) | 0 (depo açıkken) |
| Render gecelik iş (özet üretimi) | Render'da "Cron Job" servisi; ücretsiz planda cron yok | Ücretli plan gerekir. Render'ın güncel cron fiyatını panelden görüp onaylayın (tahmin: ayda birkaç dolar) |
| Bulut Claude Code (sabah yorumu) | Anthropic hesabında zamanlanmış görev; yalnızca depo + salt-okunur özet erişimi | Abonelik kullanım limitinden düşer; ek ücret planınıza bağlı |
| Cloudflare R2 (ayrı kova) | Bölüm 2 | ~0 |
| Bot hesabı | Bölüm 1 | 0 |

Toplam: büyük olasılıkla **0 – birkaç dolar/ay** (asıl kalem Render cron). Render cron'u açmadan önce onayınız istenecek.

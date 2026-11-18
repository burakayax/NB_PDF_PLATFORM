# Yapay Zekâ Ekibi — Yol Haritası

Son güncelleme: 2026-11-18 (akşam). Durum işaretleri: ✅ bitti · 🔄 devam · ⬜ başlanmadı.
Bu belge her adımda güncellenir. Kodu değiştiren her iş ayrı dalda pull request ile gider; canlıya çıkış (birleştirme) yalnızca proje sahibinin açık onayıyla yapılır.

## Değişmez kurallar

- `main` dalına doğrudan push yok. Dal → pull request → CI yeşil → sahibin "birleştir" demesi.
- Ödeme, giriş/yetki, kullanıcı verisi, veritabanı şeması, fiyat/plan ve KVKK/yasal dosyalara sahibin onayı olmadan dokunulmaz.
- Anahtar ve şifre değerleri hiçbir belgeye, mesaja veya rapora yazılmaz.

## Aşama 0 — Temel güvenlik (durum kontrolü)

| Madde | Durum | Not |
|---|---|---|
| Veri kaybı riski: `db push --accept-data-loss` yerine güvenli güncelleme | ✅ | PR #72, 2026-11-17 canlıda. Deploy artık `scripts/prod-db-migrate.mjs` çalıştırıyor; uyumsuzlukta deploy durur, eski sürüm ayakta kalır. |
| `main` dalı koruması (PR zorunlu, 6 zorunlu CI, doğrudan push ve silme yasak) | ✅ | Kural "main koruma". Bypass listesi boş. |
| Eski ölü zorunlu kontrolün ("Frontend Build Check") kaldırılması | ✅ | |
| Yeni "PostgreSQL Migration Check" kontrolünü zorunlu listeye ekleme | ⬜ | Şu an yalnız deploy öncesi şart; birleştirme şartı değil. Sahibin onayını bekliyor. |
| Render'da veritabanı yedeği | 🔄 | Sahibi elle yedek aldı (2026-11-17) ve Render'ın 3 günlük geri dönüşünü doğruladı. Otomatik yedeğin son tarihi her ay kontrol edilmeli. |
| UptimeRobot dışarıdan çalışma kontrolü | 🔄 | Sahibi 3 adres ekledi (/api/health, /api/health/db, pdfplatform.app). **Adreslerin `api.pdfplatform.app` ile başlaması gerekir**; `pdfplatform.app/api/...` site sayfası döndürüyor. Öneriler: PR #79. |
| Render'da önceki sürüme dönme kılavuzu | 🔄 | Yeni RB-11 yazıldı, PR #75 birleştirme onayında. |

## Aşama 1 — Güvenlik ağı

| Madde | Durum |
|---|---|
| Test ortamı | 🔄 Ücretli staging yok (karar). Ücretsiz seçenekler öneri olarak yazıldı: PR #76 |
| Kritik dosyalar için sahip onayı kuralı (CODEOWNERS) | 🔄 Dosya PR #74'te. Ana dal kuralına "kod sahibi onayı" bağlama sahibin kararını bekliyor (tek kişilik depoda kendi PR'ını onaylayamama sorunu var). |
| Geri alma prosedürünün Render'a göre yazılması (RB-11) | 🔄 PR #75 |
| Python test kapsamı: ödeme ve plan akışları için ilk 5 test | ⬜ |

## Aşama 2 — Yapay zekâ için salt okunur rapor kapısı

| Madde | Durum |
|---|---|
| Tasarım: **gecelik özet belgesi** yöntemi seçildi (uç açılmayacak). Sayı listesi ve doğrulama kontrolü: PR #77 | 🔄 Onay bekliyor |
| Özet içeriği: trafik/araç kullanımı, gelir/abonelik/iptal, hata özeti, site sağlığı, Search Console özeti | ⬜ Kod yazılmadı |
| Belge saklama (ayrı kova + salt okunur anahtar) ve doğrulama | ⬜ Sahibin onayı gerekli |

## Çalışma ortamı kararı (siz bilgisayar başında değilken)

- Seçenekler karşılaştırıldı: PR #80. Öneri: kendi bilgisayarı 7/24 açık bırakmamak; sabit işler GitHub Actions + Render içi gece işi, yorum gerektiren işler bulutta çalışan Claude Code. Karar sahibinde.

## Aşama 3 — Zamanlanmış rapor görevleri (taslak, sahibin onayıyla netleşecek)

| Madde | Durum |
|---|---|
| Günlük/haftalık özet rapor (yalnız okur, hiçbir şey değiştirmez) | ⬜ |
| Raporların sahibe e-posta/panel ile iletilmesi | ⬜ |

## Aşama 4 — Öneri üreten ajanlar (taslak)

| Madde | Durum |
|---|---|
| Ajan yalnız dal + pull request açar; birleştirmez, canlıya çıkarmaz | ⬜ |
| Her pull request'te CI yeşil kanıtı ve sade Türkçe özet zorunlu | ⬜ |

## Aşama 5 — Kontrollü otomasyon (taslak)

| Madde | Durum |
|---|---|
| Düşük riskli işlerde (metin, SEO, blog) hızlandırılmış inceleme | ⬜ |
| Ödeme/giriş/şema/fiyat/yasal alanlar her zaman insan onayında kalır | ⬜ |

## Sistemin en kırılgan 5 noktası (2026-11-18)

1. **Canlı veritabanı (Render Postgres):** tek veritabanı; yedek ve geri dönüş Render'ın 3 günlük penceresine bağlı. Test ortamı yok.
2. **Deploy = birleştirme:** `main`'e giren her şey, CI yeşilse otomatik canlıya çıkar. Birleştirme onayı tek koruma.
3. **Her deploy'da çalışan seed:** inceleme sonucu (PR #78): yeni "Limitler" sekmesi korunuyor; eski yoldan (`plansOverride.dailyLimit`) yazılan limit geri dönebilir. Düzeltme sahibinin onayını bekliyor.
4. **Ödeme sağlayıcıları (PayTR, iyzico) ve fatura (BirFatura):** dış servis, canlı anahtarlarla çalışıyor; sandbox ile canlı arasında test ortamı yok.
5. **Tek kişilik süreç:** hata anında Render panelini bilen tek kişi var; geri alma kılavuzu eski.

## Açık PR'lar (sahibin onayını bekliyor)

| PR | Konu |
|---|---|
| #74 | CODEOWNERS |
| #75 | Render geri alma rehberi (RB-11) |
| #76 | Ücretsiz test ortamı seçenekleri |
| #77 | Gecelik özet tasarımı |
| #78 | Seed ve panel limitleri incelemesi |
| #79 | UptimeRobot adresleri / derin sağlık adresi önerisi |
| #80 | Bilgisayar başında değilken çalışma seçenekleri |

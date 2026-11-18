# Yapay Zekâ Ekibi — Yol Haritası

Son güncelleme: 2026-11-18. Durum işaretleri: ✅ bitti · 🔄 devam · ⬜ başlanmadı.
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
| Yeni "PostgreSQL Migration Check" kontrolünü zorunlu listeye ekleme | ⬜ | Şu an yalnız deploy öncesi şart; birleştirme şartı değil. |
| Render'da veritabanı yedeği | 🔄 | Sahibi elle yedek aldı (2026-11-17) ve Render'ın 3 günlük geri dönüşünü doğruladı. Otomatik yedeğin son tarihi her ay kontrol edilmeli. |
| UptimeRobot dışarıdan çalışma kontrolü | ⬜ | Kod/belgede anılıyor ama kurulduğu doğrulanmadı. |
| Render'da önceki sürüme dönme kılavuzu | ⬜ | `docs/runbooks/RB-11-deployment-broken.md` eski, kendi sunucusu (systemctl) için yazılmış; Render'a göre yeniden yazılacak. |

## Aşama 1 — Güvenlik ağı

| Madde | Durum |
|---|---|
| Test (staging) ortamı | ⬜ Plan hazır, onay bekliyor |
| Kritik dosyalar için sahip onayı kuralı (CODEOWNERS) | ⬜ |
| Geri alma prosedürünün Render'a göre yazılması (RB-11) | ⬜ |
| Python test kapsamı: ödeme ve plan akışları için ilk 5 test | ⬜ |

## Aşama 2 — Yapay zekâ için salt okunur rapor kapısı

| Madde | Durum |
|---|---|
| Tasarım (yalnız özet sayılar, ayrı iptal edilebilir anahtar, kayıt, istek sınırı) | 🔄 Taslak sahibin onayında |
| Rapor uçları: trafik/araç kullanımı, gelir/abonelik/iptal, hata özeti, site sağlığı, Search Console özeti | ⬜ |
| Anahtar iptal denemesi ve kayıt denetimi | ⬜ |

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
3. **Her deploy'da çalışan seed:** plan limitlerini koddaki değerlere geri çeker; panelden elle değişen günlük limit geri dönebilir.
4. **Ödeme sağlayıcıları (PayTR, iyzico) ve fatura (BirFatura):** dış servis, canlı anahtarlarla çalışıyor; sandbox ile canlı arasında test ortamı yok.
5. **Tek kişilik süreç:** hata anında Render panelini bilen tek kişi var; geri alma kılavuzu eski.

## Not: Panelden medya yükleme

Panelden medya yüklemeden önce `MEDIA_STORAGE=s3` ve kalıcı bir medya kovası kurulmalı; aksi halde yüklenen dosyalar her deploy'da silinir.

## Not: Eski depo kovasi silinecek

Eski R2 hesabındaki kova, taşıma tarihinden (18 Kasım 2026) 7 gün sonra, **25 Kasım 2026** tarihinde silinecek. Eski S3 değerleri o tarihe kadar saklanıyor (geri dönüş için).
